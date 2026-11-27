import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { logger } from '../shared/logger';
import { nodeEnvironment } from '../shared/config';
const app = spawn('node', ['scripts/tool.mjs', 'pnpm', 'exec', 'vite', 'dev'], {
  stdio: 'inherit',
  detached: process.platform !== 'win32',
});
let runner: ReturnType<typeof spawn> | undefined;
let stopping = false;
function stopChild(child: ReturnType<typeof spawn>) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') child.kill('SIGTERM');
  else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      logger.info({ event: 'child_already_stopped' }, 'Child process stopped.');
    }
  }
}
function stop() {
  if (stopping) return;
  stopping = true;
  stopChild(app);
  if (runner) stopChild(runner);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, stop);
app.on('exit', (code) => {
  if (!stopping) {
    process.exitCode = code ?? 1;
    stop();
  }
});
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  if (app.exitCode !== null) break;
  try {
    const response = await fetch('http://127.0.0.1:3000/api/status', {
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* The local Worker may still be starting. */
  }
  await delay(1000);
}
if (ready) {
  runner = spawn('node', ['scripts/tool.mjs', 'pnpm', 'exec', 'tsx', 'features/runner/main.ts'], {
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    // The runner beside the local app always works for the local app.
    env: { ...nodeEnvironment(), RUNNER_SETTINGS: '.dev.vars' },
  });
  runner.on('exit', (code) => {
    if (!stopping) {
      logger.error(
        { event: 'runner_stopped', code },
        'Runner stopped. Run pnpm runner to restart it.',
      );
    }
  });
} else {
  stop();
  throw new Error('The app did not start. Run pnpm run setup, then try again.');
}
