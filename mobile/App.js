import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Image, ActivityIndicator, Animated, Dimensions } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useState, useEffect, useRef } from 'react';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Snowflake component for loading animation
function Snowflake({ delay, duration, startX, size }) {
  const fallAnim = useRef(new Animated.Value(-50)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fall = () => {
      fallAnim.setValue(-50);
      Animated.timing(fallAnim, {
        toValue: SCREEN_HEIGHT + 50,
        duration: duration,
        delay: delay,
        useNativeDriver: true,
      }).start(() => fall());
    };

    const sway = () => {
      Animated.sequence([
        Animated.timing(swayAnim, {
          toValue: 20,
          duration: duration / 4,
          useNativeDriver: true,
        }),
        Animated.timing(swayAnim, {
          toValue: -20,
          duration: duration / 4,
          useNativeDriver: true,
        }),
      ]).start(() => sway());
    };

    fall();
    sway();
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: startX,
        fontSize: size,
        color: '#ffffff',
        opacity: 0.8,
        transform: [
          { translateY: fallAnim },
          { translateX: swayAnim },
        ],
      }}
    >
      ❄
    </Animated.Text>
  );
}

// Snow-filled text progress component
function SnowFillText({ progress, text }) {
  const fillPercent = Math.min(progress * 100, 100);

  return (
    <View style={{ position: 'relative', height: 80, justifyContent: 'center' }}>
      {/* Background text - outline/empty look */}
      <Text style={{
        fontSize: 52,
        fontWeight: '900',
        color: 'transparent',
        letterSpacing: 6,
        textAlign: 'center',
        textShadowColor: '#7ec8ff',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 1,
        // Create outline effect with multiple shadows
      }}>
        {text}
      </Text>

      {/* Outline layer */}
      <Text style={{
        position: 'absolute',
        width: '100%',
        fontSize: 52,
        fontWeight: '900',
        color: 'transparent',
        letterSpacing: 6,
        textAlign: 'center',
        textDecorationLine: 'none',
        // Stroke effect using text shadow
        textShadowColor: '#3a5f7d',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      }}>
        {text}
      </Text>

      {/* Fill layer - clips from bottom up */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${fillPercent}%`,
        overflow: 'hidden',
      }}>
        <Text style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          fontSize: 52,
          fontWeight: '900',
          color: '#ffffff',
          letterSpacing: 6,
          textAlign: 'center',
          textShadowColor: 'rgba(255, 255, 255, 0.8)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

// Use react-native-fs for stable file operations
import RNFS from 'react-native-fs';

// Local tile server for offline MBTiles
import TileServer from './src/TileServer';

// Import GeoJSON data
import avyPaths from './assets/layers/BCC_AvyPaths.json';
import gatesData from './assets/layers/BCC_Gates.json';
import stagingData from './assets/layers/BCC_Staging.json';

// Import app config for version
import appConfig from './app.json';

// Calculate bounding box from all GeoJSON layers
function calculateBounds(geojsonLayers) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

  geojsonLayers.forEach(geojson => {
    geojson.features.forEach(feature => {
      const processCoords = (coords) => {
        if (typeof coords[0] === 'number') {
          // It's a coordinate pair [lng, lat]
          minLng = Math.min(minLng, coords[0]);
          maxLng = Math.max(maxLng, coords[0]);
          minLat = Math.min(minLat, coords[1]);
          maxLat = Math.max(maxLat, coords[1]);
        } else {
          // It's an array of coordinates
          coords.forEach(processCoords);
        }
      };
      processCoords(feature.geometry.coordinates);
    });
  });

  return { minLng, minLat, maxLng, maxLat };
}

// Get bounds from all layers
const layerBounds = calculateBounds([avyPaths, gatesData, stagingData]);

// Initialize MapLibre (no access token needed for free tiles)
MapLibreGL.setAccessToken(null);

// MBTiles basemap files - downloaded on first launch for offline use
// Hosted on GitHub Releases for free, reliable download
const MBTILES_BASEMAPS = {
  topo: {
    name: 'Topo',
    file: 'CC_shaded_topo.mbtiles',
    url: 'https://github.com/winston-network/map-ops/releases/download/v1.1.0-basemaps/CC_shaded_topo.mbtiles',
    size: '58 MB',
  },
  satellite: {
    name: 'Satellite',
    file: 'CC_satellite_12_14.mbtiles',
    url: 'https://github.com/winston-network/map-ops/releases/download/v1.1.0-basemaps/CC_satellite_12_14.mbtiles',
    size: '25 MB',
  }
};

// Online fallback styles (used while downloading or if download fails)
const ONLINE_FALLBACK = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

// Build a MapLibre style using local tile server
function buildLocalTileStyle(dbName) {
  // Use localhost URL from tile server
  const tileUrl = TileServer.getTileUrl(dbName);

  return {
    version: 8,
    name: 'Offline Basemap',
    sources: {
      'offline-basemap': {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 16,
      }
    },
    layers: [
      {
        id: 'offline-basemap-layer',
        type: 'raster',
        source: 'offline-basemap',
        minzoom: 0,
        maxzoom: 22,
      }
    ]
  };
}

export default function App() {
  // Layer visibility state
  const [showAvyPaths, setShowAvyPaths] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showStaging, setShowStaging] = useState(true);
  const [currentBasemap, setCurrentBasemap] = useState('topo');

  // MBTiles state
  const [mbtilesReady, setMbtilesReady] = useState(false);
  const [mbtilesPaths, setMbtilesPaths] = useState({});
  const [loadingMessage, setLoadingMessage] = useState('Loading offline maps...');
  const [debugInfo, setDebugInfo] = useState('Starting...');
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Generate snowflakes for loading animation
  const snowflakes = useRef(
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      delay: Math.random() * 3000,
      duration: 3000 + Math.random() * 4000,
      startX: Math.random() * SCREEN_WIDTH,
      size: 12 + Math.random() * 20,
    }))
  ).current;

  // Download MBTiles files on first launch for offline use
  useEffect(() => {
    async function setupMBTiles() {
      let debug = [];
      const docsPath = RNFS.DocumentDirectoryPath;
      debug.push(`Doc: ${docsPath}`);
      setDebugInfo(debug.join('\n'));
      setDownloadProgress(0.05); // Show some initial progress

      try {
        const paths = {};
        let totalFiles = Object.keys(MBTILES_BASEMAPS).length;
        let currentFile = 0;

        for (const [key, basemap] of Object.entries(MBTILES_BASEMAPS)) {
          currentFile++;
          const destPath = `${docsPath}/${basemap.file}`;
          debug.push(`Checking ${key}...`);
          setDebugInfo(debug.join('\n'));

          // Check if file exists and get its size
          const fileExists = await RNFS.exists(destPath);
          let fileSize = 0;
          if (fileExists) {
            const stat = await RNFS.stat(destPath);
            fileSize = stat.size;
          }

          if (fileExists && fileSize > 1000000) {
            // Already downloaded (and file is > 1MB, so not empty/corrupt)
            paths[key] = destPath;
            const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
            debug.push(`${key}: CACHED (${sizeMB}MB)`);
            setDownloadProgress(currentFile / totalFiles);
          } else {
            // Download from GitHub Releases
            debug.push(`${key}: downloading...`);
            setDebugInfo(debug.join('\n'));
            setLoadingMessage(`Downloading ${basemap.name} (${basemap.size})...\nThis only happens once.`);
            setDownloadProgress((currentFile - 0.5) / totalFiles);

            try {
              console.log(`Starting download: ${basemap.url}`);

              const downloadResult = await RNFS.downloadFile({
                fromUrl: basemap.url,
                toFile: destPath,
                background: true,
                discretionary: true,
                progress: (res) => {
                  const progress = res.bytesWritten / res.contentLength;
                  setDownloadProgress((currentFile - 1 + progress) / totalFiles);
                }
              }).promise;

              console.log(`Download result:`, downloadResult);

              if (downloadResult.statusCode === 200) {
                const stat = await RNFS.stat(destPath);
                const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
                setDownloadProgress(currentFile / totalFiles);

                if (stat.size > 1000000) {
                  paths[key] = destPath;
                  debug.push(`${key}: OK (${sizeMB}MB)`);
                } else {
                  debug.push(`${key}: TOO SMALL (${sizeMB}MB)`);
                }
              } else {
                debug.push(`${key}: HTTP ${downloadResult.statusCode}`);
              }
            } catch (downloadError) {
              debug.push(`${key}: FAILED - ${downloadError.message}`);
              console.error(`Download error for ${key}:`, downloadError);
            }
          }
          setDebugInfo(debug.join('\n'));
        }

        // Start tile server and open databases
        const pathKeys = Object.keys(paths);
        debug.push(`---`);

        if (pathKeys.length > 0) {
          debug.push(`Starting tile server...`);
          setDebugInfo(debug.join('\n'));

          // Start the local HTTP server
          const serverStarted = await TileServer.start();
          if (serverStarted) {
            debug.push(`Server: localhost:${TileServer.port}`);

            // Open each MBTiles database
            for (const [key, filePath] of Object.entries(paths)) {
              const opened = await TileServer.openDatabase(key, filePath);
              if (opened) {
                debug.push(`${key}: SERVING`);
              } else {
                debug.push(`${key}: FAILED TO OPEN`);
              }
            }

            debug.push(`Tile URL: ${TileServer.getTileUrl('topo')}`);
          } else {
            debug.push(`Server: FAILED TO START`);
          }
        } else {
          debug.push('FALLBACK: online tiles');
        }

        setDebugInfo(debug.join('\n'));
        setDownloadProgress(1);

        // Brief delay so user sees completion
        await new Promise(resolve => setTimeout(resolve, 500));

        setMbtilesPaths(paths);
        setMbtilesReady(true);
        setLoadingMessage('');
      } catch (error) {
        debug.push(`ERROR: ${error.message}`);
        setDebugInfo(debug.join('\n'));
        console.error('Setup error:', error);
        setLoadingMessage(`Error: ${error.message}`);
        setTimeout(() => {
          setMbtilesReady(true);
          setLoadingMessage('');
        }, 3000);
      }
    }

    setupMBTiles();
  }, []);

  // Get current basemap style
  const getMapStyle = () => {
    if (mbtilesReady && mbtilesPaths[currentBasemap] && TileServer.isRunning) {
      // Use local tile server
      return buildLocalTileStyle(currentBasemap);
    }
    return ONLINE_FALLBACK;
  };

  const mapStyle = getMapStyle();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoGlow}>
          <Image
            source={require('./assets/icons/snowflake.png')}
            style={styles.logo}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>MAP-OPS</Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>Mountain Avalanche Protection Operations</Text>
            <Text style={styles.version}>v{appConfig.expo.version}</Text>
          </View>
        </View>
      </View>

      {/* Toggle Bar */}
      <View style={styles.toggleBar}>
        {/* Basemap Toggle */}
        <View style={styles.basemapToggle}>
          <TouchableOpacity
            style={[styles.basemapBtn, currentBasemap === 'topo' && styles.basemapBtnActive]}
            onPress={() => setCurrentBasemap('topo')}
          >
            <Text style={styles.basemapText}>Topo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.basemapBtn, currentBasemap === 'satellite' && styles.basemapBtnActive]}
            onPress={() => setCurrentBasemap('satellite')}
          >
            <Text style={styles.basemapText}>Satellite</Text>
          </TouchableOpacity>
        </View>

        {/* Layer Toggles - icons on right side */}
        <TouchableOpacity
          style={[styles.toggleBtn, showAvyPaths && styles.toggleBtnActive]}
          onPress={() => setShowAvyPaths(!showAvyPaths)}
        >
          <Text style={styles.toggleText}>Paths</Text>
          <View style={[styles.toggleRect, { backgroundColor: '#7ec8ff' }]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showGates && styles.toggleBtnActive]}
          onPress={() => setShowGates(!showGates)}
        >
          <Text style={styles.toggleText}>Gates</Text>
          <Image source={require('./assets/icons/BCC_Gates.png')} style={styles.toggleIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showStaging && styles.toggleBtnActive]}
          onPress={() => setShowStaging(!showStaging)}
        >
          <Text style={styles.toggleText}>Staging</Text>
          <Image source={require('./assets/icons/BCC_Staging.png')} style={styles.toggleIcon} />
        </TouchableOpacity>
      </View>

      {/* Loading Screen with Snow Animation */}
      {loadingMessage ? (
        <View style={styles.loadingContainer}>
          {/* Falling snowflakes */}
          {snowflakes.map(flake => (
            <Snowflake
              key={flake.id}
              delay={flake.delay}
              duration={flake.duration}
              startX={flake.startX}
              size={flake.size}
            />
          ))}

          {/* Centered content */}
          <View style={styles.loadingContent}>
            {/* Snow-filled MAP-OPS text as progress indicator */}
            <SnowFillText progress={downloadProgress} text="MAP-OPS" />

            {/* Status message below */}
            <Text style={styles.loadingText}>{loadingMessage}</Text>
          </View>
        </View>
      ) : null}

      {/* MapLibre Map */}
      <MapLibreGL.MapView
        key={`${currentBasemap}-${mbtilesReady}`}
        style={styles.map}
        styleURL={typeof mapStyle === 'string' ? mapStyle : undefined}
        styleJSON={typeof mapStyle === 'object' ? JSON.stringify(mapStyle) : undefined}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera
          defaultSettings={{
            bounds: {
              ne: [layerBounds.maxLng + 0.01, layerBounds.maxLat + 0.01],
              sw: [layerBounds.minLng - 0.01, layerBounds.minLat - 0.01],
            },
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
          }}
        />

        {/* User location */}
        <MapLibreGL.UserLocation visible={true} />

        {/* Avalanche Paths - Light blue polygons */}
        <MapLibreGL.ShapeSource id="avyPaths" shape={avyPaths}>
          <MapLibreGL.FillLayer
            id="avyPathsFill"
            style={{
              fillColor: '#7ec8ff',
              fillOpacity: showAvyPaths ? 0.3 : 0,
            }}
          />
          <MapLibreGL.LineLayer
            id="avyPathsLine"
            style={{
              lineColor: '#7ec8ff',
              lineWidth: 2,
              lineOpacity: showAvyPaths ? 0.8 : 0,
            }}
          />
        </MapLibreGL.ShapeSource>

        {/* Gates - Custom icon markers */}
        {showGates && gatesData.features.map(feature => (
          <MapLibreGL.PointAnnotation
            key={`gate-${feature.id}`}
            id={`gate-${feature.id}`}
            coordinate={feature.geometry.coordinates}
            title={feature.properties.description}
          >
            <Image source={require('./assets/icons/BCC_Gates.png')} style={styles.mapIcon} />
          </MapLibreGL.PointAnnotation>
        ))}

        {/* Staging Areas - Custom icon markers */}
        {showStaging && stagingData.features.map(feature => (
          <MapLibreGL.PointAnnotation
            key={`staging-${feature.id}`}
            id={`staging-${feature.id}`}
            coordinate={feature.geometry.coordinates}
            title={feature.properties.description}
          >
            <Image source={require('./assets/icons/BCC_Staging.png')} style={styles.mapIcon} />
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      {/* Debug Panel - always visible for basemap debugging */}
      {debugInfo ? (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>BASEMAP STATUS:</Text>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.disclaimerText}>For conceptual testing only. Not for operational use.</Text>
        <View style={styles.logoRow}>
          <Image source={require('./assets/logos/usfs.png')} style={styles.footerLogo} />
          <Image source={require('./assets/logos/udot.png')} style={styles.footerLogo} />
          <Image source={require('./assets/logos/alta.png')} style={styles.footerLogo} />
          <Image source={require('./assets/logos/brighton.png')} style={styles.footerLogo} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    zIndex: 1000,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#7ec8ff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 30,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoGlow: {
    shadowColor: '#7ec8ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7ec8ff',
    letterSpacing: 2,
    textShadowColor: 'rgba(126, 200, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 1,
    textShadowColor: 'rgba(239, 68, 68, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  version: {
    fontSize: 10,
    color: '#888888',
    marginTop: 1,
  },
  toggleBar: {
    flexDirection: 'row',
    backgroundColor: '#252542',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    alignItems: 'center',
  },
  basemapToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    marginRight: 8,
  },
  basemapBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  basemapBtnActive: {
    backgroundColor: '#444466',
  },
  basemapText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    opacity: 0.5,
  },
  toggleBtnActive: {
    opacity: 1,
    backgroundColor: '#333355',
  },
  toggleIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  toggleRect: {
    width: 14,
    height: 10,
    borderRadius: 2,
    marginLeft: 4,
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  mapIcon: {
    width: 32,
    height: 32,
  },
  debugPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 10,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  debugTitle: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  debugText: {
    color: '#00ff00',
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  footer: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  disclaimerText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  footerLogo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
});
