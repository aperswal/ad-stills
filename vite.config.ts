import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
export default defineConfig({
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
  preview: { host: '127.0.0.1', port: 3000, strictPort: true },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      persistState: { path: '.local/state' },
      remoteBindings: false,
    }),
  ],
});
