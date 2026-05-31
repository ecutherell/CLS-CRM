// Run once: node generate-icons.js
// Generates minimal PNG icons using no extra dependencies.
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

// Build a minimal PNG from scratch (solid color + emoji via SVG data URL won't work in Node)
// Instead we write a valid 1-colour PNG and let the manifest SVG do the heavy lifting.
// For a proper icon, open public/icons/icon.svg in a browser and screenshot it,
// or use any online SVG→PNG converter and drop the result into public/icons/.

// For now, create a valid solid dark-square PNG so the manifest doesn't 404.
function createSolidPng(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crc = crc32(crcData);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeB, data, crcB]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT — raw scanlines (filter byte 0 + RGB per pixel), zlib-compressed
  const scanline = Buffer.alloc(1 + size * 3);
  scanline[0] = 0; // filter none
  for (let x = 0; x < size; x++) {
    scanline[1 + x * 3] = r;
    scanline[2 + x * 3] = g;
    scanline[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array(size).fill(scanline));
  const compressed = zlibDeflate(raw);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', iend)]);
}

// Minimal zlib deflate (uncompressed blocks, always valid PNG)
function zlibDeflate(data) {
  const BSIZE = 65535;
  const blocks = [];
  for (let i = 0; i < data.length; i += BSIZE) {
    const block = data.slice(i, i + BSIZE);
    const last = (i + BSIZE >= data.length) ? 1 : 0;
    const header = Buffer.from([last, block.length & 0xff, (block.length >> 8) & 0xff,
      (~block.length) & 0xff, ((~block.length) >> 8) & 0xff]);
    blocks.push(header, block);
  }
  const body = Buffer.concat(blocks);
  const header = Buffer.from([0x78, 0x01]); // zlib header, no compression
  // Adler-32 checksum
  let s1 = 1, s2 = 0;
  for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE((s2 << 16) | s1);
  return Buffer.concat([header, body, adler]);
}

// CRC-32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff);
}

mkdirSync('public/icons', { recursive: true });

// Dark background (#1a1917 = 26, 25, 23)
writeFileSync('public/icons/icon-192.png', createSolidPng(192, 26, 25, 23));
writeFileSync('public/icons/icon-512.png', createSolidPng(512, 26, 25, 23));

console.log('✓ Icon PNGs generated (solid dark background).');
console.log('  For a proper icon with the ⚡ logo, open public/icons/icon.svg');
console.log('  in a browser, screenshot at 512×512, and replace icon-512.png.');
