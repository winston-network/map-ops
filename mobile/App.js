import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

// Initialize MapLibre (no access token needed for free tiles)
MapLibreGL.setAccessToken(null);

// BCC Gates data
const gates = [
  { id: 1, coordinates: [-111.65054, 40.65086], description: "Upper Gate" },
  { id: 2, coordinates: [-111.77793, 40.61876], description: "Lower Gate" },
];

// BCC Staging Areas data
const stagingAreas = [
  { id: 1, coordinates: [-111.66153, 40.64953], description: "Staging Area 10.1" },
  { id: 2, coordinates: [-111.75057, 40.62199], description: "Staging Area 4.2" },
  { id: 3, coordinates: [-111.71155, 40.63421], description: "Staging Area 7.0" },
  { id: 4, coordinates: [-111.69962, 40.63639], description: "Staging Area 7.8" },
  { id: 5, coordinates: [-111.68574, 40.64221], description: "Staging Area 8.4" },
  { id: 6, coordinates: [-111.6754, 40.64356], description: "Staging Area 9.1" },
  { id: 7, coordinates: [-111.66882, 40.64539], description: "Staging Area 9.5" },
];

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MAP-OPS</Text>
        <Text style={styles.subtitle}>Mountain Avalanche Protection Operations</Text>
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

        {/* Gates - Orange circles */}
        {gates.map(gate => (
          <MapLibreGL.PointAnnotation
            key={`gate-${gate.id}`}
            id={`gate-${gate.id}`}
            coordinate={gate.coordinates}
            title={gate.description}
          >
            <View style={styles.gateMarker}>
              <View style={styles.gateMarkerInner} />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}

        {/* Staging Areas - Blue circles */}
        {stagingAreas.map(area => (
          <MapLibreGL.PointAnnotation
            key={`staging-${area.id}`}
            id={`staging-${area.id}`}
            coordinate={area.coordinates}
            title={area.description}
          >
            <View style={styles.stagingMarker}>
              <View style={styles.stagingMarkerInner} />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>
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
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7ec8ff',
  },
  subtitle: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 2,
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
});
