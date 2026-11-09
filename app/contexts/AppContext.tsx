import { createXRStore } from '@react-three/xr';
import type { LineData } from '@/components/Mesh';
import { type Column, columnsOf, type GroupId, groupOf, HIDDEN_GROUPS, type useParts } from '@/components/parts';
import { isShown } from '@/xr/placement';
import { createContext, ReactNode, use, useRef, useState, useSyncExternalStore } from 'react';
import type { RootState } from '@react-three/fiber';
import type * as THREE from 'three';
export type SceneView = 'initial' | 'left-side' | 'front' | 'side' | 'side-z' | 'top' | 'last-3d';
export type Unit = 'mm' | 'cm';

const UNIT_KEY = 'wardrobe.unit';

const storedUnit = (): Unit => {
  try {
    return localStorage.getItem(UNIT_KEY) === 'cm' ? 'cm' : 'mm';
  } catch {
    return 'mm';
  }
};

// The XR emulator's dev button covers the editor toolbar: opt in with ?xr
const emulated = new URLSearchParams(location.search).has('xr');
// three would hand the emulated session to the browser's own XRWebGLBinding, which only takes a native one
if (emulated) delete (window as { XRWebGLBinding?: unknown }).XRWebGLBinding;

const xr = createXRStore({
  emulate: emulated ? 'metaQuest3' : false,
  offerSession: false, // only the AR and VR buttons start a session
  frameRate: 'low', // the store's default asks a Quest 3 for 120 Hz, which a scene with this many parts cannot hold
  // minDistance: the menu is closer than the default 20 cm; clickThresholdMs: the default 300 ms drops an unhurried trigger press
  controller: { teleportPointer: false, grabPointer: false, rayPointer: { minDistance: 0, clickThresholdMs: 1000, filter: isShown } },
});

const useAppStore = (initial?: Partial<AppContextInitial>) => {
  const [three, setThree] = useState<RootState>();
  const presenting = useSyncExternalStore(xr.subscribe, () => xr.getState().session != null);
  const [grid, setGrid] = useState(initial?.grid ?? true);
  const [wireframe, setWireframe] = useState(initial?.wireframe ?? false);
  const [orthographic, setOrthographic] = useState(initial?.orthographic ?? false);
  const [hidden, setHidden] = useState<ReadonlySet<GroupId>>(
    () => new Set([...HIDDEN_GROUPS, ...(initial?.hideFronts ? (['fronts'] as const) : [])]),
  );
  const [hiddenParts, setHiddenParts] = useState<ReadonlySet<string>>(() => new Set());
  const [column, setColumn] = useState<Column | null>(null);
  const [grain, setGrain] = useState(false);
  // The editor remembers its unit; the pages around it always say centimetres
  const [unit, setUnitState] = useState<Unit>(() => (initial?.rememberUnit ? storedUnit() : 'cm'));
  const [view, setViewName] = useState<SceneView>(initial?.view ?? 'initial');
  const [viewTick, setViewTick] = useState(0); // counts requests, so the same view can be asked for again
  const [gizmo, setGizmo] = useState(initial?.gizmo ?? false);
  // Camera controls; an embedded stage enables them on click so the wheel keeps scrolling the page
  const [active, setActive] = useState(initial?.active ?? true);
  const [layer, setLayer] = useState(0);
  const line = useRef<LineData | null>(null);
  const readout = useRef<HTMLElement>(null);
  // Set by the editor; a ref so hovering does not re-render the scene
  const inspect = useRef<((mesh: THREE.Mesh | null, edge?: LineData | null) => void) | null>(null);
  // Set by the model: shows or clears the red measuring line from outside the canvas
  const showEdge = useRef<((edge: LineData | null) => void) | null>(null);
  // Set by the scene: brings a world point to the centre of the view
  const centerOn = useRef<((point: THREE.Vector3) => void) | null>(null);
  const parts = useRef<ReturnType<typeof useParts> | null>(null);

  const setView = (next: SceneView) => {
    setViewName(next);
    setViewTick(t => t + 1);
  };

  // The gizmo's Z looks from the opposite end, but it is still the side view
  const viewOn = (id: SceneView) => (id === 'initial' ? !orthographic : orthographic && (view === id || (id === 'side' && view === 'side-z')));

  // Asking for the orthographic view already on closes it, back to the last perspective view
  const toggleView = (next: SceneView) => {
    const closing = next !== 'initial' && viewOn(next);
    setOrthographic(!closing && next !== 'initial');
    setView(closing ? 'last-3d' : next);
  };

  const setUnit = (next: Unit) => {
    setUnitState(next);
    try {
      localStorage.setItem(UNIT_KEY, next);
    } catch {
      // private mode: the choice just lasts this visit
    }
  };

  const toggleGroup = (id: GroupId) =>
    setHidden(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const shown = (node: THREE.Object3D) =>
    !hidden.has(groupOf(node.name)) && !hiddenParts.has(node.name) && (!column || columnsOf(node).includes(column));

  return {
    grid,
    setGrid,
    wireframe,
    setWireframe,
    orthographic,
    setOrthographic,
    hidden,
    setHidden,
    toggleGroup,
    hiddenParts,
    setHiddenParts,
    grain,
    setGrain,
    unit,
    setUnit,
    hideFronts: hidden.has('fronts'),
    electric: !hidden.has('electric'),
    column,
    setColumn,
    shown,
    layer,
    setLayer,
    line,
    readout,
    inspect,
    showEdge,
    centerOn,
    parts,
    gizmo,
    setGizmo,
    active,
    setActive,
    view,
    setView,
    viewOn,
    toggleView,
    viewTick,
    xr,
    presenting,
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
  active: boolean;
  rememberUnit: boolean;
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
