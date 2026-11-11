// Run with: npx tsx tests/selection.test.ts
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
// An edge picked on the drawing leaves highlight and focus alone
selection.setEdge(edge);
selection.setEdge(null);
assert.deepEqual(take(), []);
selection.unpin();
assert.deepEqual(take(), ['a none', 'b none']);

// A folder under the cursor brightens all its parts and selects nothing
selection.hoverGroup(['a', 'b', 'missing']);
assert.deepEqual(take(), ['a lit', 'a none', 'b lit', 'b none']);
assert.equal(selection.pinned, null);
// The part is already lit by the folder, so the cursor reaching it must not flicker
selection.hover(a);
assert.deepEqual(take(), []);
selection.hover(null);
assert.deepEqual(take(), []);
selection.hoverGroup([]);
assert.deepEqual(take(), ['a none', 'a unlit', 'b none', 'b unlit']);

// A row of the list under the cursor: its part stands out, every other part steps back until the cursor leaves
selection.hoverGroup(['a']);
assert.deepEqual(take(), ['a lit', 'a none', 'b dim']);
selection.hoverGroup([]);
assert.deepEqual(take(), ['a none', 'a unlit', 'b none']);

// With a part selected, the folder brings the faded ones forward and leaves the selected one alone
selection.pin(a);
take();
selection.hoverGroup(['a', 'b']);
assert.deepEqual(take(), ['a selected', 'b hover', 'b lit']);
selection.hoverGroup([]);
assert.deepEqual(take(), ['a selected', 'b dim', 'b unlit']);
selection.unpin();
take();
console.log('selection ok');
