import { WARDROBE_GLB } from '@/assets';
import styles from './Footer.module.scss';

const base = import.meta.env.BASE_URL;

// Inverted close with the name across the full width
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.cols}>
        <ul>
          <li>Strony</li>
          <li>
            <a href={base}>Szafa</a>
          </li>
          <li>
            <a href={`${base}rama.html`}>Rama</a>
          </li>
          <li>
            <a href={`${base}editor.html`}>Edytor pomiarów</a>
          </li>
        </ul>
        <ul>
          <li>Pliki</li>
          <li>
            <a href={WARDROBE_GLB} download>
              Model szafy, GLB
            </a>
          </li>
          <li>
            <a href={`${base}models/Frame.glb`} download>
              Model ramy, GLB
            </a>
          </li>
        </ul>
        <ul>
          <li>Pomiar</li>
          <li>Obrót: lewy przycisk</li>
          <li>Przesuwanie: prawy przycisk</li>
          <li>Przybliżenie: kółko</li>
        </ul>
        <ul>
          <li>Kod</li>
          <li>
            <a href="https://github.com/drygiel/wardrobe">github.com/drygiel/wardrobe</a>
          </li>
        </ul>
      </div>
      <div />
      <div>
        <svg className={styles.mark} viewBox="0 0 1000 150" role="img" aria-label="Szafa 2025">
          <text x="0" y="128" textLength="1000" lengthAdjust="spacingAndGlyphs">
            Szafa 2025
          </text>
        </svg>
        <p className={styles.legal}>Projekt, model i rendery: Blender. Wymiary w milimetrach.</p>
      </div>
    </footer>
  );
}
