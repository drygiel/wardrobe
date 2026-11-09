// Run with: npx tsx tests/chapters.test.ts
import assert from 'node:assert/strict';
import {
  doorsOpen,
  dragTarget,
  drawersOpen,
  frameBakeOn,
  measuring,
  progressAt,
  stripped,
  stateAt,
  stopFor,
  track,
  YAW_MAX,
  YAW_MIN,
} from '../app/home/chapters';

const keys = [
  [0.2, 10],
  [0.6, 20],
] as const;
assert.equal(track(keys, 0), 10, 'holds before the first key');
assert.equal(track(keys, 1), 20, 'holds past the last key');
assert.equal(track(keys, 0.4), 15, 'eased midpoint');
assert.equal(track(keys, 0.2), 10, 'exactly on a key');

const start = stateAt(0);
assert.equal(start.fov, 3);
assert.equal(start.az, 0);
assert.equal(start.extrude, 0);
assert.equal(start.fronts, 1, 'the drawing opens on the closed wardrobe');
assert.equal(start.wipe, 0);
assert.equal(start.dims, 1);

const end = stateAt(1);
assert.equal(end.fov, 30);
assert.equal(end.extrude, 1);
assert.equal(end.fronts, 1);
assert.equal(end.wipe, 1);
assert.equal(end.dims, 0);
assert.equal(end.grid, 0);

// The doors swing with the fronts in place and before the light starts
assert.equal(doorsOpen(0.5), false);
assert.equal(doorsOpen(0.53), true);
assert.equal(stateAt(0.53).fronts, 1);
assert.equal(stateAt(0.53).wipe, 0);

assert.equal(doorsOpen(1.5), false, 'closed for the anatomy');
assert.equal(doorsOpen(3), true, 'open at the drawers chapter rest');
assert.equal(drawersOpen(2.6), 0);
assert.equal(drawersOpen(2.63), 1);
assert.equal(drawersOpen(3), 7, 'every section B drawer out by the rest');
assert.equal(drawersOpen(3.5), 7, 'still out while the parts fly off for the frame');
assert.equal(drawersOpen(5.1), 0, 'back in once the parts return for measuring');
assert.equal(doorsOpen(5.1), false);

// The story closes on the drawing it started from
assert.equal(stateAt(6).fov, 3);
assert.equal(stateAt(6).az, 0);
assert.equal(stateAt(6).dims, 1);
assert.equal(stateAt(6).fronts, 0, 'the measuring drawing shows the interior');
assert.equal(stateAt(6).dark, 1);
assert.equal(frameBakeOn(3), false, 'the atlas stays through the drawers chapter');
assert.equal(frameBakeOn(3.07), false, 'and while the other parts leave');
assert.equal(frameBakeOn(4.5), true, 'held through the light chapter, the frame still alone');
assert.equal(frameBakeOn(5.1), false, 'handed back once the parts return for measuring');
assert.ok(
  frameBakeOn(3.1) && stateAt(3.1).apart === 0 && stateAt(3.15).apart > 0,
  'swapped as the frame starts to part',
);
assert.equal(stripped(3), false, 'the drawers chapter keeps every part');
assert.equal(stripped(3.5), true, 'only the frame in its chapter');
assert.equal(stripped(4.5), true, 'and in the light chapter');
assert.equal(stripped(6), false, 'every part back for measuring');
assert.equal(stateAt(4.8).wires, 1, 'wiring shown in the light chapter');
assert.ok(stateAt(3.3).frameSpin < stateAt(3.7).frameSpin, 'the frame turns with the scroll');

assert.equal(measuring(5.5), false);
assert.equal(measuring(6), true, 'the closing drawing measures');
assert.equal(stateAt(5.72).dims > 0.5, true, 'measuring starts once the dimensions are drawn');

assert.equal(dragTarget(0.95), 'hero');
assert.equal(dragTarget(1.5), null, 'no dragging in the anatomy');
assert.equal(dragTarget(3.7), 'frame');
assert.equal(dragTarget(4.5), null);

assert.equal(stateAt(0).settle, 0);
assert.equal(stateAt(1).settle, 1);

const offFront = (yaw: number) => Math.abs(stateAt(1).az + (yaw * 180) / Math.PI);
assert.ok(
  offFront(YAW_MIN) < 80 && offFront(YAW_MAX) < 80,
  'the back stays out of view at both limits',
);

assert.equal(progressAt(-1), 0, 'clamped above the stage');
assert.equal(progressAt(1), 0.5, 'half of the hero');
assert.equal(progressAt(2.2), 1, 'resting on the finished view');
assert.ok(Math.abs(progressAt(2.4 + 0.75) - 1.5) < 1e-9, 'half of the anatomy');
assert.equal(progressAt(99), 6, 'clamped below the stage');

assert.equal(stopFor(0.85, true), 2, 'carried on from just short of the hero end');
assert.equal(stopFor(0.85, false), null, 'never pulled back down while scrolling up');
assert.equal(stopFor(0.5, true), null, 'too early to carry on');
assert.equal(stopFor(1, true), null, 'free scrolling during the rest');
assert.ok(Math.abs(stopFor(1.8, true)! - 3.9) < 1e-9, 'carried on to the anatomy end');
assert.ok(
  stateAt(1.2).spin > stateAt(1.6).spin && stateAt(1.6).spin > stateAt(2).spin,
  'the camera turns back across the stack as the page scrolls',
);
assert.equal(stopFor(2, true), null, 'free scrolling past the anatomy');

assert.equal(stateAt(1).explode, 0, 'the hero ends in one piece');
assert.equal(stateAt(1).dark, 0, 'and in full light');
assert.equal(stateAt(2).explode, 1);
assert.equal(stateAt(2).labels, 1);
