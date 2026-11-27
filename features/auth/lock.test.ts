import { describe, it, expect } from 'vitest';
import { appConfig } from '../../shared/config';
import { authorize, requireRunner, secretMatches, sessionFor, requireOrigin } from './lock';
const config = appConfig({
  APP_PASSCODE: 'long-passcode-for-tests',
  SESSION_SECRET: 's'.repeat(32),
  RUNNER_TOKEN: 'r'.repeat(32),
});
describe('the lock', () => {
  it('compares equal, unequal and different-length secrets', () => {
    expect(secretMatches('same', 'same')).toBe(true);
    expect(secretMatches('s', 'same')).toBe(false);
    expect(secretMatches('', '')).toBe(false);
    expect(secretMatches('x', undefined)).toBe(false);
  });
  it('fails closed without a passcode, including on runner and login routes', async () => {
    for (const path of ['/', '/login', '/api/runner/claim', '/_next/static/a.js'])
      await expect(
        authorize(
          new Request(`https://example.test${path}`),
          appConfig({ SESSION_SECRET: 's'.repeat(32), RUNNER_TOKEN: 'r'.repeat(32) }),
        ),
      ).rejects.toThrow('secrets');
  });
  it('requires the runner token even locally', () => {
    expect(() => {
      requireRunner(new Request('http://127.0.0.1/api/runner/claim'), config);
    }).toThrow();
    expect(() => {
      requireRunner(
        new Request('https://example.test', {
          headers: { Authorization: `Bearer ${'r'.repeat(32)}` },
        }),
        config,
      );
    }).not.toThrow();
  });
  it('only bypasses the lock for local mode plus a loopback address', async () => {
    const local = appConfig({ ...config, APP_MODE: 'local' });
    await expect(authorize(new Request('http://127.0.0.1/'), local)).resolves.toBeUndefined();
    await expect(authorize(new Request('https://evil.test/'), local)).rejects.toThrow('passcode');
    await expect(authorize(new Request('http://127.0.0.1/'), config)).rejects.toThrow('passcode');
  });
  it('rejects cross-origin and cross-site writes', () => {
    expect(() => {
      requireOrigin(
        new Request('http://localhost/api/batches', {
          method: 'POST',
          headers: { origin: 'https://evil.test' },
        }),
      );
    }).toThrow();
    expect(() => {
      requireOrigin(
        new Request('http://localhost/api/batches', {
          method: 'POST',
          headers: { 'sec-fetch-site': 'cross-site' },
        }),
      );
    }).toThrow();
  });
  it('accepts sealed cookies and refuses tampered ones', async () => {
    const request = new Request('https://example.test/');
    const response = new Response();
    const session = await sessionFor(request, response, config);
    session.unlocked = true;
    await session.save();
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    if (!setCookie) throw new Error('Missing cookie');
    const cookie = setCookie.split(';')[0];
    if (!cookie) throw new Error('Missing cookie');
    await expect(
      authorize(new Request(request, { headers: { cookie } }), config),
    ).resolves.toBeUndefined();
    await expect(
      authorize(
        new Request(request, { headers: { cookie: cookie.replace('Fe26.2', 'broken') } }),
        config,
      ),
    ).rejects.toThrow();
  });
});
