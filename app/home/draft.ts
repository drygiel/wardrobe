import { COLUMNS } from '@/components/parts';

// Dimension lines of the drawing in model space: they lie on the wall (x = 0) and on the floor, so they turn with the model
type V3 = [number, number, number];

const WIDTH = 2.688;
const HEIGHT = 2.66;
const DEPTH = 0.53;
const TOP = 2.84;
const BOTTOM = -0.18;
const RIGHT = 0.18;
const BUBBLE = 3.08;

const mm = (m: number) => String(Math.round(m * 1000));
const lines = () => {
  const out: number[] = [];
  return { out, add: (a: V3, b: V3) => void out.push(...a, ...b) };
};

const wall = lines();
const tick = (y: number, z: number) => wall.add([0, y - 0.028, z - 0.028], [0, y + 0.028, z + 0.028]);
const across = (y: number, a: number, b: number) => {
  wall.add([0, y, a], [0, y, b]);
  tick(y, a);
  tick(y, b);
};

const columns = Object.entries(COLUMNS);
columns.forEach(([, [a, b]]) => {
  across(TOP, a, b);
  [a, b].forEach(z => wall.add([0, HEIGHT + 0.03, z], [0, TOP + 0.05, z]));
  wall.add([0, TOP + 0.16, (a + b) / 2], [0, BUBBLE - 0.09, (a + b) / 2]);
});
across(BOTTOM, -WIDTH, 0);
[-WIDTH, 0].forEach(z => wall.add([0, -0.03, z], [0, BOTTOM - 0.05, z]));
wall.add([0, 0, RIGHT], [0, HEIGHT, RIGHT]);
tick(0, RIGHT);
tick(HEIGHT, RIGHT);
[0, HEIGHT].forEach(y => wall.add([0, y, 0.03], [0, y, RIGHT + 0.05]));

const floor = lines();
floor.add([-DEPTH, 0, -WIDTH], [-DEPTH, 0, 0]);
floor.add([-DEPTH, 0, 0], [0, 0, 0]);
floor.add([-DEPTH, 0, -WIDTH], [0, 0, -WIDTH]);
floor.add([-DEPTH, 0, RIGHT], [0, 0, RIGHT]);
[-DEPTH, 0].forEach(x => floor.add([x - 0.028, 0, RIGHT - 0.028], [x + 0.028, 0, RIGHT + 0.028]));

export const WALL_SEGMENTS = wall.out;
export const FLOOR_SEGMENTS = floor.out;

export type DraftLabel = { text: string; at: V3; layer: 'dims' | 'floor'; bubble?: boolean };

export const DRAFT_LABELS: DraftLabel[] = [
  ...columns.flatMap(([name, [a, b]]): DraftLabel[] => [
    { text: mm(b - a), at: [0, TOP + 0.08, (a + b) / 2], layer: 'dims' },
    { text: name, at: [0, BUBBLE, (a + b) / 2], layer: 'dims', bubble: true },
  ]),
  { text: mm(WIDTH), at: [0, BOTTOM - 0.09, -WIDTH / 2], layer: 'dims' },
  { text: mm(HEIGHT), at: [0, HEIGHT / 2, RIGHT + 0.13], layer: 'dims' },
  { text: mm(DEPTH), at: [-DEPTH / 2, 0, RIGHT + 0.14], layer: 'floor' },
];
