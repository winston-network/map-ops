# MAP-OPS

**Mountain Avalanche Protection Operations**

Offline map application for avalanche control operations in Utah's Cottonwood Canyons.

---

## Current Status

**Phase:** Web MVP Complete, Mobile App Next

**Latest Updates (Jan 5, 2026):**
- Custom shaded topo basemap (CC_shaded_topo_big.pmtiles, zoom 10-16)
- Basemap toggle (Topo/Satellite) in sidebar
- Big Cottonwood Canyon (BCC) layers added:
  - BCC Avalanche Paths (polygons)
  - BCC Gates (points with custom icons)
  - BCC Staging Areas (points with custom icons)
- Custom icon system for point layers
- Improved UI design:
  - Ice-blue gradient MAP-OPS title with glow effects
  - Red warning subtitle
  - Snowflake logo
  - Feature popups appear near clicked features (5 o'clock position)
  - Simplified BCC popups showing only description
- All branches merged to main, clean repo state

**Next Steps:**
1. Test React Native mobile app (when WiFi available)
2. Test GPS location tracking on physical device
3. EAS Build for iOS
4. TestFlight beta distribution

---

## What This App Does

MAP-OPS is an offline-capable map application designed for avalanche control teams operating in mountain terrain. It displays:

- **Custom basemaps** - Toggle between Shaded Topo and Satellite (PMTiles format, no server needed)
- **Operational layers** (GeoJSON):
  - Avalanche Paths (polygons) - Red
  - Closure Gates (points) - Orange
  - Staging Areas (points) - Blue
- **GPS location tracking** for field personnel
- **Layer toggle** to show/hide different data layers
- **Feature popups** with details when clicking points/polygons

The app works offline by bundling tile data and GeoJSON layers locally.

---

## Architecture

### Why PMTiles (No SQL Required)

| Component | Format | SQL Needed? |
|-----------|--------|-------------|
| Basemap tiles | PMTiles | **No** - HTTP range requests |
| Overlay layers | GeoJSON | **No** - JSON files |
| Manifest/config | JSON | **No** - JSON files |

**PMTiles vs MBTiles:**
- MBTiles = SQLite database (requires SQL driver or tile server)
- PMTiles = single optimized file (direct browser access, no server)

```
+---------------------------------------------------------------+
|                         MAP-OPS                               |
+---------------------------------------------------------------+
|  index.html        styles.css        manifest.json            |
|  (UI Shell)        (Dark Theme)      (PWA Config)             |
|                                                               |
|  +----------------------------------------------------------+ |
|  |                  JavaScript Modules                       | |
|  +------------+------------+------------+-------------------+ |
|  |  app.js    |  map.js    |  data.js   |  layer-utils.js   | |
|  | - Init     | - MapLibre | - Parsing  | - UTM conversion  | |
|  | - UI/Layer | - PMTiles  | - GeoJSON  | - Bounds calc     | |
|  | - Popups   | - Basemap  |            |                   | |
|  |            |   toggle   |            |                   | |
|  +------------+------------+------------+-------------------+ |
|                            |                                  |
|  +-------------------------v--------------------------------+ |
|  |                 Data Sources (No SQL)                    | |
|  +--------------------------+-------------------------------+ |
|  | basemap/                 | layers/                       | |
|  | - CC_shaded_topo.pmtiles | - layers.json (manifest)      | |
|  | - satellite.pmtiles      | - BCC_AvyPaths.geojson        | |
|  |   (No tile server!)      | - BCC_Gates.geojson           | |
|  |                          | - BCC_Staging.geojson         | |
|  +--------------------------+-------------------------------+ |
+---------------------------------------------------------------+
```

---

## Project Structure

```
map_app/
├── index.html              # Main app HTML
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching
├── README.md               # This file
│
├── css/
│   └── styles.css          # Dark theme, ice-blue accents
│
├── js/
│   ├── app.js              # Main app, layer management, popups
│   ├── map.js              # MapLibre + PMTiles, basemap toggle
│   ├── data.js             # Data loading & parsing
│   └── layer-utils.js      # GeoJSON utilities
│
├── layers/
│   ├── layers.json         # Layer manifest
│   ├── BCC_AvyPaths.geojson
│   ├── BCC_Gates.geojson
│   ├── BCC_Staging.geojson
│   └── archive/            # Old LCC layers
│
├── basemap/
│   ├── CC_shaded_topo_big.pmtiles  # Topo basemap (zoom 10-16)
│   └── satellite.pmtiles           # Satellite basemap
│
├── images/
│   ├── icons/
│   │   ├── icons.json      # Icon config
│   │   ├── snowflake.png   # App logo
│   │   ├── BCC_Gates.png
│   │   └── BCC_Staging.png
│   └── logos/
│       ├── logos.json
│       └── *.png           # Agency logos
│
└── mobile/                 # React Native app (Expo)
    ├── App.js
    ├── package.json
    └── ...
```

---

## Configuration Files

### layers/layers.json
```json
{
  "name": "MAP-OPS Layers",
  "files": [
    "BCC_AvyPaths.geojson",
    "BCC_Gates.geojson",
    "BCC_Staging.geojson"
  ]
}
```

### images/icons/icons.json
```json
{
  "defaultSize": 32,
  "icons": [
    { "layer": "BCC_Staging", "file": "BCC_Staging.png", "size": 2 },
    { "layer": "BCC_Gates", "file": "BCC_Gates.png", "size": 3 }
  ]
}
```

---

## Layer Styling

Defined in `js/app.js`:

```javascript
const layerStyles = {
  'BCC_AvyPaths':  { color: '#ef4444', name: 'BCC Avalanche Paths' },  // Red
  'BCC_Gates':     { color: '#f59e0b', name: 'BCC Gates' },            // Orange
  'BCC_Staging':   { color: '#3b82f6', name: 'BCC Staging Areas' }     // Blue
};
```

---

## Running Locally

**Important:** Use `http-server` (not Python's simple server) because PMTiles requires HTTP Range requests.

```bash
# Install http-server (once)
npm install -g http-server

# Run from project directory
cd /mnt/c/Users/barry.winston/Documents/coding_projects/map_app
http-server -p 8000 --cors
```

Open http://localhost:8000

---

## Converting Basemaps

To convert MBTiles to PMTiles:

```bash
# Install pmtiles CLI (once)
npm install -g pmtiles

# Convert
pmtiles convert input.mbtiles output.pmtiles
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, commit
git add -A
git commit -m "Add your feature"

# Push and create PR
git push origin feature/your-feature-name
```

**Repository:** https://github.com/winston-network/map-ops (private)

---

## Roadmap

### Phase 1: Web MVP (COMPLETE)
- [x] MapLibre GL JS map
- [x] PMTiles basemaps (no tile server)
- [x] Basemap toggle (Topo/Satellite)
- [x] Auto-load GeoJSON layers
- [x] Layer visibility toggle
- [x] Custom icons for point layers
- [x] Feature popups near clicked items
- [x] GPS location tracking
- [x] Dark theme UI with ice-blue accents
- [x] Agency logos

### Phase 2: React Native (NEXT)
- [x] Expo project scaffolded
- [ ] MapLibre React Native integration
- [ ] Test on physical device
- [ ] PMTiles bundling for mobile

### Phase 3: Distribution
- [ ] EAS Build setup
- [ ] TestFlight beta
- [ ] App Store submission

### Phase 4: Enhancements
- [ ] Offline layer sync
- [ ] Field data collection
- [ ] Team location sharing

---

## Interagency Partners

- Utah Department of Transportation (UDOT)
- US Forest Service (USFS)
- Alta Ski Area
- Brighton Resort
- Sandy City Police

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Web Map | MapLibre GL JS + PMTiles |
| Mobile Map | MapLibre React Native |
| Mobile Framework | React Native + Expo |
| Tile Format | PMTiles (no SQL) |
| Data Format | GeoJSON |
| Tile Server | **None needed** |

---

## Attribution

### Icons
- Gate icons created by Backwoods - Flaticon
- Protection icons created by rukanicon - Flaticon

### Mapping
- [MapLibre GL JS](https://maplibre.org/)
- [PMTiles](https://github.com/protomaps/PMTiles)

---

## Contact

Barry Winston - barrywinston@gmail.com
