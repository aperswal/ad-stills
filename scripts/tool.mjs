import { spawn } from 'node:child_process';
import { nodeEnvironment } from '../shared/config.ts';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
const root = process.cwd();
for (const dir of ['tmp', 'config', 'cache', 'logs'])
  mkdirSync(resolve(root, '.local', dir), { recursive: true });
// Settings for a deploy to the owner's own Cloudflare account. Git ignores the file.
const deploySettings = existsSync(resolve(root, '.deploy.vars'))
  ? parseEnv(readFileSync(resolve(root, '.deploy.vars'), 'utf8'))
  : {};
const [bin, ...args] = process.argv.slice(2);
if (!bin) throw new Error('A tool name is required.');
const child = spawn(bin, args, {
  stdio: 'inherit',
  env: {
    ...nodeEnvironment(),
    ...deploySettings,
    CF_SEND_TELEMETRY: 'false',
    WRANGLER_SEND_METRICS: 'false',
    DO_NOT_TRACK: '1',
    XDG_CONFIG_HOME: resolve(root, '.local/config'),
    XDG_CACHE_HOME: resolve(root, '.local/cache'),
    TMPDIR: resolve(root, '.local/tmp'),
    WRANGLER_LOG_PATH: resolve(root, '.local/logs/wrangler.log'),
  },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
