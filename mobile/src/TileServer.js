/**
 * Local Tile Server for MBTiles
 *
 * Mimics how native iOS apps serve offline tiles:
 * 1. Run HTTP server on localhost
 * 2. Read tiles from MBTiles (SQLite) database
 * 3. MapLibre points to http://localhost:PORT/{z}/{x}/{y}
 */

import { BridgeServer } from 'react-native-http-bridge-refurbished';
import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

SQLite.enablePromise(true);

class TileServer {
  constructor() {
    this.server = null;
    this.databases = {};
    this.port = 9876;
    this.isRunning = false;
  }

  /**
   * Start the tile server
   */
  async start() {
    if (this.isRunning) {
      console.log('Tile server already running');
      return true;
    }

    try {
      this.server = new BridgeServer('http_service', true);

      // Handle tile requests: /dbname/z/x/y
      this.server.get('/:db/:z/:x/:y', async (req, res) => {
        const { db, z, x, y } = req.params;

        try {
          const tileData = await this.getTile(db, parseInt(z), parseInt(x), parseInt(y));

          if (tileData) {
            // Return tile as binary data
            res.send(200, 'image/png', tileData);
          } else {
            // Return transparent pixel for missing tiles
            res.send(404, 'text/plain', 'Tile not found');
          }
        } catch (error) {
          console.error('Tile request error:', error);
          res.send(500, 'text/plain', error.message);
        }
      });

      // Health check endpoint
      this.server.get('/health', (req, res) => {
        res.send(200, 'application/json', JSON.stringify({ status: 'ok', databases: Object.keys(this.databases) }));
      });

      await this.server.listen(this.port);
      this.isRunning = true;
      console.log(`Tile server running on port ${this.port}`);
      return true;
    } catch (error) {
      console.error('Failed to start tile server:', error);
      return false;
    }
  }

  /**
   * Open an MBTiles database
   */
  async openDatabase(name, filePath) {
    try {
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        console.error(`MBTiles file not found: ${filePath}`);
        return false;
      }

      // Copy to a location SQLite can access if needed
      const dbPath = `${RNFS.DocumentDirectoryPath}/${name}.db`;

      // Only copy if not already there or different
      const dbExists = await RNFS.exists(dbPath);
      if (!dbExists) {
        await RNFS.copyFile(filePath, dbPath);
      }

      const db = await SQLite.openDatabase({
        name: `${name}.db`,
        location: 'Documents',
      });

      this.databases[name] = db;
      console.log(`Opened MBTiles: ${name}`);

      // Log metadata
      const metadata = await this.getMetadata(name);
      console.log(`${name} metadata:`, metadata);

      return true;
    } catch (error) {
      console.error(`Failed to open MBTiles ${name}:`, error);
      return false;
    }
  }

  /**
   * Get a tile from MBTiles database
   * MBTiles uses TMS (flipped Y) coordinate system
   */
  async getTile(dbName, z, x, y) {
    const db = this.databases[dbName];
    if (!db) {
      console.error(`Database not found: ${dbName}`);
      return null;
    }

    // MBTiles uses TMS - flip Y coordinate
    const tmsY = Math.pow(2, z) - 1 - y;

    try {
      const [results] = await db.executeSql(
        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
        [z, x, tmsY]
      );

      if (results.rows.length > 0) {
        return results.rows.item(0).tile_data;
      }
      return null;
    } catch (error) {
      console.error(`Tile query error ${z}/${x}/${y}:`, error);
      return null;
    }
  }

  /**
   * Get MBTiles metadata
   */
  async getMetadata(dbName) {
    const db = this.databases[dbName];
    if (!db) return null;

    try {
      const [results] = await db.executeSql('SELECT name, value FROM metadata');
      const metadata = {};
      for (let i = 0; i < results.rows.length; i++) {
        const row = results.rows.item(i);
        metadata[row.name] = row.value;
      }
      return metadata;
    } catch (error) {
      console.error('Metadata query error:', error);
      return null;
    }
  }

  /**
   * Get tile URL template for MapLibre
   */
  getTileUrl(dbName) {
    return `http://localhost:${this.port}/${dbName}/{z}/{x}/{y}`;
  }

  /**
   * Stop the server and close databases
   */
  async stop() {
    if (this.server) {
      this.server.stop();
    }

    for (const [name, db] of Object.entries(this.databases)) {
      try {
        await db.close();
      } catch (e) {
        console.error(`Error closing ${name}:`, e);
      }
    }

    this.databases = {};
    this.isRunning = false;
    console.log('Tile server stopped');
  }
}

export default new TileServer();
