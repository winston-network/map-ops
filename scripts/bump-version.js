#!/usr/bin/env node
/**
 * Version Bump Script
 *
 * Updates version in all project files at once.
 *
 * Usage:
 *   npm run bump patch   (1.3.0 -> 1.3.1)
 *   npm run bump minor   (1.3.0 -> 1.4.0)
 *   npm run bump major   (1.3.0 -> 2.0.0)
 *   npm run bump 1.5.0   (set specific version)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const FILES_TO_UPDATE = [
  'package.json',
  'mobile/app.json'
];

// Get current version from package.json
const pkgPath = path.join(ROOT_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

// Parse version
function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

// Determine new version
const arg = process.argv[2];
let newVersion;

if (!arg) {
  console.log(`Current version: ${currentVersion}`);
  console.log('\nUsage:');
  console.log('  npm run bump patch   (1.3.0 -> 1.3.1)');
  console.log('  npm run bump minor   (1.3.0 -> 1.4.0)');
  console.log('  npm run bump major   (1.3.0 -> 2.0.0)');
  console.log('  npm run bump 1.5.0   (set specific version)');
  process.exit(0);
}

const v = parseVersion(currentVersion);

switch (arg) {
  case 'patch':
    newVersion = `${v.major}.${v.minor}.${v.patch + 1}`;
    break;
  case 'minor':
    newVersion = `${v.major}.${v.minor + 1}.0`;
    break;
  case 'major':
    newVersion = `${v.major + 1}.0.0`;
    break;
  default:
    // Assume it's a specific version
    if (/^\d+\.\d+\.\d+$/.test(arg)) {
      newVersion = arg;
    } else {
      console.error(`Invalid version: ${arg}`);
      process.exit(1);
    }
}

console.log(`Bumping version: ${currentVersion} -> ${newVersion}\n`);

// Update each file
FILES_TO_UPDATE.forEach(file => {
  const filePath = path.join(ROOT_DIR, file);

  if (!fs.existsSync(filePath)) {
    console.log(`  Skipped: ${file} (not found)`);
    return;
  }

  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Update version field
  if (file === 'mobile/app.json') {
    content.expo.version = newVersion;
    // Also bump Android versionCode
    if (content.expo.android && content.expo.android.versionCode) {
      content.expo.android.versionCode++;
      console.log(`  Updated: ${file} (version + versionCode: ${content.expo.android.versionCode})`);
    } else {
      console.log(`  Updated: ${file}`);
    }
    // Also bump iOS buildNumber
    if (content.expo.ios && content.expo.ios.buildNumber) {
      content.expo.ios.buildNumber = String(parseInt(content.expo.ios.buildNumber) + 1);
    }
  } else {
    content.version = newVersion;
    console.log(`  Updated: ${file}`);
  }

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
});

console.log(`\nVersion bumped to ${newVersion}`);
console.log('Ready to commit and build!');
