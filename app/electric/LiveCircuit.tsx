import type { CSSProperties, ReactNode } from 'react';
import cn from 'classnames';
import { useCircuit } from './circuit';
import { contact, type DoorId, FULL_WATT, type LedId, LEDS, num, PSU_WATT, stripWatt, VOLT } from './data';
import styles from './Elektryka.module.scss';

const W = 1320;
const H = 790;
const at = (x: number, y: number): CSSProperties => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

const RAIL = 340;
const SWITCHED = 540;
const DIMMER = 640;
const DIMMER_W = 170;
const STRIP = 900;
const PX_PER_METRE = 120;

const ROW: Record<LedId, number> = { L8: 90, L7: 170, L6: 250, L1: 350, L2: 440, L3: 530, L4: 615, L5: 705 };

function Wire({ d, kind, live }: { d: string; kind: 'power' | 'signal' | 'mains'; live: boolean }) {
  return (
    <g className={cn(styles.wire, styles[kind], live && styles.live)}>
      <path d={d} />
      <path className={styles.flow} d={d} />
    </g>
  );
}

function ReedSymbol({ x, y, door }: { x: number; y: number; door: DoorId }) {
  const open = useCircuit().doors[door];
  return (
    <g className={cn(styles.reedSymbol, open && styles.reedSymbolOpen)}>
      <circle cx={x} cy={y} r={15} />
      <path d={`M${x - 15} ${y}H${x - 7}`} />
      <path className={styles.blade} d={`M${x - 7} ${y}L${x + 8} ${y}`} style={{ transformOrigin: `${x - 7}px ${y}px` }} />
      <path d={`M${x + 8} ${y}H${x + 15}`} />
      <text x={x} y={y + 31}>
        {contact(door)}
      </text>
    </g>
  );
}

function ReedButton({ x, y, door }: { x: number; y: number; door: DoorId }) {
  const circuit = useCircuit();
  const open = circuit.doors[door];
  return (
    <button
      className={styles.hit}
      style={{ ...at(x, y), width: `${(44 / W) * 100}%`, height: `${(44 / H) * 100}%` }}
      aria-pressed={open}
      aria-label={`Drzwi ${door}, kontaktron ${contact(door)}`}
      title={`Drzwi ${door}: ${open ? 'otwarte' : 'zamknięte'}`}
      onClick={() => circuit.toggleDoor(door)}
    />
  );
}

