/**
 * Layer Utilities
 * Tools for converting coordinates and merging GeoJSON layers
 */

const LayerUtils = (function() {
    'use strict';

    /**
     * UTM Zone 12N (EPSG:26912) to WGS84 (EPSG:4326) conversion
     * Using simplified projection math for NAD83/WGS84 UTM Zone 12N
     */
    function utmToLatLng(easting, northing, zone = 12, northern = true) {
        const k0 = 0.9996;
        const a = 6378137; // WGS84 semi-major axis
        const e = 0.081819191; // WGS84 eccentricity
        const e1sq = 0.006739497;
        const falseEasting = 500000;
        const falseNorthing = northern ? 0 : 10000000;

        const x = easting - falseEasting;
        const y = northing - falseNorthing;

        const M = y / k0;
        const mu = M / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

        const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));

        const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
        const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
        const J3 = (151 * Math.pow(e1, 3) / 96);
        const J4 = (1097 * Math.pow(e1, 4) / 512);

        const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

        const C1 = e1sq * Math.pow(Math.cos(fp), 2);
        const T1 = Math.pow(Math.tan(fp), 2);
        const R1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
        const N1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
        const D = x / (N1 * k0);

        const Q1 = N1 * Math.tan(fp) / R1;
        const Q2 = Math.pow(D, 2) / 2;
        const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e1sq) * Math.pow(D, 4) / 24;
        const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 252 * e1sq - 3 * Math.pow(C1, 2)) * Math.pow(D, 6) / 720;

        const lat = fp - Q1 * (Q2 - Q3 + Q4);

        const Q5 = D;
        const Q6 = (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6;
        const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * e1sq + 24 * Math.pow(T1, 2)) * Math.pow(D, 5) / 120;

        const lng0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180; // Central meridian
        const lng = lng0 + (Q5 - Q6 + Q7) / Math.cos(fp);

        return {
            lat: lat * 180 / Math.PI,
            lng: lng * 180 / Math.PI
        };
    }

    /**
     * Convert coordinates in a GeoJSON geometry from UTM to WGS84
     */
    function convertGeometryCoordinates(geometry, zone = 12) {
        if (!geometry || !geometry.coordinates) return geometry;

        function convertCoord(coord) {
            if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                // Check if already in lat/lng format (roughly -180 to 180 for lng)
                if (Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90) {
                    return coord;
                }
                const result = utmToLatLng(coord[0], coord[1], zone, true);
                return [result.lng, result.lat];
            }
            return coord.map(c => convertCoord(c));
        }

        return {
            type: geometry.type,
            coordinates: convertCoord(geometry.coordinates)
        };
    }

    /**
     * Convert entire GeoJSON from UTM to WGS84
     */
    function convertGeoJSONToWGS84(geojson, zone = 12) {
        if (!geojson) return null;

        const converted = JSON.parse(JSON.stringify(geojson)); // Deep clone

        if (converted.type === 'FeatureCollection') {
            converted.features = converted.features.map(feature => ({
                ...feature,
                geometry: convertGeometryCoordinates(feature.geometry, zone)
            }));
            // Remove CRS property as it's now WGS84
            delete converted.crs;
        } else if (converted.type === 'Feature') {
            converted.geometry = convertGeometryCoordinates(converted.geometry, zone);
        }

        return converted;
    }

    /**
     * Merge multiple GeoJSON FeatureCollections into one
     */
    function mergeGeoJSON(geojsonArray, outputName = 'merged') {
        const merged = {
            type: 'FeatureCollection',
            name: outputName,
            features: []
        };

        geojsonArray.forEach((geojson, index) => {
            if (!geojson || !geojson.features) return;

            const sourceName = geojson.name || `layer_${index}`;

            geojson.features.forEach(feature => {
                // Add source layer info to properties
                const mergedFeature = {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        _sourceLayer: sourceName
                    }
                };
                merged.features.push(mergedFeature);
            });
        });

        return merged;
    }

    /**
     * Parse CSV with lat/lng columns to GeoJSON
     */
    function csvToGeoJSON(csvText, options = {}) {
        const {
            latColumn = 'Lat',
            lngColumn = 'Long',
            nameColumn = 'Name',
            delimiter = ','
        } = options;

        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return null;

        const headers = lines[0].split(delimiter).map(h => h.trim());
        const latIndex = headers.findIndex(h => h.toLowerCase() === latColumn.toLowerCase());
        const lngIndex = headers.findIndex(h => h.toLowerCase() === lngColumn.toLowerCase());
        const nameIndex = headers.findIndex(h => h.toLowerCase() === nameColumn.toLowerCase());

        if (latIndex === -1 || lngIndex === -1) {
            throw new Error('CSV must contain Lat and Long columns');
        }

        const features = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(delimiter).map(v => v.trim());
            if (values.length < Math.max(latIndex, lngIndex) + 1) continue;

            const lat = parseFloat(values[latIndex]);
            const lng = parseFloat(values[lngIndex]);

            if (isNaN(lat) || isNaN(lng)) continue;

            const properties = {};
            headers.forEach((header, idx) => {
                if (idx !== latIndex && idx !== lngIndex) {
                    properties[header] = values[idx];
                }
            });

            features.push({
                type: 'Feature',
                properties: properties,
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                }
            });
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    /**
     * Calculate bounding box for GeoJSON
     */
    function getBounds(geojson) {
        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;

        function processCoords(coords) {
            if (typeof coords[0] === 'number') {
                minLng = Math.min(minLng, coords[0]);
                maxLng = Math.max(maxLng, coords[0]);
                minLat = Math.min(minLat, coords[1]);
                maxLat = Math.max(maxLat, coords[1]);
            } else {
                coords.forEach(processCoords);
            }
        }

        geojson.features.forEach(f => {
            if (f.geometry && f.geometry.coordinates) {
                processCoords(f.geometry.coordinates);
            }
        });

        return [[minLng, minLat], [maxLng, maxLat]];
    }

    /**
     * Export GeoJSON to downloadable file
     */
    function downloadGeoJSON(geojson, filename = 'export.geojson') {
        const dataStr = JSON.stringify(geojson, null, 2);
        const blob = new Blob([dataStr], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Public API
    return {
        utmToLatLng,
        convertGeoJSONToWGS84,
        mergeGeoJSON,
        csvToGeoJSON,
        getBounds,
        downloadGeoJSON
    };
})();

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayerUtils;
}
