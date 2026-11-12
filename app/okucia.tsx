import * as THREE from 'three';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import cn from 'classnames';
import { HARDWARE_GLB, WARDROBE_GLB } from '@/assets';
import { boxes } from '@/components/PlanDrawing';
import { DOORS, kindOf } from '@/components/parts';
import { partLabel } from '@/editor/labels';
import { A, CUP, D, DOOR, FRAME, hingeOpened, PLATE, SIDE } from '@/okucia/hinge';
import Footer from '@/sections/Footer';
import PageHeader from '@/sections/PageHeader';
import Meta from '@/sections/Meta';
import NextPage from '@/sections/NextPage';
import { COUNTS, pageAt } from '@/site';
import styles from '@/okucia/Okucia.module.scss';

const SHELF_PINS = 'https://allegro.pl/produkt/podporki-do-polek-bolce-kolki-pod-polki-metalowe-ocynk-fi-5-x-16-mm-paczka-393ebad9-2a0d-421f-a5d0-5937760a16c6?offerId=18171323510';
const DEPTH = 487; // drawer depth in Szafa4.blend
const SLIDE = Math.round(DEPTH * 0.7); // how far the site and the bake slide a drawer out (parts.ts, scripts/bake.py)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mm = (m: number) => Math.round(m * 1000);
const sectionOf = (name: string) => /_([ABCD])_/.exec(name)?.[1] ?? '';

// Progress through a tall section while its figure stays pinned; holds closed at the start and open at the end
function useScrub<T extends HTMLElement>(apply: (t: number) => void) {
  const ref = useRef<T>(null!);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const box = ref.current.getBoundingClientRect();
      apply(clamp01((-box.top / Math.max(1, box.height - window.innerHeight) - 0.1) / 0.75));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [apply]);
  return ref;
}

type Rect = { x0: number; x1: number; y0: number; y1: number };
const rect = (r: Rect, className: string) => (
  <rect className={className} x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} />
);

// A label with a leader to a point of the drawing; the drawing is y-up, so its points are flipped here
function Label({
  at,
  to,
  text,
  end,
}: {
  at: [number, number];
  to: [number, number];
  text: string;
  end?: boolean;
}) {
  return (
    <g className={styles.label}>
      <polyline points={`${at[0]},${-at[1]} ${to[0]},${-to[1]}`} />
      <text x={at[0] + (end ? -2 : 2)} y={-at[1] - 2} textAnchor={end ? 'end' : 'start'}>
        {text}
      </text>
    </g>
  );
}

