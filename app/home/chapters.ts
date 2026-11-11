// The home page's scroll story. p runs through whole chapters: 0..1 hero (drawing to wardrobe), 1..2 anatomy,
// 2..3 drawers and hinges, 3..4 frame, 4..5 light, 5..6 back to the drawing for measuring.
// A track lists [p, value] keys, eased between them and held past both ends.
type Keys = readonly (readonly [number, number])[];

export function track(keys: Keys, p: number) {
  const next = keys.findIndex(([at]) => at > p);
  if (next === 0) return keys[0][1];
  if (next < 0) return keys[keys.length - 1][1];
  const [a, from] = keys[next - 1];
  const [b, to] = keys[next];
  const t = (p - a) / (b - a);
  return from + (to - from) * t * t * (3 - 2 * t);
}

export const stateAt = (p: number) => ({
  // Near-orthographic at both ends of the story, so the model's own edges read as a front elevation
  fov: track(
    [
      [0.06, 3],
      [0.42, 30],
      [5.05, 30],
      [5.7, 3],
    ],
    p,
  ),
  az: track(
    [
      [0.06, 0],
      [0.42, 40],
      [1, 32],
      [1.55, 64],
      [2.05, 64],
      [2.55, 20],
      [3.05, 20],
      [3.5, 42],
      [4.05, 42],
      [4.5, 24],
      [5.05, 24],
      [5.7, 0],
    ],
    p,
  ),
  el: track(
    [
      [0.06, 0],
      [0.42, 14],
      [1, 6],
      [1.55, 20],
      [2.05, 20],
      [2.55, 12],
      [3.05, 12],
      [3.5, 18],
      [4.05, 18],
      [4.5, 8],
      [5.05, 8],
      [5.7, 0],
    ],
    p,
  ),
  dist: track(
    [
      [0.06, 1],
      [0.42, 1.16],
      [0.97, 1],
      [2.2, 1],
      [2.6, 0.56],
      [3.02, 0.56],
      [3.6, 1.16],
      [4.02, 1.16],
      [4.4, 1],
    ],
    p,
  ),
  // Keeps the model clear of the copy on the left
  shiftX: track(
    [
      [0.06, 0.14],
      [0.42, 0.11],
      [0.8, 0.11],
      [0.97, 0],
      [1.1, 0],
      [1.55, 0.06],
      [2.05, 0.06],
      [2.55, 0.2],
      [3.02, 0.2],
      [3.5, 0.12],
      [5.05, 0.12],
      [5.7, 0.14],
    ],
    p,
  ),
  extrude: track(
    [
      [0.08, 0],
      [0.4, 1],
    ],
    p,
  ),
  // The story opens on the closed wardrobe and closes on its interior: the fronts leave only for the measuring drawing
  fronts: track(
    [
      [5.05, 1],
      [5.5, 0],
    ],
    p,
  ),
  dims: track(
    [
      [0.26, 1],
      [0.42, 0],
      [5.45, 0],
      [5.75, 1],
    ],
    p,
  ),
  floor: track(
    [
      [0.2, 0],
      [0.38, 1],
      [0.58, 1],
      [0.7, 0],
    ],
    p,
  ),
  grid: track(
    [
      [0.54, 1],
      [0.7, 0],
      [5.4, 0],
      [5.7, 1],
    ],
    p,
  ),
  wipe: track(
    [
      [0.58, 0],
      [0.9, 1],
    ],
    p,
  ),
  // From the drawing's framing to the band above the closing copy, and back at the end.
  // Spread over a third of the hero: a short ramp here reads as the camera jumping back.
  settle: track(
    [
      [0.62, 0],
      [0.97, 1],
      [5.05, 1],
      [5.7, 0],
    ],
    p,
  ),
  // Anatomy: the light retreats, the layers part, the labels draw in
  unturn: track(
    [
      [1, 0],
      [1.12, 1],
    ],
    p,
  ),
  dark: track(
    [
      [1.02, 0],
      [1.4, 1],
      [2.2, 1],
      [2.55, 0],
      [4.05, 0],
      [4.4, 1],
    ],
    p,
  ),
  explode: track(
    [
      [1.12, 0],
      [1.6, 1],
      [2.02, 1],
      [2.4, 0],
    ],
    p,
  ),
  pose: track(
    [
      [1.05, 0],
      [1.55, 1],
      [2.05, 1],
      [2.5, 0],
    ],
    p,
  ),
  labels: track(
    [
      [1.5, 0],
      [1.68, 1],
      [2.02, 1],
      [2.1, 0],
    ],
    p,
  ),
  // The exploded stack keeps turning for as long as the chapter scrolls, degrees added to az (weighted by pose)
  spin: 25 - (Math.min(2, Math.max(1, p)) - 1) * 50,
  // Drawers and hinges: the camera moves in on section B
  dive: track(
    [
      [2.2, 0],
      [2.6, 1],
      [3.02, 1],
      [3.45, 0],
    ],
    p,
  ),
  // Frame: everything else flies off (see `stripped`, timed rather than scrolled), the pieces part
  led: track(
    [
      [3.05, 1],
      [3.35, 0],
      [4.05, 0],
      [4.35, 1],
    ],
    p,
  ),
  apart: track(
    [
      [3.1, 0],
      [3.6, 1],
      [4.02, 1],
      [4.4, 0],
    ],
    p,
  ),
  // The spread frame turns slowly as the chapter scrolls, degrees of model yaw (weighted by apart)
  frameSpin: (Math.min(4, Math.max(3, p)) - 3) * 30 - 15,
  // Light: the frame fades to a faint outline behind the strips and wiring
  frameInk: track(
    [
      [4.05, 1],
      [4.4, 0.22],
      [5.05, 0.22],
      [5.5, 1],
    ],
    p,
  ),
  wires: track(
    [
      [4.1, 0],
      [4.5, 1],
      [5.05, 1],
      [5.4, 0],
    ],
    p,
  ),
});

