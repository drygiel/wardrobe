// Run with: npx tsx tests/grain.test.ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { grainAxis, grainHatch, sheetAxes } from '../app/components/grain';

const shelf = new THREE.BoxGeometry(0.443, 0.018, 0.383);
assert.equal(grainAxis('IN_B_Shelf-03', shelf), 2); // across the 443 mm depth: along z, the shorter side
assert.equal(grainAxis('IN_C_Shelf-01', new THREE.BoxGeometry(0.492, 0.018, 0.342)), 2); // shelves run along the width
assert.equal(grainAxis('IN_B_Shelf-06', shelf), 2);
assert.equal(grainAxis('P06_C_Top', new THREE.BoxGeometry(0.33, 0.04, 0.36)), '?');
assert.equal(grainAxis('F01_Handle', shelf), null);

const hatch = grainHatch('IN_B_Shelf-03', shelf)!;
assert.ok(hatch.length > 0 && hatch.length % 6 === 0);
assert.equal(grainHatch('F01_Handle', shelf), null);

// The first segment's length, as a share of the part's own length: smaller on a smaller part
const reach = (name: string, geometry: THREE.BoxGeometry, length: number) => {
  const h = grainHatch(name, geometry)!;
  return Math.hypot(h[3] - h[0], h[4] - h[1], h[5] - h[2]) / length;
};
const big = reach('IN_B_Shelf-02', new THREE.BoxGeometry(0.492, 0.018, 1.159), 1.159);
const small = reach('IN_B_Shelf-03', shelf, 0.383);
assert.ok(small < big, `${small} < ${big}`);

// The drawing: grain left to right even along the shorter side, the longest side when there is no grain
assert.deepEqual(sheetAxes([0.443, 0.018, 0.358], 2), [2, 0, 1]);
assert.deepEqual(sheetAxes([0.443, 0.018, 0.358]), [0, 2, 1]);
console.log('grain ok');
