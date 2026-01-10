/**
 * Tile Extractor for MBTiles - File-based approach
 *
 * How it works:
 * 1. Read tiles from MBTiles (SQLite) database
 * 2. Extract tiles to individual files on disk (z/x/y.png)
 * 3. MapLibre reads tiles directly from filesystem via file:// URLs
 *
 * No HTTP server needed - simplest possible approach!
 */

import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

SQLite.enablePromise(true);

class TileServer {
  constructor() {
    this.isRunning = false;
    this.tilesDir = `${RNFS.DocumentDirectoryPath}/tiles`;
    this.extractedDbs = new Set();
  }

  /**
   * Extract tiles from MBTiles database to individual files
   */
  async extractTiles(dbName, mbtilesPath, onProgress) {
    const tileDir = `${this.tilesDir}/${dbName}`;

    // Check if already extracted
    const markerFile = `${tileDir}/.extracted`;
    const markerExists = await RNFS.exists(markerFile);
    if (markerExists) {
      console.log(`${dbName}: tiles already extracted`);
      this.extractedDbs.add(dbName);
      return true;
    }

    console.log(`${dbName}: extracting tiles from ${mbtilesPath}`);

    try {
      // Copy MBTiles to accessible location first
      const dbCopyPath = `${RNFS.DocumentDirectoryPath}/${dbName}_temp.db`;
      await RNFS.copyFile(mbtilesPath, dbCopyPath);

      // Open the copied database
      const db = await SQLite.openDatabase({
        name: `${dbName}_temp.db`,
        location: 'Documents',
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
      const baseDirExists = await RNFS.exists(this.tilesDir);
      if (!baseDirExists) {
        await RNFS.mkdir(this.tilesDir);
      }
      await RNFS.mkdir(tileDir);

      // Track created directories to avoid repeated checks
      const createdDirs = new Set();

      // Extract tiles in batches
      const batchSize = 200;
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

          // Ensure directories exist (with caching)
          if (!createdDirs.has(zDir)) {
            const zExists = await RNFS.exists(zDir);
            if (!zExists) await RNFS.mkdir(zDir);
            createdDirs.add(zDir);
          }

          if (!createdDirs.has(xDir)) {
            const xExists = await RNFS.exists(xDir);
            if (!xExists) await RNFS.mkdir(xDir);
            createdDirs.add(xDir);
          }

          // Write tile file
          const tilePath = `${xDir}/${xyzY}.png`;
          const tileData = row.tile_data;

          if (tileData) {
            // SQLite returns blob as base64 string
            await RNFS.writeFile(tilePath, tileData, 'base64');
          }

          extracted++;
        }

        offset += batchSize;

        // Report progress
        const progress = extracted / totalTiles;
        if (onProgress) onProgress(progress);

        if (extracted % 1000 === 0 || extracted === totalTiles) {
          console.log(`${dbName}: extracted ${extracted}/${totalTiles} (${Math.round(progress * 100)}%)`);
        }
      }

      // Create marker file to indicate extraction is complete
      await RNFS.writeFile(markerFile, new Date().toISOString(), 'utf8');

      await db.close();

      // Clean up temp database
      await RNFS.unlink(dbCopyPath);

      this.extractedDbs.add(dbName);
      console.log(`${dbName}: extraction complete!`);
      return true;

    } catch (error) {
      console.error(`${dbName}: extraction failed:`, error);
      return false;
    }
  }

  /**
   * "Start" the server (just marks as ready - no actual server needed)
   */
  async start() {
    // Ensure tiles directory exists
    const dirExists = await RNFS.exists(this.tilesDir);
    if (!dirExists) {
      await RNFS.mkdir(this.tilesDir);
    }
    this.isRunning = true;
    console.log(`Tile extractor ready. Tiles dir: ${this.tilesDir}`);
    return true;
  }

  /**
   * Open an MBTiles database and extract tiles
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

      console.log(`${name}: ready to serve via file://`);
      return true;

    } catch (error) {
      console.error(`Failed to open MBTiles ${name}:`, error);
      return false;
    }
  }

  /**
   * Get tile URL template for MapLibre
   * Uses file:// protocol to read directly from filesystem
   */
  getTileUrl(dbName) {
    return `file://${this.tilesDir}/${dbName}/{z}/{x}/{y}.png`;
  }

  /**
   * Get the port (for compatibility - not actually used)
   */
  get port() {
    return 0; // No server
  }

  /**
   * Stop (no-op since no server)
   */
  async stop() {
    this.isRunning = false;
    console.log('Tile extractor stopped');
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
      this.extractedDbs.clear();
      console.log('Tile cache cleared');
    } catch (error) {
      console.error('Failed to clear tile cache:', error);
    }
  }
}

export default new TileServer();
