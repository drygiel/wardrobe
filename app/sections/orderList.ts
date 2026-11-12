import data from '../components/cutlist.json';
import { mm, partLabel } from '../editor/labels';

// Written by scripts/export.py from Szafa4.blend, millimetres. Directions are seen from the front: positions run
// from the piece's front, right and bottom edges; `box`, `entry`, `min` and `max` are in Blender axes (x to the back,
// y to the left, z up) from the piece's own corner.
export type Hole = { entry: number[]; axis: number; into: number; dowel: string; face: string; d: number; depth: number; at: [number, string][] };
export type Groove = { min: number[]; max: number[]; face: string; width: number; depth: number; from: number; to: number; along: string; offset: number; offsetAlong: string };
export type Piece = {
  name: string;
  box: number[];
  length: number;
  width: number;
  thickness: number;
  board: string | null;
  mitres: number;
  grooves: Groove[];
  holes: Hole[];
};

export const PIECES = data as unknown as Piece[];
export const SHEET = '3000 × 620 × 40';

export const code = (piece: Piece) => piece.name.slice(0, 3);
export const size = (piece: Piece) => `${mm(piece.length)} × ${mm(piece.width)} × ${mm(piece.thickness)}`;

const ON_FACE: Record<string, string> = { 'prawy bok': 'prawym boku', 'lewy bok': 'lewym boku', front: 'froncie', tył: 'tyle', spód: 'spodzie', góra: 'górze' };
export const onFace = (face: string) => ON_FACE[face] ?? face;

export const grooveText = (g: Groove) =>
  `Frez LED ${mm(g.width)} × ${mm(g.depth)} na ${onFace(g.face)}, ${mm(g.offset)} ${g.offsetAlong}, od ${mm(g.from)} do ${mm(g.to)} ${g.along}`;
export const position = (h: Hole) => h.at.map(([value, from]) => `${mm(value)} ${from}`).join(', ');
export const holeText = (h: Hole) => `${h.dowel}: ${h.face}, ${position(h)}, Ø${mm(h.d)} × ${mm(h.depth)}`;

// Polish plural after a number: one, few (2-4 but not 12-14), many
export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const tens = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? few : many;
}

export function totals(pieces = PIECES) {
  return {
    pieces: pieces.length,
    boards: new Set(pieces.map(p => p.board).filter(Boolean)).size,
    holes: pieces.reduce((sum, p) => sum + p.holes.length, 0),
    grooves: pieces.reduce((sum, p) => sum + p.grooves.length, 0),
    mitres: pieces.reduce((sum, p) => sum + p.mitres, 0),
  };
}

// Semicolons and a BOM: Polish Excel opens it as columns with the diacritics intact
export function toCsv(pieces = PIECES) {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const head = ['Kod', 'Formatka', 'Długość', 'Szerokość', 'Grubość', 'Szt.', 'Płyta', 'Ścięcia 45°', 'Frez LED', 'Otwory na kołki'];
  const rows = pieces.map(p => [code(p), partLabel(p.name), mm(p.length), mm(p.width), mm(p.thickness), 1, p.board ?? '', p.mitres, p.grooves.map(grooveText).join('; '), p.holes.map(holeText).join('; ')]);
  return '﻿' + [head, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
}
