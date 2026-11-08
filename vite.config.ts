import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');

  return {
    base: env.BASE_PATH || '/',
    plugins: [react()],
    resolve: {
      alias: { '@': resolve(import.meta.dirname, 'app') },
      // @iwer/devui (XR emulator) pins React 18, which breaks hooks next to React 19
      dedupe: ['react', 'react-dom'],
    },
    server: { port: 4000 },
    preview: { port: 4001 },
    build: {
      rolldownOptions: {
        input: {
          index: resolve(import.meta.dirname, 'index.html'),
          editor: resolve(import.meta.dirname, 'editor.html'),
          rama: resolve(import.meta.dirname, 'rama.html'),
          elektryka: resolve(import.meta.dirname, 'elektryka.html'),
        },
      },
    },
  };
});
