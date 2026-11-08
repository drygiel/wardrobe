import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import cn from 'classnames';
import { CircuitProvider } from '@/electric/circuit';
import { BOM, STEPS } from '@/electric/data';
import { Hero } from '@/electric/Hero';
import { LiveCircuit } from '@/electric/LiveCircuit';
import { Xray } from '@/electric/Xray';
import { DrillSheet } from '@/electric/DrillSheet';
import Footer from '@/sections/Footer';
import styles from '@/electric/Elektryka.module.scss';
import './global.scss';

const SECTIONS = [
  { id: 'obwod', label: 'Obwód' },
  { id: 'przeswietlenie', label: 'Na wylot' },
  { id: 'wiercenie', label: 'Wiercenie' },
  { id: 'montaz', label: 'Montaż' },
];

// Section navigation drawn as a trace with one pad per section
function Rail() {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(entry => entry.isIntersecting && setActive(SECTIONS.findIndex(s => s.id === entry.target.id))),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    SECTIONS.forEach(s => io.observe(document.getElementById(s.id)!));
    return () => io.disconnect();
  }, []);

  return (
    <nav className={styles.rail} aria-label="Sekcje">
      <ul>
        {SECTIONS.map((section, i) => (
          <li key={section.id} className={cn(i <= active && styles.railOn)}>
            <a href={`#${section.id}`} aria-current={i === active ? 'true' : undefined}>
              <span>{section.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Assembly() {
  return (
    <section id="montaz" className={styles.assembly} aria-labelledby="montaz-h">
      <h2 id="montaz-h">Montaż i zakupy</h2>
      <div className={styles.assemblyGrid}>
        <ol className={styles.steps}>
          {STEPS.map(step => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <div>
          <table className={styles.table}>
            <caption>Lista zakupów</caption>
            <tbody>
              {BOM.map(item => (
                <tr key={item.name}>
                  <th scope="row">{item.name}</th>
                  <td className={styles.number}>{item.amount}</td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.warn}>Zasilacz stoi w zamkniętej szczelinie nad szufladą. Użyj modelu dopuszczonego do mebli i zostaw obieg powietrza. Część 230 V to tylko wtyczka i fabryczny przewód zasilacza.</p>
        </div>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <CircuitProvider>
    <Rail />
    <Hero />
    <main>
      <LiveCircuit />
      <Xray />
      <DrillSheet />
      <Assembly />
    </main>
    <Footer />
  </CircuitProvider>,
);
