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

// Snow accumulation component
function SnowAccumulation({ progress }) {
  // Height grows based on download progress (0 to ~100px)
  const height = Math.min(progress * 150, 150);

  return (
    <View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: height,
      backgroundColor: '#e8f4ff',
      borderTopLeftRadius: height > 20 ? 100 : 0,
      borderTopRightRadius: height > 20 ? 100 : 0,
    }}>
      {/* Snow bumps */}
      {height > 30 && (
        <>
          <View style={{ position: 'absolute', top: -15, left: '20%', width: 60, height: 30, backgroundColor: '#e8f4ff', borderRadius: 30 }} />
          <View style={{ position: 'absolute', top: -10, left: '50%', width: 80, height: 25, backgroundColor: '#e8f4ff', borderRadius: 25 }} />
          <View style={{ position: 'absolute', top: -12, left: '75%', width: 50, height: 28, backgroundColor: '#e8f4ff', borderRadius: 28 }} />
        </>
      )}
    </View>
  );
}

import * as FileSystem from 'expo-file-system';

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

// Build a MapLibre style using local MBTiles file
function buildMBTilesStyle(mbtilesPath) {
  // MBTiles uses mbtiles:// protocol in MapLibre Native
  const cleanPath = mbtilesPath.replace('file://', '');

  return {
    version: 8,
    name: 'Offline Basemap',
    sources: {
      'offline-basemap': {
        type: 'raster',
        tiles: [`mbtiles://${cleanPath}/{z}/{x}/{y}`],
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
      debug.push(`Doc: ${FileSystem.documentDirectory}`);
      setDebugInfo(debug.join('\n'));

      try {
        const paths = {};

        for (const [key, basemap] of Object.entries(MBTILES_BASEMAPS)) {
          const destPath = `${FileSystem.documentDirectory}${basemap.file}`;
          debug.push(`Checking ${key}...`);
          setDebugInfo(debug.join('\n'));

          const fileInfo = await FileSystem.getInfoAsync(destPath);

          if (fileInfo.exists && fileInfo.size > 1000000) {
            // Already downloaded (and file is > 1MB, so not empty/corrupt)
            paths[key] = destPath;
            const sizeMB = (fileInfo.size / 1024 / 1024).toFixed(1);
            debug.push(`${key}: EXISTS (${sizeMB}MB)`);
          } else {
            // Download from GitHub Releases
            debug.push(`${key}: downloading...`);
            setDebugInfo(debug.join('\n'));
            setLoadingMessage(`Downloading ${basemap.name} (${basemap.size})...`);
            // Update progress (0.5 per basemap)
            setDownloadProgress(prev => prev + 0.1);

            try {
              const downloadResult = await FileSystem.downloadAsync(
                basemap.url,
                destPath
              );

              if (downloadResult.status === 200) {
                const newFileInfo = await FileSystem.getInfoAsync(destPath);
                const sizeMB = (newFileInfo.size / 1024 / 1024).toFixed(1);
                setDownloadProgress(prev => prev + 0.4); // More progress after download

                if (newFileInfo.size > 1000000) {
                  paths[key] = destPath;
                  debug.push(`${key}: OK (${sizeMB}MB)`);
                } else {
                  debug.push(`${key}: TOO SMALL (${sizeMB}MB)`);
                }
              } else {
                debug.push(`${key}: HTTP ${downloadResult.status}`);
              }
            } catch (downloadError) {
              debug.push(`${key}: ERR ${downloadError.message}`);
            }
          }
          setDebugInfo(debug.join('\n'));
        }

        // Show final state
        const pathKeys = Object.keys(paths);
        debug.push(`Ready: ${pathKeys.length > 0 ? pathKeys.join(', ') : 'NONE'}`);
        if (paths.topo) {
          const tilePath = paths.topo.replace('file://', '');
          debug.push(`Tiles: mbtiles://${tilePath}`);
        } else {
          debug.push('Using online fallback');
        }
        setDebugInfo(debug.join('\n'));

        setMbtilesPaths(paths);
        setMbtilesReady(true);
        setLoadingMessage('');
      } catch (error) {
        setDebugInfo(`ERROR: ${error.message}`);
        setLoadingMessage('');
        setMbtilesReady(true);
      }
    }

    setupMBTiles();
  }, []);

  // Get current basemap style
  const getMapStyle = () => {
    if (mbtilesReady && mbtilesPaths[currentBasemap]) {
      return buildMBTilesStyle(mbtilesPaths[currentBasemap]);
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

          {/* Snow accumulation at bottom */}
          <SnowAccumulation progress={downloadProgress} />

          {/* Loading text */}
          <View style={styles.loadingContent}>
            <Image
              source={require('./assets/icons/snowflake.png')}
              style={styles.loadingLogo}
            />
            <Text style={styles.loadingTitle}>MAP-OPS</Text>
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
        {showAvyPaths && (
          <MapLibreGL.ShapeSource id="avyPaths" shape={avyPaths}>
            <MapLibreGL.FillLayer
              id="avyPathsFill"
              style={{
                fillColor: '#7ec8ff',
                fillOpacity: 0.3,
              }}
            />
            <MapLibreGL.LineLayer
              id="avyPathsLine"
              style={{
                lineColor: '#7ec8ff',
                lineWidth: 2,
                lineOpacity: 0.8,
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

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

      {/* Debug Panel - tap to toggle */}
      <TouchableOpacity style={styles.debugPanel} onPress={() => setDebugInfo('')}>
        <Text style={styles.debugText}>{debugInfo}</Text>
      </TouchableOpacity>

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
  },
  loadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#7ec8ff',
    letterSpacing: 3,
    marginBottom: 20,
    textShadowColor: 'rgba(126, 200, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 4,
  },
  debugText: {
    color: '#00ff00',
    fontSize: 9,
    fontFamily: 'monospace',
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
