// Map HTML for WebView - MapLibre GL JS with tiles from React Native
export const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MAP-OPS</title>
  <script src="https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@4.5.0/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .maplibregl-ctrl-attrib { display: none !important; }
    .maplibregl-ctrl-logo { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Current state
    let currentBasemap = 'topo';
    let showAvyPaths = true;
    let showGates = true;
    let showStaging = true;
    let map = null;
    let tilesReady = false;

    // Tile cache
    const tileCache = new Map();

    // Pending tile requests (waiting for RN response)
    const pendingTileRequests = new Map();

    // GeoJSON data
    let avyPathsData = null;
    let gatesData = null;
    let stagingData = null;

    // Calculate bounds from GeoJSON
    function calculateBounds(geojsonLayers) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

      geojsonLayers.forEach(geojson => {
        if (!geojson || !geojson.features) return;
        geojson.features.forEach(feature => {
          const processCoords = (coords) => {
            if (typeof coords[0] === 'number') {
              minLng = Math.min(minLng, coords[0]);
              maxLng = Math.max(maxLng, coords[0]);
              minLat = Math.min(minLat, coords[1]);
              maxLat = Math.max(maxLat, coords[1]);
            } else {
              coords.forEach(processCoords);
            }
          };
          processCoords(feature.geometry.coordinates);
        });
      });

      return [[minLng - 0.01, minLat - 0.01], [maxLng + 0.01, maxLat + 0.01]];
    }

    // Request tile from React Native
    function requestTile(basemap, z, x, y) {
      const key = basemap + '/' + z + '/' + x + '/' + y;

      // Check cache first
      if (tileCache.has(key)) {
        return Promise.resolve(tileCache.get(key));
      }

      // Check if already pending
      if (pendingTileRequests.has(key)) {
        return pendingTileRequests.get(key);
      }

      // Create new request
      const promise = new Promise((resolve, reject) => {
        // Store resolver for when RN responds
        pendingTileRequests.set(key, { resolve, reject, promise: null });

        // Request tile from React Native
        sendMessage({
          type: 'getTile',
          basemap: basemap,
          z: z,
          x: x,
          y: y,
          key: key
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (pendingTileRequests.has(key)) {
            pendingTileRequests.delete(key);
            resolve(null); // Return null on timeout
          }
        }, 10000);
      });

      pendingTileRequests.get(key).promise = promise;
      return promise;
    }

    // Handle tile response from React Native
    function handleTileResponse(key, base64Data) {
      if (pendingTileRequests.has(key)) {
        const { resolve } = pendingTileRequests.get(key);
        pendingTileRequests.delete(key);

        if (base64Data) {
          const dataUrl = 'data:image/png;base64,' + base64Data;
          tileCache.set(key, dataUrl);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      }
    }

    // Custom protocol for loading tiles from RN
    maplibregl.addProtocol('rntile', (params, callback) => {
      // URL format: rntile://basemap/z/x/y
      const url = params.url.replace('rntile://', '');
      const parts = url.split('/');
      const basemap = parts[0];
      const z = parseInt(parts[1]);
      const x = parseInt(parts[2]);
      const y = parseInt(parts[3]);

      requestTile(basemap, z, x, y)
        .then(dataUrl => {
          if (dataUrl) {
            // Fetch the data URL and return as ArrayBuffer
            fetch(dataUrl)
              .then(response => response.arrayBuffer())
              .then(data => callback(null, data, null, null))
              .catch(err => callback(err));
          } else {
            callback(new Error('Tile not found'));
          }
        })
        .catch(err => callback(err));

      return { cancel: () => {} };
    });

    // Create style with custom tile source
    function createStyle(basemap) {
      return {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: ['rntile://' + basemap + '/{z}/{x}/{y}'],
            tileSize: 256,
            minzoom: 10,
            maxzoom: 16
          }
        },
        layers: [
          {
            id: 'basemap-layer',
            type: 'raster',
            source: 'basemap',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      };
    }

    // Initialize map
    function initMap() {
      map = new maplibregl.Map({
        container: 'map',
        style: createStyle(currentBasemap),
        center: [-111.6, 40.58],
        zoom: 12,
        attributionControl: false
      });

      map.on('load', () => {
        // Notify React Native that map is ready
        sendMessage({ type: 'mapReady' });
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
      });

      // Click handlers for features
      map.on('click', 'avy-paths-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          sendMessage({
            type: 'featureSelected',
            featureType: 'Avalanche Path',
            description: feature.properties.description || feature.properties.name || 'Unknown Path'
          });
        }
      });

      map.on('click', 'gates-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          sendMessage({
            type: 'featureSelected',
            featureType: 'Gate',
            description: feature.properties.description || 'Gate'
          });
        }
      });

      map.on('click', 'staging-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          sendMessage({
            type: 'featureSelected',
            featureType: 'Staging Area',
            description: 'Mile Marker ' + (feature.properties.description || '?')
          });
        }
      });
    }

    // Add avalanche paths layer
    function addAvyPathsLayer() {
      if (!map || !avyPathsData) return;

      if (map.getSource('avy-paths')) {
        map.getSource('avy-paths').setData(avyPathsData);
      } else {
        map.addSource('avy-paths', { type: 'geojson', data: avyPathsData });

        map.addLayer({
          id: 'avy-paths-fill',
          type: 'fill',
          source: 'avy-paths',
          paint: {
            'fill-color': '#7ec8ff',
            'fill-opacity': 0.3
          }
        });

        map.addLayer({
          id: 'avy-paths-line',
          type: 'line',
          source: 'avy-paths',
          paint: {
            'line-color': '#7ec8ff',
            'line-width': 2,
            'line-opacity': 0.8
          }
        });
      }

      updateLayerVisibility();
    }

    // Add gates layer
    function addGatesLayer() {
      if (!map || !gatesData) return;

      if (map.getSource('gates')) {
        map.getSource('gates').setData(gatesData);
      } else {
        map.addSource('gates', { type: 'geojson', data: gatesData });

        // Use circle for gates (simpler, works offline)
        map.addLayer({
          id: 'gates-layer',
          type: 'circle',
          source: 'gates',
          paint: {
            'circle-radius': 8,
            'circle-color': '#f59e0b',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
      }

      updateLayerVisibility();
    }

    // Add staging/mile marker layer
    function addStagingLayer() {
      if (!map || !stagingData) return;

      if (map.getSource('staging')) {
        map.getSource('staging').setData(stagingData);
      } else {
        map.addSource('staging', { type: 'geojson', data: stagingData });

        map.addLayer({
          id: 'staging-layer',
          type: 'circle',
          source: 'staging',
          paint: {
            'circle-radius': 14,
            'circle-color': '#f97316',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        map.addLayer({
          id: 'staging-labels',
          type: 'symbol',
          source: 'staging',
          layout: {
            'text-field': ['get', 'description'],
            'text-size': 10,
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
      }

      updateLayerVisibility();
    }

    // Update layer visibility
    function updateLayerVisibility() {
      if (!map) return;

      const setVisibility = (layerId, visible) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      };

      setVisibility('avy-paths-fill', showAvyPaths);
      setVisibility('avy-paths-line', showAvyPaths);
      setVisibility('gates-layer', showGates);
      setVisibility('staging-layer', showStaging);
      setVisibility('staging-labels', showStaging);
    }

    // Switch basemap
    function switchBasemap(basemap) {
      if (!map || basemap === currentBasemap) return;
      currentBasemap = basemap;

      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();

      map.setStyle(createStyle(basemap));

      map.once('style.load', () => {
        map.setCenter(currentCenter);
        map.setZoom(currentZoom);
        if (avyPathsData) addAvyPathsLayer();
        if (gatesData) addGatesLayer();
        if (stagingData) addStagingLayer();
      });
    }

    // Update user location
    function updateUserLocation(lng, lat) {
      if (!map) return;

      if (map.getSource('user-location')) {
        map.getSource('user-location').setData({
          type: 'Point',
          coordinates: [lng, lat]
        });
      } else {
        map.addSource('user-location', {
          type: 'geojson',
          data: { type: 'Point', coordinates: [lng, lat] }
        });

        map.addLayer({
          id: 'user-location-layer',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': 8,
            'circle-color': '#4285f4',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff'
          }
        });
      }
    }

    // Send message to React Native
    function sendMessage(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    // Handle messages from React Native
    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'setGeoJSON':
            avyPathsData = data.avyPaths;
            gatesData = data.gates;
            stagingData = data.staging;

            const addLayers = () => {
              addAvyPathsLayer();
              addGatesLayer();
              addStagingLayer();
              const bounds = calculateBounds([avyPathsData, gatesData, stagingData]);
              if (bounds[0][0] !== Infinity) {
                map.fitBounds(bounds, { padding: 50 });
              }
            };

            if (map && map.isStyleLoaded()) {
              addLayers();
            } else if (map) {
              map.once('style.load', addLayers);
            }
            break;

          case 'toggleLayer':
            if (data.layer === 'avyPaths') showAvyPaths = data.visible;
            if (data.layer === 'gates') showGates = data.visible;
            if (data.layer === 'staging') showStaging = data.visible;
            updateLayerVisibility();
            break;

          case 'setBasemap':
            switchBasemap(data.basemap);
            break;

          case 'tileResponse':
            handleTileResponse(data.key, data.data);
            break;

          case 'updateLocation':
            updateUserLocation(data.lng, data.lat);
            break;

          case 'tilesReady':
            tilesReady = true;
            break;
        }
      } catch (e) {
        console.error('Error handling message:', e);
      }
    }

    // Listen for messages
    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);

    // Initialize
    initMap();
  </script>
</body>
</html>
`;
