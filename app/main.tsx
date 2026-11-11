import { type ComponentType, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Outlet, ScrollRestoration, useLocation, type RouterNavigateOptions, type To } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { applyTheme } from './theme';
import './global.scss';

// Each page stays its own chunk and loads before the route renders, so a #hash finds its section
const page = (path: string, load: () => Promise<{ default: ComponentType }>) => ({
  path,
  lazy: async () => ({ Component: (await load()).default }),
});

function Root() {
  const { pathname } = useLocation();
  useLayoutEffect(() => applyTheme(pathname), [pathname]);

  return (
    <>
      {/* Every first history entry shares the key "default", so without this a new page inherits another's scroll */}
      <ScrollRestoration getKey={({ key, pathname, hash }) => (key === 'default' ? pathname + hash : key)} />
      <Outlet />
    </>
  );
}

// Positions saved by an earlier visit belong to reloads and the back button, not to a link opened anew
if ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'navigate') {
  try {
    sessionStorage.removeItem('react-router-scroll-positions');
  } catch {
    // private mode: nothing was saved
  }
}

const router = createBrowserRouter(
  [
    {
      Component: Root,
      HydrateFallback: () => null,
      children: [
        page('/', () => import('@/szafa')),
        page('/rama', () => import('@/rama')),
        page('/elektryka', () => import('@/elektryka')),
        page('/pomiar', () => import('@/editor')),
        page('/galeria', () => import('@/galeria')),
        page('/plan', () => import('@/plan')),
        page('/okucia', () => import('@/okucia')),
        page('*', () => import('@/notFound')),
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

// Every page change runs as a view transition, styled in global.scss; in-page #hash jumps stay instant
const navigate = router.navigate as (to: To | number | null, opts?: RouterNavigateOptions) => Promise<void>;
router.navigate = ((to: To | number | null, opts?: RouterNavigateOptions) =>
  navigate(to, typeof to === 'string' && to.startsWith('#') ? opts : { ...opts, viewTransition: true })) as typeof router.navigate;

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
