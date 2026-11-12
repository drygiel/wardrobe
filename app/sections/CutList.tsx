import * as THREE from 'three';
import { type ComponentRef, type KeyboardEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useCursor, useGLTF } from '@react-three/drei';
import cn from 'classnames';
import { FRAME_BOARDS, FRAME_GLB, FRAME_PIECES, flatPiece } from '@/assets';
import { grainAxis } from '@/components/grain';
import { GROUPS } from '@/components/parts';
import { Icon } from '@/editor/icons';
import { keptSpans, type MarkHover, PartDrawing } from '@/editor/PartDrawing';
import { mm, partLabel } from '@/editor/labels';
import { ALL_LAYERS, BreakToggle, type Layers, marksOf, PieceChips } from './PieceChips';
import { focusOf, NO_FOCUS, PieceOps } from './PieceOps';
import { code, grooveText, PIECES, type Piece, plural, position, SHEET, size, toCsv, totals } from './orderList';
import styles from './CutList.module.scss';

type FrameResult = { scene: THREE.Group; nodes: Record<string, THREE.Mesh> };

const TOTALS = totals();
// Wide enough for the three boards in one row at about the scale they had stacked beside the ticket
const ACROSS = '(min-width: 1000px)';

function useMatches(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}
const STILL = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// The 3D frame sits on the drawing's paper: dark grey pieces, mid grey edges between them, the picked one in LED amber
const LOCATOR = {
  on: new THREE.MeshStandardMaterial({ color: '#f0b35a', roughness: 0.9 }),
  hover: new THREE.MeshStandardMaterial({ color: '#7d7568', roughness: 1 }),
  off: new THREE.MeshStandardMaterial({ color: '#4d4740', roughness: 1 }),
  edge: new THREE.LineBasicMaterial({ color: '#a59d90' }),
};
const locatorEdges = new Map<string, THREE.EdgesGeometry>();
const noRaycast = () => null;
const edgesOf = (name: string, geometry: THREE.BufferGeometry) => locatorEdges.get(name) ?? locatorEdges.set(name, new THREE.EdgesGeometry(geometry, 30)).get(name)!;
// Beside the text on a wide page the drawing keeps its right end free above the title strip for the 3D frame laid over it
const SHEET_WIDE = { width: 460, height: 300, inset: 130 };
const TITLE_STRIP = 24; // PartDrawing's title strip, which the 3D frame stays above
// The measuring page with only the frame, the piece pinned in its inspector
const editorLink = (name: string) => `/pomiar?hide=${GROUPS.map(g => g.id).filter(id => id !== 'frame').join()}&pin=${name}`;

function download(text: string, file: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file;
  link.click();
  URL.revokeObjectURL(url);
}

