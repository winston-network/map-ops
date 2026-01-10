const sharp = require('sharp');
const path = require('path');

async function generateIcon() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const snowflakePath = path.join(assetsDir, 'icons', 'snowflake.png');

  // App icon dimensions
  const iconSize = 1024;
  const snowflakeSize = 600;
  const glowSize = 700; // Slightly larger for glow

  // Colors
  const bgColor = '#1a1a2e';
  const glowColor = '#7ec8ff';

  console.log('Loading snowflake...');

  // Load and resize snowflake
  const snowflake = await sharp(snowflakePath)
    .resize(snowflakeSize, snowflakeSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Create glow layer - resize snowflake larger, blur it, tint it
  const glowLayer = await sharp(snowflakePath)
    .resize(glowSize, glowSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(25)
    .tint({ r: 126, g: 200, b: 255 }) // #7ec8ff
    .toBuffer();

  // Create second glow layer (more blur for outer glow)
  const outerGlowLayer = await sharp(snowflakePath)
    .resize(glowSize + 100, glowSize + 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(50)
    .tint({ r: 126, g: 200, b: 255 })
    .modulate({ brightness: 0.8 })
    .toBuffer();

  console.log('Compositing icon...');

  // Create the final icon
  const icon = await sharp({
    create: {
      width: iconSize,
      height: iconSize,
      channels: 4,
      background: bgColor
    }
  })
    .composite([
      // Outer glow
      {
        input: outerGlowLayer,
        top: Math.floor((iconSize - glowSize - 100) / 2),
        left: Math.floor((iconSize - glowSize - 100) / 2),
        blend: 'screen'
      },
      // Inner glow
      {
        input: glowLayer,
        top: Math.floor((iconSize - glowSize) / 2),
        left: Math.floor((iconSize - glowSize) / 2),
        blend: 'screen'
      },
      // Snowflake on top
      {
        input: snowflake,
        top: Math.floor((iconSize - snowflakeSize) / 2),
        left: Math.floor((iconSize - snowflakeSize) / 2)
      }
    ])
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  console.log('Created icon.png');

  // Create adaptive icon (foreground only, with transparency)
  const adaptiveIcon = await sharp({
    create: {
      width: iconSize,
      height: iconSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      // Glow
      {
        input: glowLayer,
        top: Math.floor((iconSize - glowSize) / 2),
        left: Math.floor((iconSize - glowSize) / 2),
        blend: 'over'
      },
      // Snowflake
      {
        input: snowflake,
        top: Math.floor((iconSize - snowflakeSize) / 2),
        left: Math.floor((iconSize - snowflakeSize) / 2)
      }
    ])
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));

  console.log('Created adaptive-icon.png');

  // Create splash icon (smaller version for splash screen)
  const splashIcon = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      {
        input: await sharp(snowflakePath)
          .resize(350, 350, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .blur(15)
          .tint({ r: 126, g: 200, b: 255 })
          .toBuffer(),
        top: 81,
        left: 81,
        blend: 'over'
      },
      {
        input: await sharp(snowflakePath)
          .resize(300, 300, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer(),
        top: 106,
        left: 106
      }
    ])
    .png()
    .toFile(path.join(assetsDir, 'splash-icon.png'));

  console.log('Created splash-icon.png');
  console.log('Done!');
}

generateIcon().catch(console.error);
