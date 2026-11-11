import { Link } from 'react-router';
import { nextPage, type PagePath } from '@/site';
import styles from './NextPage.module.scss';

// Closes a page with the next one of the story, so no page ends in a dead end
export default function NextPage({ after }: { after: PagePath }) {
  const next = nextPage(after);
  return (
    <nav className={styles.next} aria-label="Następna strona">
      <Link to={next.href}>
        <span className={styles.kicker}>Dalej</span>
        <span className={styles.name}>{next.label}</span>
        <span className={styles.blurb}>{next.blurb}</span>
        <svg viewBox="0 0 48 16" width="48" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M0 8h46M39 1.5 46 8l-7 6.5" />
        </svg>
      </Link>
    </nav>
  );
}
