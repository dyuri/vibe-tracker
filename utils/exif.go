package utils

import (
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/mknote"
)

// PhotoEXIFData contains extracted EXIF data from a photo
type PhotoEXIFData struct {
	HasGPS      bool
	Latitude    *float64
	Longitude   *float64
	Altitude    *float64
	Timestamp   *time.Time
	Make        string
	Model       string
	Orientation int
}

// ExtractEXIFData extracts EXIF data from a photo, focusing on GPS information
func ExtractEXIFData(reader io.Reader) (*PhotoEXIFData, error) {
	// Register known camera manufacturers for maker notes
	exif.RegisterParsers(mknote.All...)

	// Decode EXIF data
	x, err := exif.Decode(reader)
	if err != nil {
		// If EXIF decoding fails, return empty data (not an error)
		return &PhotoEXIFData{HasGPS: false}, nil
	}

	data := &PhotoEXIFData{}

	// Extract GPS coordinates
	lat, lon, err := extractGPSCoordinates(x)
	if err == nil && lat != nil && lon != nil {
		data.HasGPS = true
		data.Latitude = lat
		data.Longitude = lon
	}

	// Extract GPS altitude
	if alt, err := extractGPSAltitude(x); err == nil && alt != nil {
		data.Altitude = alt
	}

	// Extract timestamp
	if timestamp, err := extractTimestamp(x); err == nil {
		data.Timestamp = timestamp
	}

	// Extract camera information
	data.Make = extractStringField(x, exif.Make)
	data.Model = extractStringField(x, exif.Model)

	// Extract orientation
	if orientation, err := extractIntField(x, exif.Orientation); err == nil {
		data.Orientation = orientation
	} else {
		data.Orientation = 1 // Default orientation
	}

	return data, nil
}

// extractGPSCoordinates extracts latitude and longitude from EXIF data
func extractGPSCoordinates(x *exif.Exif) (*float64, *float64, error) {
	// Get GPS latitude
	latTag, err := x.Get(exif.GPSLatitude)
	if err != nil {
		return nil, nil, fmt.Errorf("no GPS latitude found: %v", err)
	}

	latRefTag, err := x.Get(exif.GPSLatitudeRef)
	if err != nil {
		return nil, nil, fmt.Errorf("no GPS latitude reference found: %v", err)
	}

	// Get GPS longitude
	lonTag, err := x.Get(exif.GPSLongitude)
	if err != nil {
		return nil, nil, fmt.Errorf("no GPS longitude found: %v", err)
	}

	lonRefTag, err := x.Get(exif.GPSLongitudeRef)
	if err != nil {
		return nil, nil, fmt.Errorf("no GPS longitude reference found: %v", err)
	}

	// Parse latitude
	lat, err := parseGPSCoordinate(latTag.String())
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse latitude: %v", err)
	}

	// Apply latitude reference (N/S)
	latRef, err := latRefTag.StringVal()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get latitude reference: %v", err)
	}
	if strings.ToUpper(latRef) == "S" {
		lat = -lat
	}

	// Parse longitude
	lon, err := parseGPSCoordinate(lonTag.String())
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse longitude: %v", err)
	}

	// Apply longitude reference (E/W)
	lonRef, err := lonRefTag.StringVal()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get longitude reference: %v", err)
	}
	if strings.ToUpper(lonRef) == "W" {
		lon = -lon
	}

	// Validate coordinates
	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return nil, nil, fmt.Errorf("invalid GPS coordinates: lat=%f, lon=%f", lat, lon)
	}

	return &lat, &lon, nil
}

// extractGPSAltitude extracts altitude from EXIF data
func extractGPSAltitude(x *exif.Exif) (*float64, error) {
	altTag, err := x.Get(exif.GPSAltitude)
	if err != nil {
		return nil, fmt.Errorf("no GPS altitude found: %v", err)
	}

	altRefTag, _ := x.Get(exif.GPSAltitudeRef)
	// Altitude reference is optional, assume above sea level if not present

	// Parse altitude (typically stored as a rational number)
	altStr := altTag.String()
	alt, err := parseRationalString(altStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse altitude: %v", err)
	}

	// Apply altitude reference if available
	if altRefTag != nil {
		if ref, err := altRefTag.Int(0); err == nil && ref == 1 {
			// 1 means below sea level
			alt = -alt
		}
	}

	return &alt, nil
}

