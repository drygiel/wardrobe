// Run with: npx tsx scripts/selection.check.ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { LineData } from '../app/components/Mesh';
import { selection } from '../app/editor/selection';

const log: string[] = [];
const part = (name: string) => {
  const mesh = new THREE.Mesh();
  mesh.name = name;
  mesh.userData.highlight = (on: boolean) => log.push(`${name} ${on ? 'lit' : 'unlit'}`);
  mesh.userData.focus = (state: string) => log.push(`${name} ${state}`);
  return mesh;
};
const take = () => log.splice(0).sort();

const a = part('a');
const b = part('b');
const root = new THREE.Group().add(a, b);
selection.root = root;
const edge = {} as LineData;

selection.hover(a);
assert.deepEqual(take(), ['a lit']);
// Moving from a part's face to its edge and back must not touch the highlight: that was the flicker
selection.hover(a, edge);
selection.hover(a);
assert.deepEqual(take(), []);

// Selecting: the part stops being brightened, the rest dims
selection.pin(a);
assert.deepEqual(take(), ['a selected', 'a unlit', 'b dim']);
// A faded part under the cursor comes forward and goes back; the selected one is never brightened
selection.hover(b);
assert.deepEqual(take(), ['a selected', 'b hover', 'b lit']);
selection.hover(a);
assert.deepEqual(take(), ['a selected', 'b dim', 'b unlit']);

selection.hover(null);
assert.deepEqual(take(), ['a selected']);
selection.unpin();
assert.deepEqual(take(), ['a none', 'b none']);
console.log('selection ok');
