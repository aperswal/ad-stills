import { and, eq, isNull, sql } from 'drizzle-orm';
import { batches, ads, productPhotos } from '../../db/schema';
import { AppError, boundedBytes } from '../../shared/http';
import { buildKey, inspectImage, MAX_UPLOAD_BYTES } from './files';
import type { ImageStore } from './files';
import type { Database } from './repository';

export interface UploadContext {
  db: Database;
  storage: ImageStore;
  batchId: string;
  kind: 'original' | 'product';
  position: number;
  request: Request;
}
export async function uploadImage({
  db,
  storage,
  batchId,
  kind,
  position,
  request,
}: UploadContext) {
  const bytes = await boundedBytes(request, MAX_UPLOAD_BYTES);
  const info = await inspectImage(bytes);
  const id = crypto.randomUUID();
  const key = buildKey({ batchId, fileId: id, kind, extension: info.extension });
  await storage.put(key, bytes, { httpMetadata: { contentType: info.mime } });
  try {
    const condition = and(eq(batches.id, batchId), isNull(batches.startedAt));
    const rows =
      kind === 'product'
        ? await db
            .insert(productPhotos)
            .select(
              db
                .select({
                  id: sql<string>`${id}`.as('id'),
                  batchId: batches.id,
                  position: sql<number>`${position}`.as('position'),
                  fileKey: sql<string>`${key}`.as('fileKey'),
                })
                .from(batches)
                .where(condition),
            )
            .onConflictDoNothing()
            .returning({ id: productPhotos.id })
        : await db
            .insert(ads)
            .select(
              db
                .select({
                  id: sql<string>`${id}`.as('id'),
                  batchId: batches.id,
                  position: sql<number>`${position}`.as('position'),
                  originalKey: sql<string>`${key}`.as('originalKey'),
                  width: sql<number>`${info.width}`.as('width'),
                  height: sql<number>`${info.height}`.as('height'),
                  state: sql<'queued'>`'queued'`.as('state'),
                  attempt: sql<number>`0`.as('attempt'),
                  claimedBy: sql<null>`null`.as('claimedBy'),
                  claimedAt: sql<null>`null`.as('claimedAt'),
                  resultKey: sql<null>`null`.as('resultKey'),
                  copy: sql<null>`null`.as('copy'),
                  extraNote: sql<string>`''`.as('extraNote'),
                  failureReason: sql<null>`null`.as('failureReason'),
                  updatedAt: sql<number>`${Date.now()}`.as('updatedAt'),
                })
                .from(batches)
                .where(condition),
            )
            .onConflictDoNothing()
            .returning({ id: ads.id });
    if (rows.length === 0)
      throw new AppError(409, 'UPLOAD_CLOSED', 'This position is filled or the batch has started.');
    return { id };
  } catch (error) {
    await storage.delete(key);
    throw error;
  }
}
