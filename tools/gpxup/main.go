package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/tkrajina/gpxgo/gpx"
)

func main() {
	apiRoot := flag.String("api-root", "http://localhost:8090", "API root URL")
	user := flag.String("user", "", "Username")
	token := flag.String("token", "", "Token")
	session := flag.String("session", "", "Session name (defaults to GPX file name without extension)")
	flag.Parse()

	if len(flag.Args()) == 0 {
		fmt.Println("Usage: gpxup [flags] <file.gpx>")
		fmt.Println("A tool to parse and upload a GPX file to the Vibe Tracker API.")
		fmt.Println("\nFlags:")
		flag.PrintDefaults()
		return
	}

	if *user == "" || *token == "" {
		log.Fatal("User and token are required")
	}

	if len(flag.Args()) != 1 {
		log.Fatal("Only one GPX file can be provided at a time.")
	}

	gpxFile := flag.Arg(0)

	if *session == "" {
		*session = strings.TrimSuffix(filepath.Base(gpxFile), filepath.Ext(gpxFile))
	}

	gpxBytes, err := ioutil.ReadFile(gpxFile)
	if err != nil {
		log.Fatalf("Error reading GPX file: %v", err)
	}

	gpxData, err := gpx.ParseBytes(gpxBytes)
	if err != nil {
		log.Fatalf("Error parsing GPX file: %v", err)
	}

	for _, track := range gpxData.Tracks {
		for _, segment := range track.Segments {
			for _, point := range segment.Points {
				u := fmt.Sprintf("%s/api/track", *apiRoot)
				v := url.Values{}
				v.Set("token", *token)
				v.Set("user", *user)
				v.Set("session", *session)
				v.Set("latitude", fmt.Sprintf("%f", point.Latitude))
				v.Set("longitude", fmt.Sprintf("%f", point.Longitude))
				if point.Elevation.NotNull() {
					v.Set("altitude", fmt.Sprintf("%f", point.Elevation.Value()))
				}
				v.Set("timestamp", fmt.Sprintf("%d", point.Timestamp.Unix()))
				
				// Extract heart rate from extensions if available
				if hrValue := extractHeartRate(point); validateHeartRate(hrValue) {
					v.Set("heart_rate", hrValue)
				}
				
				// Extract speed from extensions if available
				if speedValue := extractSpeed(point); validateSpeed(speedValue) {
					v.Set("speed", speedValue)
				}

				fullURL := fmt.Sprintf("%s?%s", u, v.Encode())
				req, err := http.NewRequest("GET", fullURL, nil)
				if err != nil {
					log.Printf("Error creating request: %v", err)
					continue
				}

				client := &http.Client{}
				resp, err := client.Do(req)
				if err != nil {
					log.Printf("Error uploading point: %v", err)
					continue
				}
				defer resp.Body.Close()

				if resp.StatusCode != http.StatusOK {
					body, _ := ioutil.ReadAll(resp.Body)
					log.Printf("Error uploading point: %s - %s", resp.Status, string(body))
				}

				time.Sleep(100 * time.Millisecond) // Avoid overwhelming the server
			}
		}
	}

	fmt.Println("GPX data uploaded successfully")
}

// extractHeartRate extracts heart rate from GPX TrackPointExtension
func extractHeartRate(point gpx.GPXPoint) string {
	// Try Garmin TrackPointExtension format
	if tpeNode, found := point.Extensions.GetNode("http://www.garmin.com/xmlschemas/TrackPointExtension/v1", "TrackPointExtension"); found {
		if hrNode, found := tpeNode.GetNode("hr"); found {
			return hrNode.Data
		}
	}
	
	// Try alternative namespace (some devices use different schemas)
	if tpeNode, found := point.Extensions.GetNode("http://www.garmin.com/xmlschemas/TrackPointExtension/v2", "TrackPointExtension"); found {
		if hrNode, found := tpeNode.GetNode("hr"); found {
			return hrNode.Data
		}
	}
	
	return ""
}

// extractSpeed extracts speed from GPX TrackPointExtension
func extractSpeed(point gpx.GPXPoint) string {
	// Try Garmin TrackPointExtension format
	if tpeNode, found := point.Extensions.GetNode("http://www.garmin.com/xmlschemas/TrackPointExtension/v1", "TrackPointExtension"); found {
		if speedNode, found := tpeNode.GetNode("speed"); found {
			return speedNode.Data
		}
	}
	
	// Try alternative namespace (some devices use different schemas)
	if tpeNode, found := point.Extensions.GetNode("http://www.garmin.com/xmlschemas/TrackPointExtension/v2", "TrackPointExtension"); found {
		if speedNode, found := tpeNode.GetNode("speed"); found {
			return speedNode.Data
		}
	}
	
	// If no speed in extensions, calculate it from GPS data if possible
	// Note: This would require access to previous point for calculation
	return ""
}

// validateHeartRate validates heart rate value is reasonable (0-300 bpm)
func validateHeartRate(hrStr string) bool {
	if hrStr == "" {
		return false
	}
	hr, err := strconv.Atoi(hrStr)
	if err != nil {
		return false
	}
	return hr > 0 && hr <= 300
}

// validateSpeed validates speed value is reasonable (>= 0 m/s)
func validateSpeed(speedStr string) bool {
	if speedStr == "" {
		return false
	}
	speed, err := strconv.ParseFloat(speedStr, 64)
	if err != nil {
		return false
	}
	return speed >= 0
}
