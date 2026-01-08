#!/usr/bin/env node
/**
 * Basemap Conversion Script
 *
 * Converts MBTiles files from basemap/source/ to PMTiles format
 * and copies them to both web and mobile app locations.
 *
 * Usage: npm run convert-basemaps
 *
 * Place your .mbtiles files in: basemap/source/
 * Output goes to:
 *   - basemap/*.pmtiles (for web localhost)
 *   - mobile/assets/basemap/*.pmtiles (for mobile app)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'basemap', 'source');
const WEB_OUTPUT_DIR = path.join(ROOT_DIR, 'basemap');
const MOBILE_OUTPUT_DIR = path.join(ROOT_DIR, 'mobile', 'assets', 'basemap');
const PMTILES_BIN = path.join(ROOT_DIR, 'tools', 'pmtiles.exe');

// Ensure output directories exist
[WEB_OUTPUT_DIR, MOBILE_OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Find all .mbtiles files in source directory
const mbtilesFiles = fs.readdirSync(SOURCE_DIR)
  .filter(file => file.endsWith('.mbtiles'));

if (mbtilesFiles.length === 0) {
  console.log('No .mbtiles files found in basemap/source/');
  console.log('Place your MBTiles files there and run again.');
  process.exit(0);
}

console.log(`Found ${mbtilesFiles.length} MBTiles file(s) to convert:\n`);

mbtilesFiles.forEach(file => {
  const baseName = file.replace('.mbtiles', '');
  const inputPath = path.join(SOURCE_DIR, file);
  const pmtilesName = `${baseName}.pmtiles`;
  const webOutput = path.join(WEB_OUTPUT_DIR, pmtilesName);
  const mobileOutput = path.join(MOBILE_OUTPUT_DIR, pmtilesName);

  console.log(`Converting: ${file}`);

  // Get input file size
  const inputSize = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);
  console.log(`  Input size: ${inputSize} MB`);

  try {
    // Convert to PMTiles (output to web directory first)
    console.log(`  Converting to PMTiles...`);
    execSync(`"${PMTILES_BIN}" convert "${inputPath}" "${webOutput}"`, { stdio: 'inherit' });

    // Get output file size
    const outputSize = (fs.statSync(webOutput).size / 1024 / 1024).toFixed(2);
    console.log(`  Output size: ${outputSize} MB`);

    // Show tile info
    console.log(`  Tile info:`);
    execSync(`"${PMTILES_BIN}" show "${webOutput}"`, { stdio: 'inherit' });

    // Copy to mobile directory
    console.log(`  Copying to mobile assets...`);
    fs.copyFileSync(webOutput, mobileOutput);

    console.log(`  ✓ Done: ${pmtilesName}\n`);
  } catch (error) {
    console.error(`  ✗ Error converting ${file}:`, error.message);
  }
});

console.log('Basemap conversion complete!');
console.log(`\nOutput locations:`);
console.log(`  Web:    ${WEB_OUTPUT_DIR}`);
console.log(`  Mobile: ${MOBILE_OUTPUT_DIR}`);
