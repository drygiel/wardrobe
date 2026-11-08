// The installation in Szafa4.blend (collection Electric). Route points are Blender world metres: x depth (back 0, front -),
// y along the wardrobe (D at 0, A at the end), z height. Strip and cable lengths are measured from the same scene.

export const DOOR_IDS = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07'] as const;
export type DoorId = (typeof DOOR_IDS)[number];
export type LedId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8';

export type Led = {
  id: LedId;
  dimmer: string;
  strip: string; // suffix of the LED_* and Dimmer * objects
  wire: string; // glTF name of its cable
  place: string;
  metres: number;
  wireMetres: number;
  doors: DoorId[] | null; // null: on the hidden switch
};

export const LEDS: Led[] = [
  { id: 'L1', dimmer: 'Ś1', strip: 'C_Side-R-Lower', wire: 'LED_Wire_C_Side-R-Lower', place: 'Dół wnęki C', metres: 0.934, wireMetres: 0.602, doors: ['F05'] },
  { id: 'L2', dimmer: 'Ś2', strip: 'P09', wire: 'LED_Wire_P09', place: 'Szafa D', metres: 2.587, wireMetres: 1.202, doors: ['F06', 'F07'] },
  { id: 'L3', dimmer: 'Ś3', strip: 'B_Shelf-02', wire: 'LED_Wire_B_Shelf-02', place: 'Pod półką szafy B', metres: 0.513, wireMetres: 0.771, doors: ['F02', 'F04'] },
  { id: 'L4', dimmer: 'Ś4', strip: 'B_Side-R', wire: 'LED_Wire_B_Side-R', place: 'Szafa B, prawy bok', metres: 1.389, wireMetres: 0.751, doors: ['F02', 'F04'] },
  { id: 'L5', dimmer: 'Ś5', strip: 'B_Side-L', wire: 'LED_Wire_B_Side-L', place: 'Szafa B, lewy bok', metres: 1.389, wireMetres: 1.931, doors: ['F01', 'F03'] },
  { id: 'L6', dimmer: 'Ś6', strip: 'P05', wire: 'LED_Wire_P05', place: 'Wnęka C, prawy bok', metres: 1.27, wireMetres: 0.87, doors: null },
  { id: 'L7', dimmer: 'Ś7', strip: 'P03', wire: 'LED_Wire_P03', place: 'Wnęka C, lewy bok', metres: 1.27, wireMetres: 0.706, doors: null },
  { id: 'L8', dimmer: 'Ś8', strip: 'P14', wire: 'LED_Wire', place: 'Regał A', metres: 2.06, wireMetres: 2.447, doors: null },
];

export const WATT_PER_METRE = 10; // assumed strip, 24 V
export const PSU_WATT = 150;
export const VOLT = 24;
export const LED_METRES = LEDS.reduce((sum, led) => sum + led.metres, 0);
export const FULL_WATT = LED_METRES * WATT_PER_METRE;
export const CABLE_METRES = 20.06;

export const contact = (door: DoorId) => `K${Number(door.slice(1))}`;
export const stripWatt = (led: Led) => led.metres * WATT_PER_METRE;

// Polish number format
export const num = (value: number, digits = 0) => value.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });

type Point = [number, number, number];
export type RouteKind = 'power' | 'signal' | 'mains' | 'switch';
export type Route = { id: string; kind: RouteKind; led?: LedId; doors?: DoorId[]; runs: Point[][] };

const X = -0.0075;
const Z1 = 1.11;
const CEIL = 1.2815;
const LANE = -0.0205;
const UNDER = 1.7328;
const TOP = 2.2848;

