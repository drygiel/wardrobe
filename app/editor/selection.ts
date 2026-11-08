import type * as THREE from 'three';
import { useSyncExternalStore } from 'react';
import type { LineData } from '@/components/Mesh';

type Selection = { hover: THREE.Mesh | null; pinned: THREE.Mesh | null; edge: LineData | null }; // edge: the red one, on any part

// Outside React context: hovering must re-render the inspector only, not the whole scene
let state: Selection = { hover: null, pinned: null, edge: null };
const listeners = new Set<() => void>();

// Hover brightens a part, unless it is the selected one
const lit = ({ hover, pinned }: Selection) => (hover === pinned ? null : hover);

const focusOf = (object: THREE.Object3D) => {
  if (!state.pinned) return 'none';
  if (object === state.pinned) return 'selected';
  return object === state.hover ? 'hover' : 'dim';
};

const applyFocus = () => selection.root?.traverse(object => object.userData.focus?.(focusOf(object)));

const update = (next: Partial<Selection>) => {
  const before = state;
  state = { ...state, ...next };
  if (lit(before) !== lit(state)) {
    lit(before)?.userData.highlight?.(false);
    lit(state)?.userData.highlight?.(true);
  }
  if (before.pinned !== state.pinned) applyFocus();
  else if (state.pinned && before.hover !== state.hover) {
    [before.hover, state.hover].forEach(mesh => mesh?.userData.focus?.(focusOf(mesh))); // hover must not walk the whole scene
  }
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSelection = () => useSyncExternalStore(subscribe, () => state);

export const selection = {
  root: null as THREE.Object3D | null,
  find(name: string) {
    return (selection.root?.getObjectByName(name) as THREE.Mesh | undefined) ?? null;
  },
  hover(mesh: THREE.Mesh | null, edge: LineData | null = null) {
    if (state.hover !== mesh || state.edge !== edge) update({ hover: mesh, edge });
  },
  // A click: pins what is under the cursor; on empty space or the pinned part again it unpins
  pin(mesh = state.hover) {
    update({ pinned: mesh === state.pinned ? null : mesh });
  },
  unpin() {
    update({ pinned: null });
  },
  // For parts that mount while something is selected
  refocus: applyFocus,
};
