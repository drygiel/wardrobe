import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { OrbitControls } from 'three-stdlib';
import { type Column, COLUMN_NAMES, type GroupId, GROUPS, HIDDEN_GROUPS } from '@/components/parts';
import { editorGoal, fitZoom } from '@/components/Scene';
import { type SceneView, useApp } from '@/contexts/AppContext';
import { useCatalog } from './catalog';
import { selection } from './selection';

const WRITE_EVERY = 400; // ms; Safari throws on more than 100 history changes in 30 s
const ORTHO_VIEWS: SceneView[] = ['front', 'side', 'side-z', 'top'];
const DEFAULT_HIDDEN = [...HIDDEN_GROUPS, 'fronts'].sort().join();

const list = (value: string | null) => (value === null ? undefined : value.split(',').filter(Boolean));

const vector = (value: string | null) => {
  const numbers = value?.split(',').map(Number);
  return numbers?.length === 3 && numbers.every(Number.isFinite) ? new THREE.Vector3(...numbers) : undefined;
};

const round = (n: number) => +n.toFixed(3);

// The address is untrusted: anything malformed reads as the default
export function readLink() {
  const query = new URLSearchParams(location.search);
  const zoom = Number(query.get('zoom'));
  const hide = list(query.get('hide'));
  const columns = list(query.get('col'));
  return {
    view: ORTHO_VIEWS.find(view => view === query.get('view')),
    position: vector(query.get('pos')),
    target: vector(query.get('target')),
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : undefined,
    wireframe: query.get('mode') !== 'render',
    grain: query.has('grain'),
    columns: columns?.length && columns.every(id => COLUMN_NAMES.includes(id as Column)) ? (columns as Column[]) : undefined,
    hidden: hide?.every(id => GROUPS.some(group => group.id === id)) ? (hide as GroupId[]) : undefined,
    off: list(query.get('off')),
    only: list(query.get('only')),
    pin: query.get('pin'),
    open: query.get('open'),
  };
}

// Mounts once the model is there: applies the address, then keeps it in step with the scene.
// Polled, because the camera, the selection and the door springs all live outside React state.
export function ShareLink() {
  const app = useApp();
  const catalog = useCatalog();
  const lastWrite = useRef(0);
  const waitingPin = useRef<string | null>(null); // the part may mount only after its group is shown

  useEffect(() => {
    lastWrite.current = performance.now(); // lets the state set below land before the first write
    const link = readLink();
    if (link.grain) app.setGrain(true);
    if (link.columns) app.setColumns(new Set(link.columns));
    if (link.hidden) app.setHidden(new Set(link.hidden));
    const hidden = new Set(link.hidden ?? [...HIDDEN_GROUPS, 'fronts']);
    if (link.off) app.setHiddenParts(new Set(link.off));
    else if (link.only) app.setHiddenParts(new Set(catalog.parts.filter(p => !hidden.has(p.group) && !link.only!.includes(p.name)).map(p => p.name)));
    if (link.open === 'all') app.parts.current?.openAll();
    else if (link.open) app.parts.current?.openOnly(link.open.split(','));
    waitingPin.current = link.pin && catalog.byName.has(link.pin) ? link.pin : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ camera, controls, size }) => {
    const mesh = waitingPin.current && selection.find(waitingPin.current);
    if (mesh) {
      selection.unpin();
      selection.pin(mesh);
      waitingPin.current = null;
    }

    const now = performance.now();
    if (now - lastWrite.current < WRITE_EVERY) return;
    lastWrite.current = now;

    const ortho = Boolean((camera as THREE.OrthographicCamera).isOrthographicCamera);
    if (!controls || ortho !== app.orthographic) return; // gone in XR, or flying to a preset

    const next = new URLSearchParams(location.search);
    const set = (key: string, value: string | null) => (value === null ? next.delete(key) : next.set(key, value));
    const unlessEqual = (value: THREE.Vector3, preset: THREE.Vector3) => {
      const text = value.toArray().map(round).join();
      return text === preset.toArray().map(round).join() ? null : text;
    };

    const preset = editorGoal(ortho ? app.view : 'initial');
    const { target } = controls as unknown as OrbitControls;
    // Per metre of frustum, so the same picture comes out whatever frustum the other side's camera was given
    const zoom = ortho ? camera.zoom / (camera as THREE.OrthographicCamera).top : 0;
    const shown = catalog.parts.filter(p => !app.hidden.has(p.group) && !app.hiddenParts.has(p.name)).map(p => p.name);
    const hiddenParts = [...app.hiddenParts];
    const useOnly = hiddenParts.length > 0 && shown.length < hiddenParts.length; // "show only this" would otherwise list the whole model
    const hide = [...app.hidden].sort().join();

    set('view', ortho ? app.view : null);
    set('pos', unlessEqual(camera.position, preset.position));
    set('target', unlessEqual(target, preset.target));
    set('zoom', ortho && Math.abs(zoom - fitZoom(app.view, size.width / size.height)) > 0.002 ? String(round(zoom)) : null);
    set('mode', app.wireframe ? null : 'render');
    set('grain', app.grain ? '1' : null);
    set('col', COLUMN_NAMES.filter(id => app.columns.has(id)).join() || null);
    set('hide', hide === DEFAULT_HIDDEN ? null : hide);
    set('off', hiddenParts.length && !useOnly ? hiddenParts.join() : null);
    set('only', useOnly ? shown.join() : null);
    set('pin', selection.pinned?.name ?? waitingPin.current);
    set('open', app.parts.current?.openState() || null);

    const query = next.toString().replaceAll('%2C', ',');
    if (query !== location.search.slice(1)) {
      // Past the router on purpose: its navigation would re-render the route on every camera move
      history.replaceState(history.state, '', `${location.pathname}${query && `?${query}`}${location.hash}`);
    }
  });

  return null;
}
