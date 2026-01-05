# MAP-OPS

**Mountain Avalanche Protection Operations**

Offline map application for avalanche control operations in Utah's Little Cottonwood Canyon area.

---

## Current Status

**Phase:** Web MVP Complete, React Native Setup In Progress

**Last Session:** Git/GitHub setup complete, Expo project scaffolded in `/mobile`

**Next Steps:**
1. Complete MapLibre React Native integration
2. Set up EAS Build for iOS
3. Configure TestFlight distribution

---

## What This App Does

MAP-OPS is an offline-capable map application designed for avalanche control teams operating in mountain terrain. It displays:

- **Custom satellite/topo basemaps** loaded from MBTiles files
- **Operational layers** (GeoJSON):
  - Avalanche Paths (polygons) - Red
  - Closure Gates (points) - Orange
  - Gun Pads (points) - Green
- **GPS location tracking** for field personnel
- **Layer toggle** to show/hide different data layers

The app works offline by bundling tile data and GeoJSON layers locally.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAP-OPS                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐   │
│  │   index.html │   │  styles.css │   │  manifest.json      │   │
│  │   (UI Shell) │   │  (Dark Theme)│   │  (PWA Config)       │   │
│  └──────┬──────┘   └─────────────┘   └─────────────────────┘   │
│         │                                                        │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │                    JavaScript Modules                     │    │
│  ├──────────────┬──────────────┬──────────────┬────────────┤    │
│  │   app.js     │   map.js     │   data.js    │layer-utils │    │
│  │  (Main App)  │  (MapLibre)  │  (Loading)   │  (GeoJSON) │    │
│  │              │              │              │            │    │
│  │ - Init       │ - Map setup  │ - File parse │ - UTM conv │    │
│  │ - UI events  │ - Layers     │ - IndexedDB  │ - Merge    │    │
│  │ - Layer mgmt │ - GPS track  │ - GeoJSON    │ - Bounds   │    │
│  └──────────────┴──────────────┴──────────────┴────────────┘    │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Data Sources                            │  │
│  ├─────────────────────┬─────────────────────────────────────┤  │
│  │  basemap/           │  layers/                             │  │
│  │  └─ *.mbtiles       │  ├─ layers.json (manifest)           │  │
│  │     (Satellite/Topo)│  ├─ Avy_Paths.geojson                │  │
│  │                     │  ├─ Closure_Gates.geojson            │  │
│  │                     │  └─ Pad_Locations.geojson            │  │
│  └─────────────────────┴─────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Tile Server                             │  │
│  │  tile-server.py (Python, port 3000)                        │  │
│  │  - Reads MBTiles SQLite database                           │  │
│  │  - Serves tiles at /tiles/{z}/{x}/{y}                      │  │
│  │  - CORS enabled for local development                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module | File | Purpose |
|--------|------|---------|
| **App** | `js/app.js` | Main coordinator. Handles UI, layer management, auto-loads layers from manifest |
| **Map** | `js/map.js` | MapLibre GL JS wrapper. Map init, layer rendering, GPS tracking, tile server detection |
| **Data** | `js/data.js` | File parsing (GeoJSON, KML, GPX, CSV), IndexedDB storage, coordinate detection |
| **Layer Utils** | `js/layer-utils.js` | UTM to WGS84 conversion, GeoJSON merging, bounds calculation |
| **Tile Server** | `tile-server.py` | Python HTTP server that reads MBTiles and serves raster tiles |

### Data Flow

```
1. App Init
   └─> Load layers/layers.json (manifest)
       └─> For each file in manifest:
           └─> Fetch GeoJSON from layers/
               └─> Parse & detect coordinate system
                   └─> Convert UTM to WGS84 if needed
                       └─> Add to MapLibre as source/layer

2. Basemap Loading
   └─> Check if tile server running (localhost:3000/health)
       └─> YES: Switch to LOCAL_MBTILES_STYLE (satellite)
       └─> NO: Use DARK_MAP_STYLE (Carto dark tiles)
```

---

## Project Structure

