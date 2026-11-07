import * as THREE from 'three';

// Shared blend between the baked texture (0) and flat schematic colours (1); one uniform drives every material
export const schematicMix = { value: 0 };

export function schematicMaterial(map: THREE.Texture | null, flat: string, emissive?: string) {
  const material = new THREE.MeshStandardMaterial({
    map,
    roughness: 1,
    metalness: 0,
    transparent: true,
    emissive: emissive ?? '#000000',
    emissiveIntensity: 0,
  });
  const uFlat = { value: new THREE.Color(flat) };

  material.onBeforeCompile = shader => {
    shader.uniforms.uMix = schematicMix;
    shader.uniforms.uFlat = uFlat;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uMix;\nuniform vec3 uFlat;')
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.rgb = mix(diffuseColor.rgb, uFlat, uMix);',
      );
  };

  return material;
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Frame-rate independent approach factor
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * Math.min(dt, 0.1));

// Camera distance that fits a box of the given half extents into the visible fraction of the viewport
export function fitDistance(camera: THREE.PerspectiveCamera, halfW: number, halfH: number, fracW: number, fracH: number) {
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(halfH / (tan * fracH), halfW / (tan * camera.aspect * fracW));
}

export type Pose = { az: number; el: number; dist: number; ty?: number };

// Pose between whole steps of T, eased per step
export function poseAt(poses: Pose[], T: number): Required<Pose> {
  const i = Math.min(poses.length - 2, Math.max(0, Math.floor(T)));
  const f = smoothstep(0, 1, T - i);
  const a = poses[i];
  const b = poses[i + 1];
  const lerp = THREE.MathUtils.lerp;
  return { az: lerp(a.az, b.az, f), el: lerp(a.el, b.el, f), dist: lerp(a.dist, b.dist, f), ty: lerp(a.ty ?? 0, b.ty ?? 0, f) };
}

const desired = new THREE.Vector3();
const aim = new THREE.Vector3();

// Orbit the camera around `center` (az from the model's front, -X, towards -Z) with damping; true while still moving
export function moveCamera(camera: THREE.Camera, look: THREE.Vector3, center: THREE.Vector3, pose: Required<Pose>, dt: number, snap = false) {
  const az = THREE.MathUtils.degToRad(pose.az);
  const el = THREE.MathUtils.degToRad(pose.el);
  desired.set(-Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az)).multiplyScalar(pose.dist).add(center);
  aim.copy(center).setY(center.y + pose.ty);
  const moving = camera.position.distanceToSquared(desired) > 1e-7 || look.distanceToSquared(aim) > 1e-7;
  if (moving) {
    const k = snap ? 1 : damp(6, dt);
    camera.position.lerp(desired, k);
    look.lerp(aim, k);
  }
  camera.lookAt(look);
  return moving;
}

// Scroll position shared by a page's DOM and its fixed scene: T 0..1 leaves the hero, then one unit per step
export type ShowcaseProgress = { T: number; yaw: number };
