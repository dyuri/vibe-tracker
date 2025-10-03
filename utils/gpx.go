package utils

import (
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

// GPX represents the root element of a GPX file
type GPX struct {
	XMLName  xml.Name `xml:"gpx"`
	Version  string   `xml:"version,attr"`
	Creator  string   `xml:"creator,attr"`
	Metadata struct {
		Name        string `xml:"name"`
		Description string `xml:"desc"`
		Time        string `xml:"time"`
	} `xml:"metadata"`
	Tracks    []GPXTrack    `xml:"trk"`
	Waypoints []GPXWaypoint `xml:"wpt"`
}

// GPXTrack represents a track in the GPX file
type GPXTrack struct {
	Name        string       `xml:"name"`
	Description string       `xml:"desc"`
	Segments    []GPXSegment `xml:"trkseg"`
}

// GPXSegment represents a track segment
type GPXSegment struct {
	Points []GPXTrackPoint `xml:"trkpt"`
}

// GPXTrackPoint represents a track point
type GPXTrackPoint struct {
	Latitude  float64  `xml:"lat,attr"`
	Longitude float64  `xml:"lon,attr"`
	Elevation *float64 `xml:"ele,omitempty"`
	Time      string   `xml:"time,omitempty"`
}

// GPXWaypoint represents a waypoint in the GPX file
type GPXWaypoint struct {
	Latitude    float64  `xml:"lat,attr"`
	Longitude   float64  `xml:"lon,attr"`
	Elevation   *float64 `xml:"ele,omitempty"`
	Time        string   `xml:"time,omitempty"`
	Name        string   `xml:"name"`
	Description string   `xml:"desc"`
	Type        string   `xml:"type"`
	Symbol      string   `xml:"sym"`
}

// ParsedGPXData contains the processed GPX data ready for database storage
type ParsedGPXData struct {
	TrackName        string
	TrackDescription string
	TrackPoints      []ParsedTrackPoint
	Waypoints        []ParsedWaypoint
}

// ParsedTrackPoint represents a track point ready for database storage
type ParsedTrackPoint struct {
	Latitude  float64
	Longitude float64
	Altitude  *float64
	Sequence  int
}

// ParsedWaypoint represents a waypoint ready for database storage
type ParsedWaypoint struct {
	Name               string
	Type               string
	Description        string
	Latitude           float64
	Longitude          float64
	Altitude           *float64
	Source             string
	PositionConfidence string
}

// ParseGPX parses a GPX file from an io.Reader and returns structured data
func ParseGPX(reader io.Reader) (*ParsedGPXData, error) {
	// Read the GPX data
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read GPX data: %v", err)
	}

	// Parse XML
	var gpx GPX
	if err := xml.Unmarshal(data, &gpx); err != nil {
		return nil, fmt.Errorf("failed to parse GPX XML: %v", err)
	}

	// Validate GPX version
	if gpx.Version == "" {
		return nil, fmt.Errorf("invalid GPX file: missing version")
	}

	// Extract track data
	parsed := &ParsedGPXData{
		TrackName:        extractTrackName(&gpx),
		TrackDescription: extractTrackDescription(&gpx),
		TrackPoints:      extractTrackPoints(&gpx),
		Waypoints:        extractWaypoints(&gpx),
	}

	return parsed, nil
}

// extractTrackName gets the track name from GPX metadata or first track
func extractTrackName(gpx *GPX) string {
	// Try metadata name first
	if gpx.Metadata.Name != "" {
		return strings.TrimSpace(gpx.Metadata.Name)
	}

	// Try first track name
	if len(gpx.Tracks) > 0 && gpx.Tracks[0].Name != "" {
		return strings.TrimSpace(gpx.Tracks[0].Name)
	}

	return "Imported Track"
}

// extractTrackDescription gets the track description from GPX metadata or first track
func extractTrackDescription(gpx *GPX) string {
	// Try metadata description first
	if gpx.Metadata.Description != "" {
		return strings.TrimSpace(gpx.Metadata.Description)
	}

	// Try first track description
	if len(gpx.Tracks) > 0 && gpx.Tracks[0].Description != "" {
		return strings.TrimSpace(gpx.Tracks[0].Description)
	}

	return ""
}

