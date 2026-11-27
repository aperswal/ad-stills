import { eq } from 'drizzle-orm';
import { ads } from '../../db/schema';
import { resultSchema } from '../../shared/contracts';
import { AppError, boundedBytes } from '../../shared/http';
import { buildKey, inspectImage, MAX_RESULT_BYTES, validateDimensions } from '../batches/files';
import type { ImageStore } from '../batches/files';
import { ownedAttempt, type Database } from '../batches/repository';

export async function saveResult(db: Database, storage: ImageStore, id: string, request: Request) {
  const bytes = await boundedBytes(request, MAX_RESULT_BYTES + 32768);
  const form = await new Response(bytes, {
    headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
  }).formData();
  const metadata = form.get('metadata');
  const image = form.get('image');
  if (
    typeof metadata !== 'string' ||
    !(image instanceof File) ||
    Array.from(form.keys()).length !== 2
  )
    throw new AppError(400, 'BAD_RESULT', 'Send one image and its metadata.');
  let raw: unknown;
  try {
    raw = JSON.parse(metadata);
  } catch {
    throw new AppError(400, 'BAD_COPY', 'The ad copy is not valid JSON.', 'runner');
  }
  const payload = resultSchema.parse(raw);
  const condition = ownedAttempt(id, payload.runnerId, payload.attempt);
  const [ad] = await db.select().from(ads).where(condition);
  if (!ad) throw new AppError(409, 'STALE_ATTEMPT', 'This attempt is no longer active.', 'runner');
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const info = await inspectImage(imageBytes, MAX_RESULT_BYTES);
  if (info.extension !== 'png')
    throw new AppError(422, 'RESULT_TYPE', 'The new ad must be a PNG.', 'runner');
  validateDimensions(info, ad);
  const key = buildKey({
    batchId: ad.batchId,
    fileId: crypto.randomUUID(),
    kind: 'result',
    extension: 'png',
    attempt: ad.attempt,
  });
  await storage.put(key, imageBytes, { httpMetadata: { contentType: 'image/png' } });
  const rows = await db
    .update(ads)
    .set({
      state: 'done',
      claimedBy: null,
      claimedAt: null,
      resultKey: key,
      copy: payload.copy,
      failureReason: null,
      updatedAt: Date.now(),
    })
    .where(condition)
    .returning({ id: ads.id });
  if (rows.length === 0) {
    await storage.delete(key);
    throw new AppError(409, 'STALE_ATTEMPT', 'This attempt is no longer active.', 'runner');
  }
  return { ok: true };
}
export async function again(db: Database, id: string, note: string) {
  const rows = await db
    .update(ads)
    .set({
      state: 'queued',
      claimedBy: null,
      claimedAt: null,
      resultKey: null,
      copy: null,
      failureReason: null,
      extraNote: note,
      updatedAt: Date.now(),
    })
    .where(eq(ads.id, id))
    .returning({ id: ads.id });
  if (rows.length === 0) throw new AppError(404, 'AD_MISSING', 'This ad was not found.');
}
