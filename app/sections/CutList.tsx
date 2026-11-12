import * as THREE from 'three';
import { type KeyboardEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import cn from 'classnames';
import { FRAME_BOARDS, FRAME_GLB, flatPiece } from '@/assets';
import { grainAxis } from '@/components/grain';
import { GROUPS } from '@/components/parts';
import { Icon } from '@/editor/icons';
import { type DrawingMarks, PartDrawing } from '@/editor/PartDrawing';
import { mm, partLabel } from '@/editor/labels';
import { Preview } from './PartsSection';
import { code, grooveText, PIECES, type Piece, plural, position, SHEET, size, toCsv, totals } from './orderList';
import styles from './CutList.module.scss';

type FrameResult = { scene: THREE.Group; nodes: Record<string, THREE.Mesh> };

const STORE = 'wardrobe.cutlist.checked';
const TOTALS = totals();
// The measuring page with only the frame, the piece pinned in its inspector
const editorLink = (name: string) => `/pomiar?hide=${GROUPS.map(g => g.id).filter(id => id !== 'frame').join()}&pin=${name}`;

function loadChecked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORE) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveChecked(names: Set<string>) {
  try {
    localStorage.setItem(STORE, JSON.stringify([...names]));
  } catch {
    // private mode: the ticks just do not survive a reload
  }
}

function download(text: string, file: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file;
  link.click();
  URL.revokeObjectURL(url);
}

// Blender millimetres from the piece's corner into the glTF mesh's own axes (Blender x, y, z is glTF x, -z, y)
function marksOf(piece: Piece, mesh: THREE.Mesh, active: number | null): DrawingMarks {
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
    holes: piece.holes.map((h, id) => ({ id, at: point(h.entry), dir: axis(h.axis, h.into), r: h.d / 2000, depth: h.depth / 1000 })),
    grooves: piece.grooves.map(g => {
      const a = point(g.min);
      const b = point(g.max);
      return { min: a.clone().min(b), max: a.max(b) };
    }),
    active,
  };
}

