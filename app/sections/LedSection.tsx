import { Link } from 'react-router';
import { Icon } from '@/editor/icons';
import { DIMMERS, DOOR_IDS, FULL_WATT, LED_METRES, LEDS, num, PSU_WATT, VOLT } from '@/electric/data';
import { useReveal } from '@/hooks/useReveal';
import styles from './LedSection.module.scss';

// The aluminium profile with a diffuser that goes into the grooves
const PROFILE = 'https://allegro.pl/oferta/profil-led-aluminiowy-do-tasmy-czarny-wpuszczany-natynkowy-klosz-2m-zestaw-14786211698';

// Groove in the frame pieces, mm
const GROOVE = { width: 18, depth: 7.5 };

// The cross-section, drawn 6 units to the millimetre: a strip of oak 40 mm thick with the groove in its face
const K = 6;
const BOARD = { x: 40, y: 70, w: 100 * K, h: 40 * K };
const SLOT = { x: BOARD.x + (BOARD.w - GROOVE.width * K) / 2, w: GROOVE.width * K, h: GROOVE.depth * K };

// Light along the frame before /elektryka: what the strips are, where they lie, how they switch, and a way to buy the profile
export default function LedSection() {
  const figure = useReveal<HTMLDivElement>();
  const longest = Math.max(...LEDS.map(led => led.metres));
  const facts: [string, string][] = [
    [String(LEDS.length), 'pasków LED'],
    [`${num(LED_METRES, 1)} m`, 'taśmy'],
    [`${VOLT} V`, `do ${num(FULL_WATT)} W`],
    [String(DIMMERS.length), 'ściemniacze'],
    [`${PSU_WATT} W`, 'zasilacz'],
  ];

  return (
    <section id="led" className={styles.led} aria-labelledby="led-h">
      <div className={styles.copy}>
        <p className={styles.kicker}>Światło w ramie</p>
        <h2 id="led-h">Taśmy LED schowane w dębie</h2>
        {/* Whatever another page or section already describes is linked there */}
        <p>
          <Link className="mention" to="/elektryka#obwod">
            Osiem odcinków taśmy {VOLT} V
          </Link>{' '}
          leży we frezach {num(GROOVE.width)} × {num(GROOVE.depth, 1)} mm,{' '}
          <Link className="mention" to="#zamowienie">
            wyciętych w formatkach ramy
          </Link>{' '}
          i wnętrza. Taśma siedzi w aluminiowym profilu z kloszem: zamiast rzędu diod widać jedną równą linię światła, a profil odprowadza ciepło od drewna.
        </p>
        <p>
          Środek szafy zapala się sam, gdy otworzysz którekolwiek z {DOOR_IDS.length} drzwi:{' '}
          <Link className="mention" to="/elektryka#obwod">
            kontaktrony przy drzwiach
          </Link>{' '}
          mówią o tym ściemniaczowi.{' '}
          <Link className="mention" to="/plan">
            Regał A i wnęka C
          </Link>{' '}
          mają własne pokrętła, a całość zasila jeden{' '}
          <Link className="mention" to="/elektryka#montaz">
            zasilacz {PSU_WATT} W
          </Link>{' '}
          z zapasem.
        </p>
        <dl className={styles.facts}>
          {facts.map(([value, label]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.actions}>
          <Link className="btn" to="/elektryka">
            Zobacz elektrykę
            <Icon name="arrow" />
          </Link>
          <a className={styles.shop} href={PROFILE} target="_blank" rel="noopener noreferrer" title="Allegro, otwiera się w nowej karcie">
            <Icon name="cart" />
            Profil LED z kloszem
          </a>
        </div>
      </div>

      <div ref={figure} className={styles.figure} aria-hidden="true">
        {/* The groove in section, as on a drawing: oak, the profile, the strip, the diffuser and the light it lets out */}
        <svg className={styles.section} viewBox={`0 0 ${BOARD.w + 80} ${BOARD.y + BOARD.h + 40}`}>
          <defs>
            <radialGradient id="led-glow" cx="50%" cy="100%" r="100%">
              <stop offset="0" stopColor="var(--led)" stopOpacity="0.9" />
              <stop offset="0.45" stopColor="var(--led)" stopOpacity="0.25" />
              <stop offset="1" stopColor="var(--led)" stopOpacity="0" />
            </radialGradient>
            <pattern id="led-oak" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0V14" className={styles.hatch} />
            </pattern>
          </defs>
          <path className={styles.light} d={`M${SLOT.x - 150} 0H${SLOT.x + SLOT.w + 150}L${SLOT.x + SLOT.w - 6} ${BOARD.y}H${SLOT.x + 6}Z`} fill="url(#led-glow)" />
          <path
            className={styles.oak}
            d={`M${BOARD.x} ${BOARD.y}H${SLOT.x}V${BOARD.y + SLOT.h}H${SLOT.x + SLOT.w}V${BOARD.y}H${BOARD.x + BOARD.w}V${BOARD.y + BOARD.h}H${BOARD.x}Z`}
            fill="url(#led-oak)"
          />
          <path
            className={styles.profile}
            d={`M${SLOT.x + 3} ${BOARD.y}V${BOARD.y + SLOT.h - 3}H${SLOT.x + SLOT.w - 3}V${BOARD.y}`}
          />
          <rect className={styles.strip} x={SLOT.x + 12} y={BOARD.y + SLOT.h - 14} width={SLOT.w - 24} height={8} />
          {[0, 1, 2].map(i => (
            <rect key={i} className={styles.chip} x={SLOT.x + 22 + i * ((SLOT.w - 56) / 2)} y={BOARD.y + SLOT.h - 22} width={12} height={8} />
          ))}
          <path className={styles.diffuser} d={`M${SLOT.x + 4} ${BOARD.y + 2}Q${SLOT.x + SLOT.w / 2} ${BOARD.y - 12} ${SLOT.x + SLOT.w - 4} ${BOARD.y + 2}`} />
          {/* Dimensions of the groove */}
          <g className={styles.dims}>
            <path d={`M${SLOT.x} ${BOARD.y + SLOT.h + 22}H${SLOT.x + SLOT.w}M${SLOT.x} ${BOARD.y + SLOT.h + 6}V${BOARD.y + SLOT.h + 28}M${SLOT.x + SLOT.w} ${BOARD.y + SLOT.h + 6}V${BOARD.y + SLOT.h + 28}`} />
            <text x={SLOT.x + SLOT.w / 2} y={BOARD.y + SLOT.h + 42} textAnchor="middle">
              {num(GROOVE.width)}
            </text>
            <path d={`M${SLOT.x + SLOT.w + 40} ${BOARD.y}V${BOARD.y + SLOT.h}M${SLOT.x + SLOT.w + 6} ${BOARD.y + SLOT.h}H${SLOT.x + SLOT.w + 46}`} />
            <text x={SLOT.x + SLOT.w + 52} y={BOARD.y + SLOT.h / 2 + 5}>
              {num(GROOVE.depth, 1)}
            </text>
            <text x={BOARD.x + 12} y={BOARD.y + BOARD.h - 14} className={styles.note}>
              dąb 40 mm
            </text>
          </g>
        </svg>

        {/* The eight strips to scale, lighting one after another as the section comes into view */}
        <ol className={styles.strips}>
          {LEDS.map((led, i) => (
            <li key={led.id} style={{ '--i': i, '--w': led.metres / longest } as React.CSSProperties}>
              <span className={styles.bar} />
              <span className={styles.label}>
                <b>{led.id}</b> {led.place}
              </span>
              <span className={styles.metres}>{num(led.metres, 2)} m</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
