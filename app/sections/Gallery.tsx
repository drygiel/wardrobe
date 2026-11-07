import { useEffect, useRef, useState } from 'react';
import ImageGallery, { type ReactImageGalleryItem } from 'react-image-gallery';
import cn from 'classnames';
import { RENDER_COUNT, renderLarge, renderSmall } from '@/assets';
import { useReveal } from '@/hooks/useReveal';
import 'react-image-gallery/styles/css/image-gallery.css';
import styles from './Gallery.module.scss';

const renders = Array.from({ length: RENDER_COUNT }, (_, i) => i + 1);

const items: ReactImageGalleryItem[] = renders.map(n => ({
  original: renderLarge(n),
  thumbnail: renderSmall(n),
  originalHeight: 1600,
  loading: 'lazy',
  originalAlt: `Render ${n} z ${RENDER_COUNT}`,
}));

// A sideways drag row of the renders; a click opens the full-screen gallery
export default function Gallery() {
  const galleryRef = useRef<ImageGallery>(null!);
  const stripRef = useRef<HTMLDivElement>(null!);
  const headRef = useReveal<HTMLElement>();
  const [current, setCurrent] = useState(1);
  const [open, setOpen] = useState(false);

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

  const show = (n: number) => {
    galleryRef.current.slideToIndex(n - 1);
    galleryRef.current.fullScreen();
  };

  return (
    <section id="galeria" className={styles.gallery} aria-labelledby="galeria-h">
      <header ref={headRef} className={styles.head}>
        <h2 id="galeria-h">Szafa w pokoju</h2>
        <p>{RENDER_COUNT} rendery z Blendera. Przeciągnij w bok, kliknij zdjęcie, aby otworzyć je na pełnym ekranie.</p>
      </header>

      <div ref={stripRef} className={styles.strip}>
        {renders.map(n => (
          <button key={n} data-n={n} className={cn({ [styles.on]: n === current })} onClick={() => show(n)}>
            <img src={renderSmall(n)} alt={`Render ${n} z ${RENDER_COUNT}`} width="1280" height="800" loading="lazy" />
          </button>
        ))}
      </div>
      <p className={styles.caption}>
        Render {current} z {RENDER_COUNT}
      </p>

      <div className={cn(styles.fullscreen, { [styles.open]: open })}>
        <ImageGallery
          ref={galleryRef}
          items={items}
          showThumbnails={false}
          showPlayButton={false}
          slideDuration={0}
          infinite
          onScreenChange={setOpen}
        />
      </div>
    </section>
  );
}
