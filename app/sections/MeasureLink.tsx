import { Link } from 'react-router';
import styles from './MeasureLink.module.scss';

// Where a page used to embed the measuring scene: the scene itself lives on /pomiar
export default function MeasureLink({ title, text, to }: { title: string; text: string; to: string }) {
  return (
    <section className={styles.section} aria-labelledby="pomiar-h">
      <h2 id="pomiar-h">{title}</h2>
      <div>
        <p>{text}</p>
        <Link className="btn" to={to}>
          Otwórz pomiary
        </Link>
      </div>
    </section>
  );
}
