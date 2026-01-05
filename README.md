# MAP-OPS

**Mountain Avalanche Protection Operations**

Offline map application for avalanche control operations in Utah's Little Cottonwood Canyon area.

---

## Current Status

**Phase:** Web MVP Complete, PMTiles Integration Done, Mobile App Next

**Last Session (Jan 4, 2026):**
- Switched from MBTiles to PMTiles (no SQL/tile server required)
- Set up Git branching workflow (feature branches → PRs → main)
- Expo React Native project scaffolded in `/mobile`
- Converted satellite basemap to PMTiles format
- PR #1 open: https://github.com/winston-network/map-ops/pull/1

**Next Steps:**
1. Test mobile app with MapLibre React Native
2. Test GPS location tracking for field personnel
3. Update to new custom basemap
4. Replace/add more GeoJSON layers
5. Set up EAS Build for iOS
6. TestFlight beta distribution
7. App Store submission

---

## What This App Does

MAP-OPS is an offline-capable map application designed for avalanche control teams operating in mountain terrain. It displays:

- **Custom satellite/topo basemaps** loaded from PMTiles files (no SQL/tile server needed)
- **Operational layers** (GeoJSON):
  - Avalanche Paths (polygons) - Red
  - Closure Gates (points) - Orange
  - Gun Pads (points) - Green
- **GPS location tracking** for field personnel
- **Layer toggle** to show/hide different data layers

The app works offline by bundling tile data and GeoJSON layers locally.

---

## Architecture

### Why PMTiles (No SQL Required)

| Component | Format | SQL Needed? |
|-----------|--------|-------------|
| Basemap tiles | PMTiles | **No** - direct file read via protocol handler |
| Overlay layers | GeoJSON | **No** - JSON files |
| Manifest/config | JSON | **No** - JSON files |
| User data (future) | Optional SQLite | Only if you add bookmarks, notes, etc. |

**PMTiles vs MBTiles:**
- MBTiles = SQLite database → requires SQL driver or tile server
- PMTiles = single optimized file → direct browser/app access, no server needed

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
│  │ - UI events  │ - PMTiles    │ - GeoJSON    │ - Merge    │    │
│  │ - Layer mgmt │ - GPS track  │              │ - Bounds   │    │
│  └──────────────┴──────────────┴──────────────┴────────────┘    │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                    Data Sources (No SQL)                   │  │
│  ├─────────────────────┬─────────────────────────────────────┤  │
│  │  basemap/           │  layers/                             │  │
│  │  └─ *.pmtiles       │  ├─ layers.json (manifest)           │  │
│  │     (Satellite/Topo)│  ├─ Avy_Paths.geojson                │  │
│  │     No tile server! │  ├─ Closure_Gates.geojson            │  │
│  │                     │  └─ Pad_Locations.geojson            │  │
│  └─────────────────────┴─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module | File | Purpose |
|--------|------|---------|
| **App** | `js/app.js` | Main coordinator. Handles UI, layer management, auto-loads layers from manifest |
| **Map** | `js/map.js` | MapLibre GL JS + PMTiles protocol. Map init, layer rendering, GPS tracking |
| **Data** | `js/data.js` | File parsing (GeoJSON, KML, GPX, CSV), coordinate detection |
| **Layer Utils** | `js/layer-utils.js` | UTM to WGS84 conversion, GeoJSON merging, bounds calculation |

### Data Flow

```
1. App Init
   └─> Load layers/layers.json (manifest)
       └─> For each file in manifest:
           └─> Fetch GeoJSON from layers/
               └─> Parse & detect coordinate system
                   └─> Convert UTM to WGS84 if needed
                       └─> Add to MapLibre as source/layer

2. Basemap Loading (PMTiles - No Server Required)
   └─> PMTiles protocol handler registered with MapLibre
       └─> Load basemap/*.pmtiles directly
           └─> Tiles fetched on-demand via HTTP range requests
               └─> No SQLite, no tile server needed
```

---

## Project Structure

```
map_app/
├── index.html              # Main app HTML
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline caching
├── .gitignore              # Excludes .pmtiles, node_modules
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
│   └── *.pmtiles           # Satellite/topo tiles (NOT in git, no SQL needed)
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

With PMTiles, you only need ONE terminal (no tile server required):

```bash
cd /mnt/c/Users/barry.winston/Documents/coding_projects/map_app
python3 -m http.server 8000
```
Open http://localhost:8000

The PMTiles protocol handler loads tiles directly from `basemap/*.pmtiles` - no separate tile server needed.

---

## Git Workflow

### Branching Strategy (Best Practice)

```bash
# Create feature branch before making changes
git checkout -b feature/your-feature-name

# Make your changes, then commit
git add -A
git commit -m "Add your feature"

# Push feature branch
git push origin feature/your-feature-name

# Create Pull Request on GitHub, then merge to main
```

### Branch Naming Conventions
- `feature/` - New features (e.g., `feature/pmtiles-support`)
- `fix/` - Bug fixes (e.g., `fix/layer-toggle`)
- `docs/` - Documentation updates (e.g., `docs/readme-update`)

### Quick Commands
```bash
git status                    # Check what's changed
git checkout -b feature/xxx   # Create new branch
git add -A && git commit -m "message"  # Commit all
git push origin feature/xxx   # Push branch
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
| Web Map | MapLibre GL JS + PMTiles protocol |
| Mobile Map | MapLibre React Native |
| Mobile Framework | React Native + Expo |
| Tile Format | PMTiles (no SQL required) |
| Data Format | GeoJSON |
| Tile Server | **None needed** - PMTiles loads directly |
| Build/Deploy | GitHub Actions + EAS Build |
| Beta Testing | TestFlight |

### Why No SQL/Tile Server?
- **PMTiles** uses HTTP range requests to fetch tiles directly from the file
- No SQLite database to query, no server-side processing
- Works in browser, React Native, or any HTTP client
- Convert from MBTiles: `pmtiles convert input.mbtiles output.pmtiles`

---

## Contact

Barry Winston - barrywinston@gmail.com
