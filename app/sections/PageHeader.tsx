import { Link } from 'react-router';
import showcase from './Showcase.module.scss';
import styles from './PageHeader.module.scss';

const NAV = [
  { href: '/', label: 'Szafa' },
  { href: '/pomiar', label: 'Pomiar' },
  { href: '/plan', label: 'Plan' },
  { href: '/okucia', label: 'Okucia' },
  { href: '/galeria', label: 'Galeria' },
  { href: '/rama', label: 'Rama' },
  { href: '/elektryka', label: 'Elektryka' },
];

// Wordmark and menu of a plain page, placed like on the pages with a hero
export default function PageHeader({ current }: { current: string }) {
  return (
    <header className={styles.top}>
      <Link className={showcase.wordmark} to="/">
        Szafa 2025
      </Link>
      <nav className={showcase.nav} aria-label="Nawigacja">
        <ul>
          {NAV.map(item => (
            <li key={item.href}>
              <Link to={item.href} aria-current={item.href === current ? 'page' : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