// extractTrackPoints processes all track points from all tracks and segments
func extractTrackPoints(gpx *GPX) []ParsedTrackPoint {
	var points []ParsedTrackPoint
	sequence := 0

	for _, track := range gpx.Tracks {
		for _, segment := range track.Segments {
			for _, point := range segment.Points {
				// Validate coordinates
				if !isValidCoordinate(point.Latitude, point.Longitude) {
					continue
				}

				parsedPoint := ParsedTrackPoint{
					Latitude:  point.Latitude,
					Longitude: point.Longitude,
					Sequence:  sequence,
				}

				// Add elevation if present and valid
				if point.Elevation != nil && *point.Elevation != 0 {
					parsedPoint.Altitude = point.Elevation
				}

				points = append(points, parsedPoint)
				sequence++
			}
		}
	}

	return points
}

// extractWaypoints processes all waypoints from the GPX file
func extractWaypoints(gpx *GPX) []ParsedWaypoint {
	var waypoints []ParsedWaypoint

	for _, wp := range gpx.Waypoints {
		// Validate coordinates
		if !isValidCoordinate(wp.Latitude, wp.Longitude) {
			continue
		}

		// Determine waypoint type from GPX symbol or type
		waypointType := mapGPXTypeToWaypointType(wp.Type, wp.Symbol)

		waypoint := ParsedWaypoint{
			Name:               getWaypointName(wp),
			Type:               waypointType,
			Description:        strings.TrimSpace(wp.Description),
			Latitude:           wp.Latitude,
			Longitude:          wp.Longitude,
			Source:             "gpx",
			PositionConfidence: "gps",
		}

		// Add elevation if present and valid
		if wp.Elevation != nil && *wp.Elevation != 0 {
			waypoint.Altitude = wp.Elevation
		}

		waypoints = append(waypoints, waypoint)
	}

	return waypoints
}

// getWaypointName extracts a name for the waypoint, with fallbacks
func getWaypointName(wp GPXWaypoint) string {
	name := strings.TrimSpace(wp.Name)
	if name != "" {
		return name
	}

	// Generate name from type/symbol if no name provided
	if wp.Type != "" {
		return fmt.Sprintf("Waypoint (%s)", wp.Type)
	}
	if wp.Symbol != "" {
		return fmt.Sprintf("Waypoint (%s)", wp.Symbol)
	}

	return "Unnamed Waypoint"
}

// mapGPXTypeToWaypointType maps GPX waypoint types/symbols to our internal types
func mapGPXTypeToWaypointType(gpxType, symbol string) string {
	// Convert to lowercase for case-insensitive matching
	gpxType = strings.ToLower(strings.TrimSpace(gpxType))
	symbol = strings.ToLower(strings.TrimSpace(symbol))

	// Map common GPX types and Garmin symbols to our waypoint types
	typeMap := map[string]string{
		// Food related
		"restaurant": "food",
		"food":       "food",
		"cafe":       "food",
		"bar":        "food",

		// Water related
		"water":    "water",
		"fountain": "water",
		"spring":   "water",

		// Shelter related
		"lodging":    "shelter",
		"hotel":      "shelter",
		"camping":    "camping",
		"campground": "camping",
		"hut":        "shelter",

		// Transportation
		"parking":   "parking",
		"trailhead": "parking",
		"airport":   "transition",
		"bus_stop":  "transition",

		// Points of interest
		"summit":    "viewpoint",
		"peak":      "viewpoint",
		"viewpoint": "viewpoint",

		// Safety
		"danger":   "danger",
		"warning":  "danger",
		"hospital": "medical",
		"medical":  "medical",

		// Fuel
		"gas":         "fuel",
		"fuel":        "fuel",
		"gas_station": "fuel",
	}

	// Try type first, then symbol
	if mapped, ok := typeMap[gpxType]; ok {
		return mapped
	}
	if mapped, ok := typeMap[symbol]; ok {
		return mapped
	}

	// Default to generic
	return "generic"
}

