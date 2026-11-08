// Run with: npx tsx scripts/edgeView.check.ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { edgeRuns } from '../app/editor/edgeView';

const box = new THREE.BoxGeometry(1, 1, 1);
const sharp = new THREE.EdgesGeometry(box, 30).attributes.position.array;
const front = { axis: 2, sign: 1 };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Top edges of a box seen from the front: the near one is visible, the far one lies under it
assert.deepEqual(edgeRuns(box, [v(-0.5, 0.5, 0.5), v(0.5, 0.5, 0.5)], front, sharp), [{ from: 0, to: 1, hidden: false }]);
assert.deepEqual(edgeRuns(box, [v(-0.5, 0.5, -0.5), v(0.5, 0.5, -0.5)], front, sharp), [{ from: 0, to: 1, hidden: true }]);
// Seen from behind they swap
assert.equal(edgeRuns(box, [v(-0.5, 0.5, -0.5), v(0.5, 0.5, -0.5)], { axis: 2, sign: -1 }, sharp)[0].hidden, false);
// A line across the far face is covered by the near face, with no sharp edge above it
assert.equal(edgeRuns(box, [v(-0.3, 0, -0.5), v(0.3, 0, -0.5)], front, sharp)[0].hidden, true);
console.log('edgeView ok');
