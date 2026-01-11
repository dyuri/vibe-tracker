# MapLibre Tile Server Setup Guide

This guide explains how to set up a local tile server for MapLibre, specifically focusing on generating and serving map tiles for Hungary. This approach avoids the usage limits of public demo servers.

## Prerequisites

- **Docker**: Ensure Docker is installed and running on your system.
- **Disk Space**: ~500MB - 1GB for Hungary map data.

## Step 1: Generate Map Tiles (The Free & Fast Way)

The best way to get fresh, free map tiles is to generate them yourself using [Planetiler](https://github.com/onthegomap/planetiler). It downloads the latest OpenStreetMap data from Geofabrik and converts it into a single `.mbtiles` file.

1.  Create a directory for your map data:

    ```bash
    mkdir -p map-data
    cd map-data
    ```

2.  Run Planetiler to generate Hungary tiles:

    ```bash
    docker run -e JAVA_TOOL_OPTIONS="-Xmx4g" -v "$(pwd)":/data ghcr.io/onthegomap/planetiler:latest --download --area=hungary
    ```

    - **Note**: This process will automatically download the required `.osm.pbf` file for Hungary and generate an `output.mbtiles` file.
    - _Time estimate_: 5-15 minutes depending on your machine.

3.  Rename the output for clarity:
    ```bash
    mv output.mbtiles hungary.mbtiles
    ```

## Step 2: Run the Tile Server

We will use [TileServer GL](https://github.com/maptiler/tileserver-gl) to serve the `.mbtiles` file. It provides vector tiles, styles, and fonts (glyphs) needed by MapLibre.

1.  Run the server using Docker:

    ```bash
    docker run --rm -it -v "$(pwd)":/data -p 8080:80 maptiler/tileserver-gl -p 80
    ```

    - `-v "$(pwd)":/data`: Mounts your current directory (containing `hungary.mbtiles`) to the container.
    - `-p 8080:80`: Maps port 80 inside the container to port 8080 on your host.

2.  Verify it works:
    - Open [http://localhost:8080](http://localhost:8080) in your browser.
    - You should see a dashboard.
    - Click on the **"Styles"** section to see available map styles (e.g., "Basic", "OSM Bright").
    - Click "Viewer" to inspect the map of Hungary.

## Step 3: Configure Frontend

Now point your MapLibre instance to the local server.

1.  Identify the **Style URL** from your local server.
    - Usually: `http://localhost:8080/styles/basic-preview/style.json` (check the dashboard for the exact link).

2.  Update your MapLibre initialization code (likely in `src/components/widgets/map-widget.ts`).

    **Before:**

    ```typescript
    this.map = new maplibregl.Map({
      container: this.mapContainer,
      style: 'https://demotiles.maplibre.org/style.json', // Old demo URL
      // ...
    });
    ```

    **After:**

    ```typescript
    this.map = new maplibregl.Map({
      container: this.mapContainer,
      // Use your local Docker IP or localhost
      style: 'http://localhost:8080/styles/basic-preview/style.json',
      // ...
    });
    ```

### Important: Handling "localhost" on Mobile/External Devices

If you are testing on a mobile device or a different computer on your network:

- `localhost` won't work. Use your computer's local IP address (e.g., `192.168.1.x`).
- Update the style URL: `http://192.168.1.5:8080/styles/basic-preview/style.json`.
- **Crucial**: Open the `style.json` in a browser, copy its content, and **replace** `"localhost:8080"` with your IP address (`"192.168.1.5:8080"`) in the `sprite` and `glyphs` URLs within the JSON. You might need to serve this modified `style.json` from your own app or configure TileServer GL to broadcast the correct public URL.

## Step 4: Persistent Setup (Optional)

To make this easier to run in the future, you can create a `docker-compose.yml` in a `maps/` directory:

```yaml
version: '3'
services:
  tileserver:
    image: maptiler/tileserver-gl
    command: -p 80
    volumes:
      - ./hungary.mbtiles:/data/hungary.mbtiles
    ports:
      - '8080:80'
```

Run it with: `docker-compose up`
