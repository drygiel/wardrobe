import { Link } from 'react-router';
import { ELECTRIC_GLB, FRAME_GLB, HARDWARE_GLB, WARDROBE_GLB } from '@/assets';
import { LED_METRES, num } from '@/electric/data';
import { useReveal } from '@/hooks/useReveal';
import { COUNTS, REPO_URL, SIZE_TEXT } from '@/site';
import styles from './About.module.scss';

const FACTS = [
  { name: 'Wymiary', value: SIZE_TEXT },
  { name: 'Elementy', value: `${COUNTS.parts}, bez okuć` },
  { name: 'Rama', value: `${COUNTS.framePieces} formatek z ${COUNTS.boards} płyt` },
  { name: 'Szuflady', value: String(COUNTS.drawers) },
  { name: 'Zawiasy', value: String(COUNTS.hinges) },
  { name: 'Paski LED', value: `${num(LED_METRES, 2)} m` },
];

const FILES = [
  { href: WARDROBE_GLB, name: 'Szafa', note: 'Wnętrze, szuflady i fronty' },
  { href: FRAME_GLB, name: 'Rama', note: '14 formatek i ich rozkrój na płytach' },
  { href: HARDWARE_GLB, name: 'Okucia', note: 'Zawiasy, kołki i klocki montażowe' },
  { href: ELECTRIC_GLB, name: 'Elektryka', note: 'Kable, ściemniacze i kontaktrony' },
];

// Closes the home page: what the project is, its figures, and the files to take away
export default function About() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="o-projekcie" className={styles.about} aria-labelledby="o-projekcie-h">
      <div ref={ref} className={styles.text}>
        <h2 id="o-projekcie-h">O projekcie</h2>
        <p>Szafa 2025 to projekt szafy na wymiar, od podłogi do sufitu: dębowa rama, cztery sekcje i światło LED schowane we frezach.</p>
        <p>
          Cała szafa istnieje jako model 3D w Blenderze, dokładny co do milimetra. Rysunki, tabele i wymiary na tej stronie są liczone z tego modelu, a nie przepisywane ręcznie.
        </p>
      </div>

      <dl className={styles.facts}>
        {FACTS.map(fact => (
          <div key={fact.name}>
            <dt>{fact.name}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div id="pobierz" className={styles.files}>
        <h3>Pobierz</h3>
        <p>Modele w formacie GLB otworzysz w Blenderze i w każdej przeglądarce modeli 3D. Wymiary są w metrach.</p>
        <ul>
          {FILES.map(file => (
            <li key={file.href}>
              <a href={file.href} download>
                <b>{file.name}</b>
                <span>{file.note}</span>
                <i>GLB</i>
              </a>
            </li>
          ))}
          <li>
            <Link to="/rama#plan">
              <b>Rozkrój ramy</b>
              <span>Układ 14 formatek na trzech płytach</span>
              <i>Rysunek</i>
            </Link>
          </li>
          <li>
            <a href={REPO_URL}>
              <b>Kod strony</b>
              <span>React, Three.js i skrypty eksportu z Blendera</span>
              <i>GitHub</i>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}
