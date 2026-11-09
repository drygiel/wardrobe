import { Link } from 'react-router';
import { RENDER_COUNT, renderSmall } from '@/assets';
import Footer from '@/sections/Footer';
import { renders, useRenderViewer } from '@/sections/Gallery';
import showcase from '@/sections/Showcase.module.scss';
import styles from './galeria.module.scss';

const NAV = [
  { href: '/', label: 'Szafa' },
  { href: '/pomiar', label: 'Pomiar' },
  { href: '/galeria', label: 'Galeria', current: true },
  { href: '/rama', label: 'Rama' },
  { href: '/elektryka', label: 'Elektryka' },
];

export default function GaleriaPage() {
  const viewer = useRenderViewer();

  return (
    <>
      <title>Galeria – Szafa 2025</title>
      <meta name="theme-color" content="#161412" />
      <header className={styles.top}>
        <Link className={showcase.wordmark} to="/">
          Szafa 2025
        </Link>
        <nav className={showcase.nav} aria-label="Nawigacja">
          <ul>
            {NAV.map(item => (
              <li key={item.href}>
                <Link to={item.href} aria-current={item.current ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className={styles.page}>
        <h1>Szafa w pokoju</h1>
        <p>{RENDER_COUNT} rendery z Blendera. Kliknij zdjęcie, aby otworzyć je na pełnym ekranie.</p>
        <div className={styles.grid}>
          {renders.map(n => (
            <button key={n} onClick={() => viewer.show(n)}>
              <img src={renderSmall(n)} alt={`Render ${n} z ${RENDER_COUNT}`} width="1280" height="800" loading="lazy" />
            </button>
          ))}
        </div>
        {viewer.element}
      </main>
      <Footer />
    </>
  );
}
