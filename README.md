# MAP-OPS

**Mountain Avalanche Protection Operations**

Offline map application for avalanche control operations in Utah's Cottonwood Canyons.

---

## Current Status

**Version:** 2.14.0
**Phase:** TestFlight Beta Distribution

**Updates (Mar 2, 2026):**
- **New basemaps** - z10-15 JPG tilesets replacing z12-16 (topo 61→21MB, satellite 172→47MB, total 233→68MB)
- **Blank opening basemap fixed** - Real tiles now exist at all opening zoom levels
- **Avy paths restyled** - Dark blue outline (#1e3a5f) + light blue fill (#93c5fd)
- **Gate icons enlarged** - 10% bigger on map (0.52→0.57)
- **Gate toggle icon** - Now matches the barrier icon shown on map
- **Pan bounds clamped** - Cannot pan beyond basemap tile extent
- **New app icon, adaptive icon, splash screen** - Updated branding
- **Feedback form** - Updated to new Google Form (smsmapping@gmail.com)
- **Web basemaps updated** - PMTiles converted to z10-15, basemaps.json updated

**Updates (Feb 26, 2026):**
- **Gate icons** - Replaced yellow circles with barrier icon (64x64 PNG), tap for description popup
- **Gate data updates** - Added LCC Hellgate; renamed gates (7 total)
- **Avy report contacts** - Added LCC and Provo contacts
- **New header logo** - Replaced snowflake with custom app icon
- **Removed footer logos** (USFS, UDOT, Alta, Brighton)

**Updates (Jan 12, 2026):**
- **iOS build submitted to TestFlight** - Ready for beta testers
- **Fixed basemap switching** - GeoJSON layers now persist when toggling topo/satellite (replaced unreliable `style.load` event with `isStyleLoaded()` polling)
- **Updated map styling:**
  - Avalanche paths: pink (#f472b6) for better contrast with orange markers
  - Gates: custom gate icon images
  - Staging: orange circles with bold black text showing mile marker numbers, black border
- **Toggleable debug panel** - Hidden by default, tap "Debug" button to show
- **3-second loading screen** - Snowflakes animation displays for minimum 3 seconds
- **Fixed Android build** - Renamed mismatched udot.png → udot.jpg (was JPEG with wrong extension)
- **PR #2 created** - Ready to merge to main

**Updates (Jan 11, 2026):**
- **New architecture:** MBTiles + expo-sqlite (no HTTP server needed)
- Tiles read directly from SQLite databases via TileBridge
- WebView requests tiles via postMessage, React Native responds with base64 data
- Custom `rntile://` protocol in MapLibre for tile loading
- Bundled MBTiles files (~85 MB total)
- Added expo-sqlite plugin for native SQLite access

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
| WebView + GCDWebServer + PMTiles | Failed | iOS WKWebView cannot access localhost HTTP servers |
| react-native-static-server v0.5.0 | Failed | Same localhost restriction on iOS |
| **MBTiles + expo-sqlite + postMessage** | **Testing** | Current solution (v2.9.x) |

**Current Architecture (v2.9.x):**
1. MBTiles files bundled with app via expo-asset
2. On first launch, TileBridge copies MBTiles to SQLite directory
3. TileBridge opens databases using expo-sqlite
4. WebView registers custom `rntile://` protocol in MapLibre
5. When MapLibre needs a tile, it calls `rntile://topo/12/831/1557`
6. WebView sends postMessage to React Native with tile coordinates
7. TileBridge queries SQLite: `SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?`
8. Returns base64-encoded tile data back to WebView
9. MapLibre renders the tile

**Why MBTiles + SQLite instead of HTTP server:**
- iOS WKWebView has security restrictions that block localhost HTTP requests
- expo-sqlite provides native SQLite access without HTTP
- postMessage bridge is reliable and doesn't require network permissions
- MBTiles is standard SQLite format, widely supported

**Why WebView instead of MapLibre React Native:**
- MapLibre RN doesn't support custom protocols needed for offline tiles
- WebView + MapLibre GL JS allows custom tile loading via addProtocol()
- Similar to Wasatch Backcountry Skiing app architecture

**Bundled Basemap Files:**
- `Topo_SLC_Provo_10_15_JPG.mbtiles` (21 MB) - Shaded relief topo, zoom 10-15
- `Satellite_SLC_Provo_10_15_JPG.mbtiles` (47 MB) - Satellite imagery, zoom 10-15

**Future Improvement:** Move MBTiles to GitHub Releases for download-on-first-launch (smaller app bundle)

**Reference App:** Wasatch Backcountry Skiing (iOS) - uses GCDWebServer + SQLite for offline tiles

---

## Mobile Architecture (v2.9.x)

```
mobile/
├── App.js                    # Main app, WebView container, layer toggles, tile request handler
├── app.json                  # Expo config, version, plugins (expo-sqlite)
├── metro.config.js           # Bundler config (mbtiles as asset)
├── package.json              # Dependencies
│
├── src/
│   ├── mapHtml.js            # WebView HTML with MapLibre GL JS + custom rntile:// protocol
│   └── TileBridge.js         # SQLite reader - queries MBTiles, returns base64 tiles
│
└── assets/
    ├── basemap/
    │   ├── CC_shaded_topo.mbtiles      # Bundled topo basemap (60 MB)
    │   └── CC_satellite_12_14.mbtiles  # Bundled satellite basemap (26 MB)
    ├── layers/
    │   ├── relevant_polygons.json           # Avalanche paths (polygons)
    │   ├── UDOT_Gates.json              # Control gates (points)
    │   └── UDOT_StagingAreas.json            # Staging areas (points)
    └── icons/
        └── ...
```

**Key Dependencies:**
- `react-native-webview` - WebView for MapLibre GL JS
- `expo-sqlite` - Native SQLite access for reading MBTiles
- `expo-asset` - Bundle MBTiles with app
- `expo-file-system` - Copy assets to SQLite directory

**Data Flow:**
```
App.js
  ├─> expo-asset: Load bundled MBTiles
  ├─> TileBridge.init(): Copy to SQLite dir, open databases
  └─> WebView
        ├─> mapHtml.js: MapLibre GL JS + custom rntile:// protocol
        ├─> Tile request: rntile://topo/12/831/1557
        │     └─> postMessage to React Native
        │           └─> TileBridge.getTile(basemap, z, x, y)
        │                 └─> SQLite query → base64 tile data
        │                       └─> postMessage back to WebView
        └─> GeoJSON: Sent via postMessage from App.js
```

**TileBridge.js - Key Functions:**
```javascript
// Initialize databases from bundled assets
await tileBridge.init({
  topo: require('./assets/basemap/CC_shaded_topo.mbtiles'),
  satellite: require('./assets/basemap/CC_satellite_12_14.mbtiles'),
});

// Get a tile (called via postMessage from WebView)
const base64Tile = await tileBridge.getTile('topo', 12, 831, 1557);
// Returns base64-encoded PNG/JPEG tile data, or null if not found
```

**MBTiles Schema (SQLite):**
```sql
-- Tiles table (TMS coordinate scheme)
SELECT tile_data FROM tiles
WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?;

-- Note: MBTiles uses TMS (flipped Y): tmsY = (1 << z) - 1 - y
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
  - Avalanche Paths (polygons)
  - UDOT Gates (points with custom icons)
  - UDOT Staging Areas (points with custom icons)
- Custom icon system for point layers
- Improved UI design:
  - Ice-blue gradient MAP-OPS title with glow effects
  - Red warning subtitle
  - Snowflake logo
  - Feature popups appear near clicked features (5 o'clock position)
  - Simplified BCC popups showing only description
- All branches merged to main, clean repo state

**Next Steps:**
1. ~~Get offline basemaps rendering in iOS~~ ✅ Complete
2. ~~Verify basemap + GeoJSON rendering in build~~ ✅ Complete
3. ~~TestFlight beta distribution~~ ✅ iOS build submitted
4. Merge PR #2 to main
5. Field testing with GPS tracking
6. Custom gate icons (replacing yellow circles) - in testing

---

## What This App Does

MAP-OPS is an offline-capable map application designed for avalanche control teams operating in mountain terrain. It displays:

- **Custom basemaps** - Toggle between Shaded Topo and Satellite (PMTiles format, no server needed)
- **Operational layers** (GeoJSON):
  - Avalanche Paths (polygons) - Blue
  - Closure Gates (points) - Gate icons
  - Staging Areas (points) - Orange circles with mile marker numbers
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
|  | - satellite.pmtiles      | - relevant_polygons.geojson        | |
|  |   (No tile server!)      | - UDOT_Gates.geojson           | |
|  |                          | - UDOT_StagingAreas.geojson         | |
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
│   ├── relevant_polygons.geojson
│   ├── UDOT_Gates.geojson
│   ├── UDOT_StagingAreas.geojson
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
│   │   ├── UDOT_Gates.png
│   │   └── UDOT_StagingAreas.png
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
    "relevant_polygons.geojson",
    "UDOT_Gates.geojson",
    "UDOT_StagingAreas.geojson"
  ]
}
```

### images/icons/icons.json
```json
{
  "defaultSize": 32,
  "icons": [
    { "layer": "UDOT_StagingAreas", "file": "UDOT_StagingAreas.png", "size": 2 },
    { "layer": "UDOT_Gates", "file": "UDOT_Gates.png", "size": 3 }
  ]
}
```

---

## Layer Styling

Defined in `js/app.js`:

```javascript
const layerStyles = {
  'relevant_polygons':  { color: '#93c5fd', name: 'Avalanche Paths' },  // Light blue fill, dark blue outline
  'UDOT_Gates':     { color: '#f59e0b', name: 'UDOT Gates' },            // Orange
  'UDOT_StagingAreas':   { color: '#3b82f6', name: 'UDOT Staging Areas' }     // Blue
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
- [x] iOS build submitted to App Store Connect
- [x] TestFlight beta (pending Apple processing)
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
| Mobile Map | WebView + MapLibre GL JS + custom rntile:// protocol |
| Mobile Framework | React Native 0.81 + Expo SDK 54 |
| Mobile Tile Access | expo-sqlite (reads MBTiles directly) |
| Tile Format | MBTiles (SQLite, bundled with app) |
| Data Format | GeoJSON |
| Web Tile Server | **None needed** (HTTP range requests) |
| Mobile Tile Server | **None needed** (SQLite + postMessage) |

---

## Attribution

### Icons
- Barrier icons created by Freepik - Flaticon
- Protection icons created by rukanicon - Flaticon

### Mapping
- [MapLibre GL JS](https://maplibre.org/)
- [PMTiles](https://github.com/protomaps/PMTiles)

---

## Contact

Barry Winston - barrywinston@gmail.com
