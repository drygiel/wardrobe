import * as THREE from 'three';

// OrbitControls turns the camera about its target. Moving camera and target by this shift afterwards
// makes the same turn happen about `center` instead, without the view jumping to look at it.
export const orbitShift = (target: THREE.Vector3, center: THREE.Vector3, turn: THREE.Quaternion) =>
  target.clone().sub(center).applyQuaternion(turn).add(center).sub(target);
