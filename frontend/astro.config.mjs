// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// SSR backend-for-frontend: every page is server-rendered so the browser never
// talks to the FastAPI backend directly (it is unpublished in docker-compose).
// The standalone node adapter emits dist/server/entry.mjs, which the Dockerfile
// runs, and reads HOST/PORT from the environment at startup.
// https://astro.build/config
export default defineConfig({
    output: 'server',
    adapter: node({ mode: 'standalone' }),
    server: { host: true, port: 7071 },
});
