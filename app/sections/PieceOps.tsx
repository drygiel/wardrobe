import cn from 'classnames';
import type { Unit } from '@/contexts/AppContext';
import { mm } from '@/editor/labels';
import type { MarkHover } from '@/editor/PartDrawing';
import { grooveText, type Piece, plural, position } from './orderList';
import styles from './PieceOps.module.scss';

// The hole or the groove in focus, by the ids the drawing's marks carry; hovering either side sets it
export type Focus = { hole: number | null; groove: number | null };
export const NO_FOCUS: Focus = { hole: null, groove: null };
export const focusOf = (mark: MarkHover): Focus => ({ hole: mark && 'hole' in mark ? mark.hole : null, groove: mark && 'groove' in mark ? mark.groove : null });

// A frame piece's operations, numbered like a work order: mitres, LED grooves, every dowel hole
export function PieceOps({ piece, focus, onFocus, unit = 'mm', className }: { piece: Piece; focus: Focus; onFocus: (focus: Focus) => void; unit?: Unit; className?: string }) {
  // Two decimals in centimetres, so a 7,5 mm groove stays 0,75 and not 0,8
  const length = (millimetres: number) => (unit === 'cm' ? (millimetres / 10).toLocaleString('pl-PL', { maximumFractionDigits: 2, useGrouping: false }) : mm(millimetres));
  const hole = (i: number | null) => onFocus({ hole: i, groove: null });
  const groove = (i: number | null) => onFocus({ hole: null, groove: i });
  return (
    <ol className={cn(styles.ops, className)}>
      {piece.mitres > 0 && (
        <li>
          <b>Ścięcia 45°</b>
          <span>
            {piece.mitres} {plural(piece.mitres, 'koniec', 'końce', 'końców')} pod kątem, tam gdzie formatka spotyka sąsiednią
          </span>
        </li>
      )}
      {piece.grooves.map((g, i) => (
        <li key={g.face} className={cn(styles.led, focus.groove === i && styles.grooveOn)} onPointerEnter={() => groove(i)} onPointerLeave={() => groove(null)}>
          <b>Frez LED</b>
          <span>{grooveText(g, length).replace(/^Frez LED /, '')}</span>
        </li>
      ))}
      {piece.holes.length > 0 && (
        <li className={styles.holes}>
          <b>Otwory na kołki 8 × 40</b>
          <table>
            <thead>
              <tr>
                <th scope="col">Złącze</th>
                <th scope="col">Ściana</th>
                <th scope="col">Pozycja, {unit}</th>
                <th scope="col">Ø × głęb.</th>
              </tr>
            </thead>
            <tbody>
              {piece.holes.map((h, i) => (
                <tr
                  key={i}
                  className={cn(focus.hole === i && styles.holeOn)}
                  tabIndex={0}
                  onPointerEnter={() => hole(i)}
                  onPointerLeave={() => hole(null)}
                  onFocus={() => hole(i)}
                  onBlur={() => hole(null)}
                >
                  <th scope="row">{h.dowel}</th>
                  <td>{h.face}</td>
                  <td>{position(h, length)}</td>
                  <td>
                    {length(h.d)} × {length(h.depth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
      )}
    </ol>
  );
}
