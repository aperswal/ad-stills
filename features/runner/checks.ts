import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp-node';
import { copySchema } from '../../shared/contracts';
import { MAX_RESULT_BYTES, validateDimensions } from '../batches/files';

export async function checkOutputs(folder: string, original: { width: number; height: number }) {
  const imagePath = join(folder, 'ad.png');
  const copyPath = join(folder, 'copy.json');
  for (const [path, limit] of [
    [imagePath, MAX_RESULT_BYTES],
    [copyPath, 16384],
  ] as const) {
    const stat = await lstat(path).catch(() => {
      throw new Error('Codex did not save both ad.png and copy.json. Try again.');
    });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit)
      throw new Error('Codex made an invalid or oversized output file.');
  }
  const image = await readFile(imagePath);
  const decoder = sharp(image, { failOn: 'warning', limitInputPixels: 40_000_000 });
  const metadata = await decoder.metadata().catch(() => {
    throw new Error('Codex saved an image that could not be opened. Try again.');
  });
  if (metadata.format !== 'png' || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
    throw new Error('Codex must save one still PNG as ad.png.');
  await decoder
    .raw()
    .toBuffer()
    .catch(() => {
      throw new Error('Codex saved a damaged image. Try again.');
    });
  validateDimensions({ width: metadata.width, height: metadata.height }, original);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(copyPath, 'utf8'));
  } catch {
    throw new Error('Codex saved invalid ad copy. Try again.');
  }
  const parsed = copySchema.safeParse(raw);
  if (!parsed.success)
    throw new Error('Codex saved copy with missing or invalid fields. Try again.');
  const copy = parsed.data;
  return { image, copy, width: metadata.width, height: metadata.height };
}
