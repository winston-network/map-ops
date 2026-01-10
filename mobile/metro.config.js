const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add pmtiles and mbtiles as asset extensions for offline basemaps
config.resolver.assetExts.push('pmtiles', 'mbtiles');

module.exports = config;
