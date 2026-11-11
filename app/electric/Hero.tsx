import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import cn from 'classnames';
import { FRAME_GLB, FRAME_PIECES, WARDROBE_GLB } from '@/assets';
import { boxes } from '@/components/PlanDrawing';
import { kindOf } from '@/components/parts';
import SiteNav from '@/sections/SiteNav';
import { useCircuit } from './circuit';
import { CABLE_METRES, CONTACTS, contact, DOOR_IDS, DRILLS, FULL_WATT, LED_METRES, LEDS, num, ROUTES, type Route } from './data';
import styles from './Elektryka.module.scss';

const WIDE = 2688;
const HIGH = 2655;
type Flat = [number, number];
// Front elevation: section A on the left, millimetres from the top left corner
const front = (y: number, z: number): Flat => [WIDE - y, HIGH - z];

// Orthogonal route with 45° corners, the way a board is routed
function routed(points: Flat[], r = 26) {
  const pts = points.filter((p, i) => !i || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.5);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const ab = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const t = Math.min(r, ab / 2, bc / 2);
    d += `L${b[0] + ((a[0] - b[0]) / ab) * t} ${b[1] + ((a[1] - b[1]) / ab) * t}`;
    d += `L${b[0] + ((c[0] - b[0]) / bc) * t} ${b[1] + ((c[1] - b[1]) / bc) * t}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${last[0]} ${last[1]}`;
}

const GLYPHS: Record<string, { strokes: string[]; pads: Flat[]; width: number }> = {
  E: { strokes: ['M70 0H12L0 12V88L12 100H70', 'M0 50H56'], pads: [[70, 0], [70, 100], [56, 50]], width: 70 },
  L: { strokes: ['M0 0V88L12 100H66'], pads: [[0, 0], [66, 100]], width: 66 },
  K: { strokes: ['M0 0V100', 'M0 54H12L62 0', 'M12 54L64 100'], pads: [[0, 0], [0, 100], [62, 0], [64, 100]], width: 64 },
  T: { strokes: ['M0 0H72', 'M36 0V100'], pads: [[0, 0], [72, 0], [36, 100]], width: 72 },
  R: { strokes: ['M0 100V12L12 0H52L68 16V40L52 56H0', 'M36 56L68 100'], pads: [[0, 100], [68, 100]], width: 68 },
  Y: { strokes: ['M0 0V12L36 48L72 12V0', 'M36 48V100'], pads: [[0, 0], [72, 0], [36, 100]], width: 72 },
  A: { strokes: ['M0 100V32L32 0H40L72 32V100', 'M0 64H72'], pads: [[0, 100], [72, 100]], width: 72 },
};

