import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repo>/, whereas Firebase Hosting
// and local dev serve from the root - only override the base path when
// explicitly building for Pages (see package.json's build:ghpages script).
export default defineConfig({
  base: process.env.GH_PAGES ? '/gearfight/' : '/',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
