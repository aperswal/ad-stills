import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { appConfig } from '../shared/config';
import { logger } from '../shared/logger';
const config = appConfig(parseEnv(await readFile('.dev.vars', 'utf8')));
const base = 'http://127.0.0.1:3001';
const anonymous = await fetch(`${base}/api/status`);
if (anonymous.status !== 401) throw new Error('Production app was not locked.');
const response = await fetch(`${base}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ passcode: config.APP_PASSCODE }),
});
if (!response.ok) throw new Error('Production passcode did not unlock.');
const cookie = response.headers.get('set-cookie')?.split(';')[0];
if (!cookie) throw new Error('No session cookie.');
const authenticated = await fetch(`${base}/api/status`, { headers: { Cookie: cookie } });
if (!authenticated.ok) throw new Error('Session could not read the app.');
const wrongRunner = await fetch(`${base}/api/runner/claim`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ runnerId: crypto.randomUUID() }),
});
if (wrongRunner.status !== 401) throw new Error('Runner route did not require its token.');
logger.info(
  {
    event: 'production_lock_passed',
    anonymous: anonymous.status,
    login: response.status,
    session: authenticated.status,
    runnerWithoutToken: wrongRunner.status,
  },
  'Built Worker lock and session passed. No secret values were logged.',
);