export const ROUTES: Route[] = [
  { id: 'Mains_Cord', kind: 'mains', runs: [[[-0.055, 0.8, 0.31], [-0.066, 0.8, 0.31], [-0.066, 0.876, 0.31]]] },
  { id: 'Feed_24V', kind: 'power', runs: [[[-0.03, 0.876, 0.32], [-0.03, 0.8525, 0.32], [X, 0.8525, 0.32], [X, 0.8525, 1.035]]] },
  { id: 'Switch_Wire', kind: 'switch', runs: [[[-0.015, 0.913, 1.04], [-0.034, 0.913, 1.04], [-0.034, 0.913, CEIL], [-0.431, 0.913, CEIL]]] },
  { id: 'LED_Wire', kind: 'power', led: 'L8', runs: [[[-0.0096, 0.998, Z1], [-0.0096, 0.998, 1.231], [-0.0096, 1.1048, 1.231], [-0.0162, 2.222, 1.231], [-0.0223, 2.2154, 0.604], [-0.2311, 2.2154, 0.604], [-0.44, 2.2154, 0.604], [-0.44, 2.273, 0.604]]] },
  { id: 'LED_Wire_C_Side-R-Lower', kind: 'power', led: 'L1', runs: [[[X, 0.76, Z1], [X, 0.76, 1.122], [X, 0.7085, 1.122], [X, 0.7085, 1.0085], [-0.4325, 0.7085, 1.0085]]] },
  { id: 'LED_Wire_P09', kind: 'power', led: 'L2', runs: [[[X, 0.794, Z1], [X, 0.794, 1.139], [X, 0.045, 1.139], [-0.431, 0.045, 1.139]]] },
  { id: 'LED_Wire_B_Shelf-02', kind: 'power', led: 'L3', runs: [[[X, 0.828, Z1], [X, 0.828, 1.2025], [LANE, 0.828, 1.2025], [LANE, 1.0395, 1.2025], [-0.4313, 1.0395, 1.2025], [-0.4313, 1.0825, 1.2025]]] },
  { id: 'LED_Wire_B_Side-R', kind: 'power', led: 'L4', runs: [[[X, 0.862, Z1], [X, 0.862, 1.236], [LANE, 0.862, 1.236], [LANE, 1.0395, 1.236], [-0.4325, 1.0395, 1.236], [-0.4325, 1.0625, 1.236]]] },
  { id: 'LED_Wire_B_Side-L', kind: 'power', led: 'L5', runs: [[[X, 0.896, Z1], [X, 0.896, 1.2525], [LANE, 0.896, 1.2525], [LANE, 1.02, 1.2525], [-0.0096, 1.02, 1.2525], [-0.0096, 1.02, 1.241], [-0.0096, 2.2165, 1.241], [-0.05, 2.2165, 1.241], [-0.05, 2.2165, 1.2315], [-0.4325, 2.2165, 1.2315]]] },
  { id: 'LED_Wire_P05', kind: 'power', led: 'L6', runs: [[[X, 0.93, Z1], [X, 0.93, CEIL], [X, 0.7205, CEIL], [-0.431, 0.7205, CEIL], [-0.431, 0.7205, 1.3475]]] },
  { id: 'LED_Wire_P03', kind: 'power', led: 'L7', runs: [[[X, 0.964, Z1], [X, 0.964, CEIL], [X, 1.0095, CEIL], [-0.431, 1.0095, CEIL], [-0.431, 1.0095, 1.3475]]] },
  { id: 'Door_Wire_C', kind: 'signal', doors: ['F05'], runs: [[[-0.015, 0.76, 1.0735], [-0.02, 0.76, 1.0735], [-0.02, 0.76, 1.0052], [-0.02, 1.03, 1.0052], [-0.46, 1.03, 1.0052], [-0.46, 1.03, 0.994], [-0.467, 1.03, 0.994]]] },
  {
    id: 'Door_Wire_D',
    kind: 'signal',
    doors: ['F06', 'F07'],
    runs: [
      [[-0.015, 0.794, 1.08], [-0.02, 0.794, 1.08], [-0.02, 0.73, 1.08], [-0.02, 0.73, 1.1495], [X, 0.73, 1.1495], [X, 0.668, 1.1495], [X, 0.668, UNDER], [-0.46, 0.668, UNDER], [-0.46, 0.668, 1.744]],
      [[X, 0.668, UNDER], [X, 0.668, TOP], [-0.46, 0.668, TOP], [-0.46, 0.668, 2.296]],
    ],
  },
  {
    id: 'Door_Wire_B-R',
    kind: 'signal',
    doors: ['F02', 'F04'],
    runs: [
      [[-0.015, 0.862, 1.0725], [-0.02, 0.862, 1.0725], [-0.02, 1.0285, 1.0725], [-0.036, 1.0285, 1.0725], [-0.036, 1.0285, 1.2545], [-0.0096, 1.0285, 1.2545], [-0.0096, 1.62, 1.2545], [-0.06, 1.62, 1.2545], [-0.06, 1.62, 1.2282], [-0.46, 1.62, 1.2282], [-0.46, 1.62, 1.217]],
      [[-0.0096, 1.62, 1.2545], [-0.0096, 1.62, TOP], [-0.46, 1.62, TOP], [-0.46, 1.62, 2.296]],
    ],
  },
  {
    id: 'Door_Wire_B-L',
    kind: 'signal',
    doors: ['F01', 'F03'],
    runs: [
      [[-0.015, 0.896, 1.0785], [-0.02, 0.896, 1.0785], [-0.02, 1.0285, 1.0785], [-0.0305, 1.0285, 1.0785], [-0.0305, 1.0285, 1.249], [-0.0096, 1.0285, 1.249], [-0.0096, 1.66, 1.249], [-0.06, 1.66, 1.249], [-0.06, 1.66, 1.2282], [-0.46, 1.66, 1.2282], [-0.46, 1.66, 1.217]],
      [[-0.0096, 1.66, 1.249], [-0.0096, 1.66, TOP], [-0.46, 1.66, TOP], [-0.46, 1.66, 2.296]],
    ],
  },
];

