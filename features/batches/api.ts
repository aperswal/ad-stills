import { gte } from 'drizzle-orm';
import { ads, runners } from '../../db/schema';
import * as contract from '../../shared/contracts';
import { database, bucket, settings } from '../../shared/server';
import { AppError, failure, readJson, success } from '../../shared/http';
import { authorize, requireRunner } from '../auth/lock';
import { unlock } from '../auth/login';
import {
  batchDetail,
  claimNext,
  createBatch,
  listBatches,
  ownedAttempt,
  startBatch,
} from './repository';
import { uploadImage } from './uploads';
import { again, saveResult } from '../runner/results';

export async function handleApi(request: Request) {
  try {
    const config = settings();
    await authorize(request, config);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const db = database();
    if (path === '/api/login' && method === 'POST')
      return await unlock(
        db,
        request,
        config,
        (await readJson(request, contract.loginSchema)).passcode,
      );
    if (path === '/api/status' && method === 'GET') {
      const active = await db
        .select()
        .from(runners)
        .where(gte(runners.lastSeen, Date.now() - 30000));
      return success({
        connected: active.length > 0,
        signedIn: active.some((r) => r.signedIn),
        runners: active.length,
        command: config.APP_MODE === 'local' ? 'pnpm dev' : 'pnpm runner',
      });
    }
    if (path === '/api/events' && method === 'GET') return events(request);
    if (path === '/api/batches' && method === 'POST')
      return success(
        await createBatch(db, await readJson(request, contract.batchInputSchema)),
        201,
      );
    if (path === '/api/batches' && method === 'GET')
      return success(
        await listBatches(
          db,
          contract.pageQuerySchema.parse(Object.fromEntries(url.searchParams)).offset,
        ),
      );
    const batchMatch = /^\/api\/batches\/([^/]+)(?:\/(files|start))?$/.exec(path);
    if (batchMatch) {
      const id = contract.idSchema.parse(batchMatch[1]);
      const action = batchMatch[2];
      if (!action && method === 'GET') return success(await batchDetail(db, id));
      if (action === 'files' && method === 'PUT') {
        const query = contract.fileQuerySchema.parse(Object.fromEntries(url.searchParams));
        return success(
          await uploadImage({ db, storage: bucket(), batchId: id, ...query, request }),
          201,
        );
      }
      if (action === 'start' && method === 'POST') {
        await readJson(request, contract.emptySchema);
        await startBatch(db, id);
        return success({ ok: true }, 202);
      }
    }
    const againMatch = /^\/api\/ads\/([^/]+)\/again$/.exec(path);
    if (againMatch && method === 'POST') {
      const id = contract.idSchema.parse(againMatch[1]);
      await again(db, id, (await readJson(request, contract.againSchema)).note);
      return success({ ok: true }, 202);
    }
    if (path.startsWith('/api/files/') && method === 'GET')
      return await serveFile(path.slice('/api/files/'.length), url.searchParams.has('download'));
    if (path.startsWith('/api/runner/')) return await runnerApi(request);
    throw new AppError(404, 'NOT_FOUND', 'This request was not found.');
  } catch (error) {
    return failure(error);
  }
}
async function runnerApi(request: Request) {
  requireRunner(request, settings());
  const path = new URL(request.url).pathname;
  const db = database();
  if (path === '/api/runner/hello' && request.method === 'POST') {
    const hello = await readJson(request, contract.helloSchema);
    const values = { ...hello, lastSeen: Date.now() };
    await db.insert(runners).values(values).onConflictDoUpdate({ target: runners.id, set: values });
    return success({ ok: true });
  }
  if (path === '/api/runner/claim' && request.method === 'POST') {
    const { runnerId } = await readJson(request, contract.claimSchema);
    const ad = await claimNext(db, runnerId);
    if (!ad) return success({ job: null });
    const detail = await batchDetail(db, ad.batchId);
    return success({
      job: {
        ad,
        batch: detail.batch,
        originalUrl: contract.fileUrl(ad.originalKey),
        productUrls: detail.photos.map((p) => contract.fileUrl(p.fileKey)),
      },
    });
  }
  const match = /^\/api\/runner\/ads\/([^/]+)\/(result|fail)$/.exec(path);
  if (match) {
    const id = contract.idSchema.parse(match[1]);
    if (match[2] === 'result' && request.method === 'PUT')
      return success(await saveResult(db, bucket(), id, request));
    if (match[2] === 'fail' && request.method === 'POST') {
      const payload = await readJson(request, contract.failSchema);
      const rows = await db
        .update(ads)
        .set({
          state: 'failed',
          claimedAt: null,
          claimedBy: null,
          failureReason: payload.reason,
          updatedAt: Date.now(),
        })
        .where(ownedAttempt(id, payload.runnerId, payload.attempt))
        .returning({ id: ads.id });
      if (rows.length === 0)
        throw new AppError(409, 'STALE_ATTEMPT', 'This attempt is no longer active.', 'runner');
      return success({ ok: true });
    }
  }
  if (path.startsWith('/api/runner/files/') && request.method === 'GET')
    return await serveFile(path.slice('/api/runner/files/'.length), false);
  throw new AppError(404, 'NOT_FOUND', 'This request was not found.');
}
async function serveFile(rawKey: string, download: boolean) {
  const key = contract.keySchema.parse(rawKey);
  const object = await bucket().get(key);
  if (!object) throw new AppError(404, 'FILE_MISSING', 'This image was not found.');
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Length': String(object.size),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(download ? { 'Content-Disposition': 'attachment; filename="ad.png"' } : {}),
    },
  });
}
function events(request: Request) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        controller.enqueue(new TextEncoder().encode('event: refresh\ndata: {}\n\n'));
      };
      send();
      timer = setInterval(send, 3000);
      request.signal.addEventListener(
        'abort',
        () => {
          clearInterval(timer);
          controller.close();
        },
        { once: true },
      );
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
