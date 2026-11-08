import { createContext, type ReactNode, use, useState } from 'react';
import { DOOR_IDS, type DoorId, type Led, type LedId, LEDS, stripWatt, VOLT } from './data';

const allClosed = Object.fromEntries(DOOR_IDS.map(id => [id, false])) as Record<DoorId, boolean>;
const allFull = Object.fromEntries(LEDS.map(led => [led.id, 1])) as Record<LedId, number>;

// The installation's live state, shared by the drawing, the schematic and the 3D view
function useCircuitStore() {
  const [s1, setS1] = useState(false);
  const [doors, setDoors] = useState(allClosed);
  const [dim, setDim] = useState(allFull);

  const on = (led: Led) => (led.doors ? led.doors.some(door => doors[door]) : s1);
  const level = (led: Led) => (on(led) ? dim[led.id] : 0);
  const watt = LEDS.reduce((sum, led) => sum + stripWatt(led) * level(led), 0);

  return {
    s1,
    doors,
    dim,
    on,
    level,
    watt,
    amp: watt / VOLT,
    toggleS1: () => setS1(value => !value),
    toggleDoor: (door: DoorId) => setDoors(state => ({ ...state, [door]: !state[door] })),
    setDim: (id: LedId, value: number) => setDim(state => ({ ...state, [id]: value })),
  };
}

const CircuitContext = createContext<ReturnType<typeof useCircuitStore> | null>(null);

export function CircuitProvider({ children }: { children: ReactNode }) {
  return <CircuitContext value={useCircuitStore()}>{children}</CircuitContext>;
}

export function useCircuit() {
  const store = use(CircuitContext);
  if (!store) throw new Error('useCircuit must be used within a CircuitProvider');
  return store;
}
