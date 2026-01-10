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

// Online basemap styles
const BASEMAP_STYLES = {
  topo: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

export default function App() {
  // Layer visibility state
  const [showAvyPaths, setShowAvyPaths] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showStaging, setShowStaging] = useState(true);
  const [currentBasemap, setCurrentBasemap] = useState('topo');

  // App state
  const [isReady, setIsReady] = useState(false);

  // Selected feature for popup
  const [selectedFeature, setSelectedFeature] = useState(null);

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

  // Simple initialization - using online tiles for now
  useEffect(() => {
    // Brief loading animation then show map
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Get current basemap style (online for now)
  const mapStyle = BASEMAP_STYLES[currentBasemap];

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
          <Text style={styles.toggleText}>Mile</Text>
          <View style={styles.toggleCircle} />
        </TouchableOpacity>
      </View>

      {/* Loading Screen with Snow Animation */}
      {!isReady ? (
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
            {/* Snow-filled MAP-OPS text */}
            <SnowFillText progress={1} text="MAP-OPS" />

            {/* Status message below */}
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      ) : null}

      {/* MapLibre Map */}
      <MapLibreGL.MapView
        key={currentBasemap}
        style={styles.map}
        styleURL={mapStyle}
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
        <MapLibreGL.ShapeSource
          id="avyPaths"
          shape={avyPaths}
          onPress={(e) => {
            if (showAvyPaths && e.features && e.features.length > 0) {
              const feature = e.features[0];
              setSelectedFeature({
                type: 'Avalanche Path',
                description: feature.properties?.description || feature.properties?.name || 'Unknown Path',
                coordinates: e.coordinates,
              });
            }
          }}
        >
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
            onSelected={() => setSelectedFeature({
              type: 'Gate',
              description: feature.properties.description || 'Gate',
              coordinates: feature.geometry.coordinates,
            })}
          >
            <Image source={require('./assets/icons/BCC_Gates.png')} style={styles.mapIcon} />
            <MapLibreGL.Callout title={feature.properties.description || 'Gate'} />
          </MapLibreGL.PointAnnotation>
        ))}

        {/* Staging Areas - Orange circles with mile marker */}
        {showStaging && stagingData.features.map(feature => (
          <MapLibreGL.PointAnnotation
            key={`staging-${feature.id}`}
            id={`staging-${feature.id}`}
            coordinate={feature.geometry.coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
            onSelected={() => setSelectedFeature({
              type: 'Staging Area',
              description: `Mile Marker ${feature.properties.description}` || 'Staging Area',
              coordinates: feature.geometry.coordinates,
            })}
          >
            <View style={styles.mileMarker}>
              <Text style={styles.mileMarkerText}>{feature.properties.description || '?'}</Text>
            </View>
            <MapLibreGL.Callout title={`Mile ${feature.properties.description}`} />
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

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
  },
  mapIcon: {
    width: 32,
    height: 32,
  },
  mileMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  mileMarkerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
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
