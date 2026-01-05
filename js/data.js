/**
 * Data Handler Module
 * Handles loading, parsing, and managing GeoJSON, KML, and GPX data
 */

const DataHandler = (function() {
    'use strict';

    // Storage key for IndexedDB
    const DB_NAME = 'OfflineMapDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'layers';

    let db = null;

    // Layer color palette
    const LAYER_COLORS = [
        '#ef4444', // red
        '#f97316', // orange
        '#eab308', // yellow
        '#22c55e', // green
        '#14b8a6', // teal
        '#3b82f6', // blue
        '#8b5cf6', // violet
        '#ec4899', // pink
    ];

    let colorIndex = 0;

    /**
     * Initialize IndexedDB for offline storage
     */
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Generate unique ID
     */
    function generateId() {
        return 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get next color from palette
     */
    function getNextColor() {
        const color = LAYER_COLORS[colorIndex % LAYER_COLORS.length];
        colorIndex++;
        return color;
    }

    /**
     * Check if GeoJSON uses projected coordinates (UTM) instead of lat/lng
     */
    function isProjectedCRS(geojson) {
        // Check for CRS property indicating projected coordinates
        if (geojson.crs && geojson.crs.properties && geojson.crs.properties.name) {
            const crsName = geojson.crs.properties.name.toLowerCase();
            // Check for EPSG codes that are projected (UTM zones, etc)
            if (crsName.includes('epsg') && !crsName.includes('4326')) {
                return true;
            }
        }

        // Also check first coordinate - if values > 180, likely projected
        if (geojson.features && geojson.features.length > 0) {
            const firstFeature = geojson.features[0];
            if (firstFeature.geometry && firstFeature.geometry.coordinates) {
                const coords = firstFeature.geometry.coordinates;
                const firstCoord = Array.isArray(coords[0]) ?
                    (Array.isArray(coords[0][0]) ?
                        (Array.isArray(coords[0][0][0]) ? coords[0][0][0] : coords[0][0])
                        : coords[0])
                    : coords;

                if (typeof firstCoord[0] === 'number' && Math.abs(firstCoord[0]) > 180) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Parse GeoJSON data
     */
    function parseGeoJSON(data, filename) {
        try {
            let geojson = typeof data === 'string' ? JSON.parse(data) : data;

            // Validate GeoJSON structure
            if (!geojson.type) {
                throw new Error('Invalid GeoJSON: missing type property');
            }

            // Normalize to FeatureCollection
            let featureCollection;
            if (geojson.type === 'FeatureCollection') {
                featureCollection = geojson;
            } else if (geojson.type === 'Feature') {
                featureCollection = {
                    type: 'FeatureCollection',
                    features: [geojson]
                };
            } else if (['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'].includes(geojson.type)) {
                featureCollection = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: geojson,
                        properties: {}
                    }]
                };
            } else {
                throw new Error('Invalid GeoJSON type: ' + geojson.type);
            }

            // Auto-detect and convert projected coordinates to WGS84
            if (isProjectedCRS(featureCollection)) {
                console.log('Detected projected coordinates, converting to WGS84...');
                if (typeof LayerUtils !== 'undefined' && LayerUtils.convertGeoJSONToWGS84) {
                    featureCollection = LayerUtils.convertGeoJSONToWGS84(featureCollection, 12);
                }
            }

            return {
                id: generateId(),
                name: filename.replace(/\.(geojson|json)$/i, ''),
                color: getNextColor(),
                visible: true,
                data: featureCollection,
                featureCount: featureCollection.features.length,
                bounds: calculateBounds(featureCollection)
            };
        } catch (error) {
            throw new Error('Failed to parse GeoJSON: ' + error.message);
        }
    }

    /**
     * Parse KML data using toGeoJSON library
     */
    function parseKML(data, filename) {
        try {
            const parser = new DOMParser();
            const kml = parser.parseFromString(data, 'text/xml');

            // Check for parsing errors
            const parseError = kml.querySelector('parsererror');
            if (parseError) {
                throw new Error('Invalid KML format');
            }

            // Convert to GeoJSON using toGeoJSON library
            const geojson = toGeoJSON.kml(kml);

            return {
                id: generateId(),
                name: filename.replace(/\.kml$/i, ''),
                color: getNextColor(),
                visible: true,
                data: geojson,
                featureCount: geojson.features.length,
                bounds: calculateBounds(geojson)
            };
        } catch (error) {
            throw new Error('Failed to parse KML: ' + error.message);
        }
    }

    /**
     * Parse GPX data using toGeoJSON library
     */
    function parseGPX(data, filename) {
        try {
            const parser = new DOMParser();
            const gpx = parser.parseFromString(data, 'text/xml');

            // Check for parsing errors
            const parseError = gpx.querySelector('parsererror');
            if (parseError) {
                throw new Error('Invalid GPX format');
            }

            // Convert to GeoJSON using toGeoJSON library
            const geojson = toGeoJSON.gpx(gpx);

            return {
                id: generateId(),
                name: filename.replace(/\.gpx$/i, ''),
                color: getNextColor(),
                visible: true,
                data: geojson,
                featureCount: geojson.features.length,
                bounds: calculateBounds(geojson)
            };
        } catch (error) {
            throw new Error('Failed to parse GPX: ' + error.message);
        }
    }

    /**
     * Calculate bounding box for GeoJSON
     */
    function calculateBounds(geojson) {
        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;

        function processCoordinates(coords) {
            if (typeof coords[0] === 'number') {
                // Single coordinate [lng, lat]
                minLng = Math.min(minLng, coords[0]);
                maxLng = Math.max(maxLng, coords[0]);
                minLat = Math.min(minLat, coords[1]);
                maxLat = Math.max(maxLat, coords[1]);
            } else {
                // Array of coordinates
                coords.forEach(processCoordinates);
            }
        }

        function processGeometry(geometry) {
            if (!geometry) return;

            if (geometry.type === 'GeometryCollection') {
                geometry.geometries.forEach(processGeometry);
            } else if (geometry.coordinates) {
                processCoordinates(geometry.coordinates);
            }
        }

        geojson.features.forEach(feature => {
            processGeometry(feature.geometry);
        });

        if (minLng === Infinity) {
            return null;
        }

        return [[minLng, minLat], [maxLng, maxLat]];
    }

    /**
     * Parse CSV data with lat/lng columns
     */
    function parseCSV(data, filename) {
        try {
            if (typeof LayerUtils !== 'undefined' && LayerUtils.csvToGeoJSON) {
                const geojson = LayerUtils.csvToGeoJSON(data);
                geojson.name = filename.replace(/\.csv$/i, '');

                return {
                    id: generateId(),
                    name: geojson.name,
                    color: getNextColor(),
                    visible: true,
                    data: geojson,
                    featureCount: geojson.features.length,
                    bounds: calculateBounds(geojson)
                };
            } else {
                throw new Error('LayerUtils not available for CSV parsing');
            }
        } catch (error) {
            throw new Error('Failed to parse CSV: ' + error.message);
        }
    }

    /**
     * Load file and parse based on extension
     */
    async function loadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const extension = file.name.split('.').pop().toLowerCase();

            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    let layer;

                    switch (extension) {
                        case 'geojson':
                        case 'json':
                            layer = parseGeoJSON(content, file.name);
                            break;
                        case 'kml':
                            layer = parseKML(content, file.name);
                            break;
                        case 'gpx':
                            layer = parseGPX(content, file.name);
                            break;
                        case 'csv':
                            layer = parseCSV(content, file.name);
                            break;
                        default:
                            throw new Error('Unsupported file format: ' + extension);
                    }

                    resolve(layer);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Save layer to IndexedDB
     */
    async function saveLayer(layer) {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(layer);

            request.onsuccess = () => resolve(layer);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all layers from IndexedDB
     */
    async function getAllLayers() {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete layer from IndexedDB
     */
    async function deleteLayer(id) {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update layer visibility
     */
    async function updateLayerVisibility(id, visible) {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const layer = getRequest.result;
                if (layer) {
                    layer.visible = visible;
                    const putRequest = store.put(layer);
                    putRequest.onsuccess = () => resolve(layer);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    reject(new Error('Layer not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Search features by property values
     */
    function searchFeatures(layers, query) {
        const results = [];
        const searchTerm = query.toLowerCase();

        layers.forEach(layer => {
            if (!layer.visible) return;

            layer.data.features.forEach((feature, index) => {
                const props = feature.properties || {};
                const match = Object.values(props).some(value => {
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(searchTerm);
                });

                if (match) {
                    results.push({
                        layerId: layer.id,
                        layerName: layer.name,
                        featureIndex: index,
                        feature: feature,
                        properties: props
                    });
                }
            });
        });

        return results;
    }

    /**
     * Get feature statistics
     */
    function getFeatureStats(layer) {
        const stats = {
            points: 0,
            lines: 0,
            polygons: 0,
            total: layer.data.features.length
        };

        layer.data.features.forEach(feature => {
            const type = feature.geometry?.type;
            if (type === 'Point' || type === 'MultiPoint') {
                stats.points++;
            } else if (type === 'LineString' || type === 'MultiLineString') {
                stats.lines++;
            } else if (type === 'Polygon' || type === 'MultiPolygon') {
                stats.polygons++;
            }
        });

        return stats;
    }

    // Public API
    return {
        initDB,
        loadFile,
        parseGeoJSON,
        parseKML,
        parseGPX,
        saveLayer,
        getAllLayers,
        deleteLayer,
        updateLayerVisibility,
        searchFeatures,
        getFeatureStats,
        calculateBounds
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataHandler;
}
