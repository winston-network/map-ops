/**
 * Local Tile Server for MBTiles - Wasatch App Architecture
 *
 * How it works (mimics Wasatch Backcountry Skiing app):
 * 1. Read tiles from MBTiles (SQLite) database
 * 2. Extract tiles to individual files on disk (z/x/y.png)
 * 3. Serve tile directory with static file server
 * 4. MapLibre requests tiles as static files
 */

import StaticServer from '@dr.pogodin/react-native-static-server';
import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

SQLite.enablePromise(true);

class TileServer {
  constructor() {
    this.server = null;
    this.port = 9876;
    this.isRunning = false;
    this.tilesDir = `${RNFS.DocumentDirectoryPath}/tiles`;
  }

  /**
   * Extract tiles from MBTiles database to individual files
   * This is the key step - static server can only serve files, not database queries
   */
  async extractTiles(dbName, mbtilesPath, onProgress) {
    const tileDir = `${this.tilesDir}/${dbName}`;

    // Check if already extracted
    const markerFile = `${tileDir}/.extracted`;
    const markerExists = await RNFS.exists(markerFile);
    if (markerExists) {
      console.log(`${dbName}: tiles already extracted`);
      return true;
    }

    console.log(`${dbName}: extracting tiles from ${mbtilesPath}`);

    try {
      // Open the MBTiles database
      const db = await SQLite.openDatabase({
        name: mbtilesPath,
        location: 'default',
        createFromLocation: mbtilesPath,
      });

      // Get total tile count for progress
      const [countResult] = await db.executeSql('SELECT COUNT(*) as count FROM tiles');
      const totalTiles = countResult.rows.item(0).count;
      console.log(`${dbName}: ${totalTiles} tiles to extract`);

      if (totalTiles === 0) {
        console.error(`${dbName}: no tiles in database!`);
        await db.close();
        return false;
      }

      // Create base directory
      await RNFS.mkdir(tileDir);

      // Extract tiles in batches
      const batchSize = 500;
      let extracted = 0;
      let offset = 0;

      while (offset < totalTiles) {
        const [results] = await db.executeSql(
          'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles LIMIT ? OFFSET ?',
          [batchSize, offset]
        );

        for (let i = 0; i < results.rows.length; i++) {
          const row = results.rows.item(i);
          const z = row.zoom_level;
          const x = row.tile_column;
          // MBTiles uses TMS - flip Y coordinate to XYZ
          const tmsY = row.tile_row;
          const xyzY = Math.pow(2, z) - 1 - tmsY;

          // Create directory structure: tiles/dbname/z/x/
          const zDir = `${tileDir}/${z}`;
          const xDir = `${zDir}/${x}`;

          // Ensure directories exist
          const zExists = await RNFS.exists(zDir);
          if (!zExists) await RNFS.mkdir(zDir);

          const xExists = await RNFS.exists(xDir);
          if (!xExists) await RNFS.mkdir(xDir);

          // Write tile file (y.png)
          const tilePath = `${xDir}/${xyzY}.png`;

          // tile_data should be base64 encoded blob from SQLite
          const tileData = row.tile_data;
          if (tileData) {
            // Write as base64
            await RNFS.writeFile(tilePath, tileData, 'base64');
          }

          extracted++;
        }

        offset += batchSize;

        // Report progress
        const progress = extracted / totalTiles;
        if (onProgress) onProgress(progress);
        console.log(`${dbName}: extracted ${extracted}/${totalTiles} (${Math.round(progress * 100)}%)`);
      }

      // Create marker file to indicate extraction is complete
      await RNFS.writeFile(markerFile, new Date().toISOString(), 'utf8');

      await db.close();
      console.log(`${dbName}: extraction complete!`);
      return true;

    } catch (error) {
      console.error(`${dbName}: extraction failed:`, error);
      return false;
    }
  }

  /**
   * Start the static file server
   */
  async start() {
    if (this.isRunning) {
      console.log('Tile server already running');
      return true;
    }

    try {
      // Ensure tiles directory exists
      const dirExists = await RNFS.exists(this.tilesDir);
      if (!dirExists) {
        await RNFS.mkdir(this.tilesDir);
      }

      // Create static server serving the tiles directory
      this.server = new StaticServer(this.port, this.tilesDir, {
        localOnly: true,
        keepAlive: true,
      });

      const origin = await this.server.start();
      this.isRunning = true;
      console.log(`Static tile server running at ${origin}`);
      return true;

    } catch (error) {
      console.error('Failed to start tile server:', error);
      return false;
    }
  }

  /**
   * Open an MBTiles database and extract tiles
   * Returns true when tiles are ready to serve
   */
  async openDatabase(name, filePath, onProgress) {
    try {
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        console.error(`MBTiles file not found: ${filePath}`);
        return false;
      }

      // Extract tiles from MBTiles to static files
      const extracted = await this.extractTiles(name, filePath, onProgress);
      if (!extracted) {
        console.error(`Failed to extract tiles for ${name}`);
        return false;
      }

      console.log(`${name}: ready to serve`);
      return true;

    } catch (error) {
      console.error(`Failed to open MBTiles ${name}:`, error);
      return false;
    }
  }

  /**
   * Get tile URL template for MapLibre
   * Static server serves files at: http://localhost:PORT/dbname/z/x/y.png
   */
  getTileUrl(dbName) {
    return `http://localhost:${this.port}/${dbName}/{z}/{x}/{y}.png`;
  }

  /**
   * Stop the server
   */
  async stop() {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
    this.isRunning = false;
    console.log('Tile server stopped');
  }

  /**
   * Clear extracted tiles (force re-extraction)
   */
  async clearCache() {
    try {
      const exists = await RNFS.exists(this.tilesDir);
      if (exists) {
        await RNFS.unlink(this.tilesDir);
      }
      console.log('Tile cache cleared');
    } catch (error) {
      console.error('Failed to clear tile cache:', error);
    }
  }
}

export default new TileServer();
