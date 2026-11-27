import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { nodeEnvironment, runnerConfigSchema } from '../shared/config';
import {
  batchSchema,
  batchDetailSchema,
  envelopeSchema,
  idSchema,
  okSchema,
  fileUrl,
} from '../shared/contracts';
import { makeFixtures } from './fixtures';
import { logger } from '../shared/logger';
const mode = z.enum(['mock', 'real']).parse(process.argv[2]);
const config = runnerConfigSchema.parse(parseEnv(await readFile('.dev.vars', 'utf8')));
async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  const response = await fetch(new URL(path, config.APP_URL), init);
  const raw: unknown = await response.json();
  const envelope = envelopeSchema.parse(raw);
  if (!response.ok || !envelope.ok) throw new Error(JSON.stringify(envelope));
  return schema.parse(envelope.data);
}
const post = (data: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
await makeFixtures();
const batch = await call(
  '/api/batches',
  batchSchema,
  post({
    brandName: `Demo Cup · ${mode} proof`,
    problem: 'People need a bottle to carry in their everyday bag.',
    audience: 'Adults who carry a bag to work or school.',
    solution: 'A reusable green bottle for everyday use.',
    colours: ['#216C52', '#EAF0E5'],
    notes:
      'The label on the product reads DEMO CUP. Use DEMO CUP as the brand name. No prices, health claims, reviews, guarantees or discounts.',
  }),
);
for (const position of Array.from({ length: mode === 'mock' ? 2 : 1 }, (_, i) => i))
  await call(
    `/api/batches/${batch.id}/files?kind=original&position=${String(position)}`,
    z.strictObject({ id: idSchema }),
    {
      method: 'PUT',
      body: new Uint8Array(
        await readFile(`evidence/fixtures/original-${String(position + 1)}.png`),
      ),
    },
  );
await call(
  `/api/batches/${batch.id}/files?kind=product&position=0`,
  z.strictObject({ id: idSchema }),
  { method: 'PUT', body: new Uint8Array(await readFile('evidence/fixtures/product.png')) },
);
await call(`/api/batches/${batch.id}/start`, okSchema, post({}));
logger.info(
  { event: 'proof_batch_started', mode, batchId: batch.id },
  'Running full app and runner loop',
);
const child = spawn('pnpm', ['runner'], {
  stdio: 'inherit',
  env: {
    ...nodeEnvironment(),
    // The stand-in replaces Codex. A real run uses the Codex CLI as it is installed: it keeps its sign-in in its own
    // folder outside this one, so it cannot be fenced into this folder.
    ...(mode === 'mock' ? { CODEX_BIN: resolve('scripts/fake-codex.mjs') } : {}),
    RUNNER_ONCE: 'true',
    RUNNER_CONCURRENCY: mode === 'mock' ? '2' : '1',
  },
});
await new Promise<void>((done, reject) => {
  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) done();
    else reject(new Error(`Runner exited ${String(code)}`));
  });
});
const detail = await call(`/api/batches/${batch.id}`, batchDetailSchema);
await writeFile(`evidence/proof-${mode}.json`, JSON.stringify(detail, null, 2));
for (const ad of detail.ads) {
  if (ad.state !== 'done' || !ad.resultKey)
    throw new Error(
      `Ad ${ad.id}: ${ad.state}. ${ad.failureReason ?? 'Codex may not be signed in.'}`,
    );
  const result = await fetch(new URL(fileUrl(ad.resultKey), config.APP_URL));
  if (!result.ok) throw new Error('Result missing from local R2');
  const bytes = new Uint8Array(await result.arrayBuffer());
  await writeFile(`evidence/${mode}-result-${String(ad.position + 1)}.png`, bytes);
  logger.info(
    {
      event: 'proof_result',
      mode,
      adId: ad.id,
      state: ad.state,
      r2Key: ad.resultKey,
      bytes: bytes.length,
    },
    'Result fetched from local R2',
  );
}
logger.info(
  { event: 'proof_passed', mode, ads: detail.ads.length },
  'All ads are done with images in local R2',
);
