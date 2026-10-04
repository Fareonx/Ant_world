// İkonları icon.svg-dən PNG-yə çevirir: node tools/make-icons.mjs
// Playwright (Chromium) tələb olunur.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(process.env.NPM_GLOBAL || '/opt/node22/lib/node_modules', 'playwright'));
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'imposter', 'icons');
const svg = await readFile(path.join(dir, 'icon.svg'), 'utf8');

// maskable: işarə təhlükəsiz zonaya (mərkəzi 80%) sığsın deyə kiçildilir
const maskable = svg.replace('scale(3.3)', 'scale(2.6)');

const targets = [
  ['apple-touch-icon.png', 180, svg],
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['icon-maskable-512.png', 512, maskable],
];

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const [name, size, src] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:#0a0b14">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: path.join(dir, name), omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
