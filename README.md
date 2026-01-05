# MAP-OPS

**Mountain Avalanche Protection Operations**

Offline map application for avalanche control operations in Utah's Little Cottonwood Canyon area.

## Features

- Offline satellite/custom basemap support (MBTiles)
- GeoJSON layer display (Avalanche Paths, Closure Gates, Gun Pads)
- GPS location tracking
- Progressive Web App (PWA) support
- Layer toggle visibility

## Quick Start (Web Version)

1. Start the tile server (serves MBTiles):
   ```bash
   python3 tile-server.py
   ```

2. Start the web server (in a separate terminal):
   ```bash
   python3 -m http.server 8000
   ```

3. Open http://localhost:8000 in your browser

## Project Structure

```
map_app/
├── index.html          # Main app HTML
├── manifest.json       # PWA manifest
├── service-worker.js   # Offline support
├── tile-server.py      # MBTiles tile server
├── css/
│   └── styles.css      # App styles
├── js/
│   ├── app.js          # Main app logic
│   ├── map.js          # MapLibre map handling
│   ├── data.js         # Data loading/parsing
│   └── layer-utils.js  # GeoJSON utilities
├── layers/
│   ├── layers.json     # Layer manifest
│   └── *.geojson       # GeoJSON layer files
├── basemap/
│   └── *.mbtiles       # Basemap tiles (not in git)
└── images/
    └── logos/          # Agency logos
```

## Adding Custom Basemaps

Place `.mbtiles` files in the `basemap/` folder. The tile server will automatically serve them.

## Interagency Partners

- Utah DOT
- US Forest Service
- Alta Ski Area
- Brighton Resort
- Sandy City Police

## Roadmap

- [ ] React Native mobile app
- [ ] TestFlight beta distribution
- [ ] Swappable basemap selector
- [ ] Offline layer sync
- [ ] App Store release