function HingeSection() {
  const door = useRef<SVGGElement>(null!);
  const links = useRef<SVGLineElement[]>([]);
  const pins = useRef<SVGCircleElement[]>([]);
  const cupLeader = useRef<SVGPolylineElement>(null!);
  const doorLeader = useRef<SVGPolylineElement>(null!);
  const readout = useRef<HTMLElement>(null!);

  const apply = useCallback((t: number) => {
    const pose = hingeOpened(t);
    door.current.setAttribute('transform', `matrix(${pose.matrix.join(' ')})`);
    [pose.B, pose.C].forEach((p, i) => {
      links.current[i].setAttribute('x2', String(p[0]));
      links.current[i].setAttribute('y2', String(p[1]));
      pins.current[i].setAttribute('cx', String(p[0]));
      pins.current[i].setAttribute('cy', String(p[1]));
    });
    const cup = pose.place([(CUP.x0 + CUP.x1) / 2, 4]);
    cupLeader.current.setAttribute('points', `92,-62 ${cup[0]},${-cup[1]}`);
    const leaf = pose.place([80, 12]);
    doorLeader.current.setAttribute('points', `92,-36 ${leaf[0]},${-leaf[1]}`);
    readout.current.textContent = `${Math.round((pose.phi * 180) / Math.PI)}°`;
  }, []);
  const ref = useScrub<HTMLElement>(apply);

  return (
    <section id="zawiasy" ref={ref} className={styles.scrub} aria-labelledby="zawiasy-h">
      <div className={styles.sticky}>
        <div className={styles.text}>
          <h2 id="zawiasy-h">Zawiasy</h2>
          <p>
            Drzwi stoją 20 mm w głębi ramy. Zawias chowa się w środku: puszka w drzwiach, prowadnik
            na boku wnętrza.
          </p>
          <p className={styles.readout}>
            <span>Otwarcie</span>
            <b ref={readout}>0°</b>
          </p>
          <p className={styles.note}>
            Przekrój z góry, wymiary z modelu. Przeguby ramienia to schemat dobrany tak, by drzwi
            otworzyły się na 95°, jak drzwi sekcji B i C w modelu, i nie dotknęły ramy. Drzwi sekcji
            D otwierają się na 90°.
          </p>
        </div>
        <svg
          className={styles.drawing}
          viewBox="-80 -140 284 210"
          role="img"
          aria-label="Przekrój zawiasu z góry: drzwi otwierają się wraz z przewijaniem"
        >
          <defs>
            <pattern
              id="hatch"
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="4" />
            </pattern>
          </defs>
          <g transform="scale(1 -1)">
            {rect(FRAME, styles.cut)}
            {rect(SIDE, styles.cut)}
            {rect(PLATE, styles.part)}
            <rect className={styles.part} x={-2} y={-10} width={28} height={8} />
            <g ref={door}>
              <polygon className={styles.door} points={DOOR.map(p => p.join(',')).join(' ')} />
              {rect(CUP, styles.part)}
            </g>
            {[A, D].map((ground, i) => (
              <line
                key={i}
                ref={el => void (el && (links.current[i] = el))}
                className={styles.link}
                x1={ground[0]}
                y1={ground[1]}
                x2={ground[0]}
                y2={ground[1]}
              />
            ))}
            {[A, D].map((ground, i) => (
              <circle key={i} className={styles.pin} cx={ground[0]} cy={ground[1]} r="1.4" />
            ))}
            {[0, 1].map(i => (
              <circle
                key={i}
                ref={el => void (el && (pins.current[i] = el))}
                className={styles.pin}
                r="1.4"
              />
            ))}
          </g>
          <Label at={[-74, 70]} to={[-40, 30]} text="Rama 40 mm" />
          <Label at={[92, -64]} to={[-6, -60]} text="Bok wnętrza 18 mm" />
          <Label at={[92, -36]} to={[10, -30]} text="Prowadnik 38 × 12 mm" />
          <Label at={[92, -14]} to={[24, -6]} text="Ramię" />
          <g className={styles.label}>
            <polyline ref={cupLeader} />
            <text x="94" y="-64">
              Puszka Ø35 × 12 mm
            </text>
          </g>
          <g className={styles.label}>
            <polyline ref={doorLeader} />
            <text x="94" y="-38">
              Drzwi 18 mm
            </text>
          </g>
        </svg>
      </div>
    </section>
  );
}

