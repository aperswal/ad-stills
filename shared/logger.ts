import pino from 'pino';
export const logger = pino({
  level: 'info',
  base: null,
  redact: [
    'token',
    'passcode',
    'password',
    'authorization',
    'cookie',
    'RUNNER_TOKEN',
    'APP_PASSCODE',
    'SESSION_SECRET',
  ],
});
