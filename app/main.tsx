import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import './global.scss';

// Each page stays its own chunk and loads before the route renders, so a #hash finds its section
const page = (path: string, load: () => Promise<{ default: ComponentType }>) => ({
  path,
  lazy: async () => ({ Component: (await load()).default }),
});

const router = createBrowserRouter(
  [
    {
      element: (
        <>
          {/* Every first history entry shares the key "default", so without this a new page inherits another's scroll */}
          <ScrollRestoration getKey={({ key, pathname, hash }) => (key === 'default' ? pathname + hash : key)} />
          <Outlet />
        </>
      ),
      HydrateFallback: () => null,
      children: [
        page('/', () => import('@/szafa')),
        page('/rama', () => import('@/rama')),
        page('/elektryka', () => import('@/elektryka')),
        page('/pomiar', () => import('@/editor')),
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
