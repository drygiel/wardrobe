import { type ReactNode, type RefObject, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Canvas } from '@react-three/fiber';
import cn from 'classnames';
import type { ShowcaseProgress } from '@/components/schematic';
import type { PagePath } from '@/site';
import Ready from '@/components/Ready';
import SiteNav from './SiteNav';
import styles from './Showcase.module.scss';

type Props = {
  current: PagePath;
  heading: string;
  facts: string;
  hint: string;
  actions: ReactNode;
  // Scroll section that follows the hero: one chapter per screen of scrolling, its copy beside the model
  id: string;
  label: string;
  chapters: Chapter[];
  scene: (progress: RefObject<ShowcaseProgress>) => ReactNode;
};

export type Chapter = { title: string; text: string; link?: { to: string; label: string } };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Hero and scroll-driven steps share one fixed canvas, so the model moves on without a cut
export default function Showcase({ current, heading, facts, hint, actions, id, label, chapters, scene }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null!);
  const heroRef = useRef<HTMLElement>(null!);
  const sectionRef = useRef<HTMLElement>(null!);
  const chaptersRef = useRef<HTMLDivElement>(null!);
  const canvasRef = useRef<HTMLDivElement>(null!);
  const progress = useRef<ShowcaseProgress>({ T: 0, yaw: 0 });
  const invalidate = useRef<() => void>(() => {});
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const count = chapters.length;

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const heroH = heroRef.current.offsetHeight;
      const top = sectionRef.current.getBoundingClientRect().top + y;
      const length = sectionRef.current.offsetHeight - vh;
      const t = clamp01((y - top) / Math.max(1, length)) * count;
      progress.current.T = y < top ? clamp01(y / heroH) : 1 + t;
      // Past the last chapter the scene leaves with the page, the frame standing on its floor, as the chapter's copy does
      canvasRef.current.style.transform = `translateY(${-Math.max(0, y - top - length)}px)`;

      // Each chapter's copy fades in once its step is under way and out before the next; the last one stays
      [...chaptersRef.current.children].forEach((el, i) => {
        const shown = Math.min(clamp01((t - i - 0.04) / 0.14), i === count - 1 ? 1 : clamp01((i + 0.96 - t) / 0.14));
        const chapter = el as HTMLElement;
        chapter.style.opacity = String(shown);
        chapter.style.transform = `translateY(${(1 - shown) * 16}px)`;
        chapter.style.visibility = shown > 0.01 ? 'visible' : 'hidden';
      });
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
      <div ref={canvasRef} className={cn(styles.canvas, { [styles.hidden]: !visible })} aria-hidden="true">
        <Canvas
          dpr={[1, 1.75]}
          frameloop={visible ? 'demand' : 'never'}
          camera={{ fov: 30, near: 0.1, far: 100, position: [-6, 2, -5] }}
          eventSource={wrapRef}
          eventPrefix="client"
          onCreated={state => (invalidate.current = state.invalidate)}
        >
          <Suspense fallback={null}>
            {scene(progress)}
            <Ready onReady={setReady} />
          </Suspense>
        </Canvas>
      </div>

      <header ref={heroRef} className={styles.hero}>
        <SiteNav current={current} halo />
        {!ready && (
          <p className="loading" role="status">
            Ładuję model 3D
          </p>
        )}

        <div className={styles.intro}>
          <h1>{heading}</h1>
          <p>{facts}</p>
        </div>
        <p className={styles.hint}>
          <span className="drag-cue" aria-hidden="true" />
          {hint}
        </p>
        <div className={styles.actions}>{actions}</div>
      </header>

      <section id={id} ref={sectionRef} className={styles.breakdown} style={{ height: `${100 + count * 100}svh` }} aria-label={label}>
        <div ref={chaptersRef} className={styles.sticky}>
          {chapters.map((chapter, i) => (
            <article key={chapter.title} className={styles.chapter}>
              <p className={styles.count}>
                {String(i + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </p>
              <h2>{chapter.title}</h2>
              <p>{chapter.text}</p>
              {chapter.link && (
                <Link className="link" to={chapter.link.to}>
                  {chapter.link.label}
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
