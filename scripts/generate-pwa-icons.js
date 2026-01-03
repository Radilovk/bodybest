#!/usr/bin/env node
/**
 * Generate PWA icons from existing logo
 * Creates 192x192 and 512x512 icons with proper padding
 */

import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOGO_PATH = join(__dirname, '../img/logoindex.png');
const OUTPUT_DIR = join(__dirname, '../img');

const SIZES = [
  { size: 192, name: 'icon-192.png', padding: 20 },
  { size: 512, name: 'icon-512.png', padding: 50 },
  { size: 192, name: 'icon-192-maskable.png', padding: 40, maskable: true },
  { size: 512, name: 'icon-512-maskable.png', padding: 100, maskable: true }
];

async function generateIcon(logoPath, outputPath, size, padding, maskable = false) {
  try {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background color
    ctx.fillStyle = maskable ? '#007bff' : '#f4f7f6';
    ctx.fillRect(0, 0, size, size);
    
    // Load logo
    const logo = await loadImage(logoPath);
    
    // Calculate dimensions to fit logo with padding
    const maxSize = size - (padding * 2);
    let logoWidth = logo.width;
    let logoHeight = logo.height;
    
    // Scale to fit
    const scale = Math.min(maxSize / logoWidth, maxSize / logoHeight);
    logoWidth *= scale;
    logoHeight *= scale;
    
    // Center logo
    const x = (size - logoWidth) / 2;
    const y = (size - logoHeight) / 2;
    
    // Draw logo
    ctx.drawImage(logo, x, y, logoWidth, logoHeight);
    
    // Save
    const buffer = canvas.toBuffer('image/png');
    writeFileSync(outputPath, buffer);
    
    console.log(`✓ Generated ${outputPath} (${size}x${size})`);
  } catch (error) {
    console.error(`✗ Failed to generate ${outputPath}:`, error.message);
  }
}

async function main() {
  console.log('Generating PWA icons...\n');
  
  for (const { size, name, padding, maskable } of SIZES) {
    const outputPath = join(OUTPUT_DIR, name);
    await generateIcon(LOGO_PATH, outputPath, size, padding, maskable);
  }
  
  console.log('\n✓ All icons generated successfully!');
  console.log('\nGenerated icons:');
  SIZES.forEach(({ name }) => console.log(`  - img/${name}`));
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
