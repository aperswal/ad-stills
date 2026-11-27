import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { drizzle } from 'drizzle-orm/d1';
import { readFile, readdir } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { batchInputSchema } from '../../shared/contracts';
import {
  claimNext,
  createBatch,
  ownedAttempt,
  startBatch,
  CLAIM_EXPIRY_MS,
  type Database,
} from './repository';
import { saveResult } from '../runner/results';
import { uploadImage } from './uploads';
import { unlock } from '../auth/login';
import { appConfig } from '../../shared/config';
import sharp from 'sharp-node';

let worker: Miniflare;
let db: Database;
let runner: string;
let batch: string;
let adId: string;
const now = Date.now();
beforeEach(async () => {
  worker = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: '2026-07-01',
    d1Databases: ['DB'],
    r2Buckets: ['FILES'],
  });
  const binding = await worker.getD1Database('DB');
  for (const name of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    const migration = await readFile('migrations/' + name, 'utf8');
    for (const statement of migration.split('--> statement-breakpoint'))
      await binding.prepare(statement).run();
  }
  db = drizzle(binding, { schema });
  runner = crypto.randomUUID();
  await db
    .insert(schema.runners)
    .values({ id: runner, name: 'Test', lastSeen: now, codexVersion: 'test', signedIn: true });
  batch = (
    await createBatch(
      db,
      batchInputSchema.parse({
        brandName: 'Test',
        problem: 'A problem',
        audience: 'A person',
        solution: 'A solution',
      }),
    )
  ).id;
  adId = crypto.randomUUID();
  await db.insert(schema.ads).values({
    id: adId,
    batchId: batch,
    position: 0,
    originalKey: `batches/${batch}/original/${adId}.png`,
    width: 1024,
    height: 1024,
    updatedAt: now,
  });
  await db.insert(schema.productPhotos).values({
    id: crypto.randomUUID(),
    batchId: batch,
    position: 0,
    fileKey: `batches/${batch}/product/${crypto.randomUUID()}.png`,
  });
});
afterEach(async () => {
  await worker.dispose();
});
describe('atomic claims and data constraints', () => {
  it('never gives one ad to two runners', async () => {
    await startBatch(db, batch);
    const another = crypto.randomUUID();
    await db
      .insert(schema.runners)
      .values({ id: another, name: 'Other', lastSeen: now, codexVersion: 'test', signedIn: true });
    const results = await Promise.all([claimNext(db, runner, now), claimNext(db, another, now)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it('does not claim a draft batch', async () => {
    expect(await claimNext(db, runner, now)).toBeNull();
  });
  it('requires a live signed-in runner', async () => {
    await startBatch(db, batch);
    await db.update(schema.runners).set({ signedIn: false }).where(eq(schema.runners.id, runner));
    expect(await claimNext(db, runner, now)).toBeNull();
  });
  it('returns claims only after fifteen minutes and fences late results', async () => {
    await startBatch(db, batch);
    const first = await claimNext(db, runner, now);
    expect(first?.attempt).toBe(1);
    expect(await claimNext(db, runner, now + CLAIM_EXPIRY_MS)).toBeNull();
    await db.update(schema.runners).set({ lastSeen: now + CLAIM_EXPIRY_MS + 1 });
    const second = await claimNext(db, runner, now + CLAIM_EXPIRY_MS + 1);
    expect(second?.attempt).toBe(2);
    const stale = await db
      .update(schema.ads)
      .set({ extraNote: 'late' })
      .where(ownedAttempt(adId, runner, 1))
      .returning();
    expect(stale).toHaveLength(0);
  });
  it('refuses duplicate positions and invalid states in D1', async () => {
    const rows = await db.select().from(schema.ads);
    const ad = rows[0];
    if (!ad) throw new Error('Missing fixture');
    await expect(
      db.insert(schema.ads).values({ ...ad, id: crypto.randomUUID() }),
    ).rejects.toThrow();
    await expect(db.update(schema.ads).set({ width: 0 })).rejects.toThrow();
    await expect(db.update(schema.ads).set({ state: 'done' })).rejects.toThrow();
  });
  it('refuses start with no product photos', async () => {
    await db.delete(schema.productPhotos);
    await expect(startBatch(db, batch)).rejects.toThrow('at least one');
  });
  it('closes uploads atomically once a batch starts', async () => {
    await startBatch(db, batch);
    const bytes = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    const storage = await worker.getR2Bucket('FILES');
    await expect(
      uploadImage({
        db,
        storage,
        batchId: batch,
        kind: 'original',
        position: 1,
        request: new Request('http://localhost', { method: 'PUT', body: new Uint8Array(bytes) }),
      }),
    ).rejects.toThrow('started');
    expect((await storage.list()).objects).toHaveLength(0);
  });
  it('limits passcode tries by address in persistent D1', async () => {
    const config = appConfig({
      APP_PASSCODE: 'valid passcode here',
      SESSION_SECRET: 's'.repeat(32),
      RUNNER_TOKEN: 'r'.repeat(32),
    });
    const request = new Request('https://example.test/api/login', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '192.0.2.1' },
    });
    for (let i = 0; i < 5; i++)
      await expect(unlock(db, request, config, 'wrong')).rejects.toThrow('not right');
    await expect(unlock(db, request, config, 'valid passcode here')).rejects.toThrow('15 minutes');
  });
  it('keeps the committed image when duplicate results arrive together', async () => {
    await startBatch(db, batch);
    const claimed = await claimNext(db, runner, now);
    if (!claimed) throw new Error('No claim');
    const bytes = await sharp({
      create: { width: 1536, height: 1536, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    const request = () => {
      const form = new FormData();
      form.set('image', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'ad.png');
      form.set(
        'metadata',
        JSON.stringify({
          runnerId: runner,
          attempt: claimed.attempt,
          copy: { headline: 'A bottle', body: '', cta: 'View it', replaced: ['Product'] },
        }),
      );
      return new Request('http://localhost/api/runner/result', { method: 'PUT', body: form });
    };
    const storage = await worker.getR2Bucket('FILES');
    const outcomes = await Promise.allSettled([
      saveResult(db, storage, adId, request()),
      saveResult(db, storage, adId, request()),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [ad] = await db.select().from(schema.ads).where(eq(schema.ads.id, adId));
    if (!ad?.resultKey) throw new Error('Missing result');
    expect(await storage.head(ad.resultKey)).not.toBeNull();
    expect((await storage.list()).objects).toHaveLength(1);
  });
});
