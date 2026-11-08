import { Suspense, useState } from 'react';
import cn from 'classnames';
import { PlanDrawing, type PlanView } from '@/components/PlanDrawing';
import { useReveal } from '@/hooks/useReveal';
import styles from './PlanSection.module.scss';

export type PlanRow = { view: PlanView; name: string; value: string; text: string; href?: string };

const ROWS: PlanRow[] = [
  { view: 'front', name: 'Widok z przodu', value: '2688 × 2660 mm', text: 'Bez frontów. Podział na regał A, szafę B, wnękę C i szafę D. Paski LED w kolorze.' },
  { view: 'side', name: 'Widok z boku', value: '560 × 2660 mm', text: 'Głębokość ramy 530 mm, razem z uchwytami 560 mm.' },
  { view: 'top', name: 'Widok z góry', value: '2688 × 560 mm', text: 'Wieńce, regał A i linia frontów z uchwytami.' },
  { view: 'A', name: 'Regał A', value: '408 mm', text: 'Otwarte półki i zamykana szafka na dole.' },
  { view: 'B', name: 'Szafa B', value: '1226 mm', text: 'Półki górne, sześć szuflad i trzy duże kosze.' },
  { view: 'C', name: 'Wnęka C', value: '360 mm', text: 'Cztery półki, front cargo i LED nad wnęką.' },
  { view: 'D', name: 'Szafa D', value: '694 mm', text: 'Półki, małe półki boczne i LED z prawej.' },
];

type Props = { id?: string; title?: string; rows?: PlanRow[]; caption?: string };

export default function PlanSection({ id = 'plan', title = 'Rysunek techniczny', rows = ROWS, caption }: Props) {
  const [active, setActive] = useState(rows[0].view);
  const listRef = useReveal<HTMLDivElement>();
  const current = rows.find(r => r.view === active)!;

  return (
    <section id={id} className={styles.plan} aria-labelledby={`${id}-h`}>
      <figure className={styles.figure}>
        <Suspense fallback={<div className={styles.loading} />}>
          <PlanDrawing view={active} />
        </Suspense>
        <figcaption>{caption ?? `${current.name}. Wymiary w milimetrach, z modelu 3D.`}</figcaption>
      </figure>

      <div ref={listRef} className={styles.list}>
        <h2 id={`${id}-h`}>{title}</h2>
        <ul>
          {rows.map(row => (
            <li key={row.view} className={cn({ [styles.on]: row.view === active })}>
              <button onMouseEnter={() => setActive(row.view)} onFocus={() => setActive(row.view)} onClick={() => setActive(row.view)}>
                <span className={styles.name}>{row.name}</span>
                <span className={styles.value}>{row.value}</span>
              </button>
              {row.view === active && <p>{row.text}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
