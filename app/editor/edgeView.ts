import * as THREE from 'three';

const STEPS = 16;
const TOLERANCE = 0.0005; // metres: half a millimetre counts as the same line

// The viewer sits on this side of this local axis
export type View = { axis: number; sign: number };
export type Run = { from: number; to: number; hidden: boolean };

const ray = new THREE.Ray();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const hit = new THREE.Vector3();

function isCovered(point: THREE.Vector3, { axis, sign }: View, geometry: THREE.BufferGeometry, sharp: ArrayLike<number>) {
  // Another sharp edge in the same place, nearer to the viewer: a far edge of a box hides behind the near one
  const u = (axis + 1) % 3;
  const w = (axis + 2) % 3;
  const x = point.getComponent(u);
  const y = point.getComponent(w);
  const depth = point.getComponent(axis) * sign;
  for (let i = 0; i < sharp.length; i += 6) {
    const du = sharp[i + 3 + u] - sharp[i + u];
    const dw = sharp[i + 3 + w] - sharp[i + w];
    const length2 = du * du + dw * dw;
    const t = length2 ? Math.min(1, Math.max(0, ((x - sharp[i + u]) * du + (y - sharp[i + w]) * dw) / length2)) : 0;
    if (Math.hypot(x - sharp[i + u] - t * du, y - sharp[i + w] - t * dw) > TOLERANCE) continue;
    if ((sharp[i + axis] + t * (sharp[i + 3 + axis] - sharp[i + axis])) * sign > depth + TOLERANCE) return true;
  }

  // Otherwise a surface between the edge and the viewer
  ray.origin.copy(point);
  ray.direction.set(0, 0, 0).setComponent(axis, sign);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const count = geometry.index ? geometry.index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const index = (n: number) => (geometry.index ? geometry.index.getX(i + n) : i + n);
    a.fromBufferAttribute(position, index(0));
    b.fromBufferAttribute(position, index(1));
    c.fromBufferAttribute(position, index(2));
    if (ray.intersectTriangle(a, b, c, false, hit) && hit.distanceTo(point) > TOLERANCE) return true;
  }
  return false;
}

const SIDE_STEP = 0.0002; // metres: how far to each side of an edge the surface is probed
const contourCache = new WeakMap<THREE.BufferGeometry, number[][]>();

// The outer outline seen along one axis, as flat [x1, y1, z1, x2, y2, z2, …]: triangle edges with empty space on one side
function contourAlong(geometry: THREE.BufferGeometry, axis: number) {
  const u = (axis + 1) % 3;
  const w = (axis + 2) % 3;
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const count = geometry.index ? geometry.index.count : position.count;
  const corner = (i: number) => {
    const v = geometry.index ? geometry.index.getX(i) : i;
    return [position.getX(v), position.getY(v), position.getZ(v)];
  };

  // Only the faces towards the viewer: on a solid part they alone cover its whole projection
  const faces: number[][][] = [];
  for (let i = 0; i < count; i += 3) {
    const [p, q, r] = [corner(i), corner(i + 1), corner(i + 2)];
    if ((q[u] - p[u]) * (r[w] - p[w]) - (q[w] - p[w]) * (r[u] - p[u]) > 1e-12) faces.push([p, q, r]);
  }

  const covered = (x: number, y: number) =>
    faces.some(face => face.every((s, i) => {
      const t = face[(i + 1) % 3];
      return (t[u] - s[u]) * (y - s[w]) - (t[w] - s[w]) * (x - s[u]) >= 0;
    }));

  const key = (v: number[]) => v.map(n => Math.round(n * 1e4)).join();
  const edges = new Map<string, number[]>();
  faces.forEach(face => face.forEach((s, i) => {
    const t = face[(i + 1) % 3];
    edges.set([key(s), key(t)].sort().join('|'), [...s, ...t]);
  }));

  return [...edges.values()].flatMap(edge => {
    const du = edge[3 + u] - edge[u];
    const dw = edge[3 + w] - edge[w];
    const length = Math.hypot(du, dw);
    if (!length) return [];
    const x = (edge[u] + edge[3 + u]) / 2;
    const y = (edge[w] + edge[3 + w]) / 2;
    const nx = (-dw / length) * SIDE_STEP;
    const ny = (du / length) * SIDE_STEP;
    return covered(x + nx, y + ny) && covered(x - nx, y - ny) ? [] : edge;
  });
}

// One outline per local axis, so a notched part is drawn notched instead of as its bounding box
export function contoursOf(geometry: THREE.BufferGeometry) {
  let contours = contourCache.get(geometry);
  if (!contours) {
    contours = [0, 1, 2].map(axis => contourAlong(geometry, axis));
    contourCache.set(geometry, contours);
  }
  return contours;
}

// Splits an edge into stretches the viewer sees and stretches lying under something else
export function edgeRuns(geometry: THREE.BufferGeometry, [p, q]: readonly [THREE.Vector3, THREE.Vector3], view: View, sharp: ArrayLike<number>): Run[] {
  const runs: Run[] = [];
  const point = new THREE.Vector3();
  for (let i = 0; i < STEPS; i++) {
    const hidden = isCovered(point.lerpVectors(p, q, (i + 0.5) / STEPS), view, geometry, sharp);
    const last = runs[runs.length - 1];
    if (last?.hidden === hidden) last.to = (i + 1) / STEPS;
    else runs.push({ from: i / STEPS, to: (i + 1) / STEPS, hidden });
  }
  return runs;
}
