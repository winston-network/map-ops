# MAP-OPS

**Mountain Avalanche Protection Operations**

Offline map application for avalanche control operations in Utah's Cottonwood Canyons.

---

## Current Status

**Version:** 2.8.2
**Phase:** Offline Basemap Testing

**Updates (Jan 10, 2026):**
- Offline basemaps working via WebView + GCDWebServer architecture
- PMTiles bundled with app (no download required)
- Switched from MapLibre React Native to WebView + MapLibre GL JS
- GeoJSON layers with click handlers and popups
- Snow loading animation while basemaps initialize

**Last Stable Version:** [v1.5.0](https://github.com/winston-network/map-ops/releases/tag/v1.5.0) - Pre-offline basemap work, uses online fallback tiles

---

## Offline Basemap Status

**Goal:** Load custom offline basemaps (shaded topo + satellite) like the Wasatch Backcountry Skiing app.

**Approaches Tried:**

| Approach | Status | Issue |
|----------|--------|-------|
| PMTiles with `pmtiles://` protocol | Failed | MapLibre RN doesn't support custom protocols |
| MBTiles with `mbtiles://` protocol | Failed | MapLibre RN doesn't support custom protocols |
| TileBridge (RN reads PMTiles, sends to WebView) | Failed | expo-file-system doesn't support byte range reads |
| @dr.pogodin/react-native-static-server | Failed | Build errors with Expo |
| **WebView + GCDWebServer + PMTiles** | **Working** | Current solution (v2.8.x) |

**Current Architecture (v2.8.x):**
1. PMTiles bundled with app via expo-asset (no user download)
2. On first launch, copy PMTiles to documentDirectory
3. Start local HTTP server (react-native-static-server/GCDWebServer) on port 9876
4. WebView loads MapLibre GL JS + pmtiles-protocol library
5. MapLibre fetches tiles via `pmtiles://http://localhost:9876/filename.pmtiles`
6. GeoJSON layers rendered on top of basemap

**Why WebView instead of MapLibre React Native:**
- MapLibre RN doesn't support custom protocols needed for PMTiles
- WebView + MapLibre GL JS has full pmtiles-protocol support
- Same architecture as Wasatch Backcountry Skiing app

**Bundled Basemap Files:**
- `CC_shaded_topo.pmtiles` (58 MB) - Shaded relief topo, zoom 10-16
- `CC_satellite_12_14.pmtiles` (25 MB) - Satellite imagery, zoom 12-14

**Reference App:** Wasatch Backcountry Skiing (iOS) - uses GCDWebServer + SQLite for offline tiles

---

## Mobile Architecture (v2.8.x)

```
mobile/
├── App.js                    # Main app, WebView container, layer toggles
├── app.json                  # Expo config, version, plugins
├── metro.config.js           # Bundler config (pmtiles as asset)
├── package.json              # Dependencies
│
├── src/
│   ├── mapHtml.js            # WebView HTML with MapLibre GL JS
│   ├── StaticServer.js       # GCDWebServer wrapper (localhost:9876)
│   └── TileBridge.js         # (unused) Direct PMTiles reader attempt
│
└── assets/
    ├── basemap/
    │   ├── CC_shaded_topo.pmtiles      # Bundled topo basemap
    │   └── CC_satellite_12_14.pmtiles  # Bundled satellite basemap
    ├── layers/
    │   ├── BCC_AvyPaths.json           # Avalanche paths (polygons)
    │   ├── BCC_Gates.json              # Control gates (points)
    │   └── BCC_Staging.json            # Staging areas (points)
    └── icons/
        └── ...
```

**Key Dependencies:**
- `react-native-webview` - WebView for MapLibre GL JS
- `react-native-static-server` - GCDWebServer (iOS) / NanoHTTPD (Android)
- `expo-asset` - Bundle PMTiles with app
- `expo-file-system` - Copy assets to documentDirectory

**Data Flow:**
```
App.js
  ├─> expo-asset: Load bundled PMTiles
  ├─> expo-file-system: Copy to documentDirectory
  ├─> StaticServer: Start HTTP server on port 9876
  └─> WebView
        ├─> mapHtml.js: MapLibre GL JS + pmtiles-protocol
        ├─> Basemap: pmtiles://http://localhost:9876/filename.pmtiles
        └─> GeoJSON: Sent via postMessage from App.js
```

---

**Updates (Jan 9, 2026):**
- Avalanche paths changed to light blue (#7ec8ff)
- Glowing snowflake app icon
- Snow loading animation with text-fill progress indicator
- Switched from expo-file-system to react-native-fs
- iOS App Transport Security configured for localhost

**Updates (Jan 7, 2026):**
- Android preview build v1.3.0 available for testing
- Dynamic basemap loading from `basemaps.json`
- Layer legends (icons for points, rectangles for polygons)
- Version display in sidebar (auto-loads from package.json)
- Version bump script (`npm run bump patch|minor|major`)
- Removed location info display from sidebar

<img width="1225" height="948" alt="image" src="https://github.com/user-attachments/assets/15266458-f8de-4668-bc54-61272e753e25" />

**Updates (Jan 6, 2026):**
- Mobile app with MapLibre React Native
- Basemap toggle (Topo/Satellite) in mobile
- Layer toggles with visibility controls
- Basemap conversion pipeline (MBTiles → PMTiles)
- Scripts: `convert-basemaps`, `sync-basemaps`, `watch-basemaps`
- EAS Build configured for Android and iOS

**Updates (Jan 5, 2026):**
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
1. ~~Get offline basemaps rendering in iOS~~ (v2.8.2 - testing)
2. Verify basemap + GeoJSON rendering in build
3. Merge working solution to main
4. TestFlight beta distribution
5. Field testing with GPS tracking

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
│   ├── basemaps.json               # Basemap manifest (auto-updated)
│   ├── CC_shaded_topo.pmtiles      # Topo basemap
│   ├── CC_satellite_12_14.pmtiles  # CC Satellite basemap
│   ├── Bo_satellite_12_14.pmtiles  # Bo Satellite basemap
│   └── source/                     # MBTiles source files
│
├── scripts/
│   ├── bump-version.js             # Version management
│   ├── convert-basemaps.js         # MBTiles → PMTiles
│   ├── sync-basemaps.js            # Sync web ↔ mobile
│   └── watch-basemaps.js           # Auto-convert on change
│
├── tools/
│   └── pmtiles.exe                 # PMTiles CLI binary
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

Drop MBTiles files in `basemap/source/` then run:

```bash
npm run convert-basemaps
```

This will:
1. Convert all MBTiles → PMTiles
2. Copy to both web and mobile folders
3. Auto-update `basemaps.json` manifest

Other basemap commands:
```bash
npm run sync-basemaps     # Sync web ↔ mobile folders
npm run watch-basemaps    # Auto-convert on file changes
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

### Phase 2: React Native (COMPLETE)
- [x] Expo project scaffolded
- [x] MapLibre React Native integration
- [x] Basemap toggle in mobile app
- [x] Layer toggles with visibility
- [x] Bundled GeoJSON layers
- [x] Android preview build (v1.3.0)

### Phase 3: Distribution (IN PROGRESS)
- [x] EAS Build setup
- [x] Android APK sharing
- [ ] iOS build (waiting for Apple Developer)
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
- Local agencies + personnel

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Web Map | MapLibre GL JS + PMTiles |
| Mobile Map | WebView + MapLibre GL JS + pmtiles-protocol |
| Mobile Framework | React Native 0.81 + Expo SDK 54 |
| Mobile Tile Server | react-native-static-server (GCDWebServer) |
| Tile Format | PMTiles (bundled with app) |
| Data Format | GeoJSON |
| Web Tile Server | **None needed** (HTTP range requests) |

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