// extractTimestamp extracts the photo timestamp from EXIF data
func extractTimestamp(x *exif.Exif) (*time.Time, error) {
	// Try different timestamp fields in order of preference
	timestampFields := []exif.FieldName{
		exif.DateTimeOriginal,
		exif.DateTimeDigitized,
		exif.DateTime,
	}

	for _, field := range timestampFields {
		if tag, err := x.Get(field); err == nil {
			if timeStr, err := tag.StringVal(); err == nil {
				// Parse EXIF datetime format: "2006:01:02 15:04:05"
				if parsedTime, err := time.Parse("2006:01:02 15:04:05", timeStr); err == nil {
					return &parsedTime, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("no valid timestamp found in EXIF data")
}

// extractStringField extracts a string field from EXIF data
func extractStringField(x *exif.Exif, field exif.FieldName) string {
	if tag, err := x.Get(field); err == nil {
		if val, err := tag.StringVal(); err == nil {
			return strings.TrimSpace(val)
		}
	}
	return ""
}

// extractIntField extracts an integer field from EXIF data
func extractIntField(x *exif.Exif, field exif.FieldName) (int, error) {
	if tag, err := x.Get(field); err == nil {
		if val, err := tag.Int(0); err == nil {
			return val, nil
		}
	}
	return 0, fmt.Errorf("field not found or not an integer")
}

// parseGPSCoordinate parses GPS coordinate from EXIF format
// Format is typically: "deg/1,min/1,sec/100" representing degrees, minutes, seconds
func parseGPSCoordinate(coordStr string) (float64, error) {
	// Remove quotes and clean up the string
	coordStr = strings.Trim(coordStr, "\"")

	// Split by comma to get degrees, minutes, seconds
	parts := strings.Split(coordStr, ",")
	if len(parts) != 3 {
		return 0, fmt.Errorf("invalid GPS coordinate format: %s", coordStr)
	}

	// Parse degrees
	degrees, err := parseRationalString(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, fmt.Errorf("failed to parse degrees: %v", err)
	}

	// Parse minutes
	minutes, err := parseRationalString(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, fmt.Errorf("failed to parse minutes: %v", err)
	}

	// Parse seconds
	seconds, err := parseRationalString(strings.TrimSpace(parts[2]))
	if err != nil {
		return 0, fmt.Errorf("failed to parse seconds: %v", err)
	}

	// Convert to decimal degrees
	decimal := degrees + minutes/60.0 + seconds/3600.0

	return decimal, nil
}

// parseRationalString parses a rational number string like "123/456"
func parseRationalString(rational string) (float64, error) {
	rational = strings.TrimSpace(rational)

	if strings.Contains(rational, "/") {
		parts := strings.Split(rational, "/")
		if len(parts) != 2 {
			return 0, fmt.Errorf("invalid rational format: %s", rational)
		}

		numerator, err := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		if err != nil {
			return 0, fmt.Errorf("failed to parse numerator: %v", err)
		}

		denominator, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		if err != nil {
			return 0, fmt.Errorf("failed to parse denominator: %v", err)
		}

		if denominator == 0 {
			return 0, fmt.Errorf("division by zero in rational: %s", rational)
		}

		return numerator / denominator, nil
	} else {
		// It's already a decimal number
		return strconv.ParseFloat(rational, 64)
	}
}

// IsValidImageFormat checks if the file format is supported for EXIF extraction
func IsValidImageFormat(filename, contentType string) bool {
	filename = strings.ToLower(filename)
	contentType = strings.ToLower(contentType)

	// Check file extensions
	supportedExtensions := []string{".jpg", ".jpeg", ".tiff", ".tif"}
	for _, ext := range supportedExtensions {
		if strings.HasSuffix(filename, ext) {
			return true
		}
	}

	// Check content types
	supportedTypes := []string{
		"image/jpeg",
		"image/jpg",
		"image/tiff",
		"image/tif",
	}
	for _, mimeType := range supportedTypes {
		if contentType == mimeType {
			return true
		}
	}

	return false
}

// GetFallbackPosition determines a fallback position for a photo based on the intelligent strategy
func GetFallbackPosition(sessionID string, photoTimestamp *time.Time, app interface{}) (*float64, *float64, *float64, string, error) {
	// This would need to be implemented based on your specific needs
	// For now, return an error indicating no fallback is available
	return nil, nil, nil, "manual", fmt.Errorf("fallback positioning not yet implemented")
}

// TODO: Implement the intelligent fallback positioning logic
// This should include:
// 1. Time-based proximity matching with tracked locations
// 2. End of tracked locations for current session
// 3. End of GPX track for current session
// 4. Last known location from user's history
// 5. Manual placement as final fallback
