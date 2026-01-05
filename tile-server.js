/**
 * Simple MBTiles Tile Server
 * Serves tiles from .mbtiles file over HTTP
 *
 * Usage: node tile-server.js
 * Tiles available at: http://localhost:3000/tiles/{z}/{x}/{y}
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Try to load better-sqlite3, fall back to sql.js
let Database;
let useSqlJs = false;

try {
    Database = require('better-sqlite3');
} catch (e) {
    console.log('better-sqlite3 not found, will try sql.js...');
    useSqlJs = true;
}

const MBTILES_PATH = path.join(__dirname, 'basemap', 'SLC_satelite_test.mbtiles');
const PORT = 3000;

let db;
let sqlJsDb;

// Initialize database
async function initDatabase() {
    if (!fs.existsSync(MBTILES_PATH)) {
        console.error(`MBTiles file not found: ${MBTILES_PATH}`);
        process.exit(1);
    }

    if (useSqlJs) {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const fileBuffer = fs.readFileSync(MBTILES_PATH);
        sqlJsDb = new SQL.Database(fileBuffer);
        console.log('Using sql.js for database access');
    } else {
        db = new Database(MBTILES_PATH, { readonly: true });
        console.log('Using better-sqlite3 for database access');
    }

    // Get metadata
    const metadata = getMetadata();
    console.log('\nMBTiles Metadata:');
    Object.entries(metadata).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
    });
}

function getMetadata() {
    const metadata = {};
    let rows;

    if (useSqlJs) {
        const result = sqlJsDb.exec('SELECT name, value FROM metadata');
        rows = result[0]?.values || [];
        rows.forEach(([name, value]) => {
            metadata[name] = value;
        });
    } else {
        rows = db.prepare('SELECT name, value FROM metadata').all();
        rows.forEach(row => {
            metadata[row.name] = row.value;
        });
    }

    return metadata;
}

function getTile(z, x, y) {
    // MBTiles uses TMS scheme (y is flipped)
    const tmsY = Math.pow(2, z) - 1 - y;

    let row;
    if (useSqlJs) {
        const result = sqlJsDb.exec(
            `SELECT tile_data FROM tiles WHERE zoom_level = ${z} AND tile_column = ${x} AND tile_row = ${tmsY}`
        );
        if (result[0]?.values?.[0]?.[0]) {
            return Buffer.from(result[0].values[0][0]);
        }
        return null;
    } else {
        row = db.prepare(
            'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
        ).get(z, x, tmsY);
        return row?.tile_data || null;
    }
}

// Create HTTP server
const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // Parse URL
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Health check
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    // Metadata endpoint
    if (url.pathname === '/metadata') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getMetadata()));
        return;
    }

    // Tile request: /tiles/{z}/{x}/{y} or /tiles/{z}/{x}/{y}.png
    const tileMatch = url.pathname.match(/^\/tiles\/(\d+)\/(\d+)\/(\d+)(\.png)?$/);

    if (tileMatch) {
        const z = parseInt(tileMatch[1]);
        const x = parseInt(tileMatch[2]);
        const y = parseInt(tileMatch[3]);

        const tile = getTile(z, x, y);

        if (tile) {
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400'
            });
            res.end(tile);
        } else {
            // Return transparent tile for missing tiles
            res.writeHead(204);
            res.end();
        }
        return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
});

// Start server
async function start() {
    await initDatabase();

    server.listen(PORT, () => {
        console.log(`\nTile server running at http://localhost:${PORT}`);
        console.log(`Tiles available at: http://localhost:${PORT}/tiles/{z}/{x}/{y}`);
        console.log(`\nPress Ctrl+C to stop\n`);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
