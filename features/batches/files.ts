import { fileTypeFromBuffer } from 'file-type';
import { imageSize } from 'image-size';
import { z } from 'zod';
import { idSchema, keySchema } from '../../shared/contracts';
import { AppError } from '../../shared/http';

export interface ImageStore {
  put(
    key: string,
    value: Uint8Array,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}
export interface ImageInfo {
  width: number;
  height: number;
  extension: 'png' | 'jpg' | 'webp';
  mime: string;
}
export interface KeyInput {
  batchId: string;
  fileId: string;
  kind: 'original' | 'product' | 'result';
  extension: 'png' | 'jpg' | 'webp';
  attempt?: number;
}
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_RESULT_BYTES = 25 * 1024 * 1024;
export function buildKey(input: KeyInput) {
  idSchema.parse(input.batchId);
  idSchema.parse(input.fileId);
  const suffix =
    input.attempt === undefined
      ? ''
      : `-${String(z.number().int().positive().parse(input.attempt))}`;
  return keySchema.parse(
    `batches/${input.batchId}/${input.kind}/${input.fileId}${suffix}.${input.extension}`,
  );
}
export async function inspectImage(
  bytes: Uint8Array,
  limit = MAX_UPLOAD_BYTES,
): Promise<ImageInfo> {
  if (bytes.length > limit)
    throw new AppError(
      413,
      'IMAGE_TOO_LARGE',
      limit === MAX_UPLOAD_BYTES ? 'Use an image under 10 MB.' : 'Use a result under 25 MB.',
    );
  let type;
  let dimensions;
  try {
    type = await fileTypeFromBuffer(bytes);
    dimensions = imageSize(bytes);
  } catch {
    throw new AppError(415, 'BAD_IMAGE', 'This image could not be read. Use PNG, JPEG or WebP.');
  }
  if (!type || !['png', 'jpg', 'webp'].includes(type.ext))
    throw new AppError(415, 'BAD_IMAGE', 'Use PNG, JPEG or WebP.');
  const extension = z.enum(['png', 'jpg', 'webp']).parse(type.ext);
  const rotated = dimensions.orientation !== undefined && dimensions.orientation >= 5;
  const width = rotated ? dimensions.height : dimensions.width;
  const height = rotated ? dimensions.width : dimensions.height;
  if (width < 1 || height < 1 || width * height > 40_000_000)
    throw new AppError(400, 'IMAGE_SIZE', 'Use an image with no more than 40 million pixels.');
  return { width, height, extension, mime: type.mime };
}
export function validateDimensions(
  result: { width: number; height: number },
  original: { width: number; height: number },
) {
  if (Math.max(result.width, result.height) < 1536)
    throw new AppError(
      422,
      'RESULT_SIZE',
      'The new ad must be at least 1536 pixels on its long side.',
      'runner',
    );
  if (Math.abs(result.width / result.height / (original.width / original.height) - 1) > 0.02)
    throw new AppError(422, 'RESULT_SHAPE', 'The new ad has the wrong shape. Try again.', 'runner');
}
