import { Link } from 'react-router';
import { FRAME_GLB, WARDROBE_GLB } from '@/assets';
import styles from './Footer.module.scss';

// A low band lit from above by an LED strip, like the wardrobe's own shelves
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>
        <Link className={styles.name} to="/">
          Szafa 2025
        </Link>
        <p>Projekt, model i rendery: Blender.</p>
      </div>
      <nav className={styles.links} aria-label="Stopka">
        <ul>
          <li>
            <Link to="/">Szafa</Link>
          </li>
          <li>
            <Link to="/rama">Rama</Link>
          </li>
          <li>
            <Link to="/elektryka">Elektryka</Link>
          </li>
          <li>
            <Link to="/pomiar">Edytor pomiarów</Link>
          </li>
          <li>
            <Link to="/plan">Rysunek techniczny</Link>
          </li>
          <li>
            <Link to="/okucia">Szuflady i zawiasy</Link>
          </li>
          <li>
            <Link to="/galeria">Galeria</Link>
          </li>
        </ul>
        <ul className={styles.files}>
          <li>
            <a href={WARDROBE_GLB} download>
              Model szafy, GLB
            </a>
          </li>
          <li>
            <a href={FRAME_GLB} download>
              Model ramy, GLB
            </a>
          </li>
          <li>
            <a href="https://github.com/drygiel/wardrobe">Kod na GitHubie</a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
