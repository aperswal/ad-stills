import { z } from 'zod';

export type BatchInput = z.infer<typeof batchInputSchema>;
export type AdCopy = z.infer<typeof copySchema>;
export type BatchDetail = z.infer<typeof batchDetailSchema>;
export type Ad = z.infer<typeof adSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Status = z.infer<typeof statusSchema>;

export const idSchema = z.uuid();
export const positionSchema = z.coerce.number().int().min(0).max(9);
export const batchInputSchema = z.strictObject({
  brandName: z.string().trim().min(1, 'Add a brand name.').max(80),
  problem: z.string().trim().min(1, 'Add the customer problem.').max(2000),
  audience: z.string().trim().min(1, 'Add who it is for.').max(2000),
  solution: z.string().trim().min(1, 'Add how your product helps.').max(2000),
  colours: z
    .array(z.string().regex(/^#[\da-fA-F]{6}$/, 'Use colours like #146B58.'))
    .max(8)
    .default([]),
  notes: z.string().trim().max(4000).default(''),
});
export const fileQuerySchema = z.strictObject({
  kind: z.enum(['original', 'product']),
  position: positionSchema,
});
export const againSchema = z.strictObject({ note: z.string().trim().max(2000).default('') });
export const copySchema = z.strictObject({
  headline: z.string().trim().min(1).max(500),
  body: z.string().trim().max(3000),
  cta: z.string().trim().min(1).max(200),
  replaced: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
});
export const helloSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(80),
  codexVersion: z.string().min(1).max(100),
  signedIn: z.boolean(),
});
export const claimSchema = z.strictObject({ runnerId: idSchema });
export const ownershipSchema = z.strictObject({
  runnerId: idSchema,
  attempt: z.number().int().positive(),
});
export const failSchema = ownershipSchema.extend({ reason: z.string().trim().min(1).max(1000) });
export const resultSchema = ownershipSchema.extend({ copy: copySchema });
export const loginSchema = z.strictObject({ passcode: z.string().min(1).max(256) });
export const pageQuerySchema = z.strictObject({
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export const emptySchema = z.strictObject({});
export const keySchema = z
  .string()
  .regex(
    /^batches\/[\da-f-]{36}\/(original|product|result)\/[\da-f-]{36}(?:-\d+)?\.(png|jpg|webp)$/,
  );
export const fileUrlSchema = z.string().startsWith('/api/files/').max(250);
const timeSchema = z.number().int().nonnegative();
export const adSchema = z.strictObject({
  id: idSchema,
  batchId: idSchema,
  position: positionSchema,
  originalKey: keySchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  state: z.enum(['queued', 'running', 'done', 'failed']),
  attempt: z.number().int().nonnegative(),
  claimedBy: idSchema.nullable(),
  claimedAt: timeSchema.nullable(),
  resultKey: keySchema.nullable(),
  copy: copySchema.nullable(),
  extraNote: z.string().max(2000),
  failureReason: z.string().max(1000).nullable(),
  updatedAt: timeSchema,
});
export const photoSchema = z.strictObject({
  id: idSchema,
  batchId: idSchema,
  position: positionSchema,
  fileKey: keySchema,
});
export const batchSchema = batchInputSchema.extend({
  id: idSchema,
  createdAt: timeSchema,
  startedAt: timeSchema.nullable(),
});
export const batchDetailSchema = z.strictObject({
  batch: batchSchema,
  ads: z.array(adSchema).max(10),
  photos: z.array(photoSchema).max(10),
});
export const batchListSchema = z.strictObject({
  items: z
    .array(
      batchSchema.extend({
        total: z.number().int().nonnegative(),
        done: z.number().int().nonnegative(),
      }),
    )
    .max(20),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export const statusSchema = z.strictObject({
  connected: z.boolean(),
  signedIn: z.boolean(),
  command: z.enum(['pnpm dev', 'pnpm runner']),
  runners: z.number().int().nonnegative(),
});
export const jobSchema = z.strictObject({
  ad: adSchema,
  batch: batchSchema,
  originalUrl: fileUrlSchema,
  productUrls: z.array(fileUrlSchema).min(1).max(10),
});
export const claimResponseSchema = z.strictObject({ job: jobSchema.nullable() });
export const okSchema = z.strictObject({ ok: z.literal(true) });
export const envelopeSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: z.unknown(), error: z.null() }),
  z.strictObject({
    ok: z.literal(false),
    data: z.null(),
    error: z.strictObject({
      code: z.string(),
      message: z.string(),
      source: z.enum(['client', 'server', 'runner']),
    }),
  }),
]);
export const fileUrl = (key: string) => `/api/files/${key}`;
