'use client';
import { z } from 'zod';
import { envelopeSchema } from './contracts';
export async function api<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: new Headers(init.headers),
    credentials: 'same-origin',
  });
  const raw: unknown = await response.json();
  const body = envelopeSchema.parse(raw);
  if (!body.ok) {
    if (body.error.code === 'LOCKED') window.location.assign('/login');
    throw new Error(body.error.message);
  }
  if (!response.ok) throw new Error('The app could not finish. Try again.');
  return schema.parse(body.data);
}
export const post = (data: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
