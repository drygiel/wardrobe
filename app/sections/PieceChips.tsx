import * as THREE from 'three';
import cn from 'classnames';
import type { DrawingMarks } from '@/editor/PartDrawing';
import { type Piece, plural } from './orderList';
import styles from './PieceChips.module.scss';

// What a frame piece's drawing shows on top of its outline; each chip switches one on or off
export type Layers = { mitres: boolean; grooves: boolean; holes: boolean };
export const ALL_LAYERS: Layers = { mitres: true, grooves: true, holes: true };

// Blender millimetres from the piece's corner into the glTF mesh's own axes (Blender x, y, z is glTF x, -z, y)
export function marksOf(piece: Piece, mesh: THREE.Mesh, active: number | null, layers: Layers): DrawingMarks {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  const world = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  const inverse = mesh.matrixWorld.clone().invert();
  const point = (p: number[]) => new THREE.Vector3(world.min.x + p[0] / 1000, world.min.y + p[2] / 1000, world.max.z - p[1] / 1000).applyMatrix4(inverse);
  const axis = (i: number, sign: number) => {
    const v = [0, 0, 0];
    v[i] = sign;
    return new THREE.Vector3(v[0], v[2], -v[1]).transformDirection(inverse);
  };
  return {
    holes: layers.holes ? piece.holes.map((h, id) => ({ id, at: point(h.entry), dir: axis(h.axis, h.into), r: h.d / 2000, depth: h.depth / 1000, from: h.at.map(([mm]) => mm) })) : [],
    grooves: layers.grooves
      ? piece.grooves.map(g => {
          const a = point(g.min);
          const b = point(g.max);
          return { min: a.clone().min(b), max: a.max(b) };
        })
      : [],
    mitres: layers.mitres && piece.mitres > 0,
    active,
  };
}

// Under a drawing of a long part: draws it as a broken view, its plain middle left out
export function BreakToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button className={cn(styles.chip, styles.toggle)} aria-pressed={on} onClick={onToggle} title="Pomija gładki środek długiej formatki; końce, otwory i wymiary bez zmian">
      Widok skrócony
    </button>
  );
}

export function PieceChips({ piece, layers, onToggle, className }: { piece: Piece; layers: Layers; onToggle: (layer: keyof Layers) => void; className?: string }) {
  const chip = (layer: keyof Layers, label: string, colour?: string) => (
    <li>
      <button className={cn(styles.chip, colour)} aria-pressed={layers[layer]} onClick={() => onToggle(layer)} title={layers[layer] ? 'Ukryj na rysunku' : 'Pokaż na rysunku'}>
        {label}
      </button>
    </li>
  );
  return (
    <ul className={cn(styles.chips, className)} aria-label="Obróbka na rysunku">
      {piece.board && <li className={styles.chip}>Płyta {piece.board}</li>}
      {piece.mitres > 0 && chip('mitres', `${piece.mitres} × ścięcie 45°`)}
      {piece.grooves.length > 0 && chip('grooves', 'Frez LED', styles.led)}
      {piece.holes.length > 0 && chip('holes', `${piece.holes.length} ${plural(piece.holes.length, 'otwór', 'otwory', 'otworów')}`, styles.hole)}
    </ul>
  );
}