```
map_app/
├── index.html              # Main app HTML
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching
├── tile-server.py          # Python MBTiles server
├── .gitignore              # Excludes .mbtiles, node_modules
├── README.md               # This file
│
├── css/
│   └── styles.css          # Dark theme, responsive layout
│
├── js/
│   ├── app.js              # Main application logic
│   ├── map.js              # MapLibre map handling
│   ├── data.js             # Data loading & parsing
│   └── layer-utils.js      # GeoJSON utilities
│
├── layers/
│   ├── layers.json         # Layer manifest (auto-load list)
│   ├── Avy_Paths.geojson   # Avalanche path polygons
│   ├── Closure_Gates.geojson
│   └── Pad_Locations.geojson
│
├── basemap/
│   └── *.mbtiles           # Satellite/topo tiles (NOT in git)
│
├── images/
│   ├── logos/              # Agency partner logos
│   │   ├── logos.json      # Logo manifest
│   │   └── *.png           # Logo files
│   └── icons/              # Layer icons (for point features)
│       ├── icons.json      # Icon config (sizes, defaults)
│       └── *.png           # Icon files (named to match layers)
│
└── mobile/                 # React Native app (Expo)
    ├── App.js
    ├── package.json
    └── ...                 # (In progress)
```

---

## Configuration Files

### layers/layers.json
```json
{
  "name": "MAP-OPS Layers",
  "files": [
    "Avy_Paths.geojson",
    "Closure_Gates.geojson",
    "Pad_Locations.geojson"
  ]
}
```

### images/logos/logos.json
```json
{
  "logos": [
    { "file": "udot.png", "name": "Utah DOT" },
    { "file": "usfs.png", "name": "US Forest Service" },
    { "file": "alta.png", "name": "Alta Ski Area" },
    { "file": "brighton.png", "name": "Brighton Resort" },
    { "file": "sandy_city.png", "name": "Sandy City Police" }
  ]
}
```

### images/icons/icons.json
```json
{
  "defaultSize": 32,
  "icons": [
    { "layer": "Closure_Gates", "file": "Closure_Gates.png", "size": 28 },
    { "layer": "Pad_Locations", "file": "Pad_Locations.png", "size": 32 }
  ]
}
```

---

## Layer Styling

Defined in `js/app.js`:

```javascript
const layerStyles = {
  'Avy_Paths':      { color: '#ef4444', name: 'Avalanche Paths' },  // Red
  'Closure_Gates':  { color: '#f59e0b', name: 'Closure Gates' },    // Orange
  'Pad_Locations':  { color: '#22c55e', name: 'Gun Pads' }          // Green
};
```

---

## Running Locally

### Terminal 1: Tile Server
```bash
cd /mnt/c/Users/barry.winston/Documents/coding_projects/map_app
python3 tile-server.py
```
Serves MBTiles at http://localhost:3000

### Terminal 2: Web Server
```bash
python3 -m http.server 8000
```
Open http://localhost:8000

---

## Git Workflow

```bash
# Check status
git status

# Stage and commit changes
git add -A
git commit -m "Your message"

# Push to GitHub
git push origin main
```

**Repository:** https://github.com/winston-network/map-ops (private)

---

## Roadmap

### Phase 1: Web MVP (COMPLETE)
- [x] MapLibre GL JS map
- [x] MBTiles tile server
- [x] Auto-load GeoJSON layers
- [x] Layer visibility toggle
- [x] GPS location tracking
- [x] Dark theme UI
- [x] Agency logos
- [x] Git + GitHub setup

### Phase 2: React Native (IN PROGRESS)
- [x] Expo project scaffolded
- [ ] MapLibre React Native integration
- [ ] Custom icons for point layers
- [ ] MBTiles bundling/download
- [ ] Layer config screen

### Phase 3: Distribution
- [ ] EAS Build setup (cloud iOS builds)
- [ ] TestFlight beta distribution
- [ ] App Store submission

### Phase 4: Enhancements
- [ ] Swappable basemap selector
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

## Attribution & Credits

### Icons
- <a href="https://www.flaticon.com/free-icons/gate" title="gate icons">Gate icons created by Backwoods - Flaticon</a>
- <a href="https://www.flaticon.com/free-icons/protection" title="protection icons">Protection icons created by rukanicon - Flaticon</a>

### Mapping Libraries
- [MapLibre GL JS](https://maplibre.org/) - Open-source map rendering
- [MapLibre React Native](https://github.com/maplibre/maplibre-react-native) - Mobile map SDK

### Data Sources
- Basemap tiles: Custom MBTiles (QGIS export)
- Operational layers: Internal GIS data

### Tools
- [Expo](https://expo.dev/) - React Native framework
- [EAS Build](https://expo.dev/eas) - Cloud build service

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Web Map | MapLibre GL JS |
| Mobile Map | MapLibre React Native |
| Mobile Framework | React Native + Expo |
| Tile Format | MBTiles (SQLite) |
| Data Format | GeoJSON |
| Tile Server | Python (http.server + sqlite3) |
| Build/Deploy | GitHub Actions + EAS Build |
| Beta Testing | TestFlight |

---

## Contact

Barry Winston - barrywinston@gmail.com