// Reed contacts, Blender world millimetres
export const CONTACTS: Record<DoorId, { y: number; z: number; shelf: string; from: string }> = {
  F01: { y: 1660, z: 1217, shelf: 'IN_B_Shelf-02', from: 'z góry' },
  F02: { y: 1620, z: 1217, shelf: 'IN_B_Shelf-02', from: 'z góry' },
  F03: { y: 1660, z: 2296, shelf: 'IN_B_Shelf-11', from: 'od spodu' },
  F04: { y: 1620, z: 2296, shelf: 'IN_B_Shelf-12', from: 'od spodu' },
  F05: { y: 1030, z: 994, shelf: 'IN_C_Shelf-03', from: 'z góry' },
  F06: { y: 668, z: 1744, shelf: 'IN_D_Shelf-06', from: 'od spodu' },
  F07: { y: 668, z: 2296, shelf: 'IN_D_Shelf-08', from: 'od spodu' },
};

// Which circuits a scene object belongs to; empty means shared by all
export function circuitsOf(name: string): LedId[] {
  const ledBySuffix = (suffix: string) => LEDS.filter(led => led.strip === suffix).map(led => led.id);
  if (name === 'LED_Wire') return ['L8'];
  const wire = /^LED_Wire_(.+)$/.exec(name);
  if (wire) return ledBySuffix(wire[1]);
  const dimmer = /^Dimmer_(.+)$/.exec(name);
  if (dimmer && dimmer[1] !== 'Jumpers') return ledBySuffix(dimmer[1]);
  const route = ROUTES.find(r => r.id === name);
  if (route?.doors) return LEDS.filter(led => led.doors?.some(d => route.doors!.includes(d))).map(led => led.id);
  const door = /^Door_(?:Sensor|Magnet)_(F\d\d)$/.exec(name)?.[1] as DoorId | undefined;
  if (door) return LEDS.filter(led => led.doors?.includes(door)).map(led => led.id);
  if (name === 'Switch' || name === 'Switch_Wire' || name === 'Bus_24V_Switched') return ['L6', 'L7', 'L8'];
  return [];
}

// Boards to drill, Blender world millimetres
export type Board = {
  label: string;
  group: string;
  form: 'shelf' | 'side' | 'door';
  x: [number, number];
  y: [number, number];
  z: [number, number];
  free?: 'min' | 'max'; // door edge without hinges, on the y axis
};

