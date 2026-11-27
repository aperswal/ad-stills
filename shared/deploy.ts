import { z } from 'zod';

// The D1 database a deployed app uses. It belongs to one Cloudflare account, so it is read from `.deploy.vars`,
// which Git ignores, and never written into a tracked file.
export const deploySettingsSchema = z.object({
  D1_DATABASE_ID: z.uuid().optional(),
});

// Undefined until the owner has created a database and written its ID down. An empty line counts as not set.
export function deployDatabaseId(values: Record<string, unknown>): string | undefined {
  const raw = values.D1_DATABASE_ID === '' ? undefined : values.D1_DATABASE_ID;
  return deploySettingsSchema.parse({ D1_DATABASE_ID: raw }).D1_DATABASE_ID;
}
