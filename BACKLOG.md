# MAP-OPS Backlog

## 3D terrain — SHIPPED (online, with offline-fallback drape)

The 2D/3D chip is live on both **web** and **mobile** as of v2.16.0. In **3D** mode the
camera tilts to 60° pitch, rotation is enabled, and real topography is draped
over the basemap tiles.

### What's shipped

- **DEM source**: AWS Open Data Terrarium S3 — free, no key, encoded in
  `terrarium` format.
  - URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
  - `tileSize: 256`, `maxzoom: 14`, `exaggeration: 0.9`
- **Mobile basemap drape fix**: in 3D the camera tilts and MapLibre asks for
  low-zoom horizon tiles outside the SLC/Provo MBTiles range (z<10) and any tile
  outside the bbox. The custom `rntile://` protocol now falls back to Mapbox
  online (`outdoors-v12` for topo, `satellite-streets-v12` for sat) so terrain
  drape works everywhere. Local MBTiles still win for z10–15 in the SLC/Provo
  bbox — offline-first intact for the primary coverage area.
- **Config**: on web, the terrain source lives in `basemap/basemaps.json`
  under a `terrain:` key. On mobile, the same values are hardcoded in
  `mobile/src/mapHtml.js` under `const TERRAIN = {...}`. Keep both in sync when
  tuning (`exaggeration` especially).

### Offline-mode behavior

- **In the SLC/Provo coverage bbox at z10–15, offline**: basemap renders fine
  (local MBTiles). 3D tilts but the DEM source is unreachable → ground is
  flat under the tilted camera, no crash.
- **Outside the bbox or z<10, offline**: tiles come up transparent → white in
  3D. Fine as a graceful degradation; the user has clearly left the coverage
  area intentionally.

### Future work (not currently planned)

Bundling a local Terrain-RGB PMTiles file would give offline users real 3D
geometry inside the primary coverage area. Pipeline:

1. Download a Terrarium tile pyramid for the SLC/Provo bbox (e.g. `rio-rgbify`
   from USGS DEM, or tile pulldown from AWS Terrarium).
2. `pmtiles convert Terrain_SLC_Provo.mbtiles Terrain_SLC_Provo_terrarium.pmtiles`
3. Drop in `basemap/` (web) + `mobile/assets/basemap/` (mobile).
4. Point the TERRAIN config at the local PMTiles file (web uses `file:`
   property; mobile would need a `pmtiles://` or `rndem://` custom protocol
   analogous to the basemap one).

Deferred because: the online path already works for every realistic use case
(the user is in a canyon with LTE/5G when they open the app, or they'll see
flat ground in 3D offline — no worse than before 3D existed). Bundle size
would grow by 30–80 MB.
