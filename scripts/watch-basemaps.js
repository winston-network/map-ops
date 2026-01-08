#!/usr/bin/env node
/**
 * Basemap Watcher
 *
 * Watches basemap/source/ for new or changed .mbtiles files
 * and automatically converts them to PMTiles.
 *
 * Usage: npm run watch-basemaps
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'basemap', 'source');
const WEB_OUTPUT_DIR = path.join(ROOT_DIR, 'basemap');
const MOBILE_OUTPUT_DIR = path.join(ROOT_DIR, 'mobile', 'assets', 'basemap');

// Ensure directories exist
[SOURCE_DIR, WEB_OUTPUT_DIR, MOBILE_OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function convertFile(filename) {
  if (!filename.endsWith('.mbtiles')) return;

  const baseName = filename.replace('.mbtiles', '');
  const inputPath = path.join(SOURCE_DIR, filename);
  const pmtilesName = `${baseName}.pmtiles`;
  const webOutput = path.join(WEB_OUTPUT_DIR, pmtilesName);
  const mobileOutput = path.join(MOBILE_OUTPUT_DIR, pmtilesName);

  // Wait a moment for file to finish writing
  setTimeout(() => {
    try {
      const inputSize = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);
      console.log(`\n🔄 Converting: ${filename} (${inputSize} MB)`);

      // Convert
      execSync(`pmtiles convert "${inputPath}" "${webOutput}"`, { stdio: 'pipe' });

      const outputSize = (fs.statSync(webOutput).size / 1024 / 1024).toFixed(2);

      // Copy to mobile
      fs.copyFileSync(webOutput, mobileOutput);

      console.log(`✅ Done: ${pmtilesName} (${outputSize} MB)`);
      console.log(`   → ${WEB_OUTPUT_DIR}`);
      console.log(`   → ${MOBILE_OUTPUT_DIR}`);
    } catch (error) {
      console.error(`❌ Error converting ${filename}:`, error.message);
    }
  }, 1000);
}

// Initial conversion of existing files
const existingFiles = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.mbtiles'));
if (existingFiles.length > 0) {
  console.log(`Found ${existingFiles.length} existing MBTiles file(s), converting...`);
  existingFiles.forEach(convertFile);
}

// Watch for changes
console.log(`\n👀 Watching: ${SOURCE_DIR}`);
console.log('Drop .mbtiles files here to auto-convert to PMTiles\n');
console.log('Press Ctrl+C to stop\n');

fs.watch(SOURCE_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.mbtiles')) {
    if (eventType === 'rename' || eventType === 'change') {
      const filePath = path.join(SOURCE_DIR, filename);
      if (fs.existsSync(filePath)) {
        convertFile(filename);
      }
    }
  }
});
