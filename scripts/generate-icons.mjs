/**
 * Renders the app icons from one SVG.
 *
 * Committed as a script rather than a pile of binaries with no source: when the
 * mark changes, this regenerates every size instead of somebody hand-exporting
 * six PNGs and getting one of them subtly wrong.
 *
 *   node scripts/generate-icons.mjs
 *
 * Uses sharp, which is already present as a Next dependency.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ACCENT = '#00f2ff';
const INK = '#000000';

/**
 * The pulse mark: a heartbeat trace inside a rounded square.
 * `padding` leaves the safe area Android maskable icons crop into — without it
 * the launcher shaves the corners off the glyph.
 */
function markSvg({ size, padding = 0, background = INK }) {
  const inner = size - padding * 2;
  const stroke = Math.max(2, inner * 0.09);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <g transform="translate(${padding} ${padding})">
    <path
      d="M ${inner * 0.12} ${inner * 0.52}
         H ${inner * 0.34}
         L ${inner * 0.44} ${inner * 0.28}
         L ${inner * 0.58} ${inner * 0.74}
         L ${inner * 0.67} ${inner * 0.52}
         H ${inner * 0.88}"
      fill="none"
      stroke="${ACCENT}"
      stroke-width="${stroke}"
      stroke-linecap="round"
      stroke-linejoin="round"/>
  </g>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  // Maskable icons get cropped to whatever shape the launcher likes, so the
  // glyph sits inside the 80% safe area.
  { file: 'icon-maskable-192.png', size: 192, padding: 19 },
  { file: 'icon-maskable-512.png', size: 512, padding: 51 },
  // iOS does not honour maskable, and renders on its own rounded square.
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
  { file: 'favicon.png', size: 48, padding: 0 },
];

await mkdir('public/icons', { recursive: true });

for (const { file, size, padding } of targets) {
  const svg = Buffer.from(markSvg({ size, padding }));
  const png = await sharp(svg).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(`public/icons/${file}`, png);
  console.log(`public/icons/${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`);
}

// Kept at the root because browsers still probe /favicon.ico by convention.
await writeFile('public/favicon.ico', await sharp(Buffer.from(markSvg({ size: 32 }))).png().toBuffer());
console.log('public/favicon.ico');
