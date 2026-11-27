import { and, asc, count, desc, eq, exists, getTableColumns, isNull, lt, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../../db/schema';
import { batches, ads, productPhotos, runners } from '../../db/schema';
import type { BatchInput } from '../../shared/contracts';
import { AppError } from '../../shared/http';

export type Database = DrizzleD1Database<typeof schema>;
export const CLAIM_EXPIRY_MS = 15 * 60 * 1000;
export async function createBatch(db: Database, input: BatchInput) {
  const batch = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), startedAt: null };
  await db.insert(batches).values(batch);
  return batch;
}
export async function batchDetail(db: Database, id: string) {
  const [batch] = await db.select().from(batches).where(eq(batches.id, id));
  if (!batch) throw new AppError(404, 'BATCH_MISSING', 'This batch was not found.');
  const [items, photos] = await Promise.all([
    db.select().from(ads).where(eq(ads.batchId, id)).orderBy(asc(ads.position)),
    db
      .select()
      .from(productPhotos)
      .where(eq(productPhotos.batchId, id))
      .orderBy(asc(productPhotos.position)),
  ]);
  return { batch, ads: items, photos };
}
export async function listBatches(db: Database, offset: number) {
  const rows = await db
    .select({
      ...getTableColumns(batches),
      total: count(ads.id),
      done: sql<number>`coalesce(sum(case when ${ads.state} = 'done' then 1 else 0 end),0)`,
    })
    .from(batches)
    .leftJoin(ads, eq(ads.batchId, batches.id))
    .groupBy(batches.id)
    .orderBy(desc(batches.createdAt), desc(batches.id))
    .limit(21)
    .offset(offset);
  return { items: rows.slice(0, 20), nextOffset: rows.length > 20 ? offset + 20 : null };
}
export async function startBatch(db: Database, id: string) {
  const rows = await db
    .update(batches)
    .set({ startedAt: Date.now() })
    .where(
      and(
        eq(batches.id, id),
        isNull(batches.startedAt),
        exists(db.select({ id: ads.id }).from(ads).where(eq(ads.batchId, id))),
        exists(
          db
            .select({ id: productPhotos.id })
            .from(productPhotos)
            .where(eq(productPhotos.batchId, id)),
        ),
      ),
    )
    .returning();
  if (rows.length === 0) {
    const detail = await batchDetail(db, id);
    if (detail.batch.startedAt !== null) return;
    throw new AppError(409, 'BATCH_NOT_READY', 'Add at least one ad and one product photo.');
  }
}
export async function claimNext(db: Database, runnerId: string, now = Date.now()) {
  await db
    .update(ads)
    .set({ state: 'queued', claimedBy: null, claimedAt: null, updatedAt: now })
    .where(and(eq(ads.state, 'running'), lt(ads.claimedAt, now - CLAIM_EXPIRY_MS)));
  const eligible = db
    .select({ id: ads.id })
    .from(ads)
    .innerJoin(batches, eq(ads.batchId, batches.id))
    .where(and(eq(ads.state, 'queued'), sql`${batches.startedAt} IS NOT NULL`))
    .orderBy(asc(ads.updatedAt), asc(ads.position))
    .limit(1);
  const activeRunner = db
    .select({ id: runners.id })
    .from(runners)
    .where(
      and(
        eq(runners.id, runnerId),
        eq(runners.signedIn, true),
        sql`${runners.lastSeen} >= ${now - 30000}`,
      ),
    );
  const [ad] = await db
    .update(ads)
    .set({
      state: 'running',
      claimedBy: runnerId,
      claimedAt: now,
      attempt: sql`${ads.attempt}+1`,
      updatedAt: now,
    })
    .where(and(eq(ads.id, eligible), eq(ads.state, 'queued'), exists(activeRunner)))
    .returning();
  return ad ?? null;
}
export function ownedAttempt(id: string, runnerId: string, attempt: number) {
  return and(
    eq(ads.id, id),
    eq(ads.state, 'running'),
    eq(ads.claimedBy, runnerId),
    eq(ads.attempt, attempt),
  );
}
