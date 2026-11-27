import { z } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public source: 'client' | 'server' | 'runner' = 'client',
  ) {
    super(message);
  }
}
export function success(data: unknown, status = 200) {
  return Response.json(
    { ok: true, data, error: null },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
export function failure(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        ok: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          source: 'client',
        },
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json(
      {
        ok: false,
        data: null,
        error: { code: error.code, message: error.message, source: error.source },
      },
      { status: error.status },
    );
  logger.error(
    { event: 'request_failed', kind: error instanceof Error ? error.name : 'unknown' },
    'Request failed',
  );
  return Response.json(
    {
      ok: false,
      data: null,
      error: {
        code: 'SERVER_ERROR',
        message: 'The app could not finish. Try again.',
        source: 'server',
      },
    },
    { status: 500 },
  );
}
export async function boundedBytes(request: Request, max: number) {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > max)
    throw new AppError(413, 'TOO_LARGE', 'This file is too large.');
  if (!request.body) throw new AppError(400, 'EMPTY_BODY', 'Add a file or request body.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > max) {
        await reader.cancel();
        throw new AppError(413, 'TOO_LARGE', 'This file is too large.');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>) {
  const bytes = await boundedBytes(request, 32 * 1024);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Send valid JSON.');
  }
  return schema.parse(value);
}