export const BOARDS: Record<string, Board> = {
  'IN_B_Side-R': { label: 'Bok prawy szafy B', group: 'Szafa B', form: 'side', x: [-492, 0], y: [1045, 1063], z: [35, 2615] },
  'IN_B_Side-R-Lower': { label: 'Bok prawy dolny B', group: 'Szafa B', form: 'side', x: [-492, 0], y: [1063, 1081], z: [35, 1208] },
  'IN_B_Side-L': { label: 'Bok lewy szafy B', group: 'Szafa B', form: 'side', x: [-492, 0], y: [2222, 2240], z: [35, 2615] },
  'P14_B_Side-L': { label: 'Bok zewnętrzny P14', group: 'Szafa B', form: 'side', x: [-530, 0], y: [2240, 2280], z: [-5, 2655] },
  'IN_B_Shelf-02': { label: 'Półka nad szufladami', group: 'Szafa B', form: 'shelf', x: [-492, 0], y: [1063, 2222], z: [1208, 1226] },
  'IN_B_Shelf-05': { label: 'Półka środkowa 05', group: 'Szafa B', form: 'shelf', x: [-443.4, 0], y: [1463, 1821], z: [1639, 1657] },
  'IN_B_Shelf-08': { label: 'Półka środkowa 08', group: 'Szafa B', form: 'shelf', x: [-443.4, 0], y: [1463, 1821], z: [1839, 1857] },
  'IN_B_Shelf-10': { label: 'Półka 10', group: 'Szafa B', form: 'shelf', x: [-492, 0], y: [1063, 2222], z: [2009, 2027] },
  'IN_B_Shelf-11': { label: 'Półka górna lewa', group: 'Szafa B', form: 'shelf', x: [-492, 0], y: [1651.5, 2221.5], z: [2287, 2305] },
  'IN_B_Shelf-12': { label: 'Półka górna prawa', group: 'Szafa B', form: 'shelf', x: [-492, 0], y: [1063, 1633], z: [2287, 2305] },
  'IN_C_Shelf-01': { label: 'Półka nad szufladą', group: 'Wnęka C', form: 'shelf', x: [-492, 0], y: [703, 1045], z: [335, 353] },
  'IN_C_Shelf-02': { label: 'Półka 02', group: 'Wnęka C', form: 'shelf', x: [-492, 0], y: [703, 1045], z: [685, 703] },
  'IN_C_Shelf-03': { label: 'Półka pod rozdzielnią', group: 'Wnęka C', form: 'shelf', x: [-492, 0], y: [703, 1045], z: [985, 1003] },
  'IN_C_Shelf-04': { label: 'Półka nad rozdzielnią', group: 'Wnęka C', form: 'shelf', x: [-492, 0], y: [703, 1045], z: [1287, 1305] },
  'P04_C_Bottom': { label: 'Dno wnęki P04', group: 'Wnęka C', form: 'shelf', x: [-530, 0], y: [685, 1045], z: [1305, 1345] },
  'IN_C_Side-R': { label: 'Bok prawy wnęki C', group: 'Wnęka C', form: 'side', x: [-492, 0], y: [685, 703], z: [35, 1305] },
  'IN_D_Shelf-06': { label: 'Półka 06', group: 'Szafa D', form: 'shelf', x: [-492, 0], y: [40, 685], z: [1735, 1753] },
  'IN_D_Shelf-07': { label: 'Półka 07', group: 'Szafa D', form: 'shelf', x: [-492, 0], y: [40, 685], z: [2009, 2027] },
  'IN_D_Shelf-08': { label: 'Półka 08', group: 'Szafa D', form: 'shelf', x: [-492, 0], y: [40, 685], z: [2287, 2305] },
  F01: { label: 'Drzwi F01', group: 'Drzwi', form: 'door', x: [-510, -492], y: [1644, 2237], z: [38, 2019], free: 'min' },
  F02: { label: 'Drzwi F02', group: 'Drzwi', form: 'door', x: [-510, -492], y: [1048, 1641], z: [38, 2019], free: 'max' },
  F03: { label: 'Drzwi F03', group: 'Drzwi', form: 'door', x: [-510, -492], y: [1644, 2237], z: [2022, 2612], free: 'min' },
  F04: { label: 'Drzwi F04', group: 'Drzwi', form: 'door', x: [-510, -492], y: [1048, 1641], z: [2022, 2612], free: 'max' },
  F05: { label: 'Drzwi F05', group: 'Drzwi', form: 'door', x: [-510, -492], y: [685, 1045], z: [38, 1302], free: 'max' },
  F06: { label: 'Drzwi F06', group: 'Drzwi', form: 'door', x: [-510, -492], y: [148, 682], z: [38, 2019], free: 'max' },
  F07: { label: 'Drzwi F07', group: 'Drzwi', form: 'door', x: [-510, -492], y: [148, 682], z: [2022, 2612], free: 'max' },
};

