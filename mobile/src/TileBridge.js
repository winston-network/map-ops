// TileBridge - Reads tiles from MBTiles (SQLite) and serves to WebView
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

class TileBridge {
  constructor() {
    this.databases = {};
  }

  async init(mbtilesPaths) {
    console.log('TileBridge.init called');

    try {
      for (const [name, assetModule] of Object.entries(mbtilesPaths)) {
        console.log(`Loading ${name} MBTiles...`);

        // Download asset to local storage
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();

        console.log(`Asset ${name} downloaded:`, {
          localUri: asset.localUri,
          uri: asset.uri,
          downloaded: asset.downloaded,
        });

        if (!asset.localUri) {
          throw new Error(`Asset ${name} has no localUri after download`);
        }

        // Copy to SQLite directory if needed
        const dbDir = `${FileSystem.documentDirectory}SQLite/`;
        const dbPath = `${dbDir}${name}.mbtiles`;

        console.log(`DB directory: ${dbDir}`);
        console.log(`DB path: ${dbPath}`);

        // Ensure directory exists
        await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true }).catch((e) => {
          console.log('mkdir error (might already exist):', e.message);
        });

        // Copy file if it doesn't exist or force recopy
        const info = await FileSystem.getInfoAsync(dbPath);
        console.log(`Existing file info:`, info);

        if (!info.exists) {
          console.log(`Copying ${name} from ${asset.localUri} to ${dbPath}`);
          await FileSystem.copyAsync({
            from: asset.localUri,
            to: dbPath,
          });
          console.log(`Copy complete for ${name}`);
        } else {
          console.log(`${name} already exists at ${dbPath}`);
        }

        // Open database
        console.log(`Opening database: ${name}.mbtiles`);
        const db = await SQLite.openDatabaseAsync(`${name}.mbtiles`);
        this.databases[name] = db;
        console.log(`Database ${name} opened successfully`);

        // Log metadata
        const metadata = await db.getAllAsync('SELECT name, value FROM metadata');
        console.log(`${name} metadata:`, metadata);
      }

      console.log('TileBridge initialized with databases:', Object.keys(this.databases));
      return true;
    } catch (error) {
      console.error('TileBridge init error:', error.message);
      console.error('TileBridge init stack:', error.stack);
      return false;
    }
  }

  async getTile(basemap, z, x, y) {
    const db = this.databases[basemap];
    if (!db) {
      console.log(`No database for basemap: ${basemap}`);
      return null;
    }

    try {
      // MBTiles uses TMS scheme - flip y coordinate
      const tmsY = (1 << z) - 1 - y;

      const result = await db.getFirstAsync(
        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
        [z, x, tmsY]
      );

      if (result && result.tile_data) {
        // Convert blob to base64
        // tile_data is a Uint8Array, convert to base64
        const bytes = new Uint8Array(result.tile_data);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }

      return null;
    } catch (error) {
      // Tile not found is common, don't log as error
      return null;
    }
  }

  async getMetadata(basemap) {
    const db = this.databases[basemap];
    if (!db) return null;

    try {
      const rows = await db.getAllAsync('SELECT name, value FROM metadata');
      const metadata = {};
      for (const row of rows) {
        metadata[row.name] = row.value;
      }
      return metadata;
    } catch (error) {
      console.error('getMetadata error:', error);
      return null;
    }
  }

  async close() {
    for (const [name, db] of Object.entries(this.databases)) {
      await db.closeAsync();
    }
    this.databases = {};
  }
}

export default TileBridge;
