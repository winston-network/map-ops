/**
 * Map Module
 * Handles MapLibre GL map initialization and interactions
 */

const MapModule = (function() {
    'use strict';

    let map = null;
    let userMarker = null;
    let accuracyCircle = null;
    let watchId = null;
    let currentPosition = null;
    let isTracking = false;

    // Tile server URL (run tile-server.js to serve local MBTiles)
    const LOCAL_TILE_SERVER = 'http://localhost:3000';

    // Local MBTiles style (satellite imagery from your basemap)
    const LOCAL_MBTILES_STYLE = {
        version: 8,
        name: 'Local Satellite',
        sources: {
            'local-tiles': {
                type: 'raster',
                tiles: [
                    `${LOCAL_TILE_SERVER}/tiles/{z}/{x}/{y}`
                ],
                tileSize: 256
            }
        },
        layers: [
            {
                id: 'local-tiles-layer',
                type: 'raster',
                source: 'local-tiles',
                minzoom: 0,
                maxzoom: 19
            }
        ]
    };

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
     * Check if local tile server is available
     */
    async function checkLocalTileServer() {
        try {
            const response = await fetch(`${LOCAL_TILE_SERVER}/health`, {
                method: 'GET',
                mode: 'cors'
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    /**
     * Initialize the map
     */
    function init(containerId, options = {}) {
        const defaultOptions = {
            center: [-111.7, 40.63], // Salt Lake City / Little Cottonwood area
            zoom: 12,
            minZoom: 2,
            maxZoom: 19
        };

        const mapOptions = { ...defaultOptions, ...options };

        // Start with dark style, will switch to local tiles if available
        map = new maplibregl.Map({
            container: containerId,
            style: DARK_MAP_STYLE,
            center: mapOptions.center,
            zoom: mapOptions.zoom,
            minZoom: mapOptions.minZoom,
            maxZoom: mapOptions.maxZoom,
            attributionControl: false
        });

        // Check for local tile server and switch if available
        checkLocalTileServer().then(available => {
            if (available) {
                console.log('Local tile server detected, switching to satellite basemap');
                map.setStyle(LOCAL_MBTILES_STYLE);
                // Re-fire map:loaded after style fully loads so layers get re-added
                map.once('idle', () => {
                    console.log('Map idle after style change, re-adding layers');
                    document.dispatchEvent(new CustomEvent('map:loaded'));
                });
            } else {
                console.log('Local tile server not available, using online tiles');
                console.log('Run "node tile-server.js" to enable local satellite imagery');
            }
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
                'fill-opacity': 0.3
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
                'line-width': 2
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
                'line-width': 3
            }
        });

        // Add point layer (use icon if available, otherwise circle)
        if (layer.icon) {
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
        updateScaleBar
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapModule;
}