function DrawerSection() {
  const drawer = useRef<SVGGElement>(null!);
  const dim = useRef<SVGGElement>(null!);
  const readout = useRef<HTMLElement>(null!);

  const depth = useRef<SVGGElement>(null!);

  const apply = useCallback((t: number) => {
    const out = Math.round(SLIDE * t);
    drawer.current.setAttribute('transform', `translate(${-out} 0)`);
    depth.current.setAttribute('transform', `translate(${-out} 0)`);
    dim.current.querySelector('line')!.setAttribute('x1', String(20 - out));
    dim.current.querySelector('text')!.setAttribute('x', String(20 - out / 2));
    dim.current.style.opacity = String(Math.min(1, t * 6));
    readout.current.textContent = `${out} mm`;
  }, []);
  const ref = useScrub<HTMLElement>(apply);

  return (
    <section id="szuflady" ref={ref} className={styles.scrub} aria-labelledby="szuflady-h">
      <div className={styles.sticky}>
        <div className={styles.text}>
          <h2 id="szuflady-h">Szuflady</h2>
          <p>
            Pięć szuflad w szafie B i jedna we wnęce C, razem {COUNTS.drawers}. Wszystkie mają
            głębokość {DEPTH} mm.
          </p>
          <p className={styles.readout}>
            <span>Wysuw</span>
            <b ref={readout}>0 mm</b>
          </p>
          <p className={styles.note}>
            Widok z boku. W modelu szuflada wysuwa się na 70% głębokości, {SLIDE} mm.
          </p>
        </div>
        <svg
          className={cn(styles.drawing, styles.large)}
          viewBox="-380 -320 940 400"
          role="img"
          aria-label="Szuflada z boku: wysuwa się wraz z przewijaniem"
        >
          <g transform="scale(1 -1)">
            <rect className={styles.cut} x={-20} y={-20} width={20} height={270} />
            <line className={styles.part} x1={0} y1={0} x2={530} y2={0} />
            <line className={styles.part} x1={0} y1={260} x2={530} y2={260} />
            <line className={styles.part} x1={530} y1={0} x2={530} y2={260} />
            <g ref={drawer}>
              <rect className={styles.door} x={20} y={10} width={DEPTH} height={220} />
              <line className={styles.part} x1={38} y1={22} x2={38 + DEPTH - 30} y2={22} />
            </g>
          </g>
          <g ref={dim} className={styles.label}>
            <line x1={20} y1={34} x2={20} y2={34} />
            <text x={20} y={62} textAnchor="middle">
              Wysuw
            </text>
          </g>
          <g ref={depth} className={styles.label}>
            <line x1={20} y1={-262} x2={20 + DEPTH} y2={-262} />
            <line x1={20} y1={-272} x2={20} y2={-252} />
            <line x1={20 + DEPTH} y1={-272} x2={20 + DEPTH} y2={-252} />
            <text x={20 + DEPTH / 2} y={-276} textAnchor="middle">
              Głębokość {DEPTH} mm
            </text>
          </g>
        </svg>
      </div>
    </section>
  );
}

type Glb = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };

// Angle a door clip turns its door through, from its first and last key
function clipAngle(clips: THREE.AnimationClip[], name: string) {
  const track = clips.find(c => c.name === name)?.tracks.find(t => t.name.endsWith('.quaternion'));
  if (!track) return null;
  const first = new THREE.Quaternion().fromArray(track.values, 0);
  const last = new THREE.Quaternion().fromArray(track.values, track.values.length - 4);
  return Math.round(THREE.MathUtils.radToDeg(first.angleTo(last)));
}

