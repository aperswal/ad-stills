import { localDatabaseId } from '../cloudflare.config';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { logger } from '../shared/logger';
await mkdir('.local/tmp', { recursive: true });
try {
  await writeFile(
    '.dev.vars',
    `APP_MODE=local\nAPP_PASSCODE=${randomBytes(24).toString('hex')}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nRUNNER_TOKEN=${randomBytes(32).toString('hex')}\nAPP_URL=http://127.0.0.1:3000\nRUNNER_CONCURRENCY=2\nRUNNER_NAME=My computer\nCODEX_BIN=codex\nRUNNER_ONCE=false\n`,
    { flag: 'wx', mode: 0o600 },
  );
  logger.info({ event: 'settings_created' }, 'Local settings created.');
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
  logger.info({ event: 'settings_kept' }, 'Keeping existing local settings.');
}
const migration = spawnSync(
  'node',
  [
    'scripts/tool.mjs',
    'pnpm',
    'exec',
    'cf',
    'd1',
    'migrations',
    'apply',
    localDatabaseId,
    '--mode',
    'development',
    '--local',
    '--persist-to',
    '.local/state',
    '--dir',
    'migrations',
  ],
  { stdio: 'inherit' },
);
if (migration.status !== 0) throw new Error('Local migrations failed.');
logger.info({ event: 'setup_done' }, 'Ready. Run pnpm dev.');
