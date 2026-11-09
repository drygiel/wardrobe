import type { LineData } from '@/components/Mesh';
import * as THREE from 'three';

// On the floor, in the XR reference space. Yaw turns the model around +y; its doors face local +x
export type Pose = { x: number; z: number; yaw: number };
// The model's closed outline, in its own coordinates
export type Footprint = { cx: number; cz: number; minY: number; halfX: number; halfZ: number };
export type Wall = { ax: number; az: number; bx: number; bz: number };
export type SnapStatus = 'free' | 'wall' | 'corner';

const REACH = 0.25; // metres from a wall at which the wardrobe jumps to it
const MAX_TURN = (20 * Math.PI) / 180;
const EDGE_REACH = 0.04;

// The pointer events and the raycaster alike hit invisible objects
export const isShown = (object: THREE.Object3D | null): boolean => !object || (object.visible && isShown(object.parent));

export const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

// The yaw that points the doors along (x, z)
export const yawFacing = (x: number, z: number) => Math.atan2(-z, x);

// Half the footprint's size along a horizontal direction
const extentAlong = (yaw: number, foot: Footprint, nx: number, nz: number) =>
  foot.halfX * Math.abs(Math.cos(yaw) * nx - Math.sin(yaw) * nz) + foot.halfZ * Math.abs(Math.sin(yaw) * nx + Math.cos(yaw) * nz);

// Backs the wardrobe onto the nearest wall, then slides it along that wall into a corner.
// `inside` is any point in the room (the viewer), since plane normals are not reliable about which way is in.
export function snapToWalls(raw: Pose, foot: Footprint, walls: Wall[], inside: { x: number; z: number }): { pose: Pose; status: SnapStatus } {
  const lines = walls.flatMap(({ ax, az, bx, bz }) => {
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 0.1) return [];
    const dx = (bx - ax) / length;
    const dz = (bz - az) / length;
    const flip = (inside.x - ax) * -dz + (inside.z - az) * dx < 0 ? -1 : 1;
    return [{ ax, az, dx, dz, length, nx: -dz * flip, nz: dx * flip }];
  });

  let back: { line: (typeof lines)[number]; gap: number; turn: number } | null = null;
  for (const line of lines) {
    const along = (raw.x - line.ax) * line.dx + (raw.z - line.az) * line.dz;
    if (along < -foot.halfZ - 0.5 || along > line.length + foot.halfZ + 0.5) continue;
    const turn = wrapAngle(yawFacing(line.nx, line.nz) - raw.yaw);
    const gap = (raw.x - line.ax) * line.nx + (raw.z - line.az) * line.nz - foot.halfX;
    if (Math.abs(turn) <= MAX_TURN && Math.abs(gap) < REACH && (!back || Math.abs(gap) < Math.abs(back.gap))) back = { line, gap, turn };
  }
  if (!back) return { pose: raw, status: 'free' };

  const yaw = raw.yaw + back.turn;
  let x = raw.x - back.line.nx * back.gap;
  let z = raw.z - back.line.nz * back.gap;

  let side = 0;
  let cornered = false;
  for (const line of lines) {
    const facing = back.line.nx * line.nx + back.line.nz * line.nz;
    const slideRate = back.line.dx * line.nx + back.line.dz * line.nz;
    if (line === back.line || Math.abs(facing) > Math.sin(MAX_TURN)) continue;
    const gap = (x - line.ax) * line.nx + (z - line.az) * line.nz - extentAlong(yaw, foot, line.nx, line.nz);
    if (Math.abs(gap) < REACH && (!cornered || Math.abs(gap / slideRate) < Math.abs(side))) {
      side = gap / slideRate;
      cornered = true;
    }
  }
  x -= back.line.dx * side;
  z -= back.line.dz * side;

  return { pose: { x, z, yaw }, status: cornered ? 'corner' : 'wall' };
}

// A detected wall as a floor segment; `points` and `normal` in reference space
export function wallFromPolygon(points: THREE.Vector3[], normal: THREE.Vector3): Wall {
  const dx = -normal.z;
  const dz = normal.x;
  const along = (p: THREE.Vector3) => p.x * dx + p.z * dz;
  const sorted = [...points].sort((p, q) => along(p) - along(q));
  const a = sorted[0];
  const b = sorted[sorted.length - 1];
  return { ax: a.x, az: a.z, bx: b.x, bz: b.z };
}

export function placementMatrix(pose: Pose, foot: Footprint, floorY: number, target: THREE.Matrix4) {
  const turn = new THREE.Matrix4().makeRotationY(pose.yaw);
  const toCentre = new THREE.Matrix4().makeTranslation(-foot.cx, -foot.minY, -foot.cz);
  return target.makeTranslation(pose.x, floorY, pose.z).multiply(turn).multiply(toCentre);
}

// `local`: the point on the part, in its geometry's coordinates
export function nearestEdge(lines: LineData[] | null | undefined, local: THREE.Vector3): LineData | null {
  const segment = new THREE.Line3();
  const closest = new THREE.Vector3();
  let best: LineData | null = null;
  let bestDistance: number = EDGE_REACH;
  for (const line of lines ?? []) {
    segment.set(line.points[0], line.points[1]).closestPointToPoint(local, true, closest);
    const distance = closest.distanceTo(local);
    if (distance < bestDistance) {
      best = line;
      bestDistance = distance;
    }
  }
  return best;
}
