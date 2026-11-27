import sharp from 'sharp-node';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { logger } from '../shared/logger';
export async function makeFixtures() {
  const folder = resolve('evidence/fixtures');
  await mkdir(folder, { recursive: true });
  const bottle =
    '<rect x="385" y="325" width="255" height="420" rx="70" fill="#1c6650"/><rect x="423" y="269" width="180" height="82" rx="20" fill="#173c32"/><rect x="405" y="460" width="215" height="130" rx="6" fill="#f2edda"/><text x="512" y="515" text-anchor="middle" font-family="sans-serif" font-size="31" font-weight="bold" fill="#173c32">DEMO CUP</text><text x="512" y="555" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#173c32">Everyday bottle</text>';
  const svg = (content: string, background: string) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${background}"/>${content}</svg>`,
    );
  const original = svg(
    '<text x="82" y="112" font-family="sans-serif" font-size="28" fill="#343459">SAMPLE BRAND</text><text x="82" y="210" font-family="sans-serif" font-size="68" font-weight="bold" fill="#252540">Ready for your day.</text><ellipse cx="520" cy="806" rx="285" ry="38" fill="#c0bad3"/><rect x="380" y="310" width="270" height="455" rx="65" fill="#8271a4"/><rect x="425" y="267" width="180" height="70" rx="15" fill="#39324c"/><text x="515" y="540" text-anchor="middle" font-family="sans-serif" font-size="30" fill="white">SAMPLE</text><rect x="82" y="880" width="270" height="65" rx="32" fill="#252540"/><text x="217" y="922" text-anchor="middle" font-family="sans-serif" font-size="25" fill="white">Find your bottle</text>',
    '#e7e2f0',
  );
  await sharp(original).png().toFile(resolve(folder, 'original-1.png'));
  await sharp(original)
    .resize(1024, 1280, { fit: 'contain', background: '#e7e2f0' })
    .png()
    .toFile(resolve(folder, 'original-2.png'));
  await sharp(
    svg(`<ellipse cx="512" cy="795" rx="230" ry="30" fill="#ccd4c9"/>${bottle}`, '#f2f2e8'),
  )
    .png()
    .toFile(resolve(folder, 'product.png'));
  logger.info({ event: 'fixtures_ready' }, 'Three fictional test images created.');
  return folder;
}
if (process.argv[1]?.endsWith('fixtures.ts')) await makeFixtures();
