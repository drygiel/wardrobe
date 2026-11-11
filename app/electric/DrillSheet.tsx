import { useMemo, useState } from 'react';
import { axes, BOARDS, DRILLS, type Drill, num, place, size } from './data';
import styles from './Elektryka.module.scss';

const groups = Object.entries(BOARDS).reduce<Record<string, string[]>>((all, [id, board]) => {
  (all[board.group] ??= []).push(id);
  return all;
}, {});

const fmt = (value: number) => num(value, Number.isInteger(value) ? 0 : 1);

function title(drill: Drill) {
  if (drill.kind === 'hole') return `Otwór Ø${drill.d}`;
  if (drill.kind === 'notch') return `Wycięcie ${fmt(drill.size![0])} × ${fmt(drill.size![1])}`;
  return drill.kind === 'bore' ? 'Gniazdo Ø8 × 25' : 'Gniazdo Ø8 × 6';
}

export function DrillSheet() {
  const [id, setId] = useState('IN_B_Side-R');
  const [row, setRow] = useState(0);
  const board = BOARDS[id];
  const items = useMemo(() => DRILLS.filter(d => d.board === id), [id]);
  const { length, width } = size(board);
  const axis = axes(board);
  const k = Math.max(length, width) / 100;
  const active = items[row] ?? items[0];
  const pos = place(board, active.at);
  const hasBore = items.some(d => d.kind === 'bore');

  const select = (next: string) => {
    setId(next);
    setRow(0);
  };

  return (
    <section id="wiercenie" className={styles.drill} aria-labelledby="wiercenie-h">
      <h2 id="wiercenie-h">Arkusze wiercenia</h2>
      <p className={styles.sectionLead}>Wszystkie wymiary w milimetrach, liczone od krawędzi tej formatki. Wybierz wiersz w tabeli, a rysunek pokaże jego wymiary.</p>

      <div className={styles.drillGrid}>
        <nav className={styles.boards} aria-label="Formatki">
          {Object.entries(groups).map(([group, ids]) => (
            <div key={group}>
              <h3>{group}</h3>
              <ul>
                {ids.map(item => (
                  <li key={item}>
                    <button aria-pressed={item === id} onClick={() => select(item)}>
                      <span>{BOARDS[item].label}</span>
                      <small>{DRILLS.filter(d => d.board === item).length}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.sheet}>
          <header>
            <h3>{board.label}</h3>
            <p>
              {id.length > 3 ? id : `Front ${id}`}, {fmt(length)} × {fmt(width)} mm
            </p>
          </header>

          <svg className={styles.drawing} viewBox={`${-12 * k} ${-14 * k} ${length + 24 * k} ${width + 28 * k}`} role="img" aria-label={`Rysunek formatki ${board.label} z ${items.length} miejscami do wycięcia`}>
            <rect className={styles.oak} width={length} height={width} rx={k * 0.2} />
            <text className={styles.edge} x={length / 2} y={width + 5.2 * k} style={{ fontSize: k * 2.6 }}>
              {board.form === 'door' ? 'krawędź z zawiasami' : 'front'}
            </text>

            {items.map((drill, i) => {
              const { u, v } = place(board, drill.at);
              const on = drill === active;
              const r = Math.max((drill.d ?? 8) / 2, k * 0.75);
              // A number sits right of its mark; with another mark in that spot it moves to the left
              // shortcut: handles pairs only, a row of three close marks needs real label placement
              const crowded = items.some(other => {
                const o = place(board, other.at);
                return o.u > u && o.u - u < k * 4 && Math.abs(o.v - v) < k * 3;
              });
              return (
                <g key={i} className={on ? styles.markOn : styles.mark} onPointerEnter={() => setRow(i)}>
                  {drill.kind === 'notch' && <rect x={u - drill.size![0] / 2} y={Math.min(v - drill.size![1] / 2, 0)} width={drill.size![0]} height={drill.size![1]} />}
                  {drill.kind === 'bore' && (
                    <>
                      <rect className={styles.bore} x={u - 4} y={width - 25} width={8} height={25} />
                      <circle cx={u} cy={width - 32} r={r * 0.8} />
                    </>
                  )}
                  {(drill.kind === 'hole' || drill.kind === 'magnet') && <circle cx={u} cy={v} r={r} />}
                  <text x={u + (crowded ? -1 : 1) * (r + k * 0.8)} y={Math.max(v, k * 3) + k * 1.1} textAnchor={crowded ? 'end' : 'start'} style={{ fontSize: k * 2.8 }}>
                    {i + 1}
                  </text>
                </g>
              );
            })}

            {/* Dimension lines outside the board, extension lines down to the mark */}
            <g className={styles.dims} style={{ strokeWidth: k * 0.16 }}>
              <path d={`M0 ${-5 * k}H${pos.u}M0 ${-6 * k}V${-4 * k}M${pos.u} ${-6 * k}V0`} />
              <path d={`M${-5 * k} 0V${pos.v}M${-6 * k} 0H${-4 * k}M${-6 * k} ${pos.v}H0`} />
              <path className={styles.onOak} d={`M${pos.u} 0V${pos.v}H0`} strokeDasharray={`${k} ${k * 0.7}`} />
              <text x={Math.max(pos.u / 2, 5 * k)} y={-7 * k} style={{ fontSize: k * 2.8 }}>
                {fmt(pos.u)}
              </text>
              <text transform={`translate(${-7 * k} ${pos.v / 2}) rotate(-90)`} style={{ fontSize: k * 2.8 }}>
                {fmt(pos.v)}
              </text>
            </g>
          </svg>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nr</th>
                  <th>Co wyciąć</th>
                  <th className={styles.number}>{axis.u}</th>
                  <th className={styles.number}>{axis.v}</th>
                  <th>Po co</th>
                </tr>
              </thead>
              <tbody>
                {items.map((drill, i) => {
                  const { u, v } = place(board, drill.at);
                  return (
                    <tr key={i} className={drill === active ? styles.rowOn : undefined} tabIndex={0} onFocus={() => setRow(i)} onPointerEnter={() => setRow(i)}>
                      <td>{i + 1}</td>
                      <td>{title(drill)}</td>
                      <td className={styles.number}>{fmt(u)}</td>
                      <td className={styles.number}>{fmt(v)}</td>
                      <td>{drill.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasBore && <p className={styles.note}>Gniazdo kontaktronu wchodzi w przednią krawędź. Otwór Ø5 na przewód trafia w nie 32 mm od frontu.</p>}
        </div>
      </div>
    </section>
  );
}
