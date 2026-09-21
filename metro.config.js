const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend (wa-sqlite) ships a .wasm binary that Metro
// doesn't recognize as an asset by default.
config.resolver.assetExts.push('wasm');

module.exports = config;
