'use client';

import { createXRStore } from '@react-three/xr';
import type { LineData } from '@/components/Mesh';
import { createContext, ReactNode, use, useRef, useState } from 'react';
import type { RootState } from '@react-three/fiber';
export type SceneView = 'initial' | 'left-side';

const xr = createXRStore();

const useAppStore = () => {
  const [three, setThree] = useState<RootState>();
  const [grid, setGrid] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [orthographic, setOrthographic] = useState(false);
  const [hideFronts, setHideFronts] = useState(process.env.NODE_ENV === 'development');
  const [view, setView] = useState<SceneView>('initial');
  const [gizmo, setGizmo] = useState(process.env.NODE_ENV === 'development');
  const [layer, setLayer] = useState(0);
  const line = useRef<LineData | null>(null);

  return {
    grid,
    setGrid,
    wireframe,
    setWireframe,
    orthographic,
    setOrthographic,
    hideFronts,
    setHideFronts,
    layer,
    setLayer,
    line,
    gizmo,
    setGizmo,
    view,
    setView,
    xr,
    three,
    setThree,
  };
};

type AppContextType = ReturnType<typeof useAppStore>;

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const store = use(AppContext);

  if (!store) {
    throw new Error('useApp must be used within a AppProvider');
  }

  return store;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const store = useAppStore();

  return <AppContext value={store}>{children}</AppContext>;
};
