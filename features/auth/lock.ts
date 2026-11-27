import { createHash, timingSafeEqual } from 'node:crypto';
import { getIronSession } from 'iron-session';
import type { AppConfig } from '../../shared/config';
import { AppError } from '../../shared/http';

export interface Session {
  unlocked: boolean;
}
export function secretMatches(actual: string, expected: string | undefined) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const match = timingSafeEqual(digest(actual), digest(expected ?? ''));
  return Boolean(expected) && match;
}
export function localRequest(request: Request, config: AppConfig) {
  const url = new URL(request.url);
  return (
    config.APP_MODE === 'local' &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  );
}
export function requireSecrets(request: Request, config: AppConfig) {
  if (
    !config.RUNNER_TOKEN ||
    !config.SESSION_SECRET ||
    (!localRequest(request, config) && !config.APP_PASSCODE)
  )
    throw new AppError(503, 'SETUP_REQUIRED', 'Set the app secrets before opening it.', 'server');
}
export function requireRunner(request: Request, config: AppConfig) {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ') || !secretMatches(header.slice(7), config.RUNNER_TOKEN))
    throw new AppError(401, 'RUNNER_DENIED', 'The runner token is missing or wrong.');
}
export function requireOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new AppError(403, 'WRONG_ORIGIN', 'Open this app directly and try again.');
}
export async function sessionFor(request: Request, response: Response, config: AppConfig) {
  if (!config.SESSION_SECRET)
    throw new AppError(503, 'SETUP_REQUIRED', 'Set the session secret.', 'server');
  return getIronSession<Session>(request, response, {
    cookieName: 'ad-stills-session',
    password: config.SESSION_SECRET,
    ttl: 60 * 60 * 12,
    cookieOptions: {
      httpOnly: true,
      secure: !localRequest(request, config),
      sameSite: 'strict',
      path: '/',
    },
  });
}
export async function authorize(request: Request, config: AppConfig) {
  requireSecrets(request, config);
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/runner/')) {
    requireRunner(request, config);
    return;
  }
  requireOrigin(request);
  if (localRequest(request, config)) return;
  if (path === '/login' || path === '/api/login' || path.startsWith('/_next/')) return;
  const session = await sessionFor(request, new Response(), config);
  if (session.unlocked !== true) throw new AppError(401, 'LOCKED', 'Enter the app passcode.');
}
export function addressHash(request: Request) {
  return createHash('sha256')
    .update(request.headers.get('cf-connecting-ip') ?? 'local')
    .digest('hex');
}
