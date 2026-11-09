// Run with: npx tsx tests/hinge.test.ts
import assert from 'node:assert/strict';
import { DOOR, FRAME, hingeAt, hingeOpened, SIDE } from '../app/okucia/hinge';

const deg = (rad: number) => (rad * 180) / Math.PI;

assert.ok(Math.abs(deg(hingeAt(0).phi)) < 1e-6, 'closed at the start');
assert.ok(Math.abs(deg(hingeAt(1).phi) - 95) < 1, `opens to the model's 95°, got ${deg(hingeAt(1).phi)}`);

assert.ok(Math.abs(deg(hingeOpened(0.5).phi) - deg(hingeAt(1).phi) / 2) < 0.01, 'half the angle at half the scroll');
assert.ok(Math.abs(deg(hingeOpened(1).phi) - deg(hingeAt(1).phi)) < 0.01);

// Opens steadily and never cuts into the frame or the inner side
const inside = ([x, y]: [number, number], r: typeof SIDE) => x > r.x0 + 0.5 && x < r.x1 - 0.5 && y > r.y0 + 0.5 && y < r.y1 - 0.5;
let last = -1e-9;
for (let i = 0; i <= 200; i++) {
  const pose = hingeAt(i / 200);
  assert.ok(pose.phi >= last - 1e-9, `opens monotonically at step ${i}`);
  last = pose.phi;
  const edge = [...DOOR, ...Array.from({ length: 13 }, (_, k) => [-15 + k * 12, 0] as [number, number]), ...Array.from({ length: 13 }, (_, k) => [-15 + k * 12, 18] as [number, number])];
  edge.map(pose.place).forEach(p => assert.ok(!inside(p, SIDE) && !inside(p, FRAME), `door clear of the wardrobe at step ${i}`));
}
