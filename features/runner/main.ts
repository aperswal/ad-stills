import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { nodeEnvironment, runnerConfigSchema } from '../../shared/config';
import { claimResponseSchema, okSchema } from '../../shared/contracts';
import type { Job } from '../../shared/contracts';
import { logger } from '../../shared/logger';
import { buildPrompt, codexArguments } from './prompt';
import { checkOutputs } from './checks';
import { runCommand } from './process';
import { jsonRequest, runnerRequest } from './client';

const root = process.cwd();
const env = nodeEnvironment();
// `pnpm dev` names the local settings, so its runner works for the local app even when `.runner.vars` points at a
// deployed one. `pnpm runner` alone reads `.runner.vars` first.
const settingsFiles = env.RUNNER_SETTINGS ? [env.RUNNER_SETTINGS] : ['.runner.vars', '.dev.vars'];
async function readSettings() {
  for (const name of settingsFiles) {
    try {
      return parseEnv(await readFile(resolve(root, name), 'utf8'));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return {};
}
const config = runnerConfigSchema.parse({ ...(await readSettings()), ...env });
const runnerId = crypto.randomUUID();
const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stop.abort();
  });
await mkdir(resolve(root, '.local/jobs'), { recursive: true });
// Pass only system paths to child processes. App secrets and API keys never reach Codex.
const childEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  PATH: env.PATH,
  HOME: env.HOME,
  USER: env.USER,
  TMPDIR: resolve(root, '.local/tmp'),
  XDG_CACHE_HOME: resolve(root, '.local/cache'),
};
let signedIn = false;
async function hello() {
  let version = 'Not installed';
  let authenticated = false;
  try {
    const result = await runCommand({
      bin: config.CODEX_BIN,
      args: ['--version'],
      cwd: root,
      env: childEnv,
      timeout: 10000,
    });
    version = result.code === 0 ? result.output.trim().slice(0, 100) : 'Not installed';
    const status = await runCommand({
      bin: config.CODEX_BIN,
      args: ['login', 'status'],
      cwd: root,
      env: childEnv,
      timeout: 10000,
    });
    authenticated = status.code === 0 && /ChatGPT/i.test(status.output);
  } catch {
    logger.warn({ event: 'codex_unavailable' }, 'Codex is not ready. Run codex login.');
  }
  signedIn = authenticated;
  await runnerRequest(
    config,
    '/api/runner/hello',
    okSchema,
    jsonRequest({ id: runnerId, name: config.RUNNER_NAME, codexVersion: version, signedIn }),
  );
}
async function download(path: string, destination: string) {
  const relative = path.replace('/api/files/', '/api/runner/files/');
  const response = await fetch(new URL(relative, config.APP_URL), {
    headers: { Authorization: `Bearer ${config.RUNNER_TOKEN}` },
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('A reference photo could not be downloaded.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error('A reference photo is too large.');
  await writeFile(destination, bytes);
}
async function makeAd(job: Job) {
  const folder = await mkdtemp(resolve(root, '.local/jobs/ad-'));
  try {
    const images = [
      join(folder, 'original'),
      ...job.productUrls.map((_, i) => join(folder, `product-${String(i)}`)),
    ];
    const urls = [job.originalUrl, ...job.productUrls];
    for (const [index, url] of urls.entries()) {
      const path = images[index];
      if (path) await download(url, path);
    }
    const result = await runCommand({
      bin: config.CODEX_BIN,
      args: codexArguments(folder, images, buildPrompt(job)),
      cwd: folder,
      env: { ...childEnv, TMPDIR: folder },
      timeout: 600000,
      signal: stop.signal,
    });
    if (result.code !== 0)
      throw new Error('Codex could not make this ad. Check Codex, then try again.');
    const checked = await checkOutputs(folder, job.ad);
    const form = new FormData();
    form.set('image', new Blob([new Uint8Array(checked.image)], { type: 'image/png' }), 'ad.png');
    form.set('metadata', JSON.stringify({ runnerId, attempt: job.ad.attempt, copy: checked.copy }));
    await runnerRequest(config, `/api/runner/ads/${job.ad.id}/result`, okSchema, {
      method: 'PUT',
      body: form,
    });
    logger.info(
      { event: 'ad_done', adId: job.ad.id, width: checked.width, height: checked.height },
      'Ad saved',
    );
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : 'The runner could not make this ad. Try again.';
    logger.warn({ event: 'ad_failed', adId: job.ad.id }, 'Ad failed');
    try {
      await runnerRequest(
        config,
        `/api/runner/ads/${job.ad.id}/fail`,
        okSchema,
        jsonRequest({ runnerId, attempt: job.ad.attempt, reason }),
      );
    } catch {
      logger.error(
        { event: 'failure_report_failed', adId: job.ad.id },
        'The app could not receive the failure. The claim will expire.',
      );
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
async function worker() {
  while (!stop.signal.aborted) {
    if (!signedIn) {
      if (config.RUNNER_ONCE === 'true') return;
      await delay(3000);
      continue;
    }
    try {
      const { job } = await runnerRequest(
        config,
        '/api/runner/claim',
        claimResponseSchema,
        jsonRequest({ runnerId }),
      );
      if (job) await makeAd(job);
      else if (config.RUNNER_ONCE === 'true') return;
      else await delay(2000);
    } catch {
      logger.warn({ event: 'app_unreachable' }, 'Cannot reach the app. Retrying.');
      if (config.RUNNER_ONCE === 'true') throw new Error('The app could not be reached.');
      await delay(3000);
    }
  }
}
let heartbeating = false;
await hello();
const heartbeat = setInterval(() => {
  if (heartbeating) return;
  heartbeating = true;
  void hello()
    .catch(() => {
      logger.warn({ event: 'heartbeat_failed' }, 'Cannot reach the app.');
    })
    .finally(() => {
      heartbeating = false;
    });
}, 10000);
logger.info(
  { event: 'runner_started', concurrency: config.RUNNER_CONCURRENCY, signedIn },
  'Runner ready',
);
try {
  await Promise.all(Array.from({ length: config.RUNNER_CONCURRENCY }, () => worker()));
} finally {
  clearInterval(heartbeat);
}
