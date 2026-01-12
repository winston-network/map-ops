// Map HTML for WebView - MapLibre GL JS with tiles from React Native via postMessage
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
    #debug { position: absolute; top: 10px; left: 10px; right: 10px; background: rgba(0,0,0,0.8); color: #0f0; font-family: monospace; font-size: 10px; padding: 8px; z-index: 9999; max-height: 150px; overflow: auto; border-radius: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="debug">Initializing...</div>
  <script>
    // Debug logging
    const debugEl = document.getElementById('debug');
    const debugLog = [];
    function log(msg) {
      debugLog.push(msg);
      if (debugLog.length > 15) debugLog.shift();
      debugEl.innerHTML = debugLog.join('<br>');
      console.log(msg);
    }

    // Current state
    let currentBasemap = 'topo';
    let showAvyPaths = true;
    let showGates = true;
    let showStaging = true;
    let map = null;
    let tileBridgeReady = false;

    // Tile request tracking
    let requestId = 0;
    const pendingRequests = {};

    log('Waiting for TileBridge...');

    // GeoJSON data
    let avyPathsData = null;
    let gatesData = null;
    let stagingData = null;

    // Request a tile from React Native
    function requestTile(basemap, z, x, y) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        pendingRequests[id] = { resolve, reject };

        sendMessage({
          type: 'getTile',
          requestId: id,
          basemap,
          z,
          x,
          y
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (pendingRequests[id]) {
            delete pendingRequests[id];
            reject(new Error('Tile request timeout'));
          }
        }, 10000);
      });
    }

    // Handle tile response from React Native
    function handleTileResponse(id, tileData) {
      const request = pendingRequests[id];
      if (request) {
        delete pendingRequests[id];
        if (tileData) {
          // Convert base64 to Uint8Array
          const binary = atob(tileData);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          request.resolve(bytes);
        } else {
          request.reject(new Error('Tile not found'));
        }
      }
    }

    // Register custom protocol for tile loading
    function registerTileProtocol() {
      maplibregl.addProtocol('rntile', (params, callback) => {
        // Parse URL: rntile://basemap/z/x/y
        const url = params.url.replace('rntile://', '');
        const parts = url.split('/');
        const basemap = parts[0];
        const z = parseInt(parts[1]);
        const x = parseInt(parts[2]);
        const y = parseInt(parts[3]);

        requestTile(basemap, z, x, y)
          .then(data => {
            callback(null, data, null, null);
          })
          .catch(err => {
            callback(err);
          });

        return { cancel: () => {} };
      });
      log('Custom tile protocol registered');
    }

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

    // Create style with custom tile source
    function createStyle(basemap) {
      if (!tileBridgeReady) {
        log('createStyle: TileBridge not ready');
        return {
          version: 8,
          sources: {},
          layers: [{
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#1a1a2e' }
          }]
        };
      }

      log('Creating style for: ' + basemap);

      return {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: ['rntile://' + basemap + '/{z}/{x}/{y}'],
            tileSize: 256,
            minzoom: 0,
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
      log('initMap called');

      // Register custom tile protocol
      registerTileProtocol();

      map = new maplibregl.Map({
        container: 'map',
        style: createStyle(currentBasemap),
        center: [-111.6, 40.58],
        zoom: 12,
        attributionControl: false
      });

      map.on('load', () => {
        log('Map loaded, sending mapReady');
        sendMessage({ type: 'mapReady' });
      });

      map.on('error', (e) => {
        log('Map error: ' + (e.error ? e.error.message : JSON.stringify(e)));
      });

      map.on('sourcedataloading', (e) => {
        if (e.sourceId === 'basemap') {
          log('Loading basemap tiles...');
        }
      });

      map.on('sourcedata', (e) => {
        if (e.sourceId === 'basemap' && e.isSourceLoaded) {
          log('Basemap tiles loaded!');
        }
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
          case 'tileBridgeReady':
            log('TileBridge ready!');
            tileBridgeReady = true;
            // Reload map style with basemap now that TileBridge is ready
            if (map) {
              log('Setting map style with basemap');
              map.setStyle(createStyle(currentBasemap));
              // Re-add layers after style loads
              map.once('style.load', () => {
                log('Style loaded, adding layers');
                if (avyPathsData) addAvyPathsLayer();
                if (gatesData) addGatesLayer();
                if (stagingData) addStagingLayer();
                // Fit bounds if we have data
                const bounds = calculateBounds([avyPathsData, gatesData, stagingData]);
                if (bounds[0][0] !== Infinity) {
                  map.fitBounds(bounds, { padding: 50 });
                }
                log('Layers added, bounds fit');
              });
            }
            break;

          case 'tileResponse':
            // Handle tile data from React Native
            handleTileResponse(data.requestId, data.tileData);
            break;

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

          case 'updateLocation':
            updateUserLocation(data.lng, data.lat);
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
