import * as THREE from 'three';
import table from './grain.json';

// Written by scripts/export.py: part name to {normal axis: grain axis}, in the mesh's own axes
const GRAIN = table as Record<string, Record<string, string>>;
const AXES = 'xyz';

export const sizeOf = (geometry: THREE.BufferGeometry) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getSize(new THREE.Vector3()).toArray();
};

// 0.15 for small parts up to 1 for a 1 m² board (sides in metres): grain marks shrink with the part
export const markScale = (a: number, b: number) => Math.min(1, Math.max(0.15, Math.sqrt(a * b)));

// The normal of a part's main face: its thinnest axis
const mainNormal = (size: number[]) => size.indexOf(Math.min(...size));

// Axes of a part's drawing: left to right, bottom to top, into the sheet.
// The grain runs left to right, as on a cutting list; without one the longest side does.
export function sheetAxes(size: number[], grain?: number): [number, number, number] {
  const byLength = [0, 1, 2].sort((p, q) => size[q] - size[p]) as [number, number, number];
  const thin = byLength[2];
  return grain === undefined || grain === thin ? byLength : [grain, 3 - grain - thin, thin];
}

// Grain axis on the main face; '?' when the model does not settle it, null for parts without wood
export function grainAxis(name: string, geometry: THREE.BufferGeometry): number | '?' | null {
  const faces = GRAIN[name];
  if (!faces) return null;
  const normal = mainNormal(sizeOf(geometry));
  const axis = AXES.indexOf(faces[AXES[normal]] ?? '?');
  return axis < 0 || axis === normal ? '?' : axis;
}

const area = new THREE.Triangle();

// Line segments along the grain on the outer faces of a part; drawers and carcasses get one hatch per side
export function grainHatch(name: string, geometry: THREE.BufferGeometry): Float32Array | null {
  const faces = GRAIN[name];
  if (!faces) return null;
  const size = sizeOf(geometry);
  const min = geometry.boundingBox!.min.toArray();
  const max = geometry.boundingBox!.max.toArray();

  // How much of each bounding plane is real surface: a drawer's open top has almost none
  const planeArea = [[0, 0], [0, 0], [0, 0]];
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const count = geometry.index ? geometry.index.count : position.count;
  const vertex = (i: number) => new THREE.Vector3().fromBufferAttribute(position, geometry.index ? geometry.index.getX(i) : i);
  for (let i = 0; i < count; i += 3) {
    area.set(vertex(i), vertex(i + 1), vertex(i + 2));
    for (let n = 0; n < 3; n++) {
      [min[n], max[n]].forEach((plane, side) => {
        if ([area.a, area.b, area.c].every(p => Math.abs(p.getComponent(n) - plane) < 0.0005)) planeArea[n][side] += area.getArea();
      });
    }
  }

  const main = mainNormal(size);
  const out: number[] = [];
  for (let n = 0; n < 3; n++) {
    const u = AXES.indexOf(faces[AXES[n]] ?? '?');
    if (u < 0 || u === n) continue;
    const v = 3 - n - u;
    if (n !== main && Math.min(size[u], size[v]) <= 0.05) continue; // board edges stay clean
    [min[n] - 0.0008, max[n] + 0.0008].forEach((plane, side) => {
      if (planeArea[n][side] < 0.3 * size[u] * size[v]) return;
      const scale = markScale(size[u], size[v]);
      const spread = (0.35 + 0.55 * scale) * size[v];
      const reach = (0.25 + 0.5 * scale) * size[u];
      const lines = Math.min(10, Math.max(1, Math.round(spread / 0.06)));
      for (let i = 0; i < lines; i++) {
        const half = reach * (i % 2 ? 0.5 : 0.42); // staggered ends read as grain, not as a grid
        const from = [0, 0, 0];
        from[n] = plane;
        from[v] = (min[v] + max[v]) / 2 + ((i + 0.5) / lines - 0.5) * spread;
        const to = [...from];
        from[u] = (min[u] + max[u]) / 2 - half;
        to[u] = (min[u] + max[u]) / 2 + half;
        out.push(...from, ...to);
      }
    });
  }
  return out.length ? new Float32Array(out) : null;
}
