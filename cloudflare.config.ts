import { bindings, defineConfig, defineWorker } from 'cf/config';
import { deployDatabaseId } from './shared/deploy.ts';
export const localDatabaseId = '00000000-0000-4000-8000-000000000001';
// A deployed app uses the database named in `.deploy.vars`. Until one is set, the local stand-in ID keeps builds and
// dry runs working.
const productionDatabaseId = deployDatabaseId(process.env) ?? localDatabaseId;
export default defineConfig(({ mode }) => ({
  worker: defineWorker({
    name: 'ad-stills',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-11-26',
    compatibilityFlags: ['nodejs_compat'],
    // The built scripts and styles are public files with no secrets in them. They are served straight from the assets,
    // so the passcode page can load its own look and its own script before anyone has signed in. Everything else
    // goes through the Worker first, where the lock is.
    assets: {
      htmlHandling: 'none',
      notFoundHandling: 'none',
      runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*'],
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        name: 'ad-stills',
        id: mode === 'development' ? localDatabaseId : productionDatabaseId,
      }),
      FILES: bindings.r2({ name: 'ad-stills-files' }),
      APP_MODE: bindings.text(mode === 'development' ? 'local' : 'deployed'),
      APP_PASSCODE: bindings.secret(),
      SESSION_SECRET: bindings.secret(),
      RUNNER_TOKEN: bindings.secret(),
    },
  }),
}));
