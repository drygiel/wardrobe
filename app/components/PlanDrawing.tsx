import * as THREE from 'three';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { FRAME_BOARDS, FRAME_GLB, FRAME_PIECES, flatPiece, WARDROBE_GLB } from '@/assets';
import { kindOf } from './Wardrobe';

export type PlanView = 'front' | 'side' | 'top' | 'A' | 'B' | 'C' | 'D' | 'cut';

type Box = { name: string; min: THREE.Vector3; max: THREE.Vector3 };

// Sections along model z (front view left to right); dividers taken at their centres
const SECTIONS = { A: [-2.688, -2.28], B: [-2.28, -1.054], C: [-1.054, -0.694], D: [-0.694, 0] } as const;
const isLed = (n: string) => kindOf(n) === 'led';
const isFront = (n: string) => kindOf(n) === 'front' || kindOf(n) === 'handle';
const isBoard = (n: string) => (FRAME_BOARDS as readonly string[]).includes(n);
const mm = (m: number) => Math.round(m * 1000);

function boxes(scene: THREE.Object3D, names?: readonly string[]) {
  scene.updateMatrixWorld(true);
  const list: Box[] = [];
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (names && !names.includes(mesh.name))) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    list.push({ name: mesh.name, min: box.min, max: box.max });
  });
  return list;
}

type Rect = { x: number; y: number; w: number; h: number; cls: string; title: string };
type Dim = { x1: number; y1: number; x2: number; y2: number; label: string; side: 'above' | 'below' | 'right' };

