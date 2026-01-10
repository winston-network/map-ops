import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useState } from 'react';

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

// Basemap styles using external style URLs (more reliable than inline JSON)
const BASEMAPS = {
  topo: {
    name: 'Topo',
    // Carto Voyager - clean street/topo style (free, no API key needed)
    styleURL: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  satellite: {
    name: 'Satellite',
    // Carto Dark Matter as satellite alternative (free, no API key needed)
    // Note: True satellite requires paid API (MapTiler, Mapbox, etc.)
    styleURL: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  }
};

export default function App() {
  // Layer visibility state
  const [showAvyPaths, setShowAvyPaths] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showStaging, setShowStaging] = useState(true);
  const [currentBasemap, setCurrentBasemap] = useState('satellite');

  const basemapStyleURL = BASEMAPS[currentBasemap].styleURL;

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
          <View style={[styles.toggleRect, { backgroundColor: '#ef4444' }]} />
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

      {/* MapLibre Map */}
      <MapLibreGL.MapView
        key={currentBasemap}
        style={styles.map}
        styleURL={basemapStyleURL}
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

        {/* Avalanche Paths - Red polygons */}
        {showAvyPaths && (
          <MapLibreGL.ShapeSource id="avyPaths" shape={avyPaths}>
            <MapLibreGL.FillLayer
              id="avyPathsFill"
              style={{
                fillColor: '#ef4444',
                fillOpacity: 0.3,
              }}
            />
            <MapLibreGL.LineLayer
              id="avyPathsLine"
              style={{
                lineColor: '#ef4444',
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

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.disclaimerText}>⚠ For conceptual testing only. Not for operational use.</Text>
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
