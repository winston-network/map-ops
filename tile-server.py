#!/usr/bin/env python3
"""
Simple MBTiles Tile Server using Python (no npm required)

Usage: python tile-server.py
Tiles available at: http://localhost:3000/tiles/{z}/{x}/{y}
"""

import http.server
import socketserver
import sqlite3
import os
import json
import re
from urllib.parse import urlparse

PORT = 3000
MBTILES_PATH = os.path.join(os.path.dirname(__file__), 'basemap', 'SLC_satelite_test.mbtiles')

class TileHandler(http.server.BaseHTTPRequestHandler):

    def do_GET(self):
        # Add CORS headers
        self.send_cors_headers()

        path = urlparse(self.path).path

        # Health check
        if path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            return

        # Metadata
        if path == '/metadata':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            metadata = get_metadata()
            self.wfile.write(json.dumps(metadata).encode())
            return

        # Tile request: /tiles/{z}/{x}/{y} or /tiles/{z}/{x}/{y}.png
        tile_match = re.match(r'^/tiles/(\d+)/(\d+)/(\d+)(\.png)?$', path)
        if tile_match:
            z = int(tile_match.group(1))
            x = int(tile_match.group(2))
            y = int(tile_match.group(3))

            tile = get_tile(z, x, y)

            if tile:
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
                self.wfile.write(tile)
            else:
                # Return 204 for missing tiles
                self.send_response(204)
                self.end_headers()
            return

        # Not found
        self.send_response(404)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Not found')

    def send_cors_headers(self):
        pass  # Headers added in response methods

    def send_response(self, code, message=None):
        super().send_response(code, message)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')

    def log_message(self, format, *args):
        # Only log errors, not every request
        if args[1] != '200' and args[1] != '204':
            super().log_message(format, *args)


def get_metadata():
    """Get metadata from MBTiles file"""
    conn = sqlite3.connect(MBTILES_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT name, value FROM metadata')
    metadata = {row[0]: row[1] for row in cursor.fetchall()}
    conn.close()
    return metadata


def get_tile(z, x, y):
    """Get tile data from MBTiles file"""
    # MBTiles uses TMS scheme (y is flipped)
    tms_y = (2 ** z) - 1 - y

    conn = sqlite3.connect(MBTILES_PATH)
    cursor = conn.cursor()
    cursor.execute(
        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
        (z, x, tms_y)
    )
    row = cursor.fetchone()
    conn.close()

    return row[0] if row else None


def main():
    # Check if MBTiles file exists
    if not os.path.exists(MBTILES_PATH):
        print(f"Error: MBTiles file not found: {MBTILES_PATH}")
        return

    # Print metadata
    print("MBTiles Metadata:")
    metadata = get_metadata()
    for key, value in metadata.items():
        print(f"  {key}: {value}")

    # Start server
    with socketserver.TCPServer(("", PORT), TileHandler) as httpd:
        print(f"\nTile server running at http://localhost:{PORT}")
        print(f"Tiles available at: http://localhost:{PORT}/tiles/{{z}}/{{x}}/{{y}}")
        print("\nPress Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")


if __name__ == '__main__':
    main()
