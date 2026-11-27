import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The passcode page is shown before anyone has signed in. If its own scripts and styles had to pass the lock, the
// page would come up bare and its button would never work. That happened on the first deploy.
describe('the built scripts and styles', () => {
  const config = readFileSync('cloudflare.config.ts', 'utf8');

  it('are served without going through the lock', () => {
    expect(config).toContain("'!/_next/static/*'");
  });
  it('are the only thing that skips it', () => {
    const skipped = [...config.matchAll(/'!([^']+)'/g)].map((match) => match[1]);
    expect(skipped.every((path) => path?.endsWith('/_next/static/*'))).toBe(true);
  });
});
