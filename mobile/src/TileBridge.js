// TileBridge - Reads PMTiles and serves tiles to WebView
import * as FileSystem from 'expo-file-system';
import { PMTiles } from 'pmtiles';

// Custom source that reads from local file using expo-file-system
class FileSource {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async getBytes(offset, length) {
    try {
      // Read bytes from file at offset
      const base64Data = await FileSystem.readAsStringAsync(this.filePath, {
        encoding: FileSystem.EncodingType.Base64,
        position: offset,
        length: length,
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return {
        data: bytes.buffer,
        etag: undefined,
        cacheControl: undefined,
        expires: undefined,
      };
    } catch (error) {
      console.error('FileSource getBytes error:', error);
      throw error;
    }
  }

  getKey() {
    return this.filePath;
  }
}

// TileBridge class manages PMTiles instances
export class TileBridge {
  constructor() {
    this.pmtilesInstances = {};
  }

  async init(basemapPaths) {
    try {
      if (basemapPaths.topo) {
        const topoSource = new FileSource(basemapPaths.topo);
        this.pmtilesInstances.topo = new PMTiles(topoSource);
        await this.pmtilesInstances.topo.getHeader(); // Validate file
        console.log('Topo PMTiles initialized');
      }

      if (basemapPaths.satellite) {
        const satSource = new FileSource(basemapPaths.satellite);
        this.pmtilesInstances.satellite = new PMTiles(satSource);
        await this.pmtilesInstances.satellite.getHeader(); // Validate file
        console.log('Satellite PMTiles initialized');
      }

      return true;
    } catch (error) {
      console.error('TileBridge init error:', error);
      return false;
    }
  }

  async getTile(basemap, z, x, y) {
    try {
      const pmtiles = this.pmtilesInstances[basemap];
      if (!pmtiles) {
        console.error(`No PMTiles instance for basemap: ${basemap}`);
        return null;
      }

      const tile = await pmtiles.getZxy(z, x, y);
      if (!tile || !tile.data) {
        return null;
      }

      // Convert ArrayBuffer to base64
      const bytes = new Uint8Array(tile.data);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      return base64;
    } catch (error) {
      console.error(`getTile error for ${basemap}/${z}/${x}/${y}:`, error);
      return null;
    }
  }

  async getMetadata(basemap) {
    try {
      const pmtiles = this.pmtilesInstances[basemap];
      if (!pmtiles) return null;

      const header = await pmtiles.getHeader();
      const metadata = await pmtiles.getMetadata();

      return {
        minZoom: header.minZoom,
        maxZoom: header.maxZoom,
        bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
        tileType: header.tileType,
        ...metadata,
      };
    } catch (error) {
      console.error('getMetadata error:', error);
      return null;
    }
  }
}

export default TileBridge;
