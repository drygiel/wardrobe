import * as THREE from 'three';
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls } from 'three-stdlib';
import type { Column, GroupId } from '@/components/parts';
import { editorGoal } from '@/components/Scene';
import { type SceneView, type Unit, useApp } from '@/contexts/AppContext';
import { useEventListener } from '@/hooks/useEventListener';
import { createHistory, observe, step } from './history';
import { selection } from './selection';

const POLL_EVERY = 100; // ms
const LANDED_AFTER = 150; // ms the camera has to stand still after a flight; under history's SETTLE, so the landing is not taken for a new step

type Snapshot = {
  key: string;
  wireframe: boolean;
  grain: boolean;
  unit: Unit;
  orthographic: boolean;
  view: SceneView;
  columns: Column[];
  hidden: GroupId[];
  hiddenParts: string[];
  pin: string | null;
  open: string;
  position: number[];
  target: number[];
  zoom: number;
};

const round = (n: number) => +n.toFixed(3);

// Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) for the editor: camera, selection, visibility, doors and settings.
// Mounted inside the canvas, next to ShareLink, because the camera and the controls are only reachable from there.
// `onRestore` runs after a step has been applied, for state the editor keeps next to the scene
export function UndoHistory({ onRestore }: { onRestore: () => void }) {
  const app = useApp();
  const get = useThree(state => state.get);
  const history = useRef(createHistory<Snapshot>());
  const lastPoll = useRef(0);
  const waitingPin = useRef<string | null>(null); // the part may mount only after its group is shown again
  // A step across a change of view flies to that view first; its exact camera is put back once the flight has landed
  const landing = useRef<Snapshot | null>(null);
  const still = useRef({ key: '', since: 0 });

  const read = (): Snapshot | null => {
    const { camera, controls } = get();
    const ortho = Boolean((camera as THREE.OrthographicCamera).isOrthographicCamera);
    if (!controls || ortho !== app.orthographic) return null; // gone in XR, or flying to a preset
    const state = {
      wireframe: app.wireframe,
      grain: app.grain,
      unit: app.unit,
      orthographic: ortho,
      // Every perspective view is the same mode; only the camera tells them apart
      view: ortho ? app.view : 'last-3d',
      columns: [...app.columns].sort(),
      hidden: [...app.hidden].sort(),
      hiddenParts: [...app.hiddenParts].sort(),
      pin: selection.pinned?.name ?? waitingPin.current,
      open: app.parts.current?.openState() ?? '',
      position: camera.position.toArray().map(round),
      target: (controls as unknown as OrbitControls).target.toArray().map(round),
      zoom: round(camera.zoom),
    };
    return { key: JSON.stringify(state), ...state };
  };

  const place = (snapshot: Snapshot) => {
    const { camera, controls, invalidate } = get();
    if (!controls) return;
    const orbit = controls as unknown as OrbitControls;
    camera.position.fromArray(snapshot.position);
    orbit.target.fromArray(snapshot.target);
    camera.zoom = snapshot.zoom;
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  };

  const restore = (snapshot: Snapshot) => {
    app.setWireframe(snapshot.wireframe);
    app.setGrain(snapshot.grain);
    if (snapshot.unit !== app.unit) app.setUnit(snapshot.unit);
    app.setColumns(new Set(snapshot.columns));
    app.setHidden(new Set(snapshot.hidden));
    app.setHiddenParts(new Set(snapshot.hiddenParts));
    if (snapshot.open === 'all') app.parts.current?.openAll();
    else app.parts.current?.openOnly(snapshot.open ? snapshot.open.split(',') : []);

    selection.unpin();
    waitingPin.current = snapshot.pin;

    if (snapshot.orthographic !== app.orthographic || (snapshot.orthographic && snapshot.view !== app.view)) {
      if (!snapshot.orthographic) {
        // The flight out of an orthographic view ends on this preset: aimed at the camera to restore, it lands there
        const goal = editorGoal('last-3d');
        goal.position.fromArray(snapshot.position);
        goal.target.fromArray(snapshot.target);
      }
      app.setOrthographic(snapshot.orthographic);
      app.setView(snapshot.view);
      landing.current = snapshot;
      still.current = { key: '', since: 0 }; // the stillness before the flight does not count
    } else {
      landing.current = null;
      place(snapshot);
    }
    onRestore();
  };

  useFrame(() => {
    const mesh = waitingPin.current && selection.find(waitingPin.current);
    if (mesh) {
      selection.pin(mesh);
      waitingPin.current = null;
    }

    const now = performance.now();
    if (now - lastPoll.current < POLL_EVERY) return;
    lastPoll.current = now;
    let snapshot = read();
    if (!snapshot) return;

    if (snapshot.key !== still.current.key) still.current = { key: snapshot.key, since: now };
    else if (landing.current?.orthographic === snapshot.orthographic && now - still.current.since >= LANDED_AFTER) {
      // An orthographic preset knows nothing of the pan and zoom the view had; put them back
      place(landing.current);
      landing.current = null;
      snapshot = read() ?? snapshot;
    }
    observe(history.current, snapshot, now);
  });

  useEventListener('keydown', event => {
    // A text field keeps its own undo
    if (!(event.ctrlKey || event.metaKey) || event.altKey || (event.target as HTMLElement).matches('input, textarea')) return;
    const key = event.key.toLowerCase();
    const direction = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' ? 'redo' : null;
    if (!direction) return;
    event.preventDefault();
    const snapshot = step(history.current, direction);
    if (snapshot) restore(snapshot);
  });

  return null;
}
