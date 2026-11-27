#!/usr/bin/env node
import sharp from 'sharp-node';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
if (args.includes('--version')) process.stdout.write('codex-stand-in 1.0\n');
else if (args[0] === 'login') process.stdout.write('Logged in using ChatGPT (test stand-in)\n');
else {
  const folder = args[args.indexOf('-C') + 1];
  const original = args[args.indexOf('-i') + 1];
  if (!folder || !original) throw new Error('Missing work folder or image');
  const info = await sharp(original).metadata();
  const width = info.width ?? 1;
  const height = info.height ?? 1;
  const scale = 1536 / Math.max(width, height);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1536"><rect width="1536" height="1536" fill="#eaf0e5"/><text x="120" y="220" font-family="sans-serif" font-size="94" font-weight="bold" fill="#164d3d">Bring your day along.</text><rect x="590" y="450" width="360" height="650" rx="90" fill="#216c52"/><rect x="640" y="375" width="260" height="100" rx="28" fill="#173c32"/><text x="770" y="790" text-anchor="middle" font-family="sans-serif" font-size="48" fill="white">DEMO CUP</text><text x="120" y="1280" font-family="sans-serif" font-size="44" fill="#164d3d">A bottle for your everyday bag.</text><text x="120" y="1410" font-family="sans-serif" font-size="42" fill="#164d3d">Find your cup</text></svg>',
  );
  await sharp(svg)
    .resize(Math.round(width * scale), Math.round(height * scale), { fit: 'fill' })
    .png()
    .toFile(resolve(folder, 'ad.png'));
  await writeFile(
    resolve(folder, 'copy.json'),
    JSON.stringify({
      headline: 'Bring your day along.',
      body: 'A bottle for your everyday bag.',
      cta: 'Find your cup',
      replaced: ['Product', 'Brand name', 'Copy', 'Colours'],
    }),
  );
}
