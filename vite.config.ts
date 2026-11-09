import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves /rama from rama.html with a 200; 404.html hands every other path to the router
const routeFallbacks: Plugin = {
  name: 'route-fallbacks',
  apply: 'build',
  async writeBundle({ dir }) {
    for (const file of ['rama.html', 'elektryka.html', 'editor.html', '404.html']) {
      await copyFile(resolve(dir!, 'index.html'), resolve(dir!, file));
    }
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');

  return {
    base: env.BASE_PATH || '/',
    plugins: [react(), routeFallbacks],
    resolve: {
      alias: { '@': resolve(import.meta.dirname, 'app') },
      // @iwer/devui (XR emulator) pins React 18, which breaks hooks next to React 19
      dedupe: ['react', 'react-dom'],
    },
    server: { port: 4000 },
    preview: { port: 4001 },
  };
});
