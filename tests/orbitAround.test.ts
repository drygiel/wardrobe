// Run with: npx tsx tests/orbitAround.test.ts
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { orbitShift } from '../app/components/orbitAround';

const camera = new THREE.Vector3(3, 1, 4);
const target = new THREE.Vector3(0, 1, 0);
const center = new THREE.Vector3(1, 2, -1);
const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);

// What OrbitControls does on its own, then the correction
const orbited = camera.clone().sub(target).applyQuaternion(turn).add(target);
const shift = orbitShift(target, center, turn);

assert.ok(orbited.clone().add(shift).distanceTo(camera.clone().sub(center).applyQuaternion(turn).add(center)) < 1e-9);
assert.ok(orbited.clone().add(shift).distanceTo(center) - camera.distanceTo(center) < 1e-9);
assert.ok(orbitShift(target, center, new THREE.Quaternion()).length() < 1e-9); // no turn, no move: pan and zoom stay untouched
console.log('orbitAround ok');
