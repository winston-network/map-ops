/**
 * Map Module
 * Handles MapLibre GL map initialization and interactions
 * Uses PMTiles for basemap (no SQL/tile server required)
 */

const MapModule = (function() {
    'use strict';

    let map = null;
    let userMarker = null;
    let accuracyCircle = null;
    let watchId = null;
    let currentPosition = null;
    let isTracking = false;
    let pmtilesProtocol = null;
    let activeBasemap = null; // Track which basemap is active
    let BASEMAPS = {}; // Loaded from basemaps.json
    let TERRAIN = null; // Optional terrain DEM config from basemaps.json
    let viewMode = '2d'; // '2d' or '3d'
    let selectedHaloId = 0;

    /**
     * Load basemaps configuration from basemaps.json
     */
    async function loadBasemapsConfig() {
        try {
            const response = await fetch('basemap/basemaps.json');
            if (!response.ok) throw new Error('basemaps.json not found');
            const data = await response.json();

            // Convert array to object keyed by id
            BASEMAPS = {};
            data.basemaps.forEach(bm => {
                BASEMAPS[bm.id] = {
                    file: bm.file,
                    name: bm.name,
                    minzoom: bm.minzoom || 0,
                    maxzoom: bm.maxzoom || 19,
                    tiles: bm.tiles || null,
                    attribution: bm.attribution || ''
                };
                if (bm.default) {
                    activeBasemap = bm.id;
                }
            });

            // Default to first basemap if none marked as default
            if (!activeBasemap && data.basemaps.length > 0) {
                activeBasemap = data.basemaps[0].id;
            }

            // Optional terrain DEM (PMTiles `file` OR online `tiles` URL)
            if (data.terrain && (data.terrain.file || (data.terrain.tiles && data.terrain.tiles.length))) {
                TERRAIN = {
                    file: data.terrain.file || null,
                    tiles: data.terrain.tiles || null,
                    encoding: data.terrain.encoding || 'terrarium',
                    tileSize: data.terrain.tileSize || 256,
                    maxzoom: data.terrain.maxzoom || 14,
                    exaggeration: data.terrain.exaggeration || 1.4,
                    attribution: data.terrain.attribution || ''
                };
            }

            console.log('Loaded basemaps:', Object.keys(BASEMAPS), TERRAIN ? '+terrain' : '');
            return true;
        } catch (e) {
            console.warn('Could not load basemaps.json:', e.message);
            return false;
        }
    }

    // Build PMTiles URL (needs full URL for protocol handler)
    function getPMTilesUrl(filename) {
        const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
        const url = `pmtiles://${base}/basemap/${filename}`;
        console.log('PMTiles URL:', url);
        return url;
    }

    // Build a style that includes all basemaps. Each basemap can come from
    // either a local PMTiles file or an online raster tiles URL.
    // pmtilesAvailability is a map of basemapId -> bool (skip PMTiles when false).
    function buildBasemapStyle(pmtilesAvailability) {
        const sources = {};
        const layers = [];

        Object.keys(BASEMAPS).forEach(id => {
            const basemap = BASEMAPS[id];
            const sourceId = `${id}-tiles`;
            const usePmtiles = (pmtilesAvailability || {})[id] === true && basemap.file;

            sources[sourceId] = usePmtiles
                ? { type: 'raster', url: getPMTilesUrl(basemap.file), tileSize: 256 }
                : { type: 'raster', tiles: basemap.tiles || [], tileSize: 256, attribution: basemap.attribution || '' };

            layers.push({
                id: `${id}-layer`,
                type: 'raster',
                source: sourceId,
                minzoom: basemap.minzoom || 0,
                maxzoom: basemap.maxzoom || 19,
                layout: { 'visibility': id === activeBasemap ? 'visible' : 'none' }
            });
        });

        return {
            version: 8,
            name: 'MAP-OPS Basemaps',
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources,
            layers
        };
    }

    // Backwards-compat alias for any old callers.
    function buildPMTilesStyle() {
        return buildBasemapStyle({});
    }

    // Map style - using free OpenStreetMap tiles
    const MAP_STYLE = {
        version: 8,
        name: 'Offline Map Style',
        sources: {
            'osm-tiles': {
                type: 'raster',
                tiles: [
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
        },
        layers: [
            {
                id: 'osm-tiles-layer',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
                maxzoom: 19
            }
        ]
    };

    // Dark map style alternative
    const DARK_MAP_STYLE = {
        version: 8,
        name: 'Dark Map Style',
        sources: {
            'carto-dark': {
                type: 'raster',
                tiles: [
                    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                    'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                    'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
                ],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }
        },
        layers: [
            {
                id: 'carto-dark-layer',
                type: 'raster',
                source: 'carto-dark',
                minzoom: 0,
                maxzoom: 19
            }
        ]
    };

    /**
     * Probe each basemap's PMTiles file with a HEAD request; return a map of id -> bool.
     */
    async function probePMTilesAvailability() {
        const availability = {};
        const ids = Object.keys(BASEMAPS);
        await Promise.all(ids.map(async id => {
            const file = BASEMAPS[id].file;
            if (!file) { availability[id] = false; return; }
            try {
                const r = await fetch(`basemap/${file}`, { method: 'HEAD' });
                availability[id] = r.ok;
            } catch (_) { availability[id] = false; }
            console.log(`Basemap ${id} (${file}): ${availability[id] ? 'PMTiles available' : 'using online fallback'}`);
        }));
        return availability;
    }

    // Backwards-compat: returns whether any PMTiles file is available.
    async function checkPMTilesAvailable() {
        const a = await probePMTilesAvailability();
        return Object.values(a).some(Boolean);
    }

    /**
     * Toggle basemap visibility
     */
    function setBasemapVisibility(basemapId, visible) {
        if (!map) return;

        const layerId = `${basemapId}-layer`;
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
    }

    /**
     * Switch active basemap
     */
    function switchBasemap(basemapId) {
        if (!map || !BASEMAPS[basemapId]) return;

        // Hide all basemaps
        Object.keys(BASEMAPS).forEach(id => {
            setBasemapVisibility(id, false);
        });

        // Show selected basemap
        setBasemapVisibility(basemapId, true);
        activeBasemap = basemapId;

        console.log(`Switched to ${BASEMAPS[basemapId].name} basemap`);
    }

    /**
     * Get available basemaps
     */
    function getBasemaps() {
        return BASEMAPS;
    }

    /**
     * Get active basemap
     */
    function getActiveBasemap() {
        return activeBasemap;
    }

    /**
     * Initialize PMTiles protocol for MapLibre
     */
    function initPMTilesProtocol() {
        if (typeof pmtiles !== 'undefined' && !pmtilesProtocol) {
            pmtilesProtocol = new pmtiles.Protocol();
            maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);
            console.log('PMTiles protocol registered');
        }
    }

    /**
     * Initialize the map
     */
    async function init(containerId, options = {}) {
        const defaultOptions = {
            center: [-111.7, 40.63], // Salt Lake City / Little Cottonwood area
            zoom: 12,
            minZoom: 2,
            maxZoom: 19
        };

        const mapOptions = { ...defaultOptions, ...options };

        // Initialize PMTiles protocol (no SQL/tile server needed)
        initPMTilesProtocol();

        // Load basemap configuration from basemaps.json
        await loadBasemapsConfig();

        // Probe which (if any) basemap PMTiles are present locally, then build
        // a hybrid style with PMTiles where available and online raster fallback otherwise.
        const pmtilesAvailability = await probePMTilesAvailability();
        const initialStyle = Object.keys(BASEMAPS).length
            ? buildBasemapStyle(pmtilesAvailability)
            : DARK_MAP_STYLE;

        map = new maplibregl.Map({
            container: containerId,
            style: initialStyle,
            center: mapOptions.center,
            zoom: mapOptions.zoom,
            minZoom: mapOptions.minZoom,
            maxZoom: mapOptions.maxZoom,
            attributionControl: false
        });

        // Add navigation control
        map.addControl(new maplibregl.NavigationControl({
            showCompass: true,
            showZoom: false,
            visualizePitch: true
        }), 'bottom-right');

        // Setup event listeners
        setupEventListeners();

        return map;
    }

    /**
     * Setup map event listeners
     */
    function setupEventListeners() {
        map.on('load', () => {
            document.dispatchEvent(new CustomEvent('map:loaded'));
        });

        map.on('moveend', () => {
            updateScaleBar();
            document.dispatchEvent(new CustomEvent('map:moveend', {
                detail: {
                    center: map.getCenter(),
                    zoom: map.getZoom()
                }
            }));
        });

        map.on('zoomend', () => {
            updateScaleBar();
        });

        map.on('click', (e) => {
            document.dispatchEvent(new CustomEvent('map:click', {
                detail: {
                    lngLat: e.lngLat,
                    point: e.point
                }
            }));
        });

        map.on('rotate', () => {
            updateCompassRotation();
        });
    }

    /**
     * Update compass button rotation
     */
    function updateCompassRotation() {
        const compassBtn = document.getElementById('compass-btn');
        if (compassBtn) {
            const bearing = map.getBearing();
            compassBtn.style.transform = `rotate(${-bearing}deg)`;
        }
    }

    /**
     * Update scale bar
     */
    function updateScaleBar() {
        const scaleBar = document.querySelector('.scale-bar-inner');
        const scaleText = document.querySelector('.scale-text');
        if (!scaleBar || !scaleText) return;

        const maxWidth = 100;
        const y = map.getContainer().clientHeight / 2;

        const left = map.unproject([0, y]);
        const right = map.unproject([maxWidth, y]);

        const distance = left.distanceTo(right);
        const units = distance >= 1000 ? 'km' : 'm';
        const displayDistance = distance >= 1000 ? distance / 1000 : distance;

        // Round to nice numbers
        const niceNumbers = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
        let niceDistance = niceNumbers.find(n => n >= displayDistance) || displayDistance;
        niceDistance = Math.min(niceDistance, displayDistance * 2);

        const ratio = niceDistance / displayDistance;
        scaleBar.style.width = `${maxWidth * ratio}px`;
        scaleText.textContent = `${niceDistance.toFixed(units === 'km' && niceDistance < 1 ? 1 : 0)} ${units}`;
    }

    /**
     * Add GeoJSON layer to map
     */
    function addLayer(layer) {
        if (!map) return;
        // Defensive: ensure required style fields exist so missing values don't trip MapLibre.
        layer = Object.assign({ color: '#7ec8ff' }, layer);

        const sourceId = `source-${layer.id}`;
        const pointLayerId = `layer-${layer.id}-points`;
        const lineLayerId = `layer-${layer.id}-lines`;
        const polygonLayerId = `layer-${layer.id}-polygons`;

        // Remove existing layers if they exist
        removeLayer(layer.id);

        // Add source
        map.addSource(sourceId, {
            type: 'geojson',
            data: layer.data
        });

        // Add polygon layer
        map.addLayer({
            id: polygonLayerId,
            type: 'fill',
            source: sourceId,
            filter: ['any',
                ['==', ['geometry-type'], 'Polygon'],
                ['==', ['geometry-type'], 'MultiPolygon']
            ],
            paint: {
                'fill-color': layer.color,
                'fill-opacity': layer.fillOpacity != null ? layer.fillOpacity : 0.3
            }
        });

        // Add polygon outline
        map.addLayer({
            id: `${polygonLayerId}-outline`,
            type: 'line',
            source: sourceId,
            filter: ['any',
                ['==', ['geometry-type'], 'Polygon'],
                ['==', ['geometry-type'], 'MultiPolygon']
            ],
            paint: {
                'line-color': layer.color,
                'line-width': layer.lineWidth != null ? layer.lineWidth : 2,
                'line-opacity': layer.lineOpacity != null ? layer.lineOpacity : 1
            }
        });

        // Add line layer
        map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: sourceId,
            filter: ['any',
                ['==', ['geometry-type'], 'LineString'],
                ['==', ['geometry-type'], 'MultiLineString']
            ],
            paint: {
                'line-color': layer.color,
                'line-width': layer.lineWidth != null ? layer.lineWidth : 3,
                'line-opacity': layer.lineOpacity != null ? layer.lineOpacity : 1
            }
        });

        // Point layer: gate symbol (iconImage + iconSrc), or styled circles, or fallback
        if (layer.iconImage && layer.iconSrc) {
            const iconId = layer.iconImage;
            const addSymbol = () => {
                if (map.getLayer(pointLayerId)) return;
                map.addLayer({
                    id: pointLayerId,
                    type: 'symbol',
                    source: sourceId,
                    filter: ['any',
                        ['==', ['geometry-type'], 'Point'],
                        ['==', ['geometry-type'], 'MultiPoint']
                    ],
                    layout: {
                        'icon-image': iconId,
                        'icon-size': layer.iconSize != null ? layer.iconSize : 0.57,
                        'icon-allow-overlap': true,
                        'icon-anchor': layer.iconAnchor || 'bottom'
                    }
                });
            };
            if (map.hasImage(iconId)) {
                addSymbol();
            } else {
                map.loadImage(layer.iconSrc, (err, image) => {
                    if (err) { console.warn(`Gate icon load failed for ${layer.id}`); return; }
                    if (!map.hasImage(iconId)) map.addImage(iconId, image);
                    addSymbol();
                });
            }
        } else if (layer.circleRadius || layer.labelField) {
            // Styled circles + optional labels (staging areas) — sized via zoom interpolation
            const baseRadius = layer.circleRadius || 14;
            const baseLabelSize = layer.labelSize || 11;
            map.addLayer({
                id: pointLayerId,
                type: 'circle',
                source: sourceId,
                filter: ['any',
                    ['==', ['geometry-type'], 'Point'],
                    ['==', ['geometry-type'], 'MultiPoint']
                ],
                paint: {
                    'circle-color': layer.color,
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        8,  Math.max(3, baseRadius * 0.35),
                        12, Math.max(5, baseRadius * 0.55),
                        14, baseRadius,
                        17, baseRadius * 1.25
                    ],
                    'circle-stroke-color': layer.strokeColor || '#000000',
                    'circle-stroke-width': [
                        'interpolate', ['linear'], ['zoom'],
                        8,  1,
                        14, layer.strokeWidth != null ? layer.strokeWidth : 2,
                        17, (layer.strokeWidth != null ? layer.strokeWidth : 2) + 0.5
                    ]
                }
            });
            if (layer.labelField) {
                const labelMinZoom = layer.labelMinZoom != null ? layer.labelMinZoom : 13;
                map.addLayer({
                    id: `${pointLayerId}-labels`,
                    type: 'symbol',
                    source: sourceId,
                    minzoom: labelMinZoom,
                    filter: ['any',
                        ['==', ['geometry-type'], 'Point'],
                        ['==', ['geometry-type'], 'MultiPoint']
                    ],
                    layout: {
                        'text-field': ['get', layer.labelField],
                        'text-size': [
                            'interpolate', ['linear'], ['zoom'],
                            labelMinZoom,     baseLabelSize * 0.85,
                            labelMinZoom + 1, baseLabelSize,
                            labelMinZoom + 4, baseLabelSize * 1.25
                        ],
                        'text-font': ['Noto Sans Bold'],
                        'text-allow-overlap': true
                    },
                    paint: {
                        'text-color': layer.labelColor || '#000000',
                        // Fade in over a one-zoom window so the snap-in isn't jarring
                        'text-opacity': [
                            'interpolate', ['linear'], ['zoom'],
                            labelMinZoom,       0,
                            labelMinZoom + 0.5, 1
                        ]
                    }
                });
            }
        } else if (layer.icon) {
            // Load icon image if not already loaded
            const iconId = `icon-${layer.id}`;
            if (!map.hasImage(iconId)) {
                map.loadImage(layer.icon.url, (error, image) => {
                    if (error) {
                        console.warn(`Failed to load icon for ${layer.id}, using circle fallback`);
                        addCircleLayer();
                        return;
                    }
                    map.addImage(iconId, image);
                    addSymbolLayer();
                });
            } else {
                addSymbolLayer();
            }

            function addSymbolLayer() {
                map.addLayer({
                    id: pointLayerId,
                    type: 'symbol',
                    source: sourceId,
                    filter: ['any',
                        ['==', ['geometry-type'], 'Point'],
                        ['==', ['geometry-type'], 'MultiPoint']
                    ],
                    layout: {
                        'icon-image': iconId,
                        'icon-size': (layer.icon.size || 32) / 32,
                        'icon-allow-overlap': true,
                        'icon-anchor': 'center'
                    }
                });
            }

            function addCircleLayer() {
                map.addLayer({
                    id: pointLayerId,
                    type: 'circle',
                    source: sourceId,
                    filter: ['any',
                        ['==', ['geometry-type'], 'Point'],
                        ['==', ['geometry-type'], 'MultiPoint']
                    ],
                    paint: {
                        'circle-color': layer.color,
                        'circle-radius': 8,
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 2
                    }
                });
            }
        } else {
            // Default circle layer
            map.addLayer({
                id: pointLayerId,
                type: 'circle',
                source: sourceId,
                filter: ['any',
                    ['==', ['geometry-type'], 'Point'],
                    ['==', ['geometry-type'], 'MultiPoint']
                ],
                paint: {
                    'circle-color': layer.color,
                    'circle-radius': 8,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
        }

        // Add click handlers for features
        [pointLayerId, lineLayerId, polygonLayerId].forEach(layerId => {
            map.on('click', layerId, (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    document.dispatchEvent(new CustomEvent('feature:click', {
                        detail: {
                            layerId: layer.id,
                            feature: feature,
                            lngLat: e.lngLat
                        }
                    }));
                }
            });

            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        });

        // Set visibility
        setLayerVisibility(layer.id, layer.visible);
    }

    /**
     * Remove layer from map
     */
    function removeLayer(layerId) {
        const sourceId = `source-${layerId}`;
        const layerIds = [
            `layer-${layerId}-points-labels`,
            `layer-${layerId}-points`,
            `layer-${layerId}-lines`,
            `layer-${layerId}-polygons`,
            `layer-${layerId}-polygons-outline`
        ];

        layerIds.forEach(id => {
            if (map.getLayer(id)) {
                map.removeLayer(id);
            }
        });

        if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
        }
    }

    /**
     * Set layer visibility
     */
    function setLayerVisibility(layerId, visible) {
        const visibility = visible ? 'visible' : 'none';
        const layerIds = [
            `layer-${layerId}-points-labels`,
            `layer-${layerId}-points`,
            `layer-${layerId}-lines`,
            `layer-${layerId}-polygons`,
            `layer-${layerId}-polygons-outline`
        ];

        layerIds.forEach(id => {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, 'visibility', visibility);
            }
        });
    }

    /**
     * Fit map to bounds
     */
    function fitBounds(bounds, options = {}) {
        if (!bounds) return;

        const defaultOptions = {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            duration: 1000
        };

        map.fitBounds(bounds, { ...defaultOptions, ...options });
    }

    /**
     * Fly to location
     */
    function flyTo(center, zoom = 15) {
        map.flyTo({
            center: center,
            zoom: zoom,
            duration: 1500
        });
    }

    /**
     * Get current location using Geolocation API
     */
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentPosition = {
                        lng: position.coords.longitude,
                        lat: position.coords.latitude,
                        accuracy: position.coords.accuracy
                    };
                    resolve(currentPosition);
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    /**
     * Start watching position
     */
    function startTracking(callback) {
        if (!navigator.geolocation) {
            return null;
        }

        isTracking = true;

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                currentPosition = {
                    lng: position.coords.longitude,
                    lat: position.coords.latitude,
                    accuracy: position.coords.accuracy
                };

                updateUserMarker(currentPosition);

                if (callback) {
                    callback(currentPosition);
                }

                document.dispatchEvent(new CustomEvent('position:update', {
                    detail: currentPosition
                }));
            },
            (error) => {
                console.error('Position tracking error:', error);
                document.dispatchEvent(new CustomEvent('position:error', {
                    detail: error
                }));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );

        return watchId;
    }

    /**
     * Stop watching position
     */
    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        isTracking = false;
    }

    /**
     * Update user location marker
     */
    function updateUserMarker(position) {
        const { lng, lat, accuracy } = position;

        // Create marker element
        if (!userMarker) {
            const el = document.createElement('div');
            el.className = 'gps-marker';

            userMarker = new maplibregl.Marker({
                element: el,
                anchor: 'center'
            });
        }

        userMarker.setLngLat([lng, lat]).addTo(map);

        // Update accuracy circle
        updateAccuracyCircle(lng, lat, accuracy);
    }

    /**
     * Update accuracy circle around user marker
     */
    function updateAccuracyCircle(lng, lat, accuracy) {
        const sourceId = 'user-accuracy';
        const layerId = 'user-accuracy-circle';

        // Create a circle polygon for accuracy
        const circle = createCirclePolygon([lng, lat], accuracy);

        if (map.getSource(sourceId)) {
            map.getSource(sourceId).setData(circle);
        } else {
            map.addSource(sourceId, {
                type: 'geojson',
                data: circle
            });

            map.addLayer({
                id: layerId,
                type: 'fill',
                source: sourceId,
                paint: {
                    'fill-color': '#4f46e5',
                    'fill-opacity': 0.15
                }
            });

            map.addLayer({
                id: `${layerId}-outline`,
                type: 'line',
                source: sourceId,
                paint: {
                    'line-color': '#4f46e5',
                    'line-width': 2,
                    'line-opacity': 0.5
                }
            });
        }
    }

    /**
     * Create a circle polygon from center point and radius
     */
    function createCirclePolygon(center, radiusInMeters, points = 64) {
        const coordinates = [];
        const earthRadius = 6371000; // meters

        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * 2 * Math.PI;
            const dx = radiusInMeters * Math.cos(angle);
            const dy = radiusInMeters * Math.sin(angle);

            const lat = center[1] + (dy / earthRadius) * (180 / Math.PI);
            const lng = center[0] + (dx / earthRadius) * (180 / Math.PI) / Math.cos(center[1] * Math.PI / 180);

            coordinates.push([lng, lat]);
        }

        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
            }
        };
    }

    /**
     * Center on user location
     */
    async function centerOnUser() {
        try {
            const position = await getCurrentPosition();
            updateUserMarker(position);
            flyTo([position.lng, position.lat], 16);
            return position;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Zoom in
     */
    function zoomIn() {
        map.zoomIn({ duration: 300 });
    }

    /**
     * Zoom out
     */
    function zoomOut() {
        map.zoomOut({ duration: 300 });
    }

    /**
     * Reset bearing to north
     */
    function resetNorth() {
        map.easeTo({
            bearing: 0,
            pitch: 0,
            duration: 500
        });
    }

    /**
     * Set up the terrain DEM source. Called once after the PMTiles style is live.
     * Safe to call multiple times — re-adding is a no-op.
     */
    function setupTerrainSource() {
        if (!map || !TERRAIN) return;
        if (map.getSource('terrain-dem')) return;

        const source = {
            type: 'raster-dem',
            tileSize: TERRAIN.tileSize,
            maxzoom: TERRAIN.maxzoom,
            encoding: TERRAIN.encoding
        };
        if (TERRAIN.tiles && TERRAIN.tiles.length) {
            source.tiles = TERRAIN.tiles;
            if (TERRAIN.attribution) source.attribution = TERRAIN.attribution;
        } else if (TERRAIN.file) {
            source.url = getPMTilesUrl(TERRAIN.file);
        } else {
            return;
        }
        map.addSource('terrain-dem', source);
    }

    /**
     * Toggle 2D / 3D view mode.
     * 3D enables pitch and (when a DEM PMTiles is configured) terrain.
     * 2D flattens pitch and removes terrain.
     */
    function setViewMode(mode) {
        if (!map || (mode !== '2d' && mode !== '3d')) return;
        viewMode = mode;

        if (mode === '3d') {
            if (TERRAIN) {
                setupTerrainSource();
                map.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN.exaggeration });
            }
            map.easeTo({ pitch: 60, duration: 600 });
        } else {
            map.setTerrain(null);
            map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
        }
    }

    function getViewMode() {
        return viewMode;
    }

    /**
     * Highlight the boundary of the selected feature with a static blue stroke.
     * Polygons / lines -> blue line on the geometry edge.
     * Points -> bright blue ring around the icon/circle.
     * Pass null to clear.
     */
    function showSelectionHalo(feature) {
        if (!map) return;
        const sourceId = 'selection-halo';
        const lineLayer = 'selection-halo-line';
        const pointLayer = 'selection-halo-point';
        const HIGHLIGHT = '#7ec8ff';

        if (!feature) {
            [lineLayer, pointLayer].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
            if (map.getSource(sourceId)) map.removeSource(sourceId);
            return;
        }

        const data = { type: 'FeatureCollection', features: [feature] };
        if (map.getSource(sourceId)) {
            map.getSource(sourceId).setData(data);
        } else {
            map.addSource(sourceId, { type: 'geojson', data });
            // Polygon / line boundary stroke
            map.addLayer({
                id: lineLayer,
                type: 'line',
                source: sourceId,
                filter: ['any',
                    ['==', ['geometry-type'], 'Polygon'],
                    ['==', ['geometry-type'], 'MultiPolygon'],
                    ['==', ['geometry-type'], 'LineString'],
                    ['==', ['geometry-type'], 'MultiLineString']
                ],
                paint: {
                    'line-color': HIGHLIGHT,
                    'line-width': 4,
                    'line-opacity': 0.95
                }
            });
            // Point ring
            map.addLayer({
                id: pointLayer,
                type: 'circle',
                source: sourceId,
                filter: ['any',
                    ['==', ['geometry-type'], 'Point'],
                    ['==', ['geometry-type'], 'MultiPoint']
                ],
                paint: {
                    'circle-radius': 18,
                    'circle-color': 'rgba(0,0,0,0)',
                    'circle-stroke-color': HIGHLIGHT,
                    'circle-stroke-width': 3,
                    'circle-stroke-opacity': 0.9
                }
            });
        }
    }

    function clearSelectionHalo() {
        showSelectionHalo(null);
    }

    /**
     * Get map instance
     */
    function getMap() {
        return map;
    }

    /**
     * Get current tracking status
     */
    function getTrackingStatus() {
        return isTracking;
    }

    /**
     * Get current position
     */
    function getPosition() {
        return currentPosition;
    }

    // Public API
    return {
        init,
        addLayer,
        removeLayer,
        setLayerVisibility,
        fitBounds,
        flyTo,
        getCurrentPosition,
        startTracking,
        stopTracking,
        centerOnUser,
        zoomIn,
        zoomOut,
        resetNorth,
        getMap,
        getTrackingStatus,
        getPosition,
        updateScaleBar,
        switchBasemap,
        getBasemaps,
        getActiveBasemap,
        setBasemapVisibility,
        setViewMode,
        getViewMode,
        showSelectionHalo,
        clearSelectionHalo
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapModule;
}
