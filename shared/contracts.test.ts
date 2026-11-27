import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import * as contract from './contracts';
import { appConfig, appConfigSchema, runnerConfigSchema } from './config';
const valid = {
  brandName: 'Demo',
  problem: 'Lost bottles',
  audience: 'Adults',
  solution: 'A green bottle',
};
const bad: Record<string, unknown[]> = {
  idSchema: ['../bad', 'abc', null],
  positionSchema: [-1, 10, 1.5, 'x'],
  batchInputSchema: [
    {},
    { ...valid, brandName: '' },
    { ...valid, colours: ['red'] },
    { ...valid, notes: 'x'.repeat(4001) },
    { ...valid, problem: ' ' },
    { ...valid, audience: '' },
    { ...valid, solution: '' },
    { ...valid, other: 'x' },
  ],
  fileQuerySchema: [
    { kind: 'result', position: 0 },
    { kind: 'product', position: 10 },
  ],
  againSchema: [{ note: 'x'.repeat(2001) }, { command: 'delete' }],
  copySchema: [
    {},
    { headline: 'x', body: '', cta: 'x', replaced: [] },
    { headline: 'x', body: '', cta: '', replaced: ['x'] },
    { headline: 'x', body: '', cta: 'x', replaced: ['x'], other: true },
  ],
  helloSchema: [
    {},
    { id: crypto.randomUUID(), name: '', codexVersion: '1', signedIn: true },
    { id: crypto.randomUUID(), name: 'x', codexVersion: '1', signedIn: 'true' },
  ],
  claimSchema: [{}, { runnerId: 'x' }],
  ownershipSchema: [{}, { runnerId: crypto.randomUUID(), attempt: 0 }],
  failSchema: [{}, { runnerId: crypto.randomUUID(), attempt: 1, reason: '' }],
  resultSchema: [{}, { runnerId: crypto.randomUUID(), attempt: 1, copy: {} }],
  loginSchema: [{}, { passcode: '' }, { passcode: 'x'.repeat(257) }],
  pageQuerySchema: [{ offset: -1 }, { offset: 1.5 }, { offset: 1000001 }],
  emptySchema: [{ x: true }, null],
  keySchema: ['../../secret', 'batches/foo/result/a.png', 'https://evil.test/a.png'],
  fileUrlSchema: ['https://evil.test/a.png', '/other'],
  adSchema: [{}, { state: 'surprise' }],
  photoSchema: [{}, { position: 10 }],
  batchSchema: [{}, valid],
  batchDetailSchema: [{}, { batch: {}, ads: [], photos: [] }],
  batchListSchema: [{}, { items: [], nextOffset: -1 }],
  statusSchema: [{}, { connected: 'true', signedIn: true, command: 'evil', runners: 1 }],
  jobSchema: [{}, { productUrls: [] }],
  claimResponseSchema: [{}, { job: {} }],
  okSchema: [{}, { ok: false }],
  envelopeSchema: [
    {},
    { ok: true, data: {}, error: { message: 'bad' } },
    { ok: false, data: null, error: { code: 'x', message: 'x', source: 'unknown' } },
  ],
};
describe('all public schemas refuse bad data', () => {
  it('lists every exported boundary schema', () => {
    const names = Object.entries(contract)
      .filter(([, value]) => value instanceof z.ZodType)
      .map(([name]) => name)
      .sort();
    expect(Object.keys(bad).sort()).toEqual(names);
  });
  for (const [name, values] of Object.entries(bad)) {
    it(`${name} rejects its invalid cases`, () => {
      const entry = Object.entries(contract).find(([key]) => key === name)?.[1];
      if (!(entry instanceof z.ZodType)) throw new Error('Missing schema');
      for (const value of values) expect(entry.safeParse(value).success).toBe(false);
    });
  }
  it('bounds long required fields, arrays and copied strings', () => {
    for (const name of ['problem', 'audience', 'solution'])
      expect(
        contract.batchInputSchema.safeParse({ ...valid, [name]: 'x'.repeat(2001) }).success,
      ).toBe(false);
    expect(
      contract.batchInputSchema.safeParse({
        ...valid,
        colours: Array.from({ length: 9 }, () => '#ffffff'),
      }).success,
    ).toBe(false);
    for (const [name, max] of [
      ['headline', 500],
      ['body', 3000],
      ['cta', 200],
    ] as const)
      expect(
        contract.copySchema.safeParse({
          headline: 'x',
          body: 'x',
          cta: 'x',
          replaced: ['x'],
          [name]: 'x'.repeat(max + 1),
        }).success,
      ).toBe(false);
  });
  it('refuses invalid app and runner settings', () => {
    expect(appConfigSchema.safeParse({ APP_MODE: 'open' }).success).toBe(false);
    expect(() => appConfig({ SESSION_SECRET: 'short' })).toThrow();
    for (const values of [
      { RUNNER_TOKEN: 'short' },
      { RUNNER_TOKEN: 'x'.repeat(32), RUNNER_CONCURRENCY: 0 },
      { RUNNER_TOKEN: 'x'.repeat(32), APP_URL: 'http://evil.test' },
      { RUNNER_TOKEN: 'x'.repeat(32), APP_URL: 'https://user:secret@example.test' },
    ])
      expect(runnerConfigSchema.safeParse(values).success).toBe(false);
  });
});
