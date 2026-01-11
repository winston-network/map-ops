// TileBridge - Reads PMTiles and serves tiles to WebView
import RNFS from 'react-native-fs';
import { PMTiles } from 'pmtiles';

// Custom source that reads from local file using react-native-fs
class FileSource {
  constructor(filePath) {
    // Remove file:// prefix if present
    this.filePath = filePath.replace('file://', '');
  }

  async getBytes(offset, length) {
    try {
      // Read bytes from file at offset using react-native-fs
      const base64Data = await RNFS.read(this.filePath, length, offset, 'base64');

      // Convert base64 to ArrayBuffer
      const binaryString = global.atob ? global.atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
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

// Simple base64 encode for React Native
function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return global.btoa ? global.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

// TileBridge class manages PMTiles instances
export class TileBridge {
  constructor() {
    this.pmtilesInstances = {};
  }

  async init(basemapPaths) {
    try {
      console.log('TileBridge init with paths:', basemapPaths);

      if (basemapPaths.topo) {
        console.log('Initializing topo PMTiles from:', basemapPaths.topo);
        const topoSource = new FileSource(basemapPaths.topo);
        this.pmtilesInstances.topo = new PMTiles(topoSource);
        const header = await this.pmtilesInstances.topo.getHeader();
        console.log('Topo PMTiles header:', header);
      }

      if (basemapPaths.satellite) {
        console.log('Initializing satellite PMTiles from:', basemapPaths.satellite);
        const satSource = new FileSource(basemapPaths.satellite);
        this.pmtilesInstances.satellite = new PMTiles(satSource);
        const header = await this.pmtilesInstances.satellite.getHeader();
        console.log('Satellite PMTiles header:', header);
      }

      console.log('TileBridge initialized successfully');
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
      return toBase64(tile.data);
    } catch (error) {
      // Tile not found is common, don't log as error
      return null;
    }
  }
}

export default TileBridge;
