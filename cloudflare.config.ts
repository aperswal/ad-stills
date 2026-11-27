import { bindings, defineConfig, defineWorker } from 'cf/config';
import { nodeEnvironment } from './shared/config.ts';
import { deployDatabaseId } from './shared/deploy.ts';
export const localDatabaseId = '00000000-0000-4000-8000-000000000001';
// A deployed app uses the database named in `.deploy.vars`. Until one is set, the local stand-in ID keeps builds and
// dry runs working.
const productionDatabaseId = deployDatabaseId(nodeEnvironment()) ?? localDatabaseId;
export default defineConfig(({ mode }) => ({
  worker: defineWorker({
    name: 'ad-stills',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-11-26',
    compatibilityFlags: ['nodejs_compat'],
    assets: { htmlHandling: 'none', notFoundHandling: 'none', runWorkerFirst: ['/*'] },
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
