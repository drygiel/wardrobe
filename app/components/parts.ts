import * as THREE from 'three';
import { type RefObject, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export type Kind = 'front' | 'handle' | 'led' | 'drawer' | 'support' | 'shelf' | 'aShelf' | 'aSide' | 'back' | 'frame';

// Part kind from its Szafa4.blend object name
export const kindOf = (name: string): Kind => {
  if (/(Back|Side)Panel$/.test(name)) return 'back';
  if (name.startsWith('LED_')) return 'led';
  if (name.endsWith('_Handle')) return 'handle';
  if (/^F\d\d_/.test(name)) return 'front';
  if (name.startsWith('DR_')) return 'drawer';
  if (/^IN_.*(Side|Divider|Strip)/.test(name)) return 'support';
  if (name === 'A_Carcass') return 'aSide';
  if (name.startsWith('A_')) return 'aShelf';
  if (/^P\d\d_/.test(name)) return 'frame';
  return 'shelf';
};

// How much of the rest of the wardrobe stays visible around a selected part
export const DIMMED_OPACITY = 0.18;
export const HOVERED_OPACITY = 0.35; // a dimmed part under the cursor

export const GROUPS = [
  { id: 'frame', label: 'Rama' },
  { id: 'interior', label: 'Półki i przegrody' },
  { id: 'drawers', label: 'Szuflady' },
  { id: 'fronts', label: 'Fronty' },
  { id: 'back', label: 'Plecy i panel boczny' },
  { id: 'led', label: 'Taśmy LED' },
  { id: 'dowels', label: 'Kołki' },
  { id: 'hinges', label: 'Zawiasy' },
  { id: 'pins', label: 'Podpórki półek' },
  { id: 'blocks', label: 'Klocki montażowe' },
  { id: 'electric', label: 'Elektryka' },
] as const;
export type GroupId = (typeof GROUPS)[number]['id'];

// Off until switched on, on every page
export const HIDDEN_GROUPS: GroupId[] = ['dowels', 'hinges', 'blocks', 'electric'];

export const groupOf = (name: string): GroupId => {
  // Before kindOf: the cables are named LED_Wire*
  if (/^(LED_Wire|Dimmer|Bus_|PSU|Plug|Switch|Mains|Feed|Door_|Socket$|Wire$)/.test(name)) return 'electric';
  if (/^J\d\d_/.test(name)) return 'dowels';
  if (/^H\d\d_/.test(name)) return 'hinges';
  if (name.startsWith('PIN_')) return 'pins';
  if (/^MB\d_/.test(name)) return 'blocks';
  const kind = kindOf(name);
  if (kind === 'front' || kind === 'handle') return 'fronts';
  if (kind === 'drawer') return 'drawers';
  if (kind === 'led' || kind === 'back' || kind === 'frame') return kind;
  return 'interior';
};

// Columns ("słupki") along model z, front view left to right; dividers taken at their centres
export const COLUMNS = { A: [-2.688, -2.28], B: [-2.28, -1.054], C: [-1.054, -0.694], D: [-0.694, 0] } as const;
export type Column = keyof typeof COLUMNS;
export const COLUMN_NAMES = Object.keys(COLUMNS) as Column[];
const DOOR_COLUMN: Record<string, Column> = { F01: 'B', F02: 'B', F03: 'B', F04: 'B', F05: 'C', F06: 'D', F07: 'D' };

const columnCache = new WeakMap<THREE.Object3D, Column[]>();

// The object name decides when it says; otherwise the columns its closed glTF pose overlaps
export function columnsOf(node: THREE.Object3D): Column[] {
  const cached = columnCache.get(node);
  if (cached) return cached;
  const tag = /^(?:[PF]\d\d|IN|DR|LED|MB\d|PIN)_([ABCD])_/.exec(node.name)?.[1] ?? (node.name.startsWith('A_') ? 'A' : undefined);
  const door = DOOR_COLUMN[/F\d\d/.exec(node.name)?.[0] ?? ''];
  let columns: Column[];
  if (tag) columns = [tag as Column];
  else if (door) columns = [door];
  else {
    node.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(node);
    const need = Math.min(0.005, (box.max.z - box.min.z) / 2);
    columns = COLUMN_NAMES.filter(c => Math.min(COLUMNS[c][1], box.max.z) - Math.max(COLUMNS[c][0], box.min.z) >= need);
  }
  columnCache.set(node, columns);
  return columns;
}

// Door mesh to its clip: hinged doors swing on their F0x_Pivot, the section A door rotates itself
export const DOORS: Record<string, string> = {
  'F01_B_Door-Bottom-L': 'Hinge.Pivot.B.BLAction',
  'F02_B_Door-Bottom-R': 'Hinge.Pivot.B.BRAction',
  'F03_B_Door-Top-L': 'Hinge.Pivot.B.TLAction',
  'F04_B_Door-Top-R': 'Hinge.Pivot.B.TRAction',
  'F05_C_Door-Bottom': 'Hinge.Pivot.C.BAction',
  'F06_D_Door-Bottom': 'Hinge.Pivot.D.BAction',
  'F07_D_Door-Top': 'Hinge.Pivot.D.TAction',
  'F09_A_Door': 'OpenBShelve',
};

// Damping ratio ~0.6 lets a door swing a little past open and settle back; drawers are critically damped.
// Speed scales with sqrt(stiffness): twice as fast is 4x stiffness and 2x damping, same damping ratio.
const DOOR = { stiffness: 144, damping: 14.4 };
const DRAWER = { stiffness: 160, damping: 25.2 };
const OPEN = 0.95; // a door counts as open for its drawers from here

// Group around a drawer that slides it out
export const slideName = (drawer: string) => `${drawer}_Slide`;

type Spring = { t: number; v: number; target: number; stiffness: number; damping: number; apply: (t: number) => void };

// Doors and drawers move on springs from 0 (closed) to 1 (open). A click flips the target only, so a part reverses
// from wherever it is instead of jumping. Drawers move once every door in front of them is open, and a closing door
// takes its drawers in first and waits for them.
// `root` holds the rendered parts with the glTF names, each drawer wrapped in a slideName() group; `scene` is the glTF scene.
export function useParts(root: RefObject<THREE.Object3D | null>, scene: THREE.Object3D, clips: THREE.AnimationClip[], frontsHidden = false) {
  const invalidate = useThree(s => s.invalidate);
  const state = useRef<{ springs: Map<string, Spring>; covers: Map<string, string[]> } | null>(null);

  const get = () => {
    if (state.current || !root.current) return state.current;
    const live = root.current;
    const springs = new Map<string, Spring>();
    const covers = new Map<string, string[]>();
    scene.updateMatrixWorld(true);

    Object.entries(DOORS).forEach(([door, clip]) => {
      const track = clips.find(c => c.name === clip)?.tracks.find(t => t.name.endsWith('.quaternion'));
      const target = track && live.getObjectByName(THREE.PropertyBinding.parseTrackName(track.name).nodeName);
      if (!track || !target) return;
      const closed = new THREE.Quaternion().fromArray(track.values, 0);
      const open = new THREE.Quaternion().fromArray(track.values, track.values.length - 4);
      springs.set(door, { t: 0, v: 0, target: 0, ...DOOR, apply: t => target.quaternion.slerpQuaternions(closed, open, t) });
    });

    // Doors in front of a drawer: their closed boxes overlap its front, seen along the model's depth (x)
    const doorBoxes = [...springs.keys()].map(name => ({ name, box: new THREE.Box3().setFromObject(scene.getObjectByName(name)!) }));
    scene.traverse(node => {
      const slide = kindOf(node.name) === 'drawer' && (node as THREE.Mesh).isMesh && live.getObjectByName(slideName(node.name));
      if (!slide) return;
      const box = new THREE.Box3().setFromObject(node);
      const out = (box.max.x - box.min.x) * 0.7; // scripts/bake.py bakes each drawer slid out this far (SLIDE)
      springs.set(node.name, { t: 0, v: 0, target: 0, ...DRAWER, apply: t => slide.position.setX(-out * t) });
      const e = 0.01;
      covers.set(
        node.name,
        doorBoxes
          .filter(({ box: d }) => d.min.y < box.max.y - e && d.max.y > box.min.y + e && d.min.z < box.max.z - e && d.max.z > box.min.z + e)
          .map(d => d.name),
      );
    });
    return (state.current = { springs, covers });
  };

  useFrame((_, delta) => {
    const s = get();
    if (!s) return;
    const dt = Math.min(delta, 1 / 30);
    let moving = false;
    s.springs.forEach((sp, name) => {
      // A closing door waits until its drawers are in
      const waiting = sp.target === 0 && [...s.covers].some(([drawer, doors]) => doors.includes(name) && s.springs.get(drawer)!.t > 0.02);
      if (waiting) {
        sp.v = 0;
        moving = true;
        return;
      }
      if (sp.t === sp.target && sp.v === 0) return;
      sp.v += (sp.stiffness * (sp.target - sp.t) - sp.damping * sp.v) * dt;
      sp.t += sp.v * dt;
      if (sp.t < 0) {
        // The carcass stops a closing part; it bounces back a little
        sp.t *= -0.3;
        sp.v *= -0.3;
      }
      if (Math.abs(sp.target - sp.t) < 1e-4 && Math.abs(sp.v) < 1e-3) {
        sp.t = sp.target;
        sp.v = 0;
      } else {
        moving = true;
      }
      sp.apply(sp.t);
    });
    if (moving) invalidate();
  });

  // Flips a door or drawer; false when the name is not a moving part or a drawer is still behind a closed door
  const toggle = (name: string) => {
    const s = get();
    const sp = s?.springs.get(name);
    if (!s || !sp) return false;
    const blocked = !frontsHidden && (s.covers.get(name) ?? []).some(door => {
      const d = s.springs.get(door)!;
      return d.target === 0 || d.t < OPEN;
    });
    if (blocked) return false;
    sp.target = sp.target ? 0 : 1;
    if (sp.target === 0) s.covers.forEach((doors, drawer) => doors.includes(name) && (s.springs.get(drawer)!.target = 0));
    invalidate();
    return true;
  };

  const closeAll = () => {
    let changed = false;
    get()?.springs.forEach(sp => {
      changed ||= sp.target !== 0;
      sp.target = 0;
    });
    if (changed) invalidate();
  };

  const openAll = () => {
    get()?.springs.forEach(sp => (sp.target = 1));
    invalidate();
  };

  const openOnly = (names: string[]) => {
    get()?.springs.forEach((sp, name) => (sp.target = names.includes(name) ? 1 : 0));
    invalidate();
  };

  // For the share link: "all", the names set to open, or empty when everything is closed
  const openState = () => {
    const springs = [...(get()?.springs ?? [])];
    const open = springs.filter(([, sp]) => sp.target).map(([name]) => name);
    return open.length && open.length === springs.length ? 'all' : open.join();
  };

  return { toggle, closeAll, openAll, openOnly, openState };
}
