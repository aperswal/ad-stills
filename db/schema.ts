import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, check, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import type { AdCopy } from '../shared/contracts';

export type BatchRow = typeof batches.$inferSelect;
export type AdRow = typeof ads.$inferSelect;
export const batches = sqliteTable(
  'batches',
  {
    id: text('id').primaryKey(),
    createdAt: integer('created_at').notNull(),
    brandName: text('brand_name').notNull(),
    problem: text('problem').notNull(),
    audience: text('audience').notNull(),
    solution: text('solution').notNull(),
    colours: text('colours', { mode: 'json' }).$type<string[]>().notNull(),
    notes: text('notes').notNull().default(''),
    startedAt: integer('started_at'),
  },
  (t) => [
    check(
      'batch_text',
      sql`length(trim(${t.brandName})) BETWEEN 1 AND 80 AND length(trim(${t.problem})) BETWEEN 1 AND 2000 AND length(trim(${t.audience})) BETWEEN 1 AND 2000 AND length(trim(${t.solution})) BETWEEN 1 AND 2000 AND length(${t.notes}) <= 4000`,
    ),
    check(
      'batch_colours',
      sql`json_valid(${t.colours}) AND json_type(${t.colours}) = 'array' AND json_array_length(${t.colours}) <= 8`,
    ),
    check(
      'batch_dates',
      sql`${t.createdAt} >= 0 AND (${t.startedAt} IS NULL OR ${t.startedAt} >= ${t.createdAt})`,
    ),
  ],
);
export const productPhotos = sqliteTable(
  'product_photos',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    fileKey: text('file_key').notNull(),
  },
  (t) => [
    uniqueIndex('product_position').on(t.batchId, t.position),
    check('product_range', sql`${t.position} BETWEEN 0 AND 9`),
    check(
      'product_key',
      sql`substr(${t.fileKey},1,53) = 'batches/' || ${t.batchId} || '/product/'`,
    ),
  ],
);
export const runners = sqliteTable(
  'runners',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    lastSeen: integer('last_seen').notNull(),
    codexVersion: text('codex_version').notNull(),
    signedIn: integer('signed_in', { mode: 'boolean' }).notNull(),
  },
  (t) => [
    check(
      'runner_values',
      sql`length(${t.name}) BETWEEN 1 AND 80 AND length(${t.codexVersion}) BETWEEN 1 AND 100 AND ${t.lastSeen} >= 0 AND ${t.signedIn} IN (0,1)`,
    ),
  ],
);
export const ads = sqliteTable(
  'ads',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
      .notNull()
      .references(() => batches.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    originalKey: text('original_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    state: text('state', { enum: ['queued', 'running', 'done', 'failed'] })
      .notNull()
      .default('queued'),
    attempt: integer('attempt').notNull().default(0),
    claimedBy: text('claimed_by').references(() => runners.id),
    claimedAt: integer('claimed_at'),
    resultKey: text('result_key'),
    copy: text('copy', { mode: 'json' }).$type<AdCopy>(),
    extraNote: text('extra_note').notNull().default(''),
    failureReason: text('failure_reason'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('ad_position').on(t.batchId, t.position),
    index('ad_queue').on(t.state, t.updatedAt),
    check(
      'ad_range',
      sql`${t.position} BETWEEN 0 AND 9 AND ${t.width}>0 AND ${t.height}>0 AND ${t.width}*${t.height}<=40000000 AND ${t.attempt}>=0 AND ${t.updatedAt}>=0`,
    ),
    check('ad_state', sql`${t.state} IN ('queued','running','done','failed')`),
    check(
      'ad_claim',
      sql`(${t.state}='running' AND ${t.claimedBy} IS NOT NULL AND ${t.claimedAt} IS NOT NULL) OR (${t.state}<>'running' AND ${t.claimedBy} IS NULL AND ${t.claimedAt} IS NULL)`,
    ),
    check(
      'ad_result',
      sql`(${t.state}='done' AND ${t.resultKey} IS NOT NULL AND ${t.copy} IS NOT NULL AND json_valid(${t.copy})) OR (${t.state}<>'done' AND ${t.resultKey} IS NULL AND ${t.copy} IS NULL)`,
    ),
    check(
      'ad_failure',
      sql`(${t.state}='failed' AND length(${t.failureReason}) BETWEEN 1 AND 1000) OR (${t.state}<>'failed' AND ${t.failureReason} IS NULL)`,
    ),
    check('ad_note', sql`length(${t.extraNote})<=2000`),
    check(
      'ad_keys',
      sql`substr(${t.originalKey},1,54) = 'batches/' || ${t.batchId} || '/original/' AND (${t.resultKey} IS NULL OR substr(${t.resultKey},1,52) = 'batches/' || ${t.batchId} || '/result/')`,
    ),
  ],
);
export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    addressHash: text('address_hash').primaryKey(),
    windowStart: integer('window_start').notNull(),
    attempts: integer('attempts').notNull(),
  },
  (t) => [check('login_range', sql`${t.attempts}>=1 AND ${t.windowStart}>=0`)],
);
