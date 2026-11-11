import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { NOT_FOUND, PAGES, type Page, urlOf } from './app/site';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// index.html with one page's title, description and address in place of the home page's
function htmlFor(html: string, page: Page, index = true) {
  const content = (tag: string, value: string) => (out: string) => out.replace(new RegExp(`(<meta ${tag} content=")[^"]*"`), `$1${escape(value)}"`);
  return [
    (out: string) => out.replace(/<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`),
    content('name="description"', page.description),
    content('property="og:title"', page.title),
    content('property="og:description"', page.description),
    content('property="og:url"', urlOf(page.href)),
    content('name="robots"', index ? 'index, follow' : 'noindex'),
    // A page that is not indexed has no canonical address
    (out: string) => (index ? out.replace(/(<link rel="canonical" href=")[^"]*"/, `$1${urlOf(page.href)}"`) : out.replace(/\s*<link rel="canonical"[^>]*>/, '')),
  ].reduce((out, change) => change(out), html);
}

// GitHub Pages serves /rama from rama.html with a 200; 404.html hands every other path to the router.
// Each file carries its own page's meta tags, so a link preview shows the page that was shared.
const routeFallbacks: Plugin = {
  name: 'route-fallbacks',
  apply: 'build',
  async writeBundle({ dir }) {
    const html = await readFile(resolve(dir!, 'index.html'), 'utf8');
    for (const page of PAGES.slice(1)) await writeFile(resolve(dir!, `${page.href.slice(1)}.html`), htmlFor(html, page));
    await writeFile(resolve(dir!, '404.html'), htmlFor(html, NOT_FOUND, false));
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
