import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

// BCC Gates data
const gates = [
  { id: 1, latitude: 40.65086, longitude: -111.65054, description: "Upper Gate" },
  { id: 2, latitude: 40.61876, longitude: -111.77793, description: "Lower Gate" },
];

// BCC Staging Areas data
const stagingAreas = [
  { id: 1, latitude: 40.64953, longitude: -111.66153, description: "Staging Area 10.1" },
  { id: 2, latitude: 40.62199, longitude: -111.75057, description: "Staging Area 4.2" },
  { id: 3, latitude: 40.63421, longitude: -111.71155, description: "Staging Area 7.0" },
  { id: 4, latitude: 40.63639, longitude: -111.69962, description: "Staging Area 7.8" },
  { id: 5, latitude: 40.64221, longitude: -111.68574, description: "Staging Area 8.4" },
  { id: 6, latitude: 40.64356, longitude: -111.6754, description: "Staging Area 9.1" },
  { id: 7, latitude: 40.64539, longitude: -111.66882, description: "Staging Area 9.5" },
];

export default function App() {
  // Big Cottonwood Canyon area - centered on the data
  const initialRegion = {
    latitude: 40.635,
    longitude: -111.71,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MAP-OPS</Text>
        <Text style={styles.subtitle}>Mountain Avalanche Protection Operations</Text>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        mapType="hybrid"
        showsUserLocation={true}
        showsCompass={true}
        showsScale={true}
      >
        {/* Gates - Orange markers */}
        {gates.map(gate => (
          <Marker
            key={`gate-${gate.id}`}
            coordinate={{ latitude: gate.latitude, longitude: gate.longitude }}
            title="BCC Gate"
            description={gate.description}
            pinColor="orange"
          />
        ))}

        {/* Staging Areas - Blue markers */}
        {stagingAreas.map(area => (
          <Marker
            key={`staging-${area.id}`}
            coordinate={{ latitude: area.latitude, longitude: area.longitude }}
            title="Staging Area"
            description={area.description}
            pinColor="blue"
          />
        ))}
      </MapView>
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
});
