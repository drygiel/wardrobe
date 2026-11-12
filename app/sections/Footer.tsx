import { Link } from 'react-router';
import { FRAME_GLB, WARDROBE_GLB } from '@/assets';
import { Icon } from '@/editor/icons';
import { PAGES, REPO_URL, SIZE } from '@/site';
import styles from './Footer.module.scss';

// The site signs off like a workshop drawing: a dimension line at the wardrobe's real width over a title block
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.dim} aria-hidden="true">
        <span>{SIZE.width}</span>
      </div>
      <div className={styles.block}>
        <div className={styles.cell}>
          <span className={styles.label} aria-hidden="true">
            Tytuł
          </span>
          <Link className={styles.name} to="/">
            Szafa 2025
          </Link>
          <p>Projekt, model i rendery: Blender.</p>
        </div>
        <nav className={styles.links} aria-label="Stopka">
          <div className={styles.cell}>
            <span className={styles.label} aria-hidden="true">
              Arkusze
            </span>
            <ul>
              {PAGES.map(page => (
                <li key={page.href}>
                  <Link to={page.href}>{page.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.cell}>
            <span className={styles.label} aria-hidden="true">
              Pliki
            </span>
            <ul className={styles.files}>
              <li>
                <a href={WARDROBE_GLB} download>
                  <Icon name="download" />
                  Model szafy, GLB
                </a>
              </li>
              <li>
                <a href={FRAME_GLB} download>
                  <Icon name="download" />
                  Model ramy, GLB
                </a>
              </li>
              <li>
                <a href={REPO_URL}>
                  Kod na GitHubie
                  <Icon name="external" />
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </footer>
  );
}