// isValidCoordinate checks if latitude and longitude are within valid ranges
func isValidCoordinate(lat, lon float64) bool {
	return lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0 &&
		lat != 0.0 && lon != 0.0 // Exclude null island (0,0)
}

// SimplifyTrack applies the Ramer-Douglas-Peucker algorithm to simplify a track
func SimplifyTrack(points []ParsedTrackPoint, epsilon float64) []ParsedTrackPoint {
	if len(points) <= 2 {
		return points
	}

	return ramerDouglasPeucker(points, epsilon)
}

// ramerDouglasPeucker implements the Ramer-Douglas-Peucker algorithm
func ramerDouglasPeucker(points []ParsedTrackPoint, epsilon float64) []ParsedTrackPoint {
	if len(points) <= 2 {
		return points
	}

	// Find the point with the maximum distance from the line segment
	maxDistance := 0.0
	maxIndex := 0

	start := points[0]
	end := points[len(points)-1]

	for i := 1; i < len(points)-1; i++ {
		distance := perpendicularDistance(points[i], start, end)
		if distance > maxDistance {
			maxDistance = distance
			maxIndex = i
		}
	}

	// If the maximum distance is greater than epsilon, recursively simplify
	if maxDistance > epsilon {
		// Recursive call on the first part
		leftResults := ramerDouglasPeucker(points[:maxIndex+1], epsilon)

		// Recursive call on the second part
		rightResults := ramerDouglasPeucker(points[maxIndex:], epsilon)

		// Combine results (remove duplicate middle point)
		result := make([]ParsedTrackPoint, 0, len(leftResults)+len(rightResults)-1)
		result = append(result, leftResults...)
		result = append(result, rightResults[1:]...)

		return result
	}

	// If the maximum distance is less than epsilon, return only the endpoints
	return []ParsedTrackPoint{start, end}
}

// perpendicularDistance calculates the perpendicular distance from a point to a line segment
func perpendicularDistance(point, lineStart, lineEnd ParsedTrackPoint) float64 {
	// Convert to approximate Cartesian coordinates (good enough for small distances)
	px, py := point.Longitude, point.Latitude
	x1, y1 := lineStart.Longitude, lineStart.Latitude
	x2, y2 := lineEnd.Longitude, lineEnd.Latitude

	// Calculate the distance from point to line segment
	A := px - x1
	B := py - y1
	C := x2 - x1
	D := y2 - y1

	dot := A*C + B*D
	lenSq := C*C + D*D

	if lenSq == 0 {
		// Line segment is actually a point
		dx := px - x1
		dy := py - y1
		return dx*dx + dy*dy
	}

	param := dot / lenSq

	var xx, yy float64
	if param < 0 {
		xx, yy = x1, y1
	} else if param > 1 {
		xx, yy = x2, y2
	} else {
		xx = x1 + param*C
		yy = y1 + param*D
	}

	dx := px - xx
	dy := py - yy
	return dx*dx + dy*dy
}

// CalculateSimplificationEpsilon suggests an appropriate epsilon value based on track characteristics
func CalculateSimplificationEpsilon(points []ParsedTrackPoint) float64 {
	if len(points) < 10 {
		return 0 // Don't simplify very short tracks
	}

	// Calculate average distance between consecutive points
	totalDistance := 0.0
	for i := 1; i < len(points); i++ {
		dx := points[i].Longitude - points[i-1].Longitude
		dy := points[i].Latitude - points[i-1].Latitude
		totalDistance += dx*dx + dy*dy
	}

	avgDistance := totalDistance / float64(len(points)-1)

	// Base epsilon on track density and length
	baseEpsilon := avgDistance * 0.1 // 10% of average point spacing

	// Adjust based on total track length
	if len(points) > 1000 {
		return baseEpsilon * 2.0 // More aggressive simplification for long tracks
	} else if len(points) > 500 {
		return baseEpsilon * 1.5
	}

	return baseEpsilon
}