// Front, side and top projections drawn from the model's own bounding boxes, in millimetres
export function PlanDrawing({ view }: { view: PlanView }) {
  const wardrobe = useGLTF(WARDROBE_GLB);
  const frame = useGLTF(FRAME_GLB);

  const data = useMemo(() => {
    const parts = [...boxes(wardrobe.scene).filter(b => kindOf(b.name) !== 'back'), ...boxes(frame.scene, FRAME_PIECES)];
    // Boards first so the pieces are drawn on top of them
    const plan = boxes(frame.scene, [...FRAME_BOARDS, ...FRAME_PIECES.map(flatPiece)]).sort(
      (a, b) => Number(isBoard(b.name)) - Number(isBoard(a.name)),
    );
    return { parts, plan };
  }, [wardrobe, frame]);

  const { rects, dims, width, height } = useMemo(() => {
    const rects: Rect[] = [];
    const dims: Dim[] = [];
    const all = new THREE.Box3();
    data.parts.forEach(p => all.union(new THREE.Box3(p.min, p.max)));

    const cls = (name: string, z: number) => {
      if (isLed(name)) return 'led';
      if (view in SECTIONS) {
        const [a, b] = SECTIONS[view as keyof typeof SECTIONS];
        return z > a - 0.001 && z < b + 0.001 ? 'part' : 'dim';
      }
      return 'part';
    };

    if (view === 'cut') {
      const cut = new THREE.Box3();
      data.plan.forEach(p => cut.union(new THREE.Box3(p.min, p.max)));
      data.plan.forEach(p =>
        rects.push({
          x: mm(p.min.x - cut.min.x),
          y: mm(p.min.z - cut.min.z),
          w: mm(p.max.x - p.min.x),
          h: mm(p.max.z - p.min.z),
          cls: isBoard(p.name) ? 'board' : 'part',
          title: p.name,
        }),
      );
      const board = data.plan.find(p => isBoard(p.name))!;
      const bw = mm(board.max.x - board.min.x);
      const bh = mm(board.max.z - board.min.z);
      const by = mm(board.min.z - cut.min.z);
      dims.push({ x1: mm(board.min.x - cut.min.x), y1: -1, x2: mm(board.min.x - cut.min.x) + bw, y2: -1, label: `${bw}`, side: 'above' });
      dims.push({ x1: mm(cut.max.x - cut.min.x), y1: by, x2: mm(cut.max.x - cut.min.x), y2: by + bh, label: `${bh}`, side: 'right' });
      return { rects, dims, width: mm(cut.max.x - cut.min.x), height: mm(cut.max.z - cut.min.z) };
    }

    if (view === 'side') {
      // From the D end: depth to the right, front on the left
      data.parts.forEach(p =>
        rects.push({ x: mm(p.min.x - all.min.x), y: mm(all.max.y - p.max.y), w: mm(p.max.x - p.min.x), h: mm(p.max.y - p.min.y), cls: cls(p.name, 0), title: p.name }),
      );
      const w = mm(all.max.x - all.min.x);
      const h = mm(all.max.y - all.min.y);
      dims.push({ x1: 0, y1: h, x2: w, y2: h, label: `${w}`, side: 'below' });
      dims.push({ x1: w, y1: 0, x2: w, y2: h, label: `${h}`, side: 'right' });
      return { rects, dims, width: w, height: h };
    }

    if (view === 'top') {
      // From above: width to the right, front at the bottom
      data.parts.forEach(p =>
        rects.push({ x: mm(p.min.z - all.min.z), y: mm(all.max.x - p.max.x), w: mm(p.max.z - p.min.z), h: mm(p.max.x - p.min.x), cls: cls(p.name, 0), title: p.name }),
      );
      const w = mm(all.max.z - all.min.z);
      const h = mm(all.max.x - all.min.x);
      dims.push({ x1: 0, y1: h, x2: w, y2: h, label: `${w}`, side: 'below' });
      dims.push({ x1: w, y1: 0, x2: w, y2: h, label: `${h}`, side: 'right' });
      return { rects, dims, width: w, height: h };
    }

    // Front view without the fronts; a section view dims everything outside it
    data.parts
      .filter(p => !isFront(p.name))
      .forEach(p => {
        const zc = (p.min.z + p.max.z) / 2;
        rects.push({ x: mm(p.min.z - all.min.z), y: mm(all.max.y - p.max.y), w: mm(p.max.z - p.min.z), h: mm(p.max.y - p.min.y), cls: cls(p.name, zc), title: p.name });
      });
    const w = mm(all.max.z - all.min.z);
    const h = mm(all.max.y - all.min.y);
    Object.entries(SECTIONS).forEach(([name, [a, b]]) => {
      if (view in SECTIONS && view !== name) return;
      dims.push({ x1: mm(a - all.min.z), y1: 0, x2: mm(b - all.min.z), y2: 0, label: `${name} · ${mm(b - a)}`, side: 'above' });
    });
    dims.push({ x1: 0, y1: h, x2: w, y2: h, label: `${w}`, side: 'below' });
    dims.push({ x1: w, y1: 0, x2: w, y2: h, label: `${h}`, side: 'right' });
    return { rects, dims, width: w, height: h };
  }, [data, view]);

  const off = 140;
  const pad = 380;
  const tick = (x: number, y: number) => `M${x - 25} ${y + 25}L${x + 25} ${y - 25}`;

  return (
    <svg
      className="plan"
      viewBox={`${-pad / 2} ${-pad} ${width + pad * 1.4} ${height + pad * 1.8}`}
      role="img"
      aria-label="Rysunek techniczny, wymiary w milimetrach"
    >
      {rects.map((r, i) => (
        <rect key={i} className={r.cls} x={r.x} y={r.y} width={Math.max(r.w, 6)} height={Math.max(r.h, 6)}>
          <title>{r.title}</title>
        </rect>
      ))}
      {dims.map((d, i) => {
        const horizontal = d.side !== 'right';
        const o = d.side === 'above' ? -off : off;
        const x1 = horizontal ? d.x1 : d.x1 + off;
        const x2 = horizontal ? d.x2 : d.x2 + off;
        const y1 = horizontal ? d.y1 + o : d.y1;
        const y2 = horizontal ? d.y2 + o : d.y2;
        const tx = horizontal ? (x1 + x2) / 2 : x1 + 70;
        const ty = horizontal ? y1 + (d.side === 'above' ? -45 : 120) : (y1 + y2) / 2;
        return (
          <g key={i} className="dim">
            <path d={`M${x1} ${y1}L${x2} ${y2}${tick(x1, y1)}${tick(x2, y2)}`} />
            <text x={tx} y={ty} transform={horizontal ? undefined : `rotate(-90 ${tx} ${ty})`}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
