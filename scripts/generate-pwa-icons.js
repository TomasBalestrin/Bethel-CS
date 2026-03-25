const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const BG_COLOR = '#060A16';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');

function createSvg(size) {
  const fontSize = Math.round(size * 0.55);
  const y = Math.round(size * 0.58);
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BG_COLOR}" rx="${Math.round(size * 0.15)}"/>
  <text x="50%" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}" fill="white">B</text>
</svg>`;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const size of SIZES) {
    const svg = Buffer.from(createSvg(size));
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(outputPath);
    console.log(`Generated: icon-${size}x${size}.png`);
  }

  console.log('\nAll icons generated in /public/icons/');
}

main().catch(console.error);
