#!/usr/bin/env node
/**
 * Genera assets PWA desde icon.svg
 * Requiere: npm install sharp @expo/image-utils
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';

const ASSETS_DIR = resolve('assets');
const SVG_PATH = resolve(ASSETS_DIR, 'icon.svg');

const SIZES = [
  { name: 'icon.png', size: 1024 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'splash.png', size: 2732 },
  { name: 'favicon.png', size: 48 },
];

async function generate() {
  if (!existsSync(SVG_PATH)) {
    console.error('❌ No existe assets/icon.svg');
    process.exit(1);
  }

  if (!existsSync(ASSETS_DIR)) {
    mkdirSync(ASSETS_DIR, { recursive: true });
  }

  const svgBuffer = readFileSync(SVG_PATH);

  for (const { name, size } of SIZES) {
    const outputPath = resolve(ASSETS_DIR, name);
    try {
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
        .png()
        .toFile(outputPath);
      console.log(`✅ ${name} (${size}x${size})`);
    } catch (err) {
      console.error(`❌ ${name}:`, err.message);
    }
  }

  console.log('\n🎉 Assets generados en mobile/assets/');
  console.log('Ahora ejecuta: npx expo export -p web');
}

generate().catch(console.error);