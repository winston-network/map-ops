import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useState } from 'react';

// Import GeoJSON data
import avyPaths from './assets/layers/BCC_AvyPaths.geojson';
import gatesData from './assets/layers/BCC_Gates.geojson';
import stagingData from './assets/layers/BCC_Staging.geojson';

// Initialize MapLibre (no access token needed for free tiles)
MapLibreGL.setAccessToken(null);

export default function App() {
  // Layer visibility state
  const [showAvyPaths, setShowAvyPaths] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showStaging, setShowStaging] = useState(true);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('./assets/icons/snowflake.png')}
            style={styles.logo}
          />
          <View>
            <Text style={styles.title}>MAP-OPS</Text>
            <Text style={styles.subtitle}>Mountain Avalanche Protection Operations</Text>
          </View>
        </View>
      </View>

      {/* Layer Toggle Bar */}
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.toggleBtn, showAvyPaths && styles.toggleBtnActive]}
          onPress={() => setShowAvyPaths(!showAvyPaths)}
        >
          <View style={[styles.toggleDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.toggleText}>Avy Paths</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showGates && styles.toggleBtnActive]}
          onPress={() => setShowGates(!showGates)}
        >
          <View style={[styles.toggleDot, { backgroundColor: '#f97316' }]} />
          <Text style={styles.toggleText}>Gates</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showStaging && styles.toggleBtnActive]}
          onPress={() => setShowStaging(!showStaging)}
        >
          <View style={[styles.toggleDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.toggleText}>Staging</Text>
        </TouchableOpacity>
      </View>

      {/* MapLibre Map */}
      <MapLibreGL.MapView
        style={styles.map}
        styleURL="https://demotiles.maplibre.org/style.json"
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera
          defaultSettings={{
            centerCoordinate: [-111.71, 40.635],
            zoomLevel: 12,
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

        {/* Gates - Orange markers */}
        {showGates && gatesData.features.map(feature => (
          <MapLibreGL.PointAnnotation
            key={`gate-${feature.id}`}
            id={`gate-${feature.id}`}
            coordinate={feature.geometry.coordinates}
            title={feature.properties.description}
          >
            <View style={styles.gateMarker}>
              <View style={styles.gateMarkerInner} />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}

        {/* Staging Areas - Blue markers */}
        {showStaging && stagingData.features.map(feature => (
          <MapLibreGL.PointAnnotation
            key={`staging-${feature.id}`}
            id={`staging-${feature.id}`}
            coordinate={feature.geometry.coordinates}
            title={feature.properties.description}
          >
            <View style={styles.stagingMarker}>
              <View style={styles.stagingMarkerInner} />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>⚠ For conceptual testing only. Not for operational use.</Text>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  subtitle: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 1,
  },
  toggleBar: {
    flexDirection: 'row',
    backgroundColor: '#252542',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    opacity: 0.5,
  },
  toggleBtnActive: {
    opacity: 1,
    backgroundColor: '#333355',
  },
  toggleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  gateMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f97316',
  },
  stagingMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagingMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  disclaimer: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 8,
    alignItems: 'center',
  },
  disclaimerText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
});
