// Run with: npx tsx scripts/labels.check.ts
import assert from 'node:assert/strict';
import { mm, partLabel, treePath } from '../app/editor/labels';

const cases: Record<string, string> = {
  'P14_B_Side-L': 'Bok lewy',
  'P02_B_Rail-Bottom-Rear': 'Belka dolna tylna',
  'P09_D_Post-Front-R': 'Słup przedni prawy',
  P04_C_Bottom: 'Dno',
  'F01_B_Door-Bottom-L': 'Drzwi dolne lewe',
  'IN_B_Side-L-Lower': 'Bok lewy dolny',
  'DR_B_Drawer-03-R': 'Szuflada 03 prawa',
  'A_Shelf-Bottom': 'Półka dolna',
  'J05_Dowel-2': 'Kołek 8×40, złącze J05',
  H01_F01_Cup: 'Puszka zawiasu H01',
  MB1_D_MountBlock: 'Klocek montażowy 1',
  LED_P09: 'Taśma LED, Szafa D',
  LED_Wire_P09: 'Przewód LED, Szafa D',
  Dimmer_P09: 'Ściemniacz Ś2, Szafa D',
  Door_Sensor_F01: 'Czujnik drzwi F01',
  Unknown: 'Unknown',
};

for (const [name, label] of Object.entries(cases)) assert.equal(partLabel(name), label);
assert.deepEqual(treePath('P09_D_Post-Front-R', 'frame', ['D']), ['Słupy']);
assert.deepEqual(treePath('IN_B_Shelf-02', 'interior', ['B']), ['Słupek B', 'Półki']);
assert.deepEqual(treePath('J05_Dowel-2', 'dowels', ['B']), ['Kołki', 'Złącze J05']);
assert.deepEqual(treePath('H01_F01_Cup', 'hinges', ['B']), ['Drzwi F01', 'Zawias H01']);
assert.deepEqual(treePath('Dimmer_Jumpers', 'electric', ['C']), ['Zasilanie']);
assert.deepEqual(treePath('LED_P03', 'led', ['C']), []);
assert.equal(mm(2660), '2660');
assert.equal(mm(18.25), '18,3');
console.log('labels ok');
