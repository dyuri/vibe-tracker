- better (location tracking) session management
  - tracks (gpx) upload
  - landmarks (waypoints) setup
  - multi-user sessions
    - refactor route display to support multiple users

- tracking events
  - start/stop/pause/resume tracking via companion app
  - don't draw route while stopped/paused (connect pause-resume, but do not connect stop-start)

- request throttling improvements
  - return a promise that resolves when a request can be made, or something like that

- unit tests (extension)