// The three boards at scale, every piece drawn from its own mesh as laid for cutting: the order list's map
function Boards({
  selected,
  hover,
  checked,
  onPick,
  onHover,
}: {
  selected: string;
  hover: string | null;
  checked: Set<string>;
  onPick: (name: string) => void;
  onHover: (name: string | null) => void;
}) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as FrameResult;
  const layout = useMemo(() => {
    const flat = (name: string) => {
      const mesh = nodes[name];
      mesh.updateWorldMatrix(true, false);
      mesh.geometry.computeBoundingBox();
      return { mesh, box: mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld) };
    };
    const sheets = [...FRAME_BOARDS].map(name => ({ name: name.slice(-3), ...flat(name) })).sort((a, b) => a.name.localeCompare(b.name));
    const GAP = 150;
    let top = 0;
    const rows = sheets.map(sheet => {
      const row = { ...sheet, y: top, h: (sheet.box.max.z - sheet.box.min.z) * 1000 };
      top += row.h + GAP;
      return row;
    });
    const pieces = PIECES.map(piece => {
      const { mesh, box } = flat(flatPiece(piece.name));
      const row = rows.find(r => box.min.z >= r.box.min.z - 1e-4 && box.max.z <= r.box.max.z + 1e-4) ?? rows[0];
      const X = (x: number) => (x - row.box.min.x) * 1000;
      const Y = (z: number) => row.y + (z - row.box.min.z) * 1000;
      // Outline from the mesh's edges seen from above: mitred ends show as they will be cut
      const edges = new THREE.EdgesGeometry(mesh.geometry, 30).attributes.position.array;
      const v = new THREE.Vector3();
      let d = '';
      for (let i = 0; i < edges.length; i += 6) {
        v.set(edges[i], edges[i + 1], edges[i + 2]).applyMatrix4(mesh.matrixWorld);
        const x1 = X(v.x);
        const y1 = Y(v.z);
        v.set(edges[i + 3], edges[i + 4], edges[i + 5]).applyMatrix4(mesh.matrixWorld);
        const x2 = X(v.x);
        const y2 = Y(v.z);
        if (Math.hypot(x2 - x1, y2 - y1) > 0.5) d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
      return { piece, d, x: X(box.min.x), y: Y(box.min.z), w: (box.max.x - box.min.x) * 1000, h: (box.max.z - box.min.z) * 1000 };
    });
    const width = Math.max(...rows.map(r => (r.box.max.x - r.box.min.x) * 1000));
    return { rows, pieces, width, height: top - GAP };
  }, [nodes]);

  // A 40 mm strip is too thin for its code: the one in focus gets it beside the board, on a leader
  const callout = hover ?? selected;

  return (
    <svg
      className={styles.boards}
      viewBox={`-230 -40 ${layout.width + 560} ${layout.height + 80}`}
      role="group"
      aria-label={`Rozkrój: ${layout.rows.length} płyty ${SHEET} mm`}
      onPointerLeave={() => onHover(null)}
    >
      {layout.rows.map(row => (
        <g key={row.name}>
          <rect className={styles.sheet} x={0} y={row.y} width={(row.box.max.x - row.box.min.x) * 1000} height={row.h} />
          <text className={styles.sheetName} x={-40} y={row.y + row.h / 2} dominantBaseline="middle" textAnchor="end">
            {row.name}
          </text>
        </g>
      ))}
      {layout.pieces.map(({ piece, d, x, y, w, h }) => {
        const name = piece.name;
        const strip = Math.min(w, h) < 120;
        return (
          <g
            key={name}
            className={cn(styles.cut, name === selected && styles.cutOn, name === hover && styles.cutHover, checked.has(name) && styles.cutDone)}
            role="button"
            aria-label={`${code(piece)}, ${partLabel(name)}, ${size(piece)} mm`}
            aria-pressed={name === selected}
            onClick={() => onPick(name)}
            onPointerEnter={() => onHover(name)}
          >
            <title>{`${code(piece)} · ${partLabel(name)} · ${size(piece)} mm`}</title>
            <rect className={styles.cutFill} x={x} y={y} width={w} height={h} />
            <path className={styles.cutEdges} d={d} />
            {!strip && (
              <text className={styles.cutCode} x={x + w / 2} y={y + h / 2} dominantBaseline="central" textAnchor="middle" fontSize={96}>
                {code(piece)}
                {checked.has(name) ? ' ✓' : ''}
              </text>
            )}
            {strip && name === callout && (
              <g className={styles.callout}>
                <path d={`M${x + w + 12} ${y + h / 2}H${layout.width + 40}`} />
                <text x={layout.width + 60} y={y + h / 2} dominantBaseline="central" fontSize={110}>
                  {code(piece)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Drawing({ piece, active }: { piece: Piece; active: number | null }) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as FrameResult;
  const mesh = nodes[piece.name];
  const marks = useMemo(() => marksOf(piece, mesh, active), [piece, mesh, active]);
  const grain = grainAxis(piece.name, mesh.geometry);
  return <PartDrawing geometry={mesh.geometry} code={`${code(piece)} · ${partLabel(piece.name)}`} unit="mm" grain={typeof grain === 'number' ? grain : undefined} marks={marks} snap={0.5} />;
}

function Locator({ name }: { name: string }) {
  return (
    <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ fov: 30, position: [-5.2, 2.4, -3.6], near: 0.1, far: 50 }} onCreated={s => s.camera.lookAt(0, 0, 0)}>
      <ambientLight intensity={1.6} />
      <directionalLight position={[-4, 6, -3]} intensity={2.4} />
      <Preview active={[name]} />
    </Canvas>
  );
}

// The frame's order list: a board map to pick from, a ticket with the piece's drawing and every operation on it,
// and ticks that remember which pieces were checked against the joiner's quote
export default function CutList() {
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const piece = PIECES[index];

  useEffect(() => setChecked(loadChecked()), []);

  const select = (i: number) => {
    setIndex((i + PIECES.length) % PIECES.length);
    setHole(null);
  };
  const pick = (name: string) => select(PIECES.findIndex(p => p.name === name));
  const toggle = (name: string) =>
    setChecked(old => {
      const next = new Set(old);
      if (!next.delete(name)) next.add(name);
      saveChecked(next);
      return next;
    });
  const onKey = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest('input, a, summary, tr')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') select(index + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') select(index - 1);
    else return;
    event.preventDefault();
  };

  const done = PIECES.filter(p => checked.has(p.name)).length;
  const prev = PIECES[(index - 1 + PIECES.length) % PIECES.length];
  const next = PIECES[(index + 1) % PIECES.length];
  const stats: [number, string][] = [
    [TOTALS.pieces, plural(TOTALS.pieces, 'formatka', 'formatki', 'formatek')],
    [TOTALS.boards, plural(TOTALS.boards, 'płyta', 'płyty', 'płyt')],
    [TOTALS.holes, plural(TOTALS.holes, 'otwór', 'otwory', 'otworów')],
    [TOTALS.grooves, plural(TOTALS.grooves, 'frez LED', 'frezy LED', 'frezów LED')],
    [TOTALS.mitres, plural(TOTALS.mitres, 'ścięcie 45°', 'ścięcia 45°', 'ścięć 45°')],
  ];

  return (
    <section id="zamowienie" className={styles.order} aria-labelledby="zamowienie-h">
      <header className={styles.head}>
        <p className={styles.kicker}>Do stolarni</p>
        <h2 id="zamowienie-h">Lista do zamówienia</h2>
        <p className={styles.lead}>
          Każda formatka z płyty dębowej {SHEET} mm, z wymiarem po obróbce, frezem i każdym otworem na kołek, policzona z modelu. Kierunki jak przy patrzeniu na szafę od frontu.
        </p>
        <dl className={styles.stats}>
          {stats.map(([value, label]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.actions}>
          <button className="btn" onClick={() => download(toCsv(), 'rama-formatki.csv')}>
            <Icon name="download" />
            Pobierz CSV
          </button>
          <button className="link" onClick={() => window.print()}>
            Drukuj listę
          </button>
        </div>
      </header>

      <div className={styles.desk} onKeyDown={onKey}>
        <div className={styles.map}>
          <div className={styles.mapHead}>
            <span>Rozkrój. Kliknij formatkę.</span>
            <span className={styles.progress} aria-live="polite">
              Sprawdzone {done} z {PIECES.length}
              <i>
                <b style={{ width: `${(done / PIECES.length) * 100}%` }} />
              </i>
            </span>
          </div>
          <Suspense fallback={<div className={styles.placeholder} />}>
            <Boards selected={piece.name} hover={hover} checked={checked} onPick={pick} onHover={setHover} />
          </Suspense>
          <ol className={styles.codes} aria-label="Formatki">
            {PIECES.map((p, i) => (
              <li key={p.name}>
                <button
                  className={cn(i === index && styles.codeOn, checked.has(p.name) && styles.codeDone)}
                  aria-current={i === index}
                  onClick={() => select(i)}
                  onPointerEnter={() => setHover(p.name)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(p.name)}
                  onBlur={() => setHover(null)}
                  title={`${partLabel(p.name)}, ${size(p)} mm`}
                >
                  {code(p)}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <article className={styles.ticket} key={piece.name} aria-labelledby="ticket-h">
          <div className={styles.ticketHead}>
            <span className={styles.code} aria-hidden="true">
              {code(piece)}
            </span>
            <div>
              <h3 id="ticket-h">
                <span className={styles.sr}>{code(piece)}, </span>
                {partLabel(piece.name)}
              </h3>
              <p className={styles.size}>
                {size(piece)} <small>mm</small>
              </p>
              <ul className={styles.chips}>
                <li>Płyta {piece.board}</li>
                {piece.mitres > 0 && <li>{piece.mitres} × ścięcie 45°</li>}
                {piece.grooves.length > 0 && <li className={styles.chipLed}>Frez LED</li>}
                {piece.holes.length > 0 && (
                  <li>
                    {piece.holes.length} {plural(piece.holes.length, 'otwór', 'otwory', 'otworów')}
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className={styles.views}>
            <figure className={styles.paper}>
              <Suspense fallback={<div className={styles.placeholder} />}>
                <Drawing piece={piece} active={hole} />
              </Suspense>
              <figcaption>Trzy rzuty z modelu. Otwory na kołki przerywaną linią, frez LED na bursztynowo.</figcaption>
            </figure>
            <figure className={styles.locator} aria-hidden="true">
              <div className={styles.locatorView}>
                <Suspense fallback={null}>
                  <Locator name={piece.name} />
                </Suspense>
              </div>
              <figcaption>Miejsce w ramie</figcaption>
            </figure>
          </div>

          <ol className={styles.ops}>
            {piece.mitres > 0 && (
              <li>
                <b>Ścięcia 45°</b>
                <span>
                  {piece.mitres} {plural(piece.mitres, 'koniec', 'końce', 'końców')} pod kątem, tam gdzie formatka spotyka sąsiednią
                </span>
              </li>
            )}
            {piece.grooves.map(g => (
              <li key={g.face} className={styles.opLed}>
                <b>Frez LED</b>
                <span>{grooveText(g).replace(/^Frez LED /, '')}</span>
              </li>
            ))}
            {piece.holes.length > 0 && (
              <li className={styles.opHoles}>
                <b>Otwory na kołki 8 × 40</b>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Złącze</th>
                      <th scope="col">Ściana</th>
                      <th scope="col">Pozycja</th>
                      <th scope="col">Ø × głęb.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piece.holes.map((h, i) => (
                      <tr
                        key={i}
                        className={cn(hole === i && styles.holeOn)}
                        tabIndex={0}
                        onPointerEnter={() => setHole(i)}
                        onPointerLeave={() => setHole(null)}
                        onFocus={() => setHole(i)}
                        onBlur={() => setHole(null)}
                      >
                        <th scope="row">{h.dowel}</th>
                        <td>{h.face === 'ścięcie 45°' ? 'ścięcie 45°' : h.face}</td>
                        <td>{position(h)}</td>
                        <td>
                          {mm(h.d)} × {mm(h.depth)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            )}
          </ol>

          <footer className={styles.ticketFoot}>
            <button className={styles.nav} onClick={() => select(index - 1)} aria-label={`Poprzednia formatka, ${code(prev)}`}>
              ← {code(prev)}
            </button>
            <label className={styles.check}>
              <input type="checkbox" checked={checked.has(piece.name)} onChange={() => toggle(piece.name)} />
              <span>Sprawdzone z wyceną</span>
            </label>
            <Link className={styles.editor} to={editorLink(piece.name)}>
              Otwórz w edytorze pomiarów
              <Icon name="external" />
            </Link>
            <button className={styles.nav} onClick={() => select(index + 1)} aria-label={`Następna formatka, ${code(next)}`}>
              {code(next)} →
            </button>
          </footer>
        </article>
      </div>

      <table className={styles.printTable}>
        <caption>
          Lista do zamówienia: {TOTALS.pieces} formatek z {TOTALS.boards} płyt {SHEET} mm, {TOTALS.holes} {plural(TOTALS.holes, 'otwór', 'otwory', 'otworów')} na kołki 8 × 40 mm
        </caption>
        <thead>
          <tr>
            <th>Kod</th>
            <th>Formatka</th>
            <th>Wymiar, mm</th>
            <th>Płyta</th>
            <th>Obróbka</th>
          </tr>
        </thead>
        <tbody>
          {PIECES.map(p => (
            <tr key={p.name}>
              <th scope="row">{code(p)}</th>
              <td>{partLabel(p.name)}</td>
              <td>{size(p)}</td>
              <td>{p.board}</td>
              <td>
                {p.mitres > 0 && <div>Ścięcia 45°: {p.mitres}</div>}
                {p.grooves.map(g => (
                  <div key={g.face}>{grooveText(g)}</div>
                ))}
                {p.holes.map((h, i) => (
                  <div key={i}>
                    {h.dowel}: {h.face}, {position(h)}, Ø{mm(h.d)} × {mm(h.depth)}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
