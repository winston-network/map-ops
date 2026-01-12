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
    #debug { position: absolute; top: 40px; left: 10px; right: 10px; background: rgba(0,0,0,0.8); color: #0f0; font-family: monospace; font-size: 10px; padding: 8px; z-index: 9999; max-height: 150px; overflow: auto; border-radius: 4px; display: none; }
    #debug-toggle { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; padding: 4px 8px; z-index: 10000; border-radius: 4px; border: none; cursor: pointer; }
  </style>
</head>
<body>
  <div id="map"></div>
  <button id="debug-toggle" onclick="toggleDebug()">Debug</button>
  <div id="debug">Initializing...</div>
  <script>
    // Debug toggle
    let debugVisible = false;
    function toggleDebug() {
      debugVisible = !debugVisible;
      document.getElementById('debug').style.display = debugVisible ? 'block' : 'none';
    }
    // Debug logging
    const debugEl = document.getElementById('debug');
    const debugLog = [];
    function log(msg) {
      debugLog.push(msg);
      if (debugLog.length > 30) debugLog.shift();
      debugEl.innerHTML = debugLog.join('<br>');
      console.log(msg);
    }
    // Make log available globally for injectJavaScript calls
    window.log = log;

    // Gate icon as base64
    const GATE_ICON_BASE64 = 'data:image/png;base64,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';

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
          try {
            // Convert base64 to Uint8Array
            const binary = atob(tileData);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            request.resolve(bytes);
          } catch (e) {
            request.reject(e);
          }
        } else {
          request.reject(new Error('Tile not found'));
        }
      }
    }

    // Global function for receiving tile data via injectJavaScript (handles large payloads)
    window.handleTileData = function(id, tileData) {
      handleTileResponse(id, tileData);
    };

    // Global function for receiving GeoJSON data via injectJavaScript
    window.setGeoJSONData = function(data) {
      log('*** setGeoJSONData CALLED ***');
      try {
        const avyCount = data.avyPaths && data.avyPaths.features ? data.avyPaths.features.length : 0;
        const gatesCount = data.gates && data.gates.features ? data.gates.features.length : 0;
        const stagingCount = data.staging && data.staging.features ? data.staging.features.length : 0;
        log('GeoJSON counts: avy=' + avyCount + ', gates=' + gatesCount + ', staging=' + stagingCount);

      avyPathsData = data.avyPaths;
      gatesData = data.gates;
      stagingData = data.staging;

      const addAllLayers = () => {
        log('Adding GeoJSON layers...');
        try {
          addAvyPathsLayer();
          addGatesLayer();
          addStagingLayer();
          // Check what layers exist
          const layers = map.getStyle().layers.map(l => l.id);
          log('Layers: ' + layers.join(', '));
          const b = calculateBounds([avyPathsData, gatesData, stagingData]);
          if (b[0][0] !== Infinity) {
            map.fitBounds(b, { padding: 50 });
            log('Bounds fitted');
          }
        } catch (e) {
          log('Error adding layers: ' + e.message);
        }
      };

      if (map && map.isStyleLoaded()) {
        log('Style loaded, adding layers now');
        addAllLayers();
      } else if (map) {
        log('Waiting for style.load...');
        map.once('style.load', addAllLayers);
      }
    } catch (e) {
      log('setGeoJSONData ERROR: ' + e.message);
    }
  };

    // Register custom protocol for tile loading (MapLibre v4+ uses Promise-based API)
    function registerTileProtocol() {
      maplibregl.addProtocol('rntile', async (params) => {
        // Parse URL: rntile://basemap/z/x/y
        const url = params.url.replace('rntile://', '');
        const parts = url.split('/');
        const basemap = parts[0];
        const z = parseInt(parts[1]);
        const x = parseInt(parts[2]);
        const y = parseInt(parts[3]);

        try {
          const data = await requestTile(basemap, z, x, y);
          return { data: data };
        } catch (err) {
          throw err;
        }
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
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
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
        center: [-111.58, 40.60],
        zoom: 10,
        attributionControl: false
      });

      map.on('load', () => {
        log('Map loaded, sending mapReady');
        sendMessage({ type: 'mapReady' });
      });

      map.on('error', (e) => {
        // Ignore tile not found errors (expected for missing tiles)
        const msg = e.error ? e.error.message : '';
        if (!msg.includes('Tile not found') && !msg.includes('404')) {
          log('Map error: ' + (msg || JSON.stringify(e)));
        }
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
            'fill-color': '#f472b6',
            'fill-opacity': 0.3
          }
        });

        map.addLayer({
          id: 'avy-paths-line',
          type: 'line',
          source: 'avy-paths',
          paint: {
            'line-color': '#f472b6',
            'line-width': 2,
            'line-opacity': 0.8
          }
        });
      }

      updateLayerVisibility();
    }

    // Pre-load gate icon
    let gateIconImage = null;
    function loadGateIcon() {
      log('Loading gate icon...');
      const img = new Image();
      img.onload = function() {
        log('Gate icon loaded: ' + img.width + 'x' + img.height);
        gateIconImage = img;
      };
      img.onerror = function(e) {
        log('Gate icon FAILED to load');
      };
      img.src = GATE_ICON_BASE64;
    }
    // Load after a brief delay to ensure logging is ready
    setTimeout(loadGateIcon, 100);

    // Add gates layer - yellow circles with "G" text
    function addGatesLayer() {
      if (!map || !gatesData) return;
      if (map.getSource('gates')) return;

      map.addSource('gates', { type: 'geojson', data: gatesData });

      // Yellow circle background
      map.addLayer({
        id: 'gates-layer',
        type: 'circle',
        source: 'gates',
        paint: {
          'circle-radius': 14,
          'circle-color': '#fbbf24',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // "G" text label
      map.addLayer({
        id: 'gates-labels',
        type: 'symbol',
        source: 'gates',
        layout: {
          'text-field': 'G',
          'text-size': 14,
          'text-font': ['Open Sans Regular'],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#000000'
        }
      });

      updateLayerVisibility();
    }

    // Add staging/mile marker layer
    function addStagingLayer() {
      if (!map || !stagingData) return;
      if (map.getSource('staging')) return;

      map.addSource('staging', { type: 'geojson', data: stagingData });

      map.addLayer({
        id: 'staging-layer',
        type: 'circle',
        source: 'staging',
        paint: {
          'circle-radius': 14,
          'circle-color': '#ff6600',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#000000'
        }
      });

      // Text label - extract number from "Staging Area 10.1" -> show "10.1"
      map.addLayer({
        id: 'staging-labels',
        type: 'symbol',
        source: 'staging',
        layout: {
          'text-field': ['concat',
            ['slice', ['get', 'description'], 13, 17]
          ],
          'text-size': 11,
          'text-font': ['Open Sans Bold'],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#000000'
        }
      });

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
      setVisibility('gates-labels', showGates);
      setVisibility('staging-layer', showStaging);
      setVisibility('staging-labels', showStaging);
    }

    // Switch basemap
    function switchBasemap(basemap) {
      if (!map || basemap === currentBasemap) return;
      log('Switching to: ' + basemap);
      currentBasemap = basemap;

      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();

      const reAddLayers = () => {
        log('Re-adding GeoJSON layers...');
        try {
          // Clear any existing sources first (safety)
          ['avy-paths', 'gates', 'staging'].forEach(src => {
            if (map.getSource(src)) {
              log('Removing old source: ' + src);
              const layers = map.getStyle().layers.filter(l => l.source === src);
              layers.forEach(l => map.removeLayer(l.id));
              map.removeSource(src);
            }
          });

          map.setCenter(currentCenter);
          map.setZoom(currentZoom);

          if (avyPathsData) {
            log('Adding avy paths (' + avyPathsData.features.length + ' features)');
            addAvyPathsLayer();
          }
          if (gatesData) {
            log('Adding gates (' + gatesData.features.length + ' features)');
            addGatesLayer();
          }
          if (stagingData) {
            log('Adding staging (' + stagingData.features.length + ' features)');
            addStagingLayer();
          }

          // Verify layers were added
          const layers = map.getStyle().layers.map(l => l.id);
          log('Final layers: ' + layers.join(', '));
        } catch (e) {
          log('ERROR re-adding: ' + e.message);
          log('Stack: ' + e.stack);
        }
      };

      // Set new style
      map.setStyle(createStyle(basemap));

      // Poll for style loaded since style.load event is unreliable
      const waitForStyle = () => {
        if (map.isStyleLoaded()) {
          log('Style ready for ' + basemap);
          setTimeout(reAddLayers, 100);
        } else {
          log('Waiting for style...');
          setTimeout(waitForStyle, 100);
        }
      };
      setTimeout(waitForStyle, 50);
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
        if (data.type !== 'tileResponse') {
          log('Message received: ' + data.type);
        }

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
            log('tileResponse received: id=' + data.requestId + ', hasData=' + !!data.tileData + ', len=' + (data.tileData ? data.tileData.length : 0));
            handleTileResponse(data.requestId, data.tileData);
            break;

          case 'setGeoJSON': {
            const avyCount = data.avyPaths && data.avyPaths.features ? data.avyPaths.features.length : 0;
            const gatesCount = data.gates && data.gates.features ? data.gates.features.length : 0;
            const stagingCount = data.staging && data.staging.features ? data.staging.features.length : 0;
            log('setGeoJSON: avy=' + avyCount + ', gates=' + gatesCount + ', staging=' + stagingCount);
            avyPathsData = data.avyPaths;
            gatesData = data.gates;
            stagingData = data.staging;

            const addLayersNow = () => {
              log('Adding GeoJSON layers...');
              try {
                addAvyPathsLayer();
                addGatesLayer();
                addStagingLayer();
                log('GeoJSON layers added!');
                const b = calculateBounds([avyPathsData, gatesData, stagingData]);
                if (b[0][0] !== Infinity) {
                  map.fitBounds(b, { padding: 50 });
                  log('Bounds fitted');
                }
              } catch (e) {
                log('Error adding layers: ' + e.message);
              }
            };

            if (map && map.isStyleLoaded()) {
              log('Style already loaded, adding layers now');
              addLayersNow();
            } else if (map) {
              log('Waiting for style.load...');
              map.once('style.load', addLayersNow);
            }
            break;
          }

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
        log('handleMessage ERROR: ' + e.message);
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
