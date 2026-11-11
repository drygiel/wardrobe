import { Link } from 'react-router';
import Footer from '@/sections/Footer';
import Meta from '@/sections/Meta';
import PageHeader from '@/sections/PageHeader';
import { NOT_FOUND, PAGES } from '@/site';
import styles from '@/sections/PageHeader.module.scss';

export default function NotFoundPage() {
  return (
    <>
      <Meta page={NOT_FOUND} index={false} />
      <PageHeader />
      <main>
        <header className={styles.intro}>
          <h1>Nie ma takiej strony</h1>
          <p>Pod tym adresem nic nie ma. Adres mógł się zmienić albo zawiera literówkę. Wybierz jedną ze stron projektu:</p>
        </header>
        <ul className={styles.pages}>
          {PAGES.map(page => (
            <li key={page.href}>
              <Link to={page.href}>
                <b>{page.label}</b>
                <span>{page.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
