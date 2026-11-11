// Run with: npx tsx tests/placement.test.ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { LineData } from '../app/components/Mesh';
import { carry, nearestEdge, placementMatrix, snapToWalls, wallFromPolygon, yawFacing, type Footprint, type Wall } from '../app/xr/placement';

const near = (actual: number, expected: number, what: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${what}: ${actual} != ${expected}`);

const foot: Footprint = { cx: 0, cz: 0, minY: 0, halfX: 0.45, halfZ: 1.5 };
// A room from (0,0) to (5,4); the viewer stands inside
const west: Wall = { ax: 0, az: 0, bx: 0, bz: 4 };
const north: Wall = { ax: 0, az: 0, bx: 5, bz: 0 };
const walls = [west, north];
const inside = { x: 3, z: 2 };

// Doors towards +x, back 10 cm from the west wall and 5 degrees off
const wall = snapToWalls({ x: 0.55, z: 2, yaw: 0.087 }, foot, walls, inside);
assert.equal(wall.status, 'wall');
near(wall.pose.x, 0.45, 'back touches the wall');
near(wall.pose.yaw, 0, 'squared up to the wall');
near(wall.pose.z, 2, 'not moved along the wall');

// Close to the north wall as well: slides into the corner, the side flush with it
const corner = snapToWalls({ x: 0.55, z: 1.6, yaw: 0 }, foot, walls, inside);
assert.equal(corner.status, 'corner');
near(corner.pose.x, 0.45, 'back in the corner');
near(corner.pose.z, 1.5, 'side in the corner');

// Too far, or turned away: stays where the hand put it
const raw = { x: 1.5, z: 2, yaw: 0 };
assert.deepEqual(snapToWalls(raw, foot, walls, inside), { pose: raw, status: 'free' });
const sideways = { x: 0.5, z: 2, yaw: Math.PI / 2 };
assert.deepEqual(snapToWalls(sideways, foot, walls, inside), { pose: sideways, status: 'free' });

// Past the end of a wall it does not count
const shortWall: Wall = { ax: 0, az: 0, bx: 0, bz: 1 };
assert.equal(snapToWalls({ x: 0.5, z: 4, yaw: 0 }, foot, [shortWall], inside).status, 'free');

// The polygon's two ends along the wall, whatever the order of its points
const segment = wallFromPolygon(
  [new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 2.5, 3), new THREE.Vector3(1, 0, 3), new THREE.Vector3(1, 2.5, 0)],
  new THREE.Vector3(-1, 0, 0),
);
assert.deepEqual([segment.ax, Math.abs(segment.az - segment.bz), segment.bx], [1, 3, 1]);

// The footprint's centre lands on the pose, and the doors point the way the yaw says
const off: Footprint = { cx: -0.2, cz: 0.1, minY: 0.02, halfX: 0.45, halfZ: 1.5 };
const yaw = yawFacing(0, 1);
const matrix = placementMatrix({ x: 2, z: 3, yaw }, off, 0.05, new THREE.Matrix4());
const centre = new THREE.Vector3(off.cx, off.minY, off.cz).applyMatrix4(matrix);
near(centre.x, 2, 'centre x');
near(centre.y, 0.05, 'stands on the floor');
near(centre.z, 3, 'centre z');
const doors = new THREE.Vector3(1, 0, 0).transformDirection(matrix);
near(doors.z, 1, 'doors face the asked direction');

const line = (a: number[], b: number[]) => ({ points: [new THREE.Vector3(...a), new THREE.Vector3(...b)] }) as unknown as LineData;
const edges = [line([0, 0, 0], [1, 0, 0]), line([0, 0, 0], [0, 1, 0])];
assert.equal(nearestEdge(edges, new THREE.Vector3(0.5, 0.01, 0)), edges[0]);
assert.equal(nearestEdge(edges, new THREE.Vector3(0.01, 0.5, 0)), edges[1]);
assert.equal(nearestEdge(edges, new THREE.Vector3(0.5, 0.5, 0)), null, 'mid-board is no edge');
assert.equal(nearestEdge(null, new THREE.Vector3()), null, 'a part without drawn edges');

// Two hands turn a quarter around the point between them: the wardrobe 1 m to the +x side swings to -z
const carried = { x: 1, z: 0, yaw: 0 };
carry(carried, { x: 0, z: 0 }, { x: 0, z: 0 }, Math.PI / 2);
near(carried.x, 0, 'swings around the handle, x');
near(carried.z, -1, 'swings around the handle, z');
near(carried.yaw, Math.PI / 2, 'turns with the hands');
// One hand, no turn: follows it one to one
carry(carried, { x: 0, z: 0 }, { x: 0.3, z: 0.2 }, 0);
near(carried.x, 0.3, 'follows the hand, x');
near(carried.z, -0.8, 'follows the hand, z');
