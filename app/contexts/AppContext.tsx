'use client';

import { createXRStore } from '@react-three/xr';
import type { LineData } from '@/components/Mesh';
import { createContext, ReactNode, use, useRef, useState } from 'react';
import type { RootState } from '@react-three/fiber';
export type SceneView = 'initial' | 'left-side';

const xr = createXRStore();

const useAppStore = (initial?: Partial<AppContextInitial>) => {
  const [three, setThree] = useState<RootState>();
  const [grid, setGrid] = useState(initial?.grid ?? true);
  const [wireframe, setWireframe] = useState(initial?.wireframe ?? false);
  const [orthographic, setOrthographic] = useState(initial?.orthographic ?? false);
  const [hideFronts, setHideFronts] = useState(initial?.hideFronts ?? false);
  const [view, setView] = useState<SceneView>(initial?.view ?? 'initial');
  const [gizmo, setGizmo] = useState(initial?.gizmo ?? false);
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

type AppContextInitial = {
  grid: boolean;
  wireframe: boolean;
  orthographic: boolean;
  hideFronts: boolean;
  view: SceneView;
  gizmo: boolean;
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

export const AppProvider = ({ children, initial }: { children: ReactNode, initial?: Partial<AppContextInitial> }) => {
  const store = useAppStore(initial);

  return <AppContext value={store}>{children}</AppContext>;
};
