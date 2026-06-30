# MAP-OPS Backlog

## Offline 3D terrain (DEM PMTiles)

The 2D/3D chip is live. In **3D** mode the camera tilts to 60° pitch and rotation is enabled — but the terrain stays flat unless a local DEM (digital elevation model) is bundled with the basemap.

To make the 3D mode actually show topography for the SLC/Provo and Cottonwood Canyon area, we need a **Terrain-RGB encoded PMTiles** file dropped next to the existing basemap PMTiles and a `terrain` entry added to `basemap/basemaps.json`.

### What I (the app) need from you

1. **A Terrain-RGB PMTiles file** covering the same extent as the existing basemaps (SLC/Provo). Source candidates:
   - USGS 3DEP 1-arc-second DEM (free, US-only, ~10 m resolution) — best fit for Wasatch
   - AWS Open Data Terrain Tiles (Terrarium encoding) — easy to download a tile pyramid for the bbox
2. **Encoding** specified — either `terrarium` (AWS) or `mapbox` (Mapbox Terrain-RGB). The app defaults to `terrarium`.
3. **Zoom range** — terrain typically only needs `maxzoom: 12–14`; the renderer upsamples between DEM tiles and basemap tiles.
4. **File placed at** `basemap/<your-filename>.pmtiles`.
5. **Add an entry to `basemap/basemaps.json`** like:
   ```json
   {
     "basemaps": [ ... existing entries ... ],
     "terrain": {
       "file": "Terrain_SLC_Provo_terrarium.pmtiles",
       "encoding": "terrarium",
       "tileSize": 512,
       "maxzoom": 14,
       "exaggeration": 1.4
     }
   }
   ```

### Suggested pipeline (one-time, offline)

```bash
# 1. Download a Terrarium tile pyramid for the bbox (e.g. with gdal2tiles or rio-rgbify
#    + an mbtiles output), or generate locally from USGS DEM with rio-rgbify.
# 2. Convert MBTiles -> PMTiles
pmtiles convert Terrain_SLC_Provo.mbtiles Terrain_SLC_Provo_terrarium.pmtiles
# 3. Drop into basemap/ and update basemaps.json (see above).
```

Until that file exists, **3D mode still works** — pitch + rotate are enabled — the ground is just flat. No errors, no console noise. Once you add the file and the JSON entry, `setTerrain` wires up automatically.

### Why packaged, not online

We considered AWS Terrarium over HTTPS (free, no key) for instant 3D, but it breaks the offline-first guarantee. Map-ops is used in dead-zone canyons; everything that renders in 2D must render in 3D. So we bundle the DEM the same way we bundle basemaps.
