import * as THREE from 'three';
import { Fragment, type RefObject, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { ELECTRIC_GLB, WARDROBE_GLB } from '@/assets';
import { DIMMED_OPACITY, DOORS, HOVERED_OPACITY } from './parts';

// Flat colour of a part from its glTF name (the loader turns spaces into underscores)
export function wireColor(name: string) {
  if (name === 'Mains_Cord') return '#3f7dff';
  if (name === 'Switch_Wire') return '#ffd23c';
  if (name.startsWith('Door_Wire')) return '#f4f2e8';
  if (/^(LED_Wire|Feed_24V|Dimmer_Jumpers)/.test(name)) return '#e8352c';
  if (name === 'Socket' || name === 'Wire') return '#d8d6cf';
  return '#17181a';
}

export type WireMaterial = THREE.ShaderMaterial & {
  uniforms: { uColor: { value: THREE.Color }; uOpacity: { value: number }; uGlow: { value: number }; uTime: { value: number } };
};

// Headlight shading so it does not depend on the scene's lights; uGlow runs bright bands along the wires
export function wireMaterial(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true, // sorted after the wardrobe's own transparent measure mode
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uGlow: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-view.xyz);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uGlow;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        float facing = max(dot(normalize(vNormal), vView), 0.0);
        vec3 color = uColor * (0.5 + 0.5 * facing) + vec3(0.16) * pow(1.0 - facing, 2.0);
        float band = smoothstep(0.82, 1.0, sin((vWorld.x + vWorld.y + vWorld.z) * 42.0 - uTime * 7.0));
        color += uGlow * band * (uColor * 1.4 + 0.25);
        gl_FragColor = vec4(color, uOpacity);
        #include <colorspace_fragment>
      }`,
  }) as WireMaterial;
}

const noRaycast = () => null;

// Pose of a magnet or hinge cup on its door's pivot, taken while the door is closed in the glTF scene.
// On the pivot, not the door: these parts stay in place when the fronts are hidden.
export function pivotPose(node: THREE.Object3D, wardrobe: THREE.Object3D) {
  const id = /^(?:Door_Magnet_|H\d\d_)(F\d\d)(?:_Cup)?$/.exec(node.name)?.[1];
  const door = id && Object.keys(DOORS).find(name => name.startsWith(`${id}_`));
  if (!door) return { pivot: undefined, position: node.position, quaternion: node.quaternion };
  const pivot = wardrobe.getObjectByName(door)!.parent!;
  const local = pivot.matrixWorld.clone().invert().multiply(node.matrixWorld);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  local.decompose(position, quaternion, new THREE.Vector3());
  return { pivot: pivot.name, position, quaternion };
}

type Props = {
  // Holds the live pivots by their glTF names; the magnets ride on them
  root: RefObject<THREE.Object3D | null>;
  // Set by a page that animates the wires itself
  materials?: Map<string, WireMaterial>;
  shown?: (node: THREE.Object3D) => boolean;
};

// The wiring as an X-ray overlay: depth is cleared after the wardrobe, so the cables only hide each other
export function Electric({ root, materials, shown }: Props) {
  const electric = useGLTF(ELECTRIC_GLB) as unknown as GLTF;
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as GLTF;
  const [live, setLive] = useState<THREE.Object3D | null>(null);

  useLayoutEffect(() => setLive(root.current), [root]);

  const clearDepth = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, colorWrite: false, depthWrite: false, depthTest: false }), []);

  const parts = useMemo(() => {
    wardrobe.scene.updateMatrixWorld(true);
    electric.scene.updateMatrixWorld(true);
    return (electric.scene.children as THREE.Mesh[]).map(node => {
      const material = materials?.get(node.name) ?? wireMaterial(wireColor(node.name));
      return { node, material, ...pivotPose(node, wardrobe.scene) };
    });
  }, [electric, wardrobe, materials]);

  const highlight = (material: WireMaterial, name: string) => (on: boolean) => material.uniforms.uColor.value.set(on ? '#ffffff' : wireColor(name));
  const focus = (material: WireMaterial) => (state: string) => (material.uniforms.uOpacity.value = state === 'dim' ? DIMMED_OPACITY : state === 'hover' ? HOVERED_OPACITY : 1);

  return (
    <>
      <mesh renderOrder={9} frustumCulled={false} material={clearDepth} raycast={noRaycast} onBeforeRender={renderer => renderer.clearDepth()}>
        <planeGeometry args={[0, 0]} />
      </mesh>
      {parts.filter(({ node }) => !shown || shown(node)).map(({ node, material, pivot, position, quaternion }) => {
        const mesh = (
          <mesh key={node.name} name={node.name} geometry={node.geometry} material={material} position={position} quaternion={quaternion} renderOrder={10} userData={{ overlay: true, highlight: highlight(material, node.name), focus: focus(material) }} />
        );
        if (!pivot) return mesh;
        const target = live?.getObjectByName(pivot);
        return target ? <Fragment key={node.name}>{createPortal(mesh, target, { events: { enabled: false, priority: 0 } })}</Fragment> : null;
      })}
    </>
  );
}
