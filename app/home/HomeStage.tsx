import { Component, type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Link, useNavigate } from 'react-router';
import hintStyles from '@/components/LineHint.module.scss';
import { renderLarge } from '@/assets';
import Ready from '@/components/Ready';
import SiteNav from '@/sections/SiteNav';
import { Icon } from '@/editor/icons';
import { COUNTS, SIZE, SIZE_TEXT } from '@/site';
import { dragTarget, measuring, progressAt, STAGE_VH, stopFor, YAW_MAX, YAW_MIN } from './chapters';
import { DRAFT_LABELS } from './draft';
import { type HeroProgress, HomeScene } from './HomeScene';
import { LAYERS } from './layers';
import { XRLinks } from '@/xr/XRLinks';
import cn from 'classnames';
import styles from './Home.module.scss';

// Without WebGL the scene cannot start; the page keeps its copy and links over a still of the wardrobe
class NoWebGL extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <img className={styles.still} src={renderLarge(31)} alt="" />
    ) : (
      this.props.children
    );
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const SNAP_IDLE_MS = 160;

// One line and a link per topic: the details live on the linked pages
const CHAPTERS = [
  {
    show: '2.62 2.74 3.02 3.1',
    title: 'Szuflady i zawiasy',
    text: `Osiem szuflad głębokości 487 mm i ${COUNTS.hinges} zawiasów z puszką 35 mm.`,
    to: '/okucia',
    label: 'Zobacz okucia',
  },
  {
    show: '3.62 3.74 4.02 4.1',
    title: 'Rama z litego dębu',
    text: `${COUNTS.framePieces} formatek o grubości 40 mm, od podłogi do sufitu: ${SIZE.height} mm.`,
    to: '/rama',
    label: 'Zobacz ramę',
  },
  {
    show: '4.62 4.74 5.02 5.1',
    title: 'Światło we frezach',
    text: 'Paski LED w rowkach 18 × 7,5 mm. Zasilanie schowane w szafie.',
    to: '/elektryka',
    label: 'Zobacz elektrykę',
  },
  {
    show: '5.62 5.74 9 10',
    title: 'Zmierz sam',
    hover: 'Wskaż krawędź kursorem, a pojawi się jej długość.',
    text: 'Wymiary i rysunek każdego elementu są w Pomiarze.',
    to: '/pomiar',
    label: 'Otwórz pomiary',
    // The closing drawing is the plan's front view, so the chapter leads there as well
    more: { to: '/plan', label: 'Rysunek techniczny' },
  },
];

