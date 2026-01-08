#!/usr/bin/env node
/**
 * Basemap Sync Script
 *
 * Syncs PMTiles files from web basemap folder to mobile assets.
 * Also syncs any PMTiles already in mobile back to web.
 *
 * Usage: npm run sync-basemaps
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const WEB_DIR = path.join(ROOT_DIR, 'basemap');
const MOBILE_DIR = path.join(ROOT_DIR, 'mobile', 'assets', 'basemap');

// Ensure directories exist
[WEB_DIR, MOBILE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Get PMTiles files from both directories
const webFiles = fs.readdirSync(WEB_DIR).filter(f => f.endsWith('.pmtiles'));
const mobileFiles = fs.readdirSync(MOBILE_DIR).filter(f => f.endsWith('.pmtiles'));

// All unique files
const allFiles = [...new Set([...webFiles, ...mobileFiles])];

console.log('Syncing basemaps...\n');

let synced = 0;
allFiles.forEach(file => {
  const webPath = path.join(WEB_DIR, file);
  const mobilePath = path.join(MOBILE_DIR, file);

  const webExists = fs.existsSync(webPath);
  const mobileExists = fs.existsSync(mobilePath);

  if (webExists && !mobileExists) {
    fs.copyFileSync(webPath, mobilePath);
    console.log(`  → Copied to mobile: ${file}`);
    synced++;
  } else if (!webExists && mobileExists) {
    fs.copyFileSync(mobilePath, webPath);
    console.log(`  ← Copied to web: ${file}`);
    synced++;
  } else {
    // Both exist - check if web is newer
    const webStat = fs.statSync(webPath);
    const mobileStat = fs.statSync(mobilePath);

    if (webStat.mtime > mobileStat.mtime) {
      fs.copyFileSync(webPath, mobilePath);
      console.log(`  → Updated mobile: ${file}`);
      synced++;
    } else if (mobileStat.mtime > webStat.mtime) {
      fs.copyFileSync(mobilePath, webPath);
      console.log(`  ← Updated web: ${file}`);
      synced++;
    } else {
      console.log(`  ✓ In sync: ${file}`);
    }
  }
});

console.log(`\n${synced > 0 ? synced + ' file(s) synced' : 'All files already in sync'}`);

// List final state
console.log('\nCurrent basemaps:');
const finalFiles = fs.readdirSync(WEB_DIR).filter(f => f.endsWith('.pmtiles'));
finalFiles.forEach(f => {
  const size = (fs.statSync(path.join(WEB_DIR, f)).size / 1024 / 1024).toFixed(2);
  console.log(`  ${f} (${size} MB)`);
});
