import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Image, Animated, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import TileBridge from './src/TileBridge';
import { mapHtml } from './src/mapHtml';

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
      <Text style={{
        fontSize: 52,
        fontWeight: '900',
        color: 'transparent',
        letterSpacing: 6,
        textAlign: 'center',
        textShadowColor: '#7ec8ff',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 1,
      }}>
        {text}
      </Text>
      <Text style={{
        position: 'absolute',
        width: '100%',
        fontSize: 52,
        fontWeight: '900',
        color: 'transparent',
        letterSpacing: 6,
        textAlign: 'center',
        textDecorationLine: 'none',
        textShadowColor: '#3a5f7d',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      }}>
        {text}
      </Text>
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

// Import GeoJSON data
import avyPaths from './assets/layers/BCC_AvyPaths.json';
import gatesData from './assets/layers/BCC_Gates.json';
import stagingData from './assets/layers/BCC_Staging.json';

// Import app config for version
import appConfig from './app.json';

// Bundled MBTiles basemaps
const BUNDLED_BASEMAPS = {
  topo: require('./assets/basemap/CC_shaded_topo.mbtiles'),
  satellite: require('./assets/basemap/CC_satellite_12_14.mbtiles'),
};

export default function App() {
  // Layer visibility state
  const [showAvyPaths, setShowAvyPaths] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showStaging, setShowStaging] = useState(true);
  const [currentBasemap, setCurrentBasemap] = useState('topo');

  // App state
  const [isReady, setIsReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [tileBridgeReady, setTileBridgeReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Preparing basemaps...');
  const [errorDetails, setErrorDetails] = useState(null);

  // Selected feature for popup
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Refs
  const webViewRef = useRef(null);
  const tileBridgeRef = useRef(null);

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

  // Initialize TileBridge with MBTiles databases
  useEffect(() => {
    const initTileBridge = async () => {
      try {
        setLoadingStatus('Loading basemap databases...');

        // Create TileBridge instance
        tileBridgeRef.current = new TileBridge();

        // Initialize with MBTiles files
        const result = await tileBridgeRef.current.init(BUNDLED_BASEMAPS);

        if (result === true) {
          setLoadingStatus('Basemaps ready!');
          setTileBridgeReady(true);
          console.log('TileBridge initialized successfully');
        } else if (result && result.error) {
          // TileBridge returned error details
          setLoadingStatus('Error initializing basemaps');
          setErrorDetails({
            message: result.error,
            step: result.step,
            stack: result.stack,
          });
        } else {
          setLoadingStatus('Error initializing basemaps');
          setErrorDetails({ message: 'Unknown error - init returned: ' + JSON.stringify(result) });
        }
      } catch (error) {
        console.error('Error initializing TileBridge:', error);
        setLoadingStatus('Error: ' + error.message);
        setErrorDetails({
          message: error.message,
          stack: error.stack,
        });
      }
    };

    initTileBridge();

    // Cleanup on unmount
    return () => {
      if (tileBridgeRef.current) {
        tileBridgeRef.current.close();
      }
    };
  }, []);

  // Send message to WebView
  const sendToWebView = (message) => {
    if (webViewRef.current && mapReady) {
      webViewRef.current.postMessage(JSON.stringify(message));
    }
  };

  // Handle messages from WebView
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'mapReady':
          console.log('[mapReady] Received from WebView');
          setMapReady(true);
          setIsReady(true);
          // Tell WebView that TileBridge is ready
          console.log('[mapReady] Sending tileBridgeReady');
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'tileBridgeReady',
          }));
          // Send GeoJSON after a short delay to ensure WebView is ready
          setTimeout(() => {
            console.log('[mapReady] Sending GeoJSON now...');
            const geoJsonPayload = JSON.stringify({
              avyPaths: avyPaths,
              gates: gatesData,
              staging: stagingData,
            });
            console.log('[mapReady] GeoJSON size:', geoJsonPayload.length);

            // Escape for safe injection (escape quotes and backslashes)
            const safePayload = geoJsonPayload
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'")
              .replace(/\n/g, '\\n');

            webViewRef.current?.injectJavaScript(`
              (function() {
                window.log('GeoJSON received!');
                try {
                  var data = JSON.parse('${safePayload}');
                  window.log('Parsed ' + (data.avyPaths ? data.avyPaths.features.length : 0) + ' avy paths');
                  if (window.setGeoJSONData) {
                    window.setGeoJSONData(data);
                  }
                } catch(e) {
                  window.log('Parse error: ' + e.message.substring(0, 50));
                }
              })();
              true;
            `);
          }, 1000);
          break;

        case 'getTile':
          // Handle tile request from WebView
          console.log(`[getTile] Request: ${data.basemap}/${data.z}/${data.x}/${data.y}`);
          if (tileBridgeRef.current) {
            const { requestId, basemap, z, x, y } = data;
            const tileData = await tileBridgeRef.current.getTile(basemap, z, x, y);
            console.log(`[getTile] Response for ${basemap}/${z}/${x}/${y}: ${tileData ? 'OK (' + tileData.length + ' chars)' : 'null'}`);
            // Use injectJavaScript for large tile data (postMessage has size limits)
            if (tileData) {
              webViewRef.current?.injectJavaScript(`
                window.handleTileData(${requestId}, "${tileData}");
                true;
              `);
            } else {
              webViewRef.current?.injectJavaScript(`
                window.handleTileData(${requestId}, null);
                true;
              `);
            }
          } else {
            console.log('[getTile] tileBridgeRef.current is null!');
          }
          break;

        case 'featureSelected':
          setSelectedFeature({
            type: data.featureType,
            description: data.description,
          });
          break;
      }
    } catch (e) {
      console.error('Error handling WebView message:', e);
    }
  };

  // Update WebView when layer visibility changes
  useEffect(() => {
    if (mapReady) {
      sendToWebView({ type: 'toggleLayer', layer: 'avyPaths', visible: showAvyPaths });
    }
  }, [showAvyPaths, mapReady]);

  useEffect(() => {
    if (mapReady) {
      sendToWebView({ type: 'toggleLayer', layer: 'gates', visible: showGates });
    }
  }, [showGates, mapReady]);

  useEffect(() => {
    if (mapReady) {
      sendToWebView({ type: 'toggleLayer', layer: 'staging', visible: showStaging });
    }
  }, [showStaging, mapReady]);

  // Update WebView when basemap changes
  useEffect(() => {
    if (mapReady) {
      sendToWebView({ type: 'setBasemap', basemap: currentBasemap });
    }
  }, [currentBasemap, mapReady]);

  // Location tracking
  useEffect(() => {
    let locationSubscription;

    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          if (mapReady) {
            sendToWebView({
              type: 'updateLocation',
              lng: location.coords.longitude,
              lat: location.coords.latitude,
            });
          }
        }
      );
    };

    if (mapReady) {
      startLocationTracking();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [mapReady]);

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

        {/* Layer Toggles */}
        <TouchableOpacity
          style={[styles.toggleBtn, showAvyPaths && styles.toggleBtnActive]}
          onPress={() => setShowAvyPaths(!showAvyPaths)}
        >
          <Text style={styles.toggleText}>Paths</Text>
          <View style={[styles.toggleRect, { backgroundColor: '#f472b6' }]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showStaging && styles.toggleBtnActive]}
          onPress={() => setShowStaging(!showStaging)}
        >
          <Text style={styles.toggleText}>Staging</Text>
          <View style={styles.toggleCircle} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showGates && styles.toggleBtnActive]}
          onPress={() => setShowGates(!showGates)}
        >
          <Text style={styles.toggleText}>Gates</Text>
          <Image source={require('./assets/icons/BCC_Gates.png')} style={styles.toggleIcon} />
        </TouchableOpacity>
      </View>

      {/* Loading Screen with Snow Animation */}
      {(!isReady || !tileBridgeReady) && (
        <View style={styles.loadingContainer}>
          {snowflakes.map(flake => (
            <Snowflake
              key={flake.id}
              delay={flake.delay}
              duration={flake.duration}
              startX={flake.startX}
              size={flake.size}
            />
          ))}
          <View style={styles.loadingContent}>
            <SnowFillText progress={1} text="MAP-OPS" />
            <Text style={styles.loadingText}>{loadingStatus}</Text>
            {errorDetails && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>DEBUG INFO:</Text>
                {errorDetails.step && (
                  <Text style={styles.errorStep}>Step: {errorDetails.step}</Text>
                )}
                <Text style={styles.errorMessage}>{errorDetails.message}</Text>
                {errorDetails.stack && (
                  <Text style={styles.errorStack}>{errorDetails.stack}</Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* WebView Map */}
      {tileBridgeReady && (
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          onError={(e) => console.error('WebView error:', e.nativeEvent)}
          onHttpError={(e) => console.error('WebView HTTP error:', e.nativeEvent)}
        />
      )}

      {/* Feature Popup */}
      {selectedFeature && (
        <TouchableOpacity
          style={styles.popupOverlay}
          activeOpacity={1}
          onPress={() => setSelectedFeature(null)}
        >
          <View style={styles.popup}>
            <Text style={styles.popupType}>{selectedFeature.type}</Text>
            <Text style={styles.popupDescription}>{selectedFeature.description}</Text>
            <Text style={styles.popupHint}>Tap anywhere to close</Text>
          </View>
        </TouchableOpacity>
      )}

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
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
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
  errorContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    maxWidth: '90%',
    maxHeight: 300,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorStep: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorMessage: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  errorStack: {
    color: '#aaaaaa',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  toggleCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f97316',
    marginLeft: 4,
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  map: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  popup: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: '#7ec8ff',
    shadowColor: '#7ec8ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  popupType: {
    color: '#7ec8ff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  popupDescription: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  popupHint: {
    color: '#888888',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
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