// Section B doors swing before the light comes on in the hero, and again for the drawers chapter
const DOORS_OPEN_AT = 0.52;
// They stay open while the parts fly off for the frame and close only when the parts come back for measuring
const STRIP_FROM = 3.04;
const STRIP_TO = 5.06;
export const doorsOpen = (p: number) =>
  (p > DOORS_OPEN_AT && p < 1.02) || (p > 2.5 && p < STRIP_TO);
// Drawers of section B slide out one after another as the chapter is scrolled
export const drawersOpen = (p: number) =>
  p > 2.62 && p < STRIP_TO ? Math.min(7, Math.floor((p - 2.62) / 0.05) + 1) : 0;
// Everything but the frame, its dowels and the LED strips is away from here to the measuring drawing.
// Crossing either threshold starts the flight, which then finishes on its own clock.
export const stripped = (p: number) => p > STRIP_FROM && p < STRIP_TO;
// The frame's own bake cuts in as the frame pieces start to part (`apart` from 3.1), after the other parts have
// left, and holds while the frame stands alone, the light chapter included. HomeScene keeps it on until the other
// parts are fully back, either way, so the atlas's dark joint bands never show on a bare frame.
export const frameBakeOn = (p: number) => p >= 3.1 && p < STRIP_TO;

// From here to the end of the hero the finished wardrobe answers to clicks and drags
export const LIVE_FROM = 0.92;

// The closing drawing measures edges under the cursor, like /pomiar, and opens it on a click
export const measuring = (p: number) => p >= 5.72;

// What a horizontal drag turns at this point of the story: the finished wardrobe, the spread frame, or nothing
export const dragTarget = (p: number) =>
  p >= LIVE_FROM && p <= 1 ? 'hero' : p >= 3.45 && p <= 4.02 ? 'frame' : null;

// Model turn limits in radians: at most 68 degrees off the front either way (the view rests at az 32), so the back never shows
export const YAW_MIN = -1.75;
export const YAW_MAX = 0.63;

// The pinned stage in viewport heights: each chapter scrolls for its length, then rests
// Kept short: every animation finishes within a few turns of the wheel
const LEGS: readonly (readonly [number, number])[] = [
  [2, 0.4],
  [1.5, 0.2], // the anatomy turns all the way through, so it barely rests
  [0.9, 0.4],
  [1.3, 0.2], // the frame turns all the way through
  [0.9, 0.4],
  [0.9, 0.4],
];
export const STAGE_VH = LEGS.reduce((sum, [length, rest]) => sum + length + rest, 0) + 1;

export function progressAt(vh: number) {
  let at = 0;
  for (let i = 0; i < LEGS.length; i++) {
    const [length, rest] = LEGS[i];
    if (vh < at + length) return i + Math.max(0, vh - at) / length;
    at += length + rest;
    if (vh < at) return i + 1;
  }
  return LEGS.length;
}

// Where a reader who stops in the last quarter of a chapter on the way down is carried, in viewport heights
export function stopFor(p: number, down: boolean) {
  const chapter = Math.floor(p);
  if (!down || chapter >= LEGS.length || p - chapter < 0.75) return null;
  return (
    LEGS.slice(0, chapter).reduce((sum, [length, rest]) => sum + length + rest, 0) +
    LEGS[chapter][0]
  );
}
