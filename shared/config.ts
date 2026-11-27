import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export type AppConfig = ReturnType<typeof appConfig>;
export type RunnerConfig = z.infer<typeof runnerConfigSchema>;
export const appConfigSchema = z.object({
  APP_MODE: z.enum(['local', 'deployed']).default('deployed'),
  APP_PASSCODE: z.string().min(12).max(256).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  RUNNER_TOKEN: z.string().min(32).optional(),
});
export const runnerConfigSchema = z.object({
  APP_URL: z
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        !u.username &&
        !u.password &&
        u.pathname === '/' &&
        !u.search &&
        !u.hash &&
        (u.protocol === 'https:' ||
          (u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)))
      );
    }, 'Use HTTPS, or local HTTP.')
    .default('http://127.0.0.1:3000'),
  RUNNER_TOKEN: z.string().min(32),
  RUNNER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  CODEX_BIN: z.string().min(1).default('codex'),
  RUNNER_NAME: z.string().min(1).max(80).default('My computer'),
  RUNNER_ONCE: z.enum(['true', 'false']).default('false'),
});
export function appConfig(values: Record<string, unknown>) {
  return createEnv({
    server: appConfigSchema.shape,
    runtimeEnv: appConfigSchema.parse(values),
    isServer: true,
    emptyStringAsUndefined: true,
    onValidationError: () => {
      throw new Error('App settings are missing or invalid.');
    },
  });
}
// Node-only callers supply their parsed settings. Worker callers supply bindings.
export function nodeEnvironment() {
  return process.env;
}
