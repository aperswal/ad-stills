import { spawn } from 'node:child_process';
import { logger } from '../../shared/logger';

export interface CommandOptions {
  bin: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeout: number;
  signal?: AbortSignal;
}
export async function runCommand(options: CommandOptions) {
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn(options.bin, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let output = '';
    let timedOut = false;
    const append = (data: Buffer) => {
      output = (output + data.toString()).slice(-8192);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const stop = () => {
      if (child.pid) {
        try {
          if (process.platform === 'win32') child.kill('SIGKILL');
          else process.kill(-child.pid, 'SIGKILL');
        } catch {
          logger.warn({ event: 'process_already_stopped' }, 'Runner process already stopped');
        }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, options.timeout);
    options.signal?.addEventListener('abort', stop, { once: true });
    child.on('error', (error) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', stop);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', stop);
      if (timedOut) reject(new Error('Codex took more than 10 minutes. Try again.'));
      else if (options.signal?.aborted) reject(new Error('The runner stopped. Try again.'));
      else resolve({ code: code ?? 1, output });
    });
  });
}
