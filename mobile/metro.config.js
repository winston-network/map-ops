const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add geojson as a source extension (so it can be imported as JSON)
config.resolver.sourceExts.push('geojson');

module.exports = config;