export type Drill = {
  board: string;
  kind: 'hole' | 'notch' | 'bore' | 'magnet';
  at: [number, number, number]; // x, y, z of its centre
  d?: number;
  size?: [number, number]; // notch: along the board, in from the back edge
  note: string;
};

const notch = (board: string, at: Drill['at'], size: [number, number], note: string): Drill => ({ board, kind: 'notch', at, size, note });
const hole = (board: string, at: Drill['at'], d: number, note: string): Drill => ({ board, kind: 'hole', at, d, note });

export const DRILLS: Drill[] = [
  notch('IN_C_Shelf-01', [-7.75, 800, 344], [80, 15.5], 'Gniazdko 230 V'),
  notch('IN_C_Shelf-01', [-6.5, 852.5, 344], [10, 13], 'Zasilanie 24 V'),
  notch('IN_C_Shelf-02', [-6.5, 852.5, 694], [10, 13], 'Zasilanie 24 V'),
  notch('IN_C_Shelf-03', [-6.5, 852.5, 994], [10, 13], 'Zasilanie 24 V'),
  hole('IN_C_Shelf-04', [-431, 720.5, 1296], 8, 'Kabel do L6, na wylot'),
  hole('IN_C_Shelf-04', [-431, 1009.5, 1296], 8, 'Kabel do L7, na wylot'),
  hole('P04_C_Bottom', [-431, 720.5, 1325], 8, 'Kabel do L6, wychodzi we frezie LED'),
  hole('P04_C_Bottom', [-431, 1009.5, 1325], 8, 'Kabel do L7, wychodzi we frezie LED'),
  notch('IN_C_Side-R', [-6.5, 694, 1144], [20, 13], 'Kabel L2 i pętla K6, K7'),
  notch('IN_B_Side-R', [-7.5, 1054, 1242], [32, 15], 'Kable L8, L5 i pętle kontaktronów B'),
  hole('IN_B_Side-R', [-432.5, 1054, 1236], 8, 'Kabel do L4, wychodzi pod paskiem'),
  hole('IN_B_Side-R', [-431.3, 1054, 1202.5], 8, 'Kabel do L3'),
  hole('IN_B_Side-R-Lower', [-431.3, 1072, 1202.5], 8, 'Kabel do L3'),
  hole('IN_B_Side-L', [-440, 2231, 604], 8, 'Kabel do L8'),
  hole('P14_B_Side-L', [-440, 2260, 604], 8, 'Kabel do L8, wychodzi we frezie LED'),
  notch('IN_B_Shelf-02', [-16, 2217, 1217], [10, 10], 'Kabel do L8, w narożniku'),
  hole('IN_B_Shelf-05', [-9.6, 1620, 1648], 5, 'Pętla K4'),
  hole('IN_B_Shelf-05', [-9.6, 1660, 1648], 5, 'Pętla K3'),
  hole('IN_B_Shelf-08', [-9.6, 1620, 1848], 5, 'Pętla K4'),
  hole('IN_B_Shelf-08', [-9.6, 1660, 1848], 5, 'Pętla K3'),
  hole('IN_B_Shelf-10', [-9.6, 1620, 2018], 5, 'Pętla K4'),
  hole('IN_B_Shelf-10', [-9.6, 1660, 2018], 5, 'Pętla K3'),
  hole('IN_D_Shelf-06', [-7.5, 668, 1744], 5, 'Pętla K7'),
  hole('IN_D_Shelf-07', [-7.5, 668, 2018], 5, 'Pętla K7'),
  ...DOOR_IDS.map((door): Drill => {
    const c = CONTACTS[door];
    return { board: c.shelf, kind: 'bore', at: [-492, c.y, c.z], note: `${contact(door)} (drzwi ${door}), przewód ${c.from}` };
  }),
  ...DOOR_IDS.map((door): Drill => {
    const c = CONTACTS[door];
    return { board: door, kind: 'magnet', at: [-492, c.y, c.z], note: `Magnes ${contact(door)}` };
  }),
];

