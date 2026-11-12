import * as THREE from 'three';
import { Fragment, type RefObject, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { HARDWARE_GLB, WARDROBE_GLB } from '@/assets';
import { pivotPose } from './Electric';
import { Mesh } from './Mesh';

export const PIN_GREEN = '#4fc26b';

export const hardwareColor = (name: string) => {
  if (name.startsWith('PIN_')) return PIN_GREEN;
  if (name.startsWith('J')) return '#d9b27a';
  if (name.startsWith('MB')) return '#a9825a';
  return name.endsWith('_Plate') ? '#7c8187' : '#c6cbd0';
};

type Props = {
  root: RefObject<THREE.Object3D | null>;
  shown: (node: THREE.Object3D) => boolean;
};

// Dowels, hinges, mount blocks and shelf pins. Hinge cups ride on their door's pivot;
// shortcut: hinge arms keep their closed pose when a door opens, drive them from the door angle if that ever shows
export function Hardware({ root, shown }: Props) {
  const hardware = useGLTF(HARDWARE_GLB) as unknown as GLTF;
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as GLTF;
  const [live, setLive] = useState<THREE.Object3D | null>(null);

  useLayoutEffect(() => setLive(root.current), [root]);

  const parts = useMemo(() => {
    wardrobe.scene.updateMatrixWorld(true);
    hardware.scene.updateMatrixWorld(true);
    return (hardware.scene.children as THREE.Mesh[]).map(node => {
      const { pivot, position, quaternion } = pivotPose(node, wardrobe.scene);
      return { node, pivot, position, rotation: new THREE.Euler().setFromQuaternion(quaternion) };
    });
  }, [hardware, wardrobe]);

  return parts.map(({ node, pivot, position, rotation }) => {
    const mesh = (
      <Mesh key={node.name} name={node.name} geometry={node.geometry} position={position} rotation={rotation} visible={shown(node)} overlay={hardwareColor(node.name)} />
    );
    if (!pivot) return mesh;
    const target = live?.getObjectByName(pivot);
    return target ? <Fragment key={node.name}>{createPortal(mesh, target, { events: { enabled: false, priority: 0 } })}</Fragment> : null;
  });
}
