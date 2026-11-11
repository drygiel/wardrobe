import { useEffect } from 'react';
import { type Page, urlOf } from '@/site';
import { THEME_COLOR } from '@/theme';

const set = (selector: string, attribute: string, value: string) => document.querySelector(selector)?.setAttribute(attribute, value);

// Tab title, the description and address that search engines and link previews quote, and the colour of the browser's own chrome.
// The built HTML of each route already carries its own values (vite.config.ts); this keeps them right while moving between pages.
export default function Meta({ page, color = THEME_COLOR, index = true }: { page: Page; color?: string; index?: boolean }) {
  useEffect(() => {
    document.title = page.title;
    set('meta[name="description"]', 'content', page.description);
    set('meta[property="og:title"]', 'content', page.title);
    set('meta[property="og:description"]', 'content', page.description);
    set('meta[property="og:url"]', 'content', urlOf(page.href));
    set('link[rel="canonical"]', 'href', urlOf(page.href));
    set('meta[name="robots"]', 'content', index ? 'index, follow' : 'noindex');
  }, [page, index]);

  return <meta name="theme-color" content={color} />;
}