// The hero pins one canvas while the scroll turns the drawing into the wardrobe.
// DOM copy fades by `data-show="in-from in-to out-from out-to"` in the same progress.
export default function HomeStage() {
  const stageRef = useRef<HTMLDivElement>(null!);
  const pinRef = useRef<HTMLDivElement>(null!);
  const labels = useRef<HTMLDivElement>(null!);
  const finalText = useRef<HTMLDivElement>(null!);
  const callouts = useRef<HTMLDivElement>(null!);
  const progress = useRef<HeroProgress>({
    p: 0,
    yaw: 0,
    frameYaw: 0,
    touched: 0,
    active: -1,
    pointer: null,
    overLink: false,
    hover: null,
  });
  const hint = useRef<HTMLDivElement>(null!);
  const navigate = useNavigate();
  const invalidate = useRef<() => void>(() => {});
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState<number[]>([]);

  const highlight = (layer: number) => {
    progress.current.active = layer;
    callouts.current
      .querySelectorAll<HTMLElement>('[data-i]')
      .forEach(el => {
        el.classList.toggle(styles.dim, layer >= 0 && Number(el.dataset.i) !== layer);
        el.classList.toggle(styles.on, Number(el.dataset.i) === layer);
      });
    invalidate.current();
  };

  useEffect(() => {
    let raf = 0;
    let idle = 0;
    let lastY = window.scrollY;
    let down = false;
    let touching = false;
    const faded = [...pinRef.current.querySelectorAll<HTMLElement>('[data-show]')].map(el => ({
      el,
      at: el.dataset.show!.split(' ').map(Number),
    }));
    // One viewport height of the stage in pixels (svh, not innerHeight)
    const unit = () => stageRef.current.offsetHeight / STAGE_VH;

    const update = () => {
      raf = 0;
      const p = progressAt(-stageRef.current.getBoundingClientRect().top / unit());
      progress.current.p = p;
      faded.forEach(({ el, at: [a, b, c, d] }) => {
        const shown = Math.min(clamp01((p - a) / (b - a)), 1 - clamp01((p - c) / (d - c)));
        el.style.opacity = String(shown);
        el.style.visibility = shown > 0.01 ? 'visible' : 'hidden';
      });
      pinRef.current.classList.toggle(styles.live, dragTarget(p) !== null);
      invalidate.current();
    };

    // A reader who stops just short of the end while scrolling down is carried the rest of the way
    const finish = () => {
      const stop = stopFor(progress.current.p, down);
      if (touching || stop === null) return;
      const top = stageRef.current.getBoundingClientRect().top + window.scrollY + stop * unit();
      window.scrollTo({
        top,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    };
    const waitForIdle = () => {
      clearTimeout(idle);
      idle = window.setTimeout(finish, SNAP_IDLE_MS);
    };

    const onScroll = () => {
      if (window.scrollY !== lastY) down = window.scrollY > lastY;
      lastY = window.scrollY;
      waitForIdle();
      if (!raf) raf = requestAnimationFrame(update);
    };
    const touchStart = () => (touching = true);
    const touchEnd = () => {
      touching = false;
      waitForIdle();
    };

    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(stageRef.current);
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchend', touchEnd, { passive: true });
    window.addEventListener('touchcancel', touchEnd, { passive: true });
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchend', touchEnd);
      window.removeEventListener('touchcancel', touchEnd);
    };
  }, []);

  // Horizontal drag turns the finished wardrobe or the spread frame; vertical swipes keep scrolling the page
  useEffect(() => {
    const pin = pinRef.current;
    let lastX: number | null = null;
    let turning: ReturnType<typeof dragTarget> = null;
    const down = (e: PointerEvent) => {
      turning = dragTarget(progress.current.p);
      if (!turning || (e.target as HTMLElement).closest('a, button')) return;
      lastX = e.clientX;
      progress.current.touched = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (lastX === null) return;
      const turn = (e.clientX - lastX) * 0.006;
      progress.current.touched = performance.now();
      // The frame has no back panel to hide, so it turns freely
      if (turning === 'frame') progress.current.frameYaw += turn;
      else progress.current.yaw = Math.min(YAW_MAX, Math.max(YAW_MIN, progress.current.yaw + turn));
      lastX = e.clientX;
      invalidate.current();
    };
    const up = () => (lastX = null);
    pin.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      pin.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // Measuring at the end: the scene reads the cursor, a click on a hovered part opens /pomiar like the button does
  useEffect(() => {
    const pin = pinRef.current;
    const track = (e: PointerEvent) => {
      progress.current.pointer = { x: e.clientX, y: e.clientY };
      progress.current.overLink = !!(e.target as Element).closest('a, button');
      invalidate.current(); // the anatomy also follows the cursor, to light the layer under it
      if (!measuring(progress.current.p)) return;
      pin.style.cursor = progress.current.hover ? 'pointer' : '';
    };
    const leave = () => {
      progress.current.pointer = null;
      progress.current.overLink = false;
      pin.style.cursor = '';
      invalidate.current();
    };
    const click = (e: MouseEvent) => {
      if (
        measuring(progress.current.p) &&
        progress.current.hover &&
        !(e.target as HTMLElement).closest('a, button')
      )
        navigate('/pomiar');
    };
    pin.addEventListener('pointermove', track);
    pin.addEventListener('pointerdown', track);
    pin.addEventListener('pointerleave', leave);
    pin.addEventListener('click', click);
    return () => {
      pin.removeEventListener('pointermove', track);
      pin.removeEventListener('pointerdown', track);
      pin.removeEventListener('pointerleave', leave);
      pin.removeEventListener('click', click);
    };
  }, [navigate]);

  return (
    <div ref={stageRef} className={styles.stage} style={{ height: `${STAGE_VH * 100}svh` }}>
      <div ref={pinRef} className={styles.pin}>
        <div className={styles.canvas} aria-hidden="true">
          <NoWebGL>
            <Canvas
              dpr={[1, 1.75]}
              frameloop={visible ? 'demand' : 'never'}
              camera={{ fov: 3, near: 1, far: 200, position: [-80, 1.33, -1.344] }}
              eventSource={pinRef}
              onCreated={state => {
                invalidate.current = state.invalidate;
                // Measured from the pin: past the end of the stage it scrolls away, and client coordinates alone would aim too high
                state.setEvents({
                  compute: (event, s) => {
                    const box = pinRef.current.getBoundingClientRect();
                    s.pointer.set(
                      ((event.clientX - box.left) / s.size.width) * 2 - 1,
                      -((event.clientY - box.top) / s.size.height) * 2 + 1,
                    );
                    s.raycaster.setFromCamera(s.pointer, s.camera);
                  },
                });
              }}
            >
              <Suspense fallback={null}>
                <HomeScene
                  progress={progress}
                  labels={labels}
                  finalText={finalText}
                  callouts={callouts}
                  hint={hint}
                  onCounts={setCounts}
                  onLayer={highlight}
                />
                <Ready onReady={setReady} />
              </Suspense>
            </Canvas>
          </NoWebGL>
        </div>

        <div ref={hint} className={cn(hintStyles.hint, hintStyles.hidden, styles.measure)}>
          <div role="tooltip">
            <div>
              <span className={hintStyles.value} />
              <span className={hintStyles.unit}>mm</span>
            </div>
          </div>
        </div>

        <div ref={labels} className={styles.labels} aria-hidden="true">
          {DRAFT_LABELS.map(label => (
            <span key={label.text + label.at} className={cn(label.bubble && styles.bubble)}>
              {label.text}
            </span>
          ))}
        </div>

        {/* While the camera is inside section B the model reaches the top edge: the menu keeps a clear band */}
        <div className={styles.shade} data-show="2.25 2.55 3.05 3.4" aria-hidden="true" />
        <SiteNav current="/" halo />
        {!ready && (
          <p className="loading" role="status">
            Ładuję model 3D
          </p>
        )}

        <header className={styles.sheet} data-show="-2 -1 0.05 0.15">
          <h1>
            Najpierw kreska.
            <br />
            Potem dąb.
          </h1>
          <p className={styles.lede}>Projekt szafy na wymiar w ramie z litego dębu, od podłogi do sufitu. Każdy wymiar na tej stronie pochodzi z modelu 3D.</p>
          <p>
            <span className={styles.scrollCue} aria-hidden="true" />
            Przewiń, a rysunek stanie się szafą.
          </p>
        </header>

        <dl className={styles.titleBlock} data-show="-2 -1 0.08 0.2">
          <div>
            <dt>Rysunek</dt>
            <dd>Widok z przodu</dd>
          </div>
          <div>
            <dt>Wymiary</dt>
            <dd>{SIZE_TEXT}</dd>
          </div>
          <div>
            <dt>Elementy</dt>
            <dd>{COUNTS.parts}, bez okuć</dd>
          </div>
        </dl>

        <p className={styles.caption} data-show="0.22 0.28 0.44 0.5">
          Każda linia to prawdziwy element.
        </p>
        <p className={styles.caption} data-show="0.6 0.66 0.8 0.86">
          Potem zapala się światło.
        </p>

        {/* DOM order follows the scroll story, so a screen reader meets the headings as a reader does:
            hero close, anatomy, then the chapters. All three are absolutely placed; the order draws nothing. */}
        <div ref={finalText} className={styles.final} data-show="0.9 0.97 1.02 1.08">
          <div className={styles.intro}>
            <h2>Szafa w ramie z litego dębu, od podłogi do sufitu.</h2>
            <p>
              {SIZE_TEXT}. Cztery sekcje, {COUNTS.parts} elementów bez okuć.
            </p>
          </div>
          <p className={styles.hint}>
            <span className="drag-cue" aria-hidden="true" />
            Przeciągnij, aby obrócić. Kliknij drzwi, aby je otworzyć.
          </p>
          <div className={styles.actions}>
            <Link className="btn" to="/pomiar">
              <Icon name="measure" />
              Zmierz szafę
            </Link>
            <XRLinks className={styles.xr} />
          </div>
        </div>

        {/* Shown by HomeScene together with its lines, on their own clock */}
        <div ref={callouts} className={styles.callouts}>
          <svg className={styles.lines} aria-hidden="true">
            {LAYERS.map((layer, i) => (
              <g key={layer.id} data-i={i}>
                <polyline pathLength={1} />
                <circle r="2.5" />
              </g>
            ))}
          </svg>
          <header>
            <h2>Z czego się składa</h2>
            <p>Osiem warstw. Wybierz jedną, aby zobaczyć szczegóły.</p>
          </header>
          {(['right', 'left'] as const).map(side => (
            <ul key={side} className={styles[side]}>
              {LAYERS.map(
                (layer, i) =>
                  layer.side === side && (
                    <li key={layer.id} data-i={i}>
                      <Link
                        to={layer.to}
                        onPointerEnter={() => highlight(i)}
                        onPointerLeave={() => highlight(-1)}
                        onFocus={() => highlight(i)}
                        onBlur={() => highlight(-1)}
                      >
                        {layer.label}
                        {counts[i] !== undefined && <span>{counts[i]}</span>}
                      </Link>
                    </li>
                  ),
              )}
            </ul>
          ))}
        </div>

        {CHAPTERS.map(chapter => (
          <section key={chapter.title} className={styles.chapter} data-show={chapter.show}>
            <h2>{chapter.title}</h2>
            <p>
              {chapter.hover && <span className={styles.hoverOnly}>{chapter.hover} </span>}
              {chapter.text}
            </p>
            <div className={styles.links}>
              <Link className="btn" to={chapter.to}>
                {chapter.to === '/pomiar' && <Icon name="measure" />}
                {chapter.label}
                {chapter.to !== '/pomiar' && <Icon name="arrow" />}
              </Link>
              {chapter.more && (
                <Link className="link" to={chapter.more.to}>
                  {chapter.more.label}
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
