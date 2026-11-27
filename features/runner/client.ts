import { z } from 'zod';
import { envelopeSchema } from '../../shared/contracts';
import type { RunnerConfig } from '../../shared/config';
export async function runnerRequest<T>(
  config: RunnerConfig,
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
) {
  const response = await fetch(new URL(path, config.APP_URL), {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: new Headers([
      ...new Headers(init.headers),
      ['Authorization', `Bearer ${config.RUNNER_TOKEN}`],
    ]),
  });
  const body: unknown = await response.json();
  const envelope = envelopeSchema.parse(body);
  if (!envelope.ok) throw new Error(envelope.error.message);
  if (!response.ok) throw new Error(`App request failed (${String(response.status)}).`);
  return schema.parse(envelope.data);
}
export const jsonRequest = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
