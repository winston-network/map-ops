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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Logging (console only)
    function log(msg) { console.log(msg); }
    window.log = log;

    // Gate icon as base64
    const GATE_ICON_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAB2AAAAdgB+lymcgAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAPiSURBVHic7ZpdaFtlHIef95yTpE2bJiut2k2dSIvDMS+mbCIoDkWmTq0X65igsLlWEeqUCjqnrRsTZUw7WccquAsvZLIpiOzCm2HnPjqHMrsiVkVcR6srjrVbYtp8ndeLrO2yU3NOIeFN6ftcJec8vPn9fyecjxDQaDQajUaj0cxPhPx+fSNSdALhvGYawdlUfgfAJxJUsVGsO3igQBmLioUU3cCN7qqEjIcVM7IMS+wB5kQBBp6GnyVpKgq+ZpEwVAdQjS5AdQDV6AJUB1DNvC/Amo0cS9p8NTDGifNxhqIpLANuDftZdVsljzVU4TdFsXIWDSFPPSO9iCf7oryzf5ixiZnvhhYurGP79g4aGupBCCl95WNe1jWP/WT5n+uoIJGcak8uqJLJL3fG7CWLHR9m/viL6V+3tZL4+HTboQqZPPReLHNXg8M3+v8wA2vfqORKbNovL5OJz3cMZu658yVPBZzoj9HWNYjtYgaDQbo+7ub2+nq3JbPhevsJNLYhYuNT22S4ksThTuzlS5x+3+8EHt+MGI1O+6Egia8/xF6x1On/dp7A6lbEyKVrQpaROPQ+mQfvBhh2PQdE4xna9w+5Dg8Qj8fZ9nY7tm27uiUwPMAi1wK+6BklGvfyEJBl8Nw5vvu2J69TIsNnXbeBjvVdcVMcnDx+/H/3ldLw4KGAoX+SboqD4eGhGbcbp0prePBwGTx95iypVNpNy2Fk5C9G/h7J2SYOHOFi+6dkpACCAJgCat56Hlm3AK7zOdzLpVe7SUuZ62/ZgLylxun3nGG0pZOUzZRvALWtTcg7bnb6V3H9BkRC5W6Kg5raG3LeTw8/vc0UULOzGfn0/c4Fcoa/xn93A7JpldPPGT6LAdS+3oRsXpM3q2sBDyyvc1McPLL60anXpTz8pJuXD15ehs/n/YYxHI6wcVMLUPrDT/p5qa0OsOuVlQjhfptrWha79+zDsqw5MbxpmGlPh3bTU4uxDEHb7tNMJGa+KoRCVXTt3ceKe1cijvYxuuMzTNPAnAxnCCK7XsjwxH329VWKHwbE5S2fWIYp8JPdK4SgetuzGbn+Iaf/85/i8ua9ljAM/FcPoRBQ/VpTRrascfgzYRhGwm/53/T8LEBaMtY7Qcc3v3Jk4AIXo+MYQnBTpIInly1i68P1+CYfhsrEhGg+OPuzpwJm9TQYKbP4qHEp4LwGz1Xm/e8BugDVAVSjC1AdQDW6ANUBVKMLUB1ANboA1QFUowtQHUA1ugDVAVSjC1AdQDW6ABAXCr6qxb8FX7NIWCBfBDqBSH5VCEyXv9MC+JggSGtB0mk0Go1Go9FoNEXjP6DG0O2RYUmFAAAAAElFTkSuQmCC';

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
            map.fitBounds(b, { padding: 50, minZoom: 12 });
            log('Bounds fitted');
          }
          setMaxBoundsFromData();
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

        // For zooms below available range, return transparent tile
        if (z < 10) {
          const empty = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUSErkJggg=='), c => c.charCodeAt(0));
          return { data: empty };
        }

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

    // Calculate bounds with a percentage buffer (0.25 = 25%)
    function calculateBoundsWithBuffer(geojsonLayers, bufferPct) {
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

      const lngSpan = maxLng - minLng;
      const latSpan = maxLat - minLat;
      const lngBuf = lngSpan * bufferPct;
      const latBuf = latSpan * bufferPct;

      return [[minLng - lngBuf, minLat - latBuf], [maxLng + lngBuf, maxLat + latBuf]];
    }

    // Basemap tile extent - don't allow panning beyond this
    const BASEMAP_BOUNDS = [[-111.826, 40.2997], [-111.451, 40.712]];

    // Set max bounds on map clamped to basemap extent
    function setMaxBoundsFromData() {
      if (!map) return;
      const layers = [avyPathsData, gatesData, stagingData];
      const bounds = calculateBoundsWithBuffer(layers, 0.25);
      if (bounds[0][0] !== Infinity) {
        // Clamp to basemap extent
        bounds[0][0] = Math.max(bounds[0][0], BASEMAP_BOUNDS[0][0]);
        bounds[0][1] = Math.max(bounds[0][1], BASEMAP_BOUNDS[0][1]);
        bounds[1][0] = Math.min(bounds[1][0], BASEMAP_BOUNDS[1][0]);
        bounds[1][1] = Math.min(bounds[1][1], BASEMAP_BOUNDS[1][1]);
        map.setMaxBounds(bounds);
        log('Max bounds set: ' + JSON.stringify(bounds));
      }
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
            maxzoom: 15
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
        center: [-111.65, 40.59],
        zoom: 12,
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
            description: feature.properties.description || feature.properties.name || 'Unknown Path',
            tapX: e.point.x,
            tapY: e.point.y
          });
        }
      });

      map.on('click', 'gates-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          sendMessage({
            type: 'featureSelected',
            featureType: 'Gate',
            description: feature.properties.description || 'Gate',
            tapX: e.point.x,
            tapY: e.point.y
          });
        }
      });

      map.on('click', 'staging-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          sendMessage({
            type: 'featureSelected',
            featureType: 'Staging Area',
            description: 'Mile Marker ' + (feature.properties.description || '?'),
            tapX: e.point.x,
            tapY: e.point.y
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
            'fill-color': '#93c5fd',
            'fill-opacity': 0.3
          }
        });

        map.addLayer({
          id: 'avy-paths-line',
          type: 'line',
          source: 'avy-paths',
          paint: {
            'line-color': '#1e3a5f',
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

    // Add gates layer - gate icon
    function addGatesLayer() {
      if (!map || !gatesData) return;
      if (map.getSource('gates')) return;

      map.addSource('gates', { type: 'geojson', data: gatesData });

      // Add gate icon to map if not already present
      if (!map.hasImage('gate-icon') && gateIconImage) {
        map.addImage('gate-icon', gateIconImage);
        log('Gate icon added to map');
      }

      // Gate icon layer
      map.addLayer({
        id: 'gates-layer',
        type: 'symbol',
        source: 'gates',
        layout: {
          'icon-image': 'gate-icon',
          'icon-size': 0.57,
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom'
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
          'text-field': ['get', 'mile_marker'],
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
                  map.fitBounds(bounds, { padding: 50, minZoom: 12 });
                }
                setMaxBoundsFromData();
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
                  map.fitBounds(b, { padding: 50, minZoom: 12 });
                  log('Bounds fitted');
                }
                setMaxBoundsFromData();
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
