import { NextResponse, type NextRequest } from 'next/server';
import { authorize } from './features/auth/lock';
import { settings } from './shared/server';
import { AppError, failure } from './shared/http';
export async function middleware(request: NextRequest) {
  let response: Response;
  try {
    await authorize(request, settings());
    response = NextResponse.next();
  } catch (error) {
    response =
      error instanceof AppError &&
      error.status === 401 &&
      !new URL(request.url).pathname.startsWith('/api/')
        ? NextResponse.redirect(new URL('/login', request.url))
        : failure(error);
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' ws://127.0.0.1:3000; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  if (new URL(request.url).protocol === 'https:')
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  return response;
}