// The three boards at scale, every piece drawn from its own mesh as laid for cutting: the order list's map
function Boards({
  across,
  selected,
  sheet,
  hover,
  onPick,
  onHover,
}: {
  across: boolean; // the three boards side by side in one row, not stacked
  selected: string;
  sheet: string | null; // the selected piece's board, lit; the other two dimmed
  hover: string | null;
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
    const GAP = across ? 260 : 210;
    let at = 0;
    const rows = sheets.map(sheet => {
      const w = (sheet.box.max.x - sheet.box.min.x) * 1000;
      const h = (sheet.box.max.z - sheet.box.min.z) * 1000;
      const row = { ...sheet, x: across ? at : 0, y: across ? 0 : at, w, h };
      at += (across ? w : h) + GAP;
      return row;
    });
    const pieces = PIECES.map(piece => {
      const { mesh, box } = flat(flatPiece(piece.name));
      const row = rows.find(r => box.min.z >= r.box.min.z - 1e-4 && box.max.z <= r.box.max.z + 1e-4) ?? rows[0];
      const X = (x: number) => row.x + (x - row.box.min.x) * 1000;
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
      return { piece, d, sheet: row.name, x: X(box.min.x), y: Y(box.min.z), w: (box.max.x - box.min.x) * 1000, h: (box.max.z - box.min.z) * 1000 };
    });
    const width = across ? at - GAP : Math.max(...rows.map(r => r.w));
    const height = across ? Math.max(...rows.map(r => r.h)) : at - GAP;
    return { rows, pieces, width, height };
  }, [nodes, across]);

  // A 40 mm strip is too thin for its code: the one in focus gets it beside the boards (below them in a row), on a leader
  const callout = hover ?? selected;

  return (
    <svg
      className={styles.boards}
      viewBox={across ? `-40 -190 ${layout.width + 80} ${layout.height + 420}` : `-230 -170 ${layout.width + 560} ${layout.height + 210}`}
      role="group"
      aria-label={`Rozkrój: ${layout.rows.length} płyty ${SHEET} mm`}
      onPointerLeave={() => onHover(null)}
    >
      {layout.rows.map(row => (
        <g key={row.name} className={cn(sheet && (row.name === sheet ? styles.sheetOn : styles.sheetOff))}>
          <rect className={styles.sheet} x={row.x} y={row.y} width={row.w} height={row.h} />
          {/* The whole sheet's size on a dimension line above it, as on a drawing; the sheet mesh is flat, so the order list's size */}
          <g className={styles.sheetSize}>
            <path d={`M${row.x} ${row.y - 40}h${row.w}M${row.x} ${row.y - 62}v44M${row.x + row.w} ${row.y - 62}v44`} />
            <text x={row.x + row.w / 2} y={row.y - 66} textAnchor="middle" fontSize={88}>
              {SHEET} mm
            </text>
          </g>
          {across ? (
            <text className={styles.sheetName} x={row.x} y={row.y - 66}>
              {row.name}
            </text>
          ) : (
            <text className={styles.sheetName} x={-40} y={row.y + row.h / 2} dominantBaseline="middle" textAnchor="end">
              {row.name}
            </text>
          )}
        </g>
      ))}
      {layout.pieces.map(({ piece, d, sheet: on, x, y, w, h }) => {
        const name = piece.name;
        const strip = Math.min(w, h) < 120;
        return (
          <g
            key={name}
            className={cn(styles.cut, sheet && on !== sheet && styles.sheetOff, name === selected && styles.cutOn, name === hover && styles.cutHover)}
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
              </text>
            )}
            {strip && name === callout && (
              <g className={styles.callout}>
                {across ? (
                  <>
                    <path d={`M${x + w / 2} ${y + h + 12}V${layout.height + 70}`} />
                    <text x={x + w / 2} y={layout.height + 180} textAnchor="middle" fontSize={110}>
                      {code(piece)}
                    </text>
                  </>
                ) : (
                  <>
                    <path d={`M${x + w + 12} ${y + h / 2}H${layout.width + 40}`} />
                    <text x={layout.width + 60} y={y + h / 2} dominantBaseline="central" fontSize={110}>
                      {code(piece)}
                    </text>
                  </>
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Drawing({
  piece,
  active,
  groove,
  layers,
  wide,
  broken,
  onMark,
  onBroken,
}: {
  piece: Piece;
  active: number | null;
  groove: number | null;
  layers: Layers;
  wide: boolean;
  broken: boolean;
  onMark: (mark: MarkHover) => void;
  onBroken: () => void;
}) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as FrameResult;
  const mesh = nodes[piece.name];
  const marks = useMemo(() => ({ ...marksOf(piece, mesh, active, layers), activeGroove: groove }), [piece, mesh, active, groove, layers]);
  const axis = grainAxis(piece.name, mesh.geometry);
  const grain = typeof axis === 'number' ? axis : undefined;
  // Only a part long enough to have a plain middle offers the shortened view
  const long = keptSpans(mesh.geometry, grain, marks.holes).length > 1;
  return (
    <>
      <PartDrawing geometry={mesh.geometry} code={`${code(piece)} · ${partLabel(piece.name)}`} unit="mm" grain={grain} marks={marks} onMark={onMark} snap={0.5} broken={broken && long} {...(wide ? SHEET_WIDE : {})} />
      {long && <BreakToggle on={broken} onToggle={onBroken} />}
    </>
  );
}

// The frame orbiting slowly, the piece lit. The camera keeps the whole frame in shot from any angle: far enough for
// the bounding sphere upright, and sideways for the radius of the turn about the vertical axis, much less for a flat frame
type Hover = { hover: string | null; onHover: (name: string | null) => void };

function LocatorFrame({ name, spin, onPick, hover, onHover }: { name: string; spin: boolean; onPick: (name: string) => void } & Hover) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as FrameResult;
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const invalidate = useThree(s => s.invalidate);
  // The page shares the hovered piece with the map and the codes; the pointer cursor follows only this view's own
  const [pointed, setPointed] = useState<string | null>(null);
  useCursor(pointed !== null);

  const goal = useMemo(() => {
    const box = new THREE.Box3();
    FRAME_PIECES.forEach(n => {
      const mesh = nodes[n];
      mesh.geometry.computeBoundingBox();
      mesh.updateMatrix();
      box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix));
    });
    const size = box.getSize(new THREE.Vector3());
    return { center: box.getCenter(new THREE.Vector3()), radius: size.length() / 2, across: Math.hypot(size.x, size.z) / 2 };
  }, [nodes]);

  useEffect(() => invalidate(), [spin, invalidate]);

  // Every frame, so a resized view refits at once: same direction, distance for the current aspect
  useFrame(state => {
    const target = controls.current?.target;
    if (!target) return;
    const camera = state.camera as THREE.PerspectiveCamera;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const distance = Math.max(goal.radius / Math.sin(half), goal.across / Math.sin(Math.atan(Math.tan(half) * camera.aspect))) * 1.1;
    const offset = camera.position.clone().sub(target);
    target.copy(goal.center);
    camera.position.copy(target).add(offset.setLength(distance));
  });

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        autoRotate={spin && !STILL}
        autoRotateSpeed={0.8}
        minPolarAngle={0.5}
        maxPolarAngle={1.5}
      />
      {FRAME_PIECES.map(n => (
        <mesh
          key={n}
          geometry={nodes[n].geometry}
          position={nodes[n].position}
          quaternion={nodes[n].quaternion}
          material={n === name ? LOCATOR.on : n === hover ? LOCATOR.hover : LOCATOR.off}
          onPointerOver={e => {
            e.stopPropagation();
            setPointed(n);
            onHover(n);
          }}
          onPointerOut={() => {
            setPointed(p => (p === n ? null : p));
            onHover(null);
          }}
          onClick={e => {
            e.stopPropagation();
            // A drag that ends on a piece turned the frame, it did not pick
            if (e.delta < 6) onPick(n);
          }}
        >
          {/* Not hit by the pointer: a line's pick radius is a whole metre and would hand the hover to a piece behind */}
          <lineSegments geometry={edgesOf(n, nodes[n].geometry)} material={LOCATOR.edge} raycast={noRaycast} />
        </mesh>
      ))}
    </>
  );
}

function Locator({ name, onPick, hover, onHover }: { name: string; onPick: (name: string) => void } & Hover) {
  const view = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [over, setOver] = useState(false);

  // Spinning keeps rendering, so it stops while the view is off screen or under the pointer
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(view.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={view} className={styles.locatorView} onPointerEnter={() => setOver(true)} onPointerLeave={() => setOver(false)}>
      <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ fov: 30, position: [-5.2, 2.4, -3.6], near: 0.1, far: 50 }}>
        <ambientLight intensity={1.6} />
        <directionalLight position={[-4, 6, -3]} intensity={2.4} />
        <Suspense fallback={null}>
          <LocatorFrame name={name} spin={visible && !over} hover={hover} onHover={onHover} onPick={onPick} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// The frame's order list: a board map to pick from and a ticket with the piece's drawing and every operation on it
export default function CutList() {
  const [index, setIndex] = useState(0);
  // The hole and the LED groove in focus, from the drawing or from the operations list: each lights the other
  const [focus, setFocus] = useState(NO_FOCUS);
  const [hover, setHover] = useState<string | null>(null);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [broken, setBroken] = useState(false);
  const across = useMatches(ACROSS);
  const piece = PIECES[index];

  const select = (i: number) => {
    setIndex((i + PIECES.length) % PIECES.length);
    setFocus(NO_FOCUS);
  };
  const pick = (name: string) => select(PIECES.findIndex(p => p.name === name));
  const onKey = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest('input, a, summary, tr')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') select(index + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') select(index - 1);
    else return;
    event.preventDefault();
  };

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
          Każda formatka z płyty dębowej {SHEET} mm, z wymiarem po obróbce,{' '}
          <Link className="mention" to="#led">
            frezem pod LED
          </Link>{' '}
          i każdym otworem na kołek, policzona z{' '}
          <Link className="mention" to="/pomiar">
            modelu 3D
          </Link>
          . Kierunki jak przy patrzeniu na szafę od frontu.
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
          <button className="link" onClick={() => window.print()}>
            Drukuj listę
          </button>
          <button className="btn" onClick={() => download(toCsv(), 'rama-formatki.csv')}>
            <Icon name="download" />
            Pobierz CSV
          </button>
        </div>
      </header>

      <div className={styles.desk} onKeyDown={onKey}>
        <div className={styles.map}>
          <div className={styles.mapHead}>
            <span>Rozkrój. Kliknij formatkę.</span>
          </div>
          <Suspense fallback={<div className={styles.placeholder} />}>
            <Boards across={across} selected={piece.name} sheet={piece.board} hover={hover} onPick={pick} onHover={setHover} />
          </Suspense>
          <ol className={styles.codes} aria-label="Formatki">
            {PIECES.map((p, i) => (
              <li key={p.name}>
                <button
                  className={cn(i === index && styles.codeOn, p.name === hover && styles.codeHover)}
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

        <article className={styles.ticket} aria-labelledby="ticket-h">
          <div className={styles.ticketHead} key={`head-${piece.name}`}>
            <span className={styles.code} aria-hidden="true">
              {code(piece)}
            </span>
            <div className={styles.title}>
              <h3 id="ticket-h">
                <span className={styles.sr}>{code(piece)}, </span>
                {partLabel(piece.name)}
              </h3>
              <p className={styles.size}>
                {size(piece)} <small>mm</small>
              </p>
            </div>
            <PieceChips className={styles.chips} piece={piece} layers={layers} onToggle={layer => setLayers(old => ({ ...old, [layer]: !old[layer] }))} />
          </div>

          <div className={styles.views}>
            <figure className={styles.paper} key={piece.name}>
              <Suspense fallback={<div className={styles.placeholder} />}>
                <Drawing
                  piece={piece}
                  active={focus.hole}
                  groove={focus.groove}
                  layers={layers}
                  wide={across}
                  broken={broken}
                  onMark={mark => setFocus(focusOf(mark))}
                  onBroken={() => setBroken(!broken)}
                />
              </Suspense>
              <figcaption>Trzy rzuty z modelu. Otwory na kołki przerywaną linią, frez LED na bursztynowo.</figcaption>
            </figure>
            <figure
              className={cn(styles.locator, across && styles.locatorOver)}
              style={across ? { width: `${(SHEET_WIDE.inset / SHEET_WIDE.width) * 100}%`, aspectRatio: `${SHEET_WIDE.inset} / ${SHEET_WIDE.height - TITLE_STRIP}` } : undefined}
              aria-hidden="true"
            >
              <Locator name={piece.name} onPick={pick} hover={hover} onHover={setHover} />
              <figcaption>Miejsce w ramie</figcaption>
            </figure>
          </div>

          <PieceOps className={styles.ops} key={`ops-${piece.name}`} piece={piece} focus={focus} onFocus={setFocus} />

          <footer className={styles.ticketFoot}>
            <button className={styles.nav} onClick={() => select(index - 1)} aria-label={`Poprzednia formatka, ${code(prev)}`}>
              ← {code(prev)}
            </button>
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
