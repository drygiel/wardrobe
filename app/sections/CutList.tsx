import cutlist from '@/components/cutlist.json';
import { mm, partLabel } from '@/editor/labels';
import styles from './CutList.module.scss';

// Written by scripts/export.py from Szafa4.blend: one row per frame piece, millimetres
type Hole = { dowel: string; face: string; d: number; depth: number; at: [number, string][] };
type Groove = { face: string; width: number; depth: number; from: number; to: number; along: string; offset: number; offsetAlong: string };
type Piece = { name: string; length: number; width: number; thickness: number; board: string | null; mitres: number; grooves: Groove[]; holes: Hole[] };

const PIECES = cutlist as Piece[];
const SHEET = '3000 × 620 × 40';

const ON_FACE: Record<string, string> = { 'prawy bok': 'prawym boku', 'lewy bok': 'lewym boku', front: 'froncie', tył: 'tyle', spód: 'spodzie', góra: 'górze' };

const size = (p: Piece) => `${mm(p.length)} × ${mm(p.width)} × ${mm(p.thickness)}`;
const groove = (g: Groove) =>
  `Frez LED ${mm(g.width)} × ${mm(g.depth)} na ${ON_FACE[g.face] ?? g.face}, ${mm(g.offset)} ${g.offsetAlong}, od ${mm(g.from)} do ${mm(g.to)} ${g.along}`;
const hole = (h: Hole) => `${h.dowel}: ${h.face}, ${h.at.map(([v, from]) => `${mm(v)} ${from}`).join(', ')}, Ø${mm(h.d)} × ${mm(h.depth)}`;
// 1 otwór, 2–4 otwory (but 12–14 otworów), 5+ otworów
const holeWord = (n: number) => (n === 1 ? 'otwór' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'otwory' : 'otworów');
const holes = (p: Piece) => (p.holes.length ? `${p.holes.length} × Ø${mm(p.holes[0].d)} × ${mm(p.holes[0].depth)}` : '');

function downloadCsv() {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const head = ['Kod', 'Formatka', 'Długość', 'Szerokość', 'Grubość', 'Szt.', 'Płyta', 'Ścięcia 45°', 'Frez LED', 'Otwory na kołki'];
  const rows = PIECES.map(p => [
    p.name.slice(0, 3),
    partLabel(p.name),
    mm(p.length),
    mm(p.width),
    mm(p.thickness),
    1,
    p.board ?? '',
    p.mitres,
    p.grooves.map(groove).join('; '),
    p.holes.map(hole).join('; '),
  ]);
  // Semicolons and a BOM: Polish Excel opens it as columns with the diacritics intact
  const csv = '﻿' + [head, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rama-formatki.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// Opens every hole list first: closed <details> do not print
function print() {
  document.querySelectorAll<HTMLDetailsElement>('#zamowienie details').forEach(d => (d.open = true));
  window.print();
}

// The frame's order list: what a joinery needs to cut, mill and drill every piece
export default function CutList() {
  const boards = new Set(PIECES.map(p => p.board).filter(Boolean)).size;
  const drilled = PIECES.reduce((sum, p) => sum + p.holes.length, 0);

  return (
    <section id="zamowienie" className={styles.cutlist} aria-labelledby="zamowienie-h">
      <div className={styles.head}>
        <h2 id="zamowienie-h">Lista do zamówienia</h2>
        <p>
          {PIECES.length} formatek z {boards} płyt dębowych {SHEET} mm. Wymiary gotowych formatek w milimetrach, po obróbce. Kierunki jak przy patrzeniu na szafę od frontu.
        </p>
        <div className={styles.actions}>
          <button className="btn" onClick={downloadCsv}>
            Pobierz CSV
          </button>
          <button className="link" onClick={print}>
            Drukuj
          </button>
        </div>
      </div>

      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Kod</th>
              <th scope="col">Formatka</th>
              <th scope="col">Dł. × szer. × gr.</th>
              <th scope="col">Płyta</th>
              <th scope="col">Obróbka</th>
            </tr>
          </thead>
          <tbody>
            {PIECES.map(p => (
              <tr key={p.name}>
                <th scope="row">{p.name.slice(0, 3)}</th>
                <td>{partLabel(p.name)}</td>
                <td className={styles.number}>{size(p)}</td>
                <td>{p.board}</td>
                <td>
                  <ul className={styles.work}>
                    {p.mitres > 0 && <li>Ścięcia 45°: {p.mitres}</li>}
                    {p.grooves.map(g => (
                      <li key={g.face}>{groove(g)}</li>
                    ))}
                    {p.holes.length > 0 && (
                      <li>
                        <details>
                          <summary>Otwory na kołki: {holes(p)}</summary>
                          <ul>
                            {p.holes.map((h, i) => (
                              <li key={i}>{hole(h)}</li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    )}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Razem</th>
              <td colSpan={4}>
                {PIECES.length} formatek, {boards} płyty {SHEET} mm, {drilled} {holeWord(drilled)} na kołki 8 × 40 mm
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
