const fs = require('fs');
const path = require('path');
const pngjs = require('pngjs');

function createPng(width, height) {
  const image = new pngjs.PNG({ width, height });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      image.data[idx] = 220;
      image.data[idx + 1] = 20;
      image.data[idx + 2] = 60;
      image.data[idx + 3] = 255;
    }
  }
  
  return pngjs.PNG.sync.write(image);
}

const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'logo192.png'), createPng(320, 320));
fs.writeFileSync(path.join(publicDir, 'logo512.png'), createPng(512, 512));
fs.writeFileSync(path.join(publicDir, 'screenshot-mobile.png'), createPng(1080, 1920));
fs.writeFileSync(path.join(publicDir, 'screenshot-desktop.png'), createPng(1920, 1080));

console.log('Icons and screenshots created successfully');
