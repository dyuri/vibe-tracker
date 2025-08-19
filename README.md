# Vibe Tracker

A comprehensive location tracker web application built with Go, PocketBase, and Leaflet.js. Track your journeys, manage sessions, and share your adventures with others.

![Vibe Tracker Screenshot](vibe-tracker.jpg)

## Features

*   **User Authentication:** Secure login system with JWT tokens and refresh tokens
*   **Session-based Tracking:** Organize location data into named sessions for different trips or activities
*   **Location Tracking:** Track location data (latitude, longitude, altitude, speed, heart rate) via API
*   **Public Sharing:** Share your location data publicly with customizable privacy settings
*   **Profile Management:** User profiles with avatar upload and token regeneration
*   **Multiple Interfaces:** 
    *   Real-time map view for tracking
    *   Profile management interface
    *   Session management dashboard
*   **Comprehensive API:** 16+ endpoints for location tracking, session management, and user operations
*   **PocketBase Backend:** Uses PocketBase as a self-contained backend with automatic migrations

## Getting Started

1.  **Prerequisites:**
    *   Go (1.23+)

2.  **Installation:**
    ```bash
    go mod tidy
    ```

3.  **Running the application:**
    ```bash
    go run . serve
    ```

    The application will be available at `http://127.0.0.1:8090`.

## API Usage

### Authentication

First, login to get an access token:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "identity": "your_email@example.com",
  "password": "your_password"
}' http://127.0.0.1:8090/api/login
```

### Location Tracking

#### POST Request (GeoJSON format)

```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_ACCESS_TOKEN" -d '{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [18.93, 47.51, 200]
  },
  "properties": {
    "timestamp": 1672531200,
    "speed": 60,
    "heart_rate": 120,
    "session": "your_session_name"
  }
}' http://127.0.0.1:8090/api/track
```

#### GET Request (URL parameters)

```bash
curl "http://127.0.0.1:8090/api/track?token=YOUR_USER_TOKEN&latitude=47.51&longitude=18.93&altitude=200&speed=60&heart_rate=120&session=your_session_name"
```

### Session Management

#### Get user's sessions
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" "http://127.0.0.1:8090/api/sessions/username"
```

#### Get session data (GeoJSON LineString)
```bash
curl "http://127.0.0.1:8090/api/session/username/session_name"
```

#### Create new session
```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_ACCESS_TOKEN" -d '{
  "name": "session_name",
  "title": "Session Title",
  "description": "Session description",
  "public": false
}' http://127.0.0.1:8090/api/sessions
```

### Public Data

#### Get public locations from all users
```bash
curl "http://127.0.0.1:8090/api/public-locations"
```

## Docker

Build the Docker image:

```bash
docker build -t vibe-tracker .
```

Run the Docker container:

```bash
docker run -p 8090:8090 -v $(pwd)/pb_data:/app/pb_data vibe-tracker
```
