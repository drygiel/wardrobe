import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import ImageGallery, { type ReactImageGalleryItem } from 'react-image-gallery';
import cn from 'classnames';
import { RENDER_COUNT, renderLarge, renderSmall } from '@/assets';
import { useReveal } from '@/hooks/useReveal';
import 'react-image-gallery/styles/css/image-gallery.css';
import styles from './Gallery.module.scss';

const SPEED = 24; // px/s, the photos travel right to left
const RESUME_AFTER = 1500; // ms after the user last scrolled the row

export const renders = Array.from({ length: RENDER_COUNT }, (_, i) => i + 1);

const items: ReactImageGalleryItem[] = renders.map(n => ({
  original: renderLarge(n),
  thumbnail: renderSmall(n),
  originalHeight: 1600,
  loading: 'lazy',
  originalAlt: `Render ${n} z ${RENDER_COUNT}`,
}));

// The full-screen view of one render; `element` has to be mounted for `show` to work
export function useRenderViewer() {
  const galleryRef = useRef<ImageGallery>(null!);
  const [open, setOpen] = useState(false);

  const show = (n: number) => {
    galleryRef.current.slideToIndex(n - 1);
    galleryRef.current.fullScreen();
  };

  const element = (
    <div className={cn(styles.fullscreen, { [styles.open]: open })}>
      <ImageGallery ref={galleryRef} items={items} showThumbnails={false} showPlayButton={false} slideDuration={0} infinite onScreenChange={setOpen} />
    </div>
  );

  return { show, element };
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M5.5 2 11.5 8l-6 6" />
    </svg>
  );
}

// An endless row of the renders drifting to the left; a click opens the full-screen view
export default function Gallery() {
  const stripRef = useRef<HTMLDivElement>(null!);
  const headRef = useReveal<HTMLElement>();
  const viewer = useRenderViewer();
  const [current, setCurrent] = useState(1);
  const held = useRef({ hover: false, focus: false });
  const nudge = useRef(0); // distance the arrows still have to travel

  useEffect(() => {
    const strip = stripRef.current;
    const io = new IntersectionObserver(
      entries =>
        entries.forEach(entry => entry.isIntersecting && setCurrent(Number((entry.target as HTMLElement).dataset.n))),
      { root: strip, rootMargin: '0px -55% 0px -5%' },
    );
    [...strip.children].forEach(child => io.observe(child));
    return () => io.disconnect();
  }, []);

  // Runs on the row's native scroll position, so swiping and the trackpad keep working.
  // The row holds the renders twice: past the end of one copy it jumps by exactly one copy.
  useEffect(() => {
    const strip = stripRef.current;
    const drifts = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = 0;
    let position = strip.scrollLeft;
    let written = position;
    let resumeAt = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (Math.abs(strip.scrollLeft - written) > 2) {
        position = written = strip.scrollLeft;
        resumeAt = now + RESUME_AFTER;
      }

      const before = position;
      const step = nudge.current * Math.min(1, dt * 9);
      nudge.current -= step;
      position += step;
      if (drifts && !held.current.hover && !held.current.focus && now >= resumeAt && Math.abs(nudge.current) < 1) position += SPEED * dt;

      const copy = (strip.children[RENDER_COUNT] as HTMLElement).offsetLeft - (strip.children[0] as HTMLElement).offsetLeft;
      position = ((position % copy) + copy) % copy;

      // Not on every frame: writing would stop a swipe's momentum
      if (position !== before) {
        strip.scrollLeft = position;
        written = strip.scrollLeft;
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      if (!entry.isIntersecting) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    });
    io.observe(strip);

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const scrollBy = (direction: number) => (nudge.current += direction * stripRef.current.clientWidth * 0.75);

  return (
    <section id="galeria" className={styles.gallery} aria-labelledby="galeria-h">
      <header ref={headRef} className={styles.head}>
        <h2 id="galeria-h">Szafa w pokoju</h2>
        <div>
          <p>{RENDER_COUNT} rendery z Blendera. Kliknij zdjęcie, aby otworzyć je na pełnym ekranie.</p>
          <Link className="link" to="/galeria">
            Zobacz wszystkie zdjęcia
          </Link>
        </div>
      </header>

      <div
        className={styles.carousel}
        onPointerEnter={event => (held.current.hover = event.pointerType === 'mouse')}
        onPointerLeave={() => (held.current.hover = false)}
        onFocus={event => (held.current.focus = event.target.matches(':focus-visible'))}
        onBlur={() => (held.current.focus = false)}
      >
        <div ref={stripRef} className={styles.strip}>
          {[0, 1].flatMap(copy =>
            renders.map(n => (
              <button key={`${copy}-${n}`} data-n={n} className={cn({ [styles.on]: n === current })} tabIndex={copy ? -1 : undefined} aria-hidden={copy ? true : undefined} onClick={() => viewer.show(n)}>
                <img src={renderSmall(n)} alt={copy ? '' : `Render ${n} z ${RENDER_COUNT}`} width="1280" height="800" loading="lazy" />
              </button>
            )),
          )}
        </div>
        <button className={cn(styles.arrow, styles.prev)} aria-label="Poprzednie zdjęcia" onClick={() => scrollBy(-1)}>
          <Chevron flip />
        </button>
        <button className={cn(styles.arrow, styles.next)} aria-label="Następne zdjęcia" onClick={() => scrollBy(1)}>
          <Chevron />
        </button>
      </div>
      <p className={styles.caption}>
        Render {current} z {RENDER_COUNT}
      </p>

      {viewer.element}
    </section>
  );
}
