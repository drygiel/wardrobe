import type { Unit } from '../contexts/AppContext';
import { DIMMERS, LEDS } from '../electric/data';

type Gender = 0 | 1 | 2; // masculine, feminine, neuter or plural

const NOUNS: Record<string, [string, Gender]> = {
  Post: ['Słup', 0],
  Rail: ['Belka', 1],
  Side: ['Bok', 0],
  Bottom: ['Dno', 2],
  Top: ['Wieniec górny', 0],
  Crossbar: ['Poprzeczka', 1],
  Door: ['Drzwi', 2],
  Filler: ['Maskownica', 1],
  Divider: ['Przegroda', 1],
  Shelf: ['Półka', 1],
  Strip: ['Listwa', 1],
  Drawer: ['Szuflada', 1],
  Carcass: ['Korpus regału', 0],
};

const ADJECTIVES: Record<string, [string, string, string]> = {
  Bottom: ['dolny', 'dolna', 'dolne'],
  Lower: ['dolny', 'dolna', 'dolne'],
  Top: ['górny', 'górna', 'górne'],
  Front: ['przedni', 'przednia', 'przednie'],
  Rear: ['tylny', 'tylna', 'tylne'],
  L: ['lewy', 'lewa', 'lewe'],
  R: ['prawy', 'prawa', 'prawe'],
};

const ELECTRIC: Record<string, string> = {
  Mains_Cord: 'Przewód zasilający 230 V',
  Feed_24V: 'Zasilanie 24 V',
  Switch_Wire: 'Przewód włącznika',
  Dimmer_Jumpers: 'Mostki ściemniaczy',
  Dimmer_Outputs: 'Rozgałęzienia na wyjściach ściemniaczy',
  Bus_24V: 'Szyna 24 V',
  Bus_24V_Switched: 'Szyna 24 V za włącznikiem',
  PSU_24V: 'Zasilacz 24 V',
  Plug: 'Wtyczka',
  Switch: 'Włącznik',
  Socket: 'Gniazdo',
  Wire: 'Przewód gniazda',
  Unused_SidePanel: 'Panel boczny',
};

const HINGE_PARTS: Record<string, string> = { Arm: 'Ramię', Cup: 'Puszka', Plate: 'Prowadnik' };

// Polish name of a part from its Szafa4.blend object name (spaces arrive as underscores from the loader)
export function partLabel(name: string): string {
  if (ELECTRIC[name]) return ELECTRIC[name];
  const wire = LEDS.find(led => led.wire === name);
  if (wire) return `Przewód LED, ${wire.place}`;

  let match;
  const dimmer = DIMMERS.find(d => d.object === name);
  if (dimmer) return `Ściemniacz ${dimmer.id}, ${dimmer.place}`;
  if ((match = /^LED_(.+)$/.exec(name))) {
    const led = LEDS.find(l => l.strip === match![1]);
    if (led) return `Taśma LED, ${led.place}`;
  }
  if ((match = /^Door_Sensor_(F\d\d)$/.exec(name))) return `Czujnik drzwi ${match[1]}`;
  if ((match = /^Door_Magnet_(F\d\d)$/.exec(name))) return `Magnes czujnika ${match[1]}`;
  if ((match = /^Door_Wire_(.+)$/.exec(name))) return `Przewód czujników ${match[1]}`;
  if ((match = /^(J\d\d)_Dowel/.exec(name))) return `Kołek 8×40, złącze ${match[1]}`;
  if ((match = /^(H\d\d)_F\d\d_(Arm|Cup|Plate)$/.exec(name))) return `${HINGE_PARTS[match[2]]} zawiasu ${match[1]}`;
  if ((match = /^MB(\d)_/.exec(name))) return `Klocek montażowy ${match[1]}`;
  if ((match = /^PIN_(.+)_(\d)$/.exec(name))) return `Podpórka ${match[2]}, ${partLabel(`IN_${match[1]}`).toLowerCase()}`;
  if ((match = /^(F\d\d)_Handle$/.exec(name))) return `Uchwyt drzwi ${match[1]}`;
  if ((match = /^([BCD]\d)_BackPanel$/.exec(name))) return `Plecy ${match[1]}`;

  match = /^(?:P\d\d|F\d\d|IN|DR|A)_(?:[ABCD]_)?(.+)$/.exec(name);
  const [head, ...rest] = match ? match[1].split('-') : [];
  const noun = NOUNS[head];
  if (!noun) return name;
  const words = rest.map(token => ADJECTIVES[token]?.[noun[1]] ?? token);
  return [noun[0], ...words].join(' ');
}

// Folders of a part in the element tree, below its group
export function treePath(name: string, group: string, columns: string[]): string[] {
  const column = `Słupek ${columns.length > 1 ? `${columns[0]}–${columns[columns.length - 1]}` : columns[0]}`;
  switch (group) {
    case 'frame':
      if (name.includes('Post')) return ['Słupy'];
      if (name.includes('Side')) return ['Boki'];
      if (name.includes('Rail')) return ['Belki'];
      if (name.includes('Crossbar')) return ['Poprzeczki'];
      if (name.includes('Shelf')) return ['Półki'];
      return ['Dno i wieniec'];
    case 'interior':
      if (name.includes('Shelf')) return [column, 'Półki'];
      if (name.includes('Divider')) return [column, 'Przegrody'];
      if (name.includes('Side')) return [column, 'Boki'];
      if (name.includes('Strip')) return [column, 'Listwy'];
      return [column];
    case 'drawers':
      return [column];
    case 'fronts':
      if (name.endsWith('_Handle')) return ['Uchwyty'];
      return [name.includes('Filler') ? 'Maskownice' : 'Drzwi'];
    case 'dowels':
      return ['Kołki', `Złącze ${name.slice(0, 3)}`];
    case 'pins':
      return [column, partLabel(`IN_${name.slice(4, -2)}`)];
    case 'hinges':
      return [`Drzwi ${name.slice(4, 7)}`, `Zawias ${name.slice(0, 3)}`];
    case 'electric':
      if (name.startsWith('Door_')) return ['Czujniki drzwi'];
      if (name.startsWith('LED_Wire')) return ['Przewody LED'];
      if (DIMMERS.some(d => d.object === name)) return ['Ściemniacze'];
      return ['Zasilanie'];
    default:
      return [];
  }
}

// Millimetres, Polish decimal comma, no grouping: technical drawings write 2660
export const mm = (value: number) => value.toLocaleString('pl-PL', { maximumFractionDigits: 1, useGrouping: false });

// A length given in millimetres, written in the chosen unit
export const inUnit = (millimetres: number, unit: Unit) => mm(unit === 'cm' ? millimetres / 10 : millimetres);
