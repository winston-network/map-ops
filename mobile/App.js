import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useState } from 'react';

// Import GeoJSON data
import avyPaths from './assets/layers/BCC_AvyPaths.json';
import gatesData from './assets/layers/BCC_Gates.json';
import stagingData from './assets/layers/BCC_Staging.json';

// Initialize MapLibre (no access token needed for free tiles)
MapLibreGL.setAccessToken(null);

// Basemap styles (online sources for now - offline PMTiles coming soon)
const BASEMAPS = {
  topo: {
    name: 'Topo',
    style: {
      version: 8,
      sources: {
        'opentopomap': {
          type: 'raster',
          tiles: [
            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenTopoMap contributors'
        }
      },
      layers: [
        {
          id: 'opentopomap-layer',
          type: 'raster',
          source: 'opentopomap',
          minzoom: 0,
          maxzoom: 17
        }
      ]
    }
  },
  satellite: {
    name: 'Satellite',
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '© Esri'
        }
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    }
  }
};

export default function App() {
  // Layer visibility state
  const [showAvyPaths, setShowAvyPaths] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [showStaging, setShowStaging] = useState(true);
  const [currentBasemap, setCurrentBasemap] = useState('satellite');

  const basemapStyle = BASEMAPS[currentBasemap].style;

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
          <View style={[styles.toggleRect, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.toggleText}>Paths</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showGates && styles.toggleBtnActive]}
          onPress={() => setShowGates(!showGates)}
        >
          <Image source={require('./assets/icons/BCC_Gates.png')} style={styles.toggleIcon} />
          <Text style={styles.toggleText}>Gates</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, showStaging && styles.toggleBtnActive]}
          onPress={() => setShowStaging(!showStaging)}
        >
          <Image source={require('./assets/icons/BCC_Staging.png')} style={styles.toggleIcon} />
          <Text style={styles.toggleText}>Staging</Text>
        </TouchableOpacity>
      </View>

      {/* MapLibre Map */}
      <MapLibreGL.MapView
        key={currentBasemap}
        style={styles.map}
        styleJSON={JSON.stringify(basemapStyle)}
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
    marginRight: 4,
  },
  toggleRect: {
    width: 14,
    height: 10,
    borderRadius: 2,
    marginRight: 4,
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