export function LiveCircuit() {
  const circuit = useCircuit();
  const load = circuit.watt / PSU_WATT;
  const rowOf = (id: LedId) => ROW[id];
  const contacts: { led: LedId; doors: DoorId[] }[] = [
    { led: 'L1', doors: ['F05'] },
    { led: 'L2', doors: ['F06', 'F07'] },
    { led: 'L4', doors: ['F02', 'F04'] },
    { led: 'L5', doors: ['F01', 'F03'] },
  ];
  const loopLive = (doors: DoorId[]) => doors.some(door => circuit.doors[door]);

  const overlays: ReactNode[] = [];

  return (
    <section id="obwod" className={styles.circuit} aria-labelledby="obwod-h">
      <div className={styles.circuitHead}>
        <div>
          <h2 id="obwod-h">Obwód na żywo</h2>
          <p>Każdy pasek ma własny ściemniacz i własny kabel do rozdzielni. Włącz S1, klikaj kontaktrony, przesuwaj jasność.</p>
        </div>
        <dl className={styles.meter} aria-live="polite">
          <div>
            <dt>Pobór</dt>
            <dd>{num(circuit.watt)} W</dd>
          </div>
          <div>
            <dt>Prąd przy {VOLT} V</dt>
            <dd>{num(circuit.amp, 1)} A</dd>
          </div>
          <div className={styles.load}>
            <dt>Obciążenie zasilacza {PSU_WATT} W</dt>
            <dd>
              <i style={{ width: `${load * 100}%` }} />
              <b style={{ left: `${(FULL_WATT / PSU_WATT) * 100}%` }} title="Wszystkie paski na pełnej mocy" />
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.scroller}>
        <div className={styles.diagram}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Schemat połączeń: gniazdko, zasilacz 24 V, szyny, włącznik S1, kontaktrony, osiem ściemniaczy i pasków LED">
            <Wire d={`M108 370H170`} kind="mains" live />
            <Wire d={`M300 370H${RAIL}`} kind="power" live />
            <Wire d={`M${RAIL} 170V705`} kind="power" live />
            <Wire d={`M${RAIL} 170H424`} kind="power" live />
            <Wire d={`M486 170H${SWITCHED}`} kind="power" live={circuit.s1} />
            <Wire d={`M${SWITCHED} 90V250`} kind="power" live={circuit.s1} />

            <g className={styles.box}>
              <rect x="40" y="340" width="68" height="60" />
              <text x="74" y="376">
                230 V
              </text>
              <rect x="170" y="320" width="130" height="100" />
              <text x="235" y="364">
                Z1
              </text>
              <text className={styles.small} x="235" y="388">
                24 V, 150 W
              </text>
            </g>

            <text className={styles.group} x={RAIL + 16} y="60">
              Na włączniku
            </text>
            <text className={styles.group} x={RAIL + 16} y="318">
              Na drzwiach
            </text>

            <g className={cn(styles.switchSymbol, circuit.s1 && styles.switchOn)}>
              <circle cx="424" cy="170" r="6" />
              <circle cx="486" cy="170" r="6" />
              <path className={styles.blade} d="M424 170H486" style={{ transformOrigin: '424px 170px' }} />
              <text x="455" y="208">
                S1
              </text>
            </g>

            {LEDS.map(led => {
              const y = rowOf(led.id);
              const on = circuit.on(led);
              const level = circuit.level(led);
              const barW = led.metres * PX_PER_METRE;
              return (
                <g key={led.id}>
                  {led.doors ? (
                    <Wire d={`M${RAIL} ${y - 10}H${DIMMER}`} kind="power" live />
                  ) : (
                    <Wire d={`M${SWITCHED} ${y}H${DIMMER}`} kind="power" live={circuit.s1} />
                  )}
                  <Wire d={`M${DIMMER + DIMMER_W} ${y}H${STRIP}`} kind="power" live={on} />
                  <g className={cn(styles.box, on && styles.boxOn)}>
                    <rect x={DIMMER} y={y - 28} width={DIMMER_W} height={56} />
                    <text x={DIMMER + 24} y={y + 6}>
                      {led.dimmer}
                    </text>
                  </g>
                  <rect className={styles.barGlow} x={STRIP} y={y - 12} width={barW} height={24} style={{ opacity: level }} />
                  <rect className={cn(styles.bar, on && styles.barOn)} x={STRIP} y={y - 5} width={barW} height={10} style={{ opacity: 0.35 + 0.65 * (on ? level : 0) }} />
                  <text className={styles.rowLabel} x={STRIP} y={y - 19}>
                    {led.id}, {led.place}
                  </text>
                  <text className={styles.rowValue} x={STRIP} y={y + 26}>
                    {num(led.metres, 2)} m, {num(stripWatt(led) * level)} W
                  </text>
                </g>
              );
            })}

            {contacts.map(({ led, doors }) => {
              const y = rowOf(led) + 18;
              const xs = doors.length === 2 ? [452, 524] : [488];
              return (
                <g key={led}>
                  <Wire d={`M${RAIL + 40} ${y}H${xs[0] - 15}`} kind="signal" live={loopLive(doors)} />
                  {xs.slice(1).map((x, i) => (
                    <Wire key={x} d={`M${xs[i] + 15} ${y}H${x - 15}`} kind="signal" live={loopLive(doors)} />
                  ))}
                  <Wire d={`M${xs[xs.length - 1] + 15} ${y}H${DIMMER}`} kind="signal" live={loopLive(doors)} />
                  {doors.map((door, i) => (
                    <ReedSymbol key={door} x={xs[i]} y={y} door={door} />
                  ))}
                </g>
              );
            })}
            <Wire d={`M600 ${rowOf('L4') + 18}V${rowOf('L3') + 18}H${DIMMER}`} kind="signal" live={loopLive(['F02', 'F04'])} />
          </svg>

          <button
            className={styles.hit}
            style={{ ...at(455, 170), width: `${(110 / W) * 100}%`, height: `${(70 / H) * 100}%` }}
            aria-pressed={circuit.s1}
            aria-label="Włącznik S1"
            title={circuit.s1 ? 'S1 włączony' : 'S1 wyłączony'}
            onClick={circuit.toggleS1}
          />

          {contacts.flatMap(({ led, doors }) => {
            const y = rowOf(led) + 18;
            const xs = doors.length === 2 ? [452, 524] : [488];
            return doors.map((door, i) => <ReedButton key={door} x={xs[i]} y={y} door={door} />);
          })}

          {LEDS.map(led => (
            <input
              key={led.id}
              className={styles.slider}
              style={{ ...at(DIMMER + 104, rowOf(led.id)), width: `${(106 / W) * 100}%` }}
              type="range"
              min={5}
              max={100}
              value={Math.round(circuit.dim[led.id] * 100)}
              aria-label={`Jasność ${led.id}, ${led.place}`}
              onChange={event => circuit.setDim(led.id, Number(event.target.value) / 100)}
            />
          ))}
          {overlays}
        </div>
      </div>

      <ul className={styles.legend}>
        <li className={styles.lPower}>24 V, plus. Minus jest wspólny i na schemacie go nie ma.</li>
        <li className={styles.lMains}>230 V, tylko przewód fabryczny zasilacza.</li>
        <li className={styles.lSignal}>Pętla kontaktronów. Otwarcie drzwi ją rozwiera i pasek płynnie się rozjaśnia.</li>
      </ul>
    </section>
  );
}
