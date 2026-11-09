import * as THREE from 'three';
import { useSyncExternalStore } from 'react';
import type { LineData } from '@/components/Mesh';

type Selection = {
  hover: THREE.Mesh | null;
  group: readonly THREE.Mesh[]; // every part of the folder under the cursor in the list
  pinned: THREE.Mesh | null;
  edge: LineData | null; // the red one, on any part
};

// Outside React context: hovering must re-render the inspector only, not the whole scene
let state: Selection = { hover: null, group: [], pinned: null, edge: null };
const listeners = new Set<() => void>();

// Hover brightens a part, unless it is the selected one
const lit = ({ hover, group, pinned }: Selection) => new Set([hover, ...group].filter(mesh => mesh && mesh !== pinned));

const focusOf = (object: THREE.Object3D) => {
  if (!state.pinned) return 'none';
  if (object === state.pinned) return 'selected';
  return object === state.hover || state.group.includes(object as THREE.Mesh) ? 'hover' : 'dim';
};

const applyFocus = () => selection.root?.traverse(object => object.userData.focus?.(focusOf(object)));

const update = (next: Partial<Selection>) => {
  const before = state;
  state = { ...state, ...next };
  const litBefore = lit(before);
  const litNow = lit(state);
  litBefore.forEach(mesh => litNow.has(mesh) || mesh?.userData.highlight?.(false));
  litNow.forEach(mesh => litBefore.has(mesh) || mesh?.userData.highlight?.(true));
  if (before.pinned !== state.pinned) applyFocus();
  else if (state.pinned && (before.hover !== state.hover || before.group !== state.group)) {
    new Set([before.hover, state.hover, ...before.group, ...state.group]).forEach(mesh => mesh?.userData.focus?.(focusOf(mesh))); // hover must not walk the whole scene
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
  get pinned() {
    return state.pinned;
  },
  find(name: string) {
    return (selection.root?.getObjectByName(name) as THREE.Mesh | undefined) ?? null;
  },
  // World centre of the selected part, else of the one under the cursor
  orbitCenter() {
    const mesh = state.pinned ?? state.hover;
    if (!mesh) return null;
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  },
  hover(mesh: THREE.Mesh | null, edge: LineData | null = null) {
    if (state.hover !== mesh || state.edge !== edge) update({ hover: mesh, edge });
  },
  // Brightens a whole folder of the list; selects nothing and leaves the inspector alone
  hoverGroup(names: string[]) {
    if (names.length || state.group.length) update({ group: names.flatMap(name => selection.find(name) ?? []) });
  },
  setEdge(edge: LineData | null) {
    if (state.edge !== edge) update({ edge });
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