// The word routed as copper; it takes current from S1
function TraceTitle({ live }: { live: boolean }) {
  let x = 0;
  const letters = [...'ELEKTRYKA'].map((char, i) => {
    const glyph = GLYPHS[char];
    const letter = (
      <g key={i} transform={`translate(${x} 0)`} style={{ ['--i' as string]: i }}>
        {glyph.strokes.map(d => (
          <path key={d} className={styles.titleTrace} d={d} pathLength={1} />
        ))}
        {glyph.pads.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`} className={styles.titlePad}>
            <circle cx={cx} cy={cy} r={9.5} />
            <circle className={styles.titleDrill} cx={cx} cy={cy} r={3.4} />
          </g>
        ))}
      </g>
    );
    x += glyph.width + 30;
    return letter;
  });
  return (
    <svg className={cn(styles.title, live && styles.titleLive)} viewBox={`-12 -12 ${x - 30 + 24} 124`} aria-hidden="true">
      {letters}
    </svg>
  );
}

function Board() {
  const circuit = useCircuit();
  const wardrobe = useGLTF(WARDROBE_GLB);
  const frame = useGLTF(FRAME_GLB);

  const { panels, strips, doors } = useMemo(() => {
    const all = [...boxes(wardrobe.scene), ...boxes(frame.scene, FRAME_PIECES)];
    const flat = (b: (typeof all)[number]) => ({
      name: b.name,
      x: b.min.z * 1000 + WIDE,
      y: HIGH - b.max.y * 1000,
      w: (b.max.z - b.min.z) * 1000,
      h: (b.max.y - b.min.y) * 1000,
    });
    return {
      panels: all.filter(b => ['shelf', 'support', 'aShelf', 'aSide', 'frame'].includes(kindOf(b.name))).map(flat),
      strips: all.filter(b => kindOf(b.name) === 'led').map(flat),
      doors: all.filter(b => /^F0[1-7]_.*Door/.test(b.name)).map(flat),
    };
  }, [wardrobe, frame]);

  const live = (route: Route) => {
    if (route.kind === 'mains' || route.id === 'Feed_24V') return true;
    if (route.kind === 'switch') return circuit.s1;
    if (route.doors) return route.doors.some(door => circuit.doors[door]);
    return circuit.on(LEDS.find(led => led.id === route.led)!);
  };

  const [sw, sh] = front(913, 1287);
  const rows = LEDS.map((led, i) => ({ led, y: 760 + i * 34 }));

  return (
    <svg className={styles.board} viewBox="-90 -130 2868 2880" role="group" aria-label="Rzut szafy od frontu z przebiegiem kabli. Kontaktrony można kliknąć.">
      <defs>
        <filter id="led-glow" x="-200%" y="-20%" width="500%" height="140%">
          <feGaussianBlur stdDeviation="70" />
        </filter>
      </defs>

      {strips.map(s => {
        const led = LEDS.find(l => s.name === `LED_${l.strip}`);
        const level = led ? circuit.level(led) : 0;
        const horizontal = s.w > s.h;
        return (
          <rect
            key={s.name}
            className={styles.glow}
            style={{ opacity: level }}
            filter="url(#led-glow)"
            x={s.x - (horizontal ? 0 : 150)}
            y={s.y - (horizontal ? 150 : 0)}
            width={Math.max(s.w, 300)}
            height={Math.max(s.h, 300)}
          />
        );
      })}

      {doors.map(d => {
        const id = d.name.slice(0, 3) as (typeof DOOR_IDS)[number];
        return <rect key={d.name} className={cn(styles.door, circuit.doors[id] && styles.doorOpen)} x={d.x} y={d.y} width={d.w} height={d.h} />;
      })}

      {panels.map(p => (
        <rect key={p.name} className={styles.panel} x={p.x} y={p.y} width={Math.max(p.w, 2)} height={Math.max(p.h, 2)} />
      ))}

      {([['A', 204], ['B', 1040], ['C', 1823], ['D', 2340]] as const).map(([name, x]) => (
        <text key={name} className={styles.section} x={x} y={-44}>
          {name}
        </text>
      ))}

      {ROUTES.map((route, i) =>
        route.runs.map((run, j) => {
          const d = routed(run.map(([, y, z]) => front(y * 1000, z * 1000)));
          return (
            <g key={`${route.id}${j}`} className={cn(styles.trace, styles[route.kind], live(route) && styles.live)}>
              <path d={d} pathLength={1} style={{ ['--i' as string]: i }} />
              <path className={styles.flow} d={d} />
            </g>
          );
        }),
      )}

      {strips.map(s => {
        const led = LEDS.find(l => s.name === `LED_${l.strip}`);
        return (
          <rect key={s.name} className={cn(styles.strip, led && circuit.on(led) && styles.stripOn)} x={s.x - (s.w > s.h ? 0 : 7)} y={s.y - (s.w > s.h ? 7 : 0)} width={Math.max(s.w, 14)} height={Math.max(s.h, 14)}>
            <title>{led ? `${led.id}: ${led.place}` : s.name}</title>
          </rect>
        );
      })}

      {DRILLS.filter(d => d.kind === 'hole' && BOARD_VISIBLE.has(d.board)).map(d => {
        const [cx, cy] = front(d.at[1], d.at[2]);
        return <circle key={`${d.board}-${d.at}`} className={styles.via} cx={cx} cy={cy} r={11} />;
      })}

      <g className={styles.part}>
        <rect {...rect(front(1034, 335), 159, 30)} />
        <text x={WIDE - 1034 + 200} y={HIGH - 320}>Z1</text>
        <rect className={styles.socket} {...rect(front(840, 350), 80, 80)} />
        <rect {...rect(front(1013, 1048), 98, 16)} />
        <rect {...rect(front(911, 1048), 166, 16)} />
        {rows.map(({ led, y }) => (
          <rect key={led.id} className={cn(circuit.on(led) && styles.partOn)} {...rect(front(y + 15, 1110), 30, 40)} />
        ))}
      </g>
      <text className={styles.partLabel} x={WIDE - 1000} y={HIGH - 1160}>
        Ś1 do Ś8
      </text>

      {DOOR_IDS.map(door => {
        const c = CONTACTS[door];
        const [cx, cy] = front(c.y, c.z);
        const open = circuit.doors[door];
        return (
          <g
            key={door}
            className={cn(styles.reed, open && styles.reedOpen)}
            role="button"
            tabIndex={0}
            aria-pressed={open}
            aria-label={`Kontaktron ${contact(door)}, drzwi ${door}`}
            onClick={() => circuit.toggleDoor(door)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                circuit.toggleDoor(door);
              }
            }}
          >
            <circle className={styles.reedHit} cx={cx} cy={cy} r={62} />
            <circle className={styles.reedPad} cx={cx} cy={cy} r={21} />
            <circle className={styles.reedDrill} cx={cx} cy={cy} r={7} />
            <text x={cx + LABEL_X[door]} y={cy + (LABEL_X[door] ? 14 : -40)} style={{ textAnchor: LABEL_X[door] < 0 ? 'end' : LABEL_X[door] ? 'start' : 'middle' }}>
              {contact(door)}
            </text>
          </g>
        );
      })}

      <g className={cn(styles.part, circuit.s1 && styles.partOn)} data-s1="">
        <rect x={sw - 14} y={sh} width={28} height={26} />
      </g>
    </svg>
  );
}

const rect = ([x, y]: Flat, width: number, height: number) => ({ x, y, width, height });
// Paired contacts sit 40 mm apart, so their designators go to the outer sides
const LABEL_X: Record<(typeof DOOR_IDS)[number], number> = { F01: -34, F02: 34, F03: -34, F04: 34, F05: -34, F06: 0, F07: 0 };
const BOARD_VISIBLE = new Set(DRILLS.filter(d => d.kind === 'hole').map(d => d.board));

// Silkscreen leader from the switch on the page to the switch on the board
function Leader({ hero, live }: { hero: React.RefObject<HTMLElement>; live: boolean }) {
  const [d, setD] = useState('');
  const [end, setEnd] = useState<Flat>([0, 0]);

  useEffect(() => {
    const el = hero.current;
    const measure = () => {
      const target = el.querySelector('[data-s1]');
      const start = el.querySelector('[data-rocker]');
      if (!target || !start || window.innerWidth < 1100) {
        setD('');
        return;
      }
      const box = el.getBoundingClientRect();
      const a = start.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const [x0, y0] = [a.right - box.left, a.top + a.height / 2 - box.top];
      const [x1, y1] = [b.left - box.left, b.top + b.height / 2 - box.top];
      const rise = Math.abs(y1 - y0);
      const mid = Math.max(x0 + 40, x1 - rise - 60);
      setD(`M${x0} ${y0}H${mid}L${mid + rise} ${y1}H${x1}`);
      setEnd([x1, y1]);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const target = setTimeout(measure, 300); // the board appears after its glTF loads
    return () => {
      observer.disconnect();
      clearTimeout(target);
    };
  }, [hero]);

  if (!d) return null;
  return (
    <svg className={cn(styles.leader, live && styles.leaderLive)} aria-hidden="true">
      <path d={d} />
      <circle cx={end[0]} cy={end[1]} r={4} />
    </svg>
  );
}

export function Hero() {
  const circuit = useCircuit();
  const heroRef = useRef<HTMLElement>(null!);
  // The room gets lighter with the load
  const glow = circuit.watt / FULL_WATT;

  return (
    <header ref={heroRef} className={styles.hero} style={{ ['--room' as string]: glow }}>
      <div className={styles.topnav}>
        <SiteNav current="/elektryka" toggle={false} />
      </div>

      <div className={styles.intro}>
        <h1 className={styles.sr}>Elektryka szafy</h1>
        <TraceTitle live={circuit.s1} />
        <p className={styles.lead}>Osiem pasków LED na 24 V, ukryty włącznik i siedem kontaktronów. Tu jest wszystko, co trzeba wywiercić, zanim szafa stanie.</p>

        <div className={styles.switchRow}>
          <button className={cn(styles.rocker, circuit.s1 && styles.rockerOn)} data-rocker="" aria-pressed={circuit.s1} aria-label="Włącznik S1" onClick={circuit.toggleS1}>
            <span>I</span>
            <span>O</span>
          </button>
          <p>
            <b>S1, ukryty włącznik</b>
            <br />
            {circuit.s1 ? 'Świeci regał A i wnęka C.' : 'Naciśnij, aby zapalić regał A i wnękę C.'} Kliknij kontaktron K na rysunku, a otworzysz drzwi przed nim.
          </p>
        </div>

        <dl className={styles.facts}>
          <div>
            <dt>Paski LED</dt>
            <dd>{num(LED_METRES, 2)} m</dd>
          </div>
          <div>
            <dt>Pełna moc</dt>
            <dd>{num(FULL_WATT)} W</dd>
          </div>
          <div>
            <dt>Kable</dt>
            <dd>{num(CABLE_METRES, 1)} m</dd>
          </div>
          <div>
            <dt>Do wycięcia</dt>
            <dd>{DRILLS.length} miejsc</dd>
          </div>
        </dl>
      </div>

      <Suspense fallback={<div className={styles.board} />}>
        <Board />
      </Suspense>
      <Leader hero={heroRef} live={circuit.s1} />
    </header>
  );
}

useGLTF.preload(WARDROBE_GLB);
useGLTF.preload(FRAME_GLB);