function Tables() {
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as Glb;
  const hardware = useGLTF(HARDWARE_GLB) as unknown as Glb;

  const { drawers, doors } = useMemo(() => {
    const all = boxes(wardrobe.scene);
    const size = (b: (typeof all)[number]) => ({
      w: mm(b.max.z - b.min.z),
      h: mm(b.max.y - b.min.y),
      d: mm(b.max.x - b.min.x),
    });
    const drawers = all
      .filter(b => kindOf(b.name) === 'drawer')
      .sort((a, b) => sectionOf(a.name).localeCompare(sectionOf(b.name)) || b.max.y - a.max.y)
      .map(b => ({
        name: b.name,
        label: partLabel(b.name),
        section: sectionOf(b.name),
        ...size(b),
      }));
    const hinges = new Map<string, number>();
    hardware.scene.traverse(node => {
      const match = /^H\d\d_(F\d\d)_Cup$/.exec(node.name);
      if (match) hinges.set(match[1], (hinges.get(match[1]) ?? 0) + 1);
    });
    const doors = all
      .filter(b => kindOf(b.name) === 'front' && hinges.has(b.name.slice(0, 3)))
      .map(b => ({
        name: b.name,
        label: partLabel(b.name),
        section: sectionOf(b.name),
        ...size(b),
        hinges: hinges.get(b.name.slice(0, 3))!,
        angle: clipAngle(wardrobe.animations, DOORS[b.name]),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { drawers, doors };
  }, [wardrobe, hardware]);

  return (
    <div className={styles.tables}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption>Drzwi i zawiasy</caption>
          <thead>
            <tr>
              <th scope="col">Drzwi</th>
              <th scope="col">Sekcja</th>
              <th scope="col">Szer. × wys., mm</th>
              <th scope="col">Zawiasy</th>
              <th scope="col">Otwarcie</th>
            </tr>
          </thead>
          <tbody>
            {doors.map(door => (
              <tr key={door.name}>
                <th scope="row">{door.label}</th>
                <td>{door.section}</td>
                <td>
                  {door.w} × {door.h}
                </td>
                <td>{door.hinges}</td>
                <td>{door.angle === null ? '–' : `${door.angle}°`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption>Szuflady</caption>
          <thead>
            <tr>
              <th scope="col">Szuflada</th>
              <th scope="col">Sekcja</th>
              <th scope="col">Szer. × wys. × gł., mm</th>
            </tr>
          </thead>
          <tbody>
            {drawers.map(drawer => (
              <tr key={drawer.name}>
                <th scope="row">{drawer.label}</th>
                <td>{drawer.section}</td>
                <td>
                  {drawer.w} × {drawer.h} × {drawer.d}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OkuciaPage() {
  return (
    <>
      <Meta page={pageAt('/okucia')} />
      <PageHeader current="/okucia" />
      <main className={styles.page}>
        <header className={styles.intro}>
          <h1>Okucia</h1>
          <p>
            Szuflady, zawiasy i podpórki półek: {COUNTS.drawers} szuflad, {COUNTS.hinges} zawiasów na{' '}
            {COUNTS.hingedDoors} drzwiach i {COUNTS.shelfPins} podpórek pod {COUNTS.adjustableShelves}{' '}
            półkami przestawnymi. Wszystkie wymiary pochodzą z modelu 3D szafy.
          </p>
        </header>
        <HingeSection />
        <DrawerSection />
        <Suspense
          fallback={
            <p className="loading-row" role="status">
              Ładuję dane z modelu 3D
            </p>
          }
        >
          <Tables />
        </Suspense>
        <section className={styles.buy} aria-labelledby="dobor-h">
          <h2 id="dobor-h">Dobór okuć</h2>
          <ul>
            <li>
              <b>Zawias</b>
              <span>
                Puszkowy do drzwi wpuszczanych: puszka Ø35 × 12 mm, prowadnik 38 × 12 mm, otwarcie
                co najmniej 95° (w modelu 95° w sekcjach B i C, 90° w sekcji D). Drzwi 18 mm stoją
                20 mm w głębi ramy.
              </span>
            </li>
            <li>
              <b>Prowadnice szuflad</b>
              <span>
                Model ich nie zawiera. Trzeba je dobrać do szuflady głębokości {DEPTH} mm i wysuwu{' '}
                {SLIDE} mm.
              </span>
            </li>
            <li id="podporki">
              <b>Podpórki półek</b>
              <span>
                Metalowe, ocynkowane, Ø5 × 16 mm z kołnierzem. {COUNTS.shelfPins} sztuk, po cztery pod
                każdą z {COUNTS.adjustableShelves} półek przestawnych. Otwory Ø5 mm, głębokie na 8 mm, są
                w bokach i przegrodach pod półką, około 50 mm od jej przedniej i tylnej krawędzi. Półkę
                przestawia się razem z podpórkami i otworami. W pomiarze podpórki są zielone.{' '}
                <a href={SHELF_PINS} target="_blank" rel="noopener noreferrer" title="Allegro, otwiera się w nowej karcie">
                  Podpórki Ø5 × 16 mm na Allegro
                </a>
              </span>
            </li>
            <li>
              <b>Producent</b>
              <span>
                Model nie wskazuje producenta ani numerów katalogowych. Przed zamówieniem sprawdź
                wymiary w karcie wybranego okucia.
              </span>
            </li>
          </ul>
        </section>
        <NextPage after="/okucia" />
      </main>
      <Footer />
    </>
  );
}
