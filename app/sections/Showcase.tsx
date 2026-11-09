import { type ReactNode, type RefObject, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Link } from 'react-router';
import cn from 'classnames';
import type { ShowcaseProgress } from '@/components/schematic';
import styles from './Showcase.module.scss';

type Props = {
  nav: { href: string; label: string; current?: boolean }[];
  heading: string;
  facts: string;
  hint: string;
  actions: ReactNode;
  // Scroll section that follows the hero
  id: string;
  title: string;
  steps: string[];
  photos: [string, string][];
  scene: (progress: RefObject<ShowcaseProgress>) => ReactNode;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Hero and scroll-driven steps share one fixed canvas, so the model moves on without a cut
export default function Showcase({ nav, heading, facts, hint, actions, id, title, steps, photos, scene }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null!);
  const heroRef = useRef<HTMLElement>(null!);
  const sectionRef = useRef<HTMLElement>(null!);
  const stepsRef = useRef<HTMLOListElement>(null!);
  const photosRef = useRef<HTMLDivElement>(null!);
  const progress = useRef<ShowcaseProgress>({ T: 0, yaw: 0 });
  const invalidate = useRef<() => void>(() => {});
  const [visible, setVisible] = useState(true);
  const count = steps.length;

  useEffect(() => {
    let raf = 0;
    let active = -2;

    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const heroH = heroRef.current.offsetHeight;
      const top = sectionRef.current.getBoundingClientRect().top + y;
      const length = sectionRef.current.offsetHeight - vh;
      const t = clamp01((y - top) / Math.max(1, length)) * count;
      progress.current.T = y < top ? clamp01(y / heroH) : 1 + t;

      const next = y < top - vh * 0.3 ? -1 : Math.min(count, Math.max(0, Math.ceil(t - 0.15)));
      if (next !== active) {
        active = next;
        [...stepsRef.current.children].forEach((li, i) => li.classList.toggle(styles.on, i === active));
        [...photosRef.current.children].forEach(img =>
          img.classList.toggle(styles.on, (img as HTMLElement).dataset.step === String(active)),
        );
      }
      invalidate.current();
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(wrapRef.current);
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [count]);

  // Horizontal drag on the hero turns the model; vertical swipes keep scrolling the page
  useEffect(() => {
    const hero = heroRef.current;
    let lastX: number | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a, button')) return;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (lastX === null) return;
      progress.current.yaw += (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
      invalidate.current();
    };
    const up = () => (lastX = null);
    hero.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      hero.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={cn(styles.canvas, { [styles.hidden]: !visible })} aria-hidden="true">
        <Canvas
          dpr={[1, 1.75]}
          frameloop={visible ? 'demand' : 'never'}
          camera={{ fov: 30, near: 0.1, far: 100, position: [-6, 2, -5] }}
          eventSource={wrapRef}
          eventPrefix="client"
          onCreated={state => (invalidate.current = state.invalidate)}
        >
          <Suspense fallback={null}>{scene(progress)}</Suspense>
        </Canvas>
      </div>

      <header ref={heroRef} className={styles.hero}>
        <Link className={styles.wordmark} to="/">
          Szafa 2025
        </Link>
        <nav className={styles.nav} aria-label="Nawigacja">
          <ul>
            {nav.map(item => (
              <li key={item.href}>
                <Link to={item.href} aria-current={item.current ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.intro}>
          <h1>{heading}</h1>
          <p>{facts}</p>
        </div>
        <p className={styles.hint}>{hint}</p>
        <div className={styles.actions}>{actions}</div>
      </header>

      <section id={id} ref={sectionRef} className={styles.breakdown} style={{ height: `calc(100svh + ${count} * 75vh)` }} aria-labelledby={`${id}-h`}>
        <div className={styles.sticky}>
          <ol ref={stepsRef} className={styles.steps}>
            <li>
              <h2 id={`${id}-h`}>{title}</h2>
            </li>
            {steps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div ref={photosRef}>
            {photos.flatMap(([left, right], i) => [
              <img key={`${i}l`} className={cn(styles.photo, styles.left)} data-step={i + 1} src={left} alt="" width="1280" height="800" loading="lazy" />,
              <img key={`${i}r`} className={cn(styles.photo, styles.right)} data-step={i + 1} src={right} alt="" width="1280" height="800" loading="lazy" />,
            ])}
          </div>
        </div>
      </section>
    </div>
  );
}
