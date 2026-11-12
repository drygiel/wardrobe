// Run with: npx tsx tests/site.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { COUNTS, nextPage, PAGES, SIZE } from '../app/site';

// Names of the mesh nodes in a .glb, read from its JSON chunk
function meshes(file: string) {
  const glb = readFileSync(new URL(`../public/models/${file}`, import.meta.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as { nodes: { name: string; mesh?: number }[] };
  return json.nodes.filter(node => node.mesh !== undefined).map(node => node.name);
}

const wardrobe = meshes('Wardrobe.glb');
const frame = meshes('Frame.glb').filter(name => /^P\d\d_/.test(name));
const hardware = meshes('Hardware.glb');

assert.equal(frame.length, COUNTS.framePieces, 'frame pieces');
assert.equal(wardrobe.length + frame.length, COUNTS.parts, 'parts');
assert.equal(wardrobe.filter(name => name.startsWith('DR_')).length, COUNTS.drawers, 'drawers');
assert.equal(hardware.filter(name => name.endsWith('_Cup')).length, COUNTS.hinges, 'hinges');
assert.equal(new Set(hardware.filter(name => name.endsWith('_Cup')).map(name => name.slice(4, 7))).size, COUNTS.hingedDoors, 'hinged doors');
assert.equal(hardware.filter(name => name.startsWith('PIN_')).length, COUNTS.shelfPins, 'shelf pins');
assert.equal(COUNTS.shelfPins, COUNTS.adjustableShelves * 4, 'four pins a shelf');

// Depth of everything in Wardrobe.glb, from the POSITION bounds of each mesh in world space
type Node = { mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] };
function depth(file: string) {
  const glb = readFileSync(new URL(`../public/models/${file}`, import.meta.url));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as {
    nodes: Node[];
    scenes: { nodes: number[] }[];
    meshes: { primitives: { attributes: { POSITION: number } }[] }[];
    accessors: { min: number[]; max: number[] }[];
  };
  const all = new THREE.Box3();
  const visit = (index: number, parent: THREE.Matrix4) => {
    const node = json.nodes[index];
    const world = parent.clone().multiply(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...(node.translation ?? [0, 0, 0])),
        new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
        new THREE.Vector3(...(node.scale ?? [1, 1, 1])),
      ),
    );
    if (node.mesh !== undefined)
      json.meshes[node.mesh].primitives.forEach(p => {
        const { min, max } = json.accessors[p.attributes.POSITION];
        all.union(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)).applyMatrix4(world));
      });
    node.children?.forEach(child => visit(child, world));
  };
  json.scenes[0].nodes.forEach(index => visit(index, new THREE.Matrix4()));
  return Math.round((all.max.x - all.min.x) * 1000);
}
assert.equal(depth('Wardrobe.glb'), SIZE.depthOverall, 'overall depth');

assert.equal(nextPage('/okucia').href, '/rama');
assert.equal(nextPage(PAGES[PAGES.length - 1].href).href, '/', 'the last page leads back to the start');

console.log('site: ok');
