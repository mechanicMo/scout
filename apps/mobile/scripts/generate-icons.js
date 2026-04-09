const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

async function generate(svgPath, outPath, size = 1024) {
  const svg = fs.readFileSync(svgPath);
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ ${path.basename(outPath)}`);
}

async function main() {
  await generate(
    path.join(ASSETS, 'icon.svg'),
    path.join(ASSETS, 'icon.png'),
  );
  await generate(
    path.join(ASSETS, 'icon-foreground.svg'),
    path.join(ASSETS, 'android-icon-foreground.png'),
  );
  console.log('Icons generated.');
}

main().catch(err => { console.error(err); process.exit(1); });
