import { describe, it, expect } from 'vitest';
import { buildKey, inspectImage } from './files';
import sharp from 'sharp-node';
const batchId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const fileId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
describe('file boundary', () => {
  it('builds keys from validated server IDs', () => {
    expect(buildKey({ batchId, fileId, kind: 'original', extension: 'png' })).toBe(
      `batches/${batchId}/original/${fileId}.png`,
    );
  });
  it('refuses path injection', () => {
    expect(() =>
      buildKey({ batchId: '../../private', fileId, kind: 'original', extension: 'png' }),
    ).toThrow();
  });
  it('rejects text pretending to be a PNG', async () => {
    await expect(inspectImage(new TextEncoder().encode('<svg/>'))).rejects.toThrow();
  });
  it('reads bytes instead of trusting names', async () => {
    const bytes = await sharp({
      create: { width: 80, height: 100, channels: 3, background: '#175e49' },
    })
      .png()
      .toBuffer();
    expect(await inspectImage(bytes)).toMatchObject({ width: 80, height: 100, extension: 'png' });
  });
  it('rejects oversized uploads before inspecting', async () => {
    await expect(inspectImage(new Uint8Array(10 * 1024 * 1024 + 1))).rejects.toThrow('10 MB');
  });
});
