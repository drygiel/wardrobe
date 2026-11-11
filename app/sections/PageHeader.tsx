import type { PagePath } from '@/site';
import SiteNav from './SiteNav';
import styles from './PageHeader.module.scss';

// Wordmark and menu of a plain page, placed like on the pages with a hero
export default function PageHeader({ current }: { current?: PagePath }) {
  return (
    <header className={styles.top}>
      <SiteNav current={current} />
    </header>
  );
}