// Position on the drawing: u along the board, v across it
export function place(board: Board, at: Drill['at']) {
  if (board.form === 'door') return { u: at[2] - board.z[0], v: board.free === 'min' ? at[1] - board.y[0] : board.y[1] - at[1] };
  if (board.form === 'side') return { u: at[2] - board.z[0], v: board.x[1] - at[0] };
  return { u: board.y[1] - at[1], v: board.x[1] - at[0] };
}

export const size = (board: Board) =>
  board.form === 'door'
    ? { length: board.z[1] - board.z[0], width: board.y[1] - board.y[0] }
    : { length: board.form === 'side' ? board.z[1] - board.z[0] : board.y[1] - board.y[0], width: board.x[1] - board.x[0] };

export const axes = (board: Board) =>
  board.form === 'door'
    ? { u: 'od dołu', v: 'od krawędzi bez zawiasów' }
    : { u: board.form === 'side' ? 'od dołu' : 'od lewej krawędzi', v: 'od tylnej krawędzi' };

export const BOM: { name: string; amount: string; note: string }[] = [
  { name: 'Zasilacz LED 24 V, 150 W', amount: '1 szt.', note: 'Z dopuszczeniem do mebli, z wtyczką. Z1.' },
  { name: 'Taśma LED 24 V, do 10 W/m', amount: `${num(LED_METRES, 2)} m`, note: 'Osiem odcinków, L1 do L8.' },
  { name: 'Ściemniacz 24 V z wejściem na styk', amount: '5 szt.', note: 'Świeci przy rozwartym styku. Ś1 do Ś5.' },
  { name: 'Ściemniacz 24 V z pokrętłem', amount: '3 szt.', note: 'Ś6 do Ś8.' },
  { name: 'Włącznik kołyskowy 24 V, min. 3 A', amount: '1 szt.', note: 'S1, pod półką IN_C_Shelf-04.' },
  { name: 'Kontaktron wpuszczany Ø8 z magnesem', amount: '7 kpl.', note: 'Styk zwarty przy zamkniętych drzwiach. K1 do K7.' },
  { name: 'Szyna rozdzielcza 24 V', amount: '2 szt.', note: 'Stała i za włącznikiem.' },
  { name: 'Przewód 2 × 1,5 mm²', amount: '1 m', note: 'Z zasilacza do rozdzielni.' },
  { name: 'Przewód 2 × 0,5 mm²', amount: '11 m', note: 'Do pasków i do S1.' },
  { name: 'Przewód 2 × 0,22 mm²', amount: '10 m', note: 'Pętle kontaktronów.' },
];

export const STEPS: { title: string; text: string }[] = [
  { title: 'Wytnij wszystko przed skręceniem', text: 'Otwory, wycięcia i gniazda z arkuszy wiercenia. Potem nie będzie dojścia do tylnych krawędzi.' },
  { title: 'Skręć korpus bez pleców', text: 'Plecy zostają zdjęte, dopóki kable nie leżą w narożnikach.' },
  { title: 'Przeciągnij kable od rozdzielni', text: 'Każdy kabel oznacz numerem paska przed włożeniem w otwór. Zostaw 15 cm zapasu na obu końcach.' },
  { title: 'Wklej kontaktrony i magnesy', text: 'Kontaktron wchodzi równo z krawędzią półki, magnes równo z drzwiami. Sprawdź miernikiem: zwarte przy zamkniętych drzwiach.' },
  { title: 'Złóż rozdzielnię na plecach', text: 'Szyny, osiem ściemniaczy, włącznik S1 pod półką. Zasilacz przykręć pod półką nad szufladą.' },
  { title: 'Podłącz na końcu 230 V', text: 'Wtyczka zasilacza do gniazdka dopiero po sprawdzeniu, że plus i minus nie są zwarte na szynach.' },
];
