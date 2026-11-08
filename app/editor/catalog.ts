import * as THREE from 'three';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { ELECTRIC_GLB, FRAME_GLB, FRAME_PIECES, HARDWARE_GLB, WARDROBE_GLB } from '@/assets';
import { type Column, columnsOf, type GroupId, groupOf, GROUPS } from '@/components/parts';
import { partLabel, treePath } from './labels';

export type Part = {
  name: string; // the code name in Szafa4.blend
  label: string;
  group: GroupId;
  columns: Column[];
  path: string[]; // folders in the element tree, below the group
  node: THREE.Mesh;
  size: [number, number, number]; // mm, longest first
  from: { left: number; floor: number; back: number }; // mm, closed pose
  twins: number; // parts of the group with the same size, this one included
};

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as THREE.Mesh).isMesh;

export function useCatalog() {
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as GLTF;
  const frame = useGLTF(FRAME_GLB) as unknown as GLTF;
  const electric = useGLTF(ELECTRIC_GLB) as unknown as GLTF;
  const hardware = useGLTF(HARDWARE_GLB) as unknown as GLTF;

  return useMemo(() => {
    [wardrobe, frame, electric, hardware].forEach(g => g.scene.updateMatrixWorld(true));
    const nodes: THREE.Mesh[] = [];
    wardrobe.scene.traverse(o => isMesh(o) && nodes.push(o));
    frame.scene.traverse(o => isMesh(o) && (FRAME_PIECES as readonly string[]).includes(o.name) && nodes.push(o));
    electric.scene.children.filter(isMesh).forEach(o => nodes.push(o));
    hardware.scene.children.filter(isMesh).forEach(o => nodes.push(o));

    // Bounding boxes without the children: a door's box must not grow by its handle
    const boxes = new Map(nodes.map(node => {
      node.geometry.computeBoundingBox();
      return [node, node.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld)];
    }));
    const all = new THREE.Box3();
    boxes.forEach((box, node) => groupOf(node.name) !== 'electric' && all.union(box));

    const parts: Part[] = nodes.map(node => {
      const dims = node.geometry.boundingBox!.getSize(new THREE.Vector3());
      const box = boxes.get(node)!;
      return {
        name: node.name,
        label: partLabel(node.name),
        group: groupOf(node.name),
        columns: columnsOf(node),
        path: treePath(node.name, groupOf(node.name), columnsOf(node)),
        node,
        size: [dims.x * 1000, dims.y * 1000, dims.z * 1000].sort((a, b) => b - a) as Part['size'],
        from: {
          left: (box.min.z - all.min.z) * 1000,
          floor: (box.min.y - all.min.y) * 1000,
          back: (all.max.x - box.max.x) * 1000,
        },
        twins: 1,
      };
    });

    const sizeKey = (p: Part) => `${p.group}:${p.size.map(Math.round).join('x')}`;
    const twins = new Map<string, number>();
    parts.forEach(p => twins.set(sizeKey(p), (twins.get(sizeKey(p)) ?? 0) + 1));
    parts.forEach(p => (p.twins = twins.get(sizeKey(p))!));

    const order = GROUPS.map(g => g.id as GroupId);
    parts.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name, 'en'));

    const counts = new Map<GroupId, number>();
    parts.forEach(p => counts.set(p.group, (counts.get(p.group) ?? 0) + 1));

    const overall = all.getSize(new THREE.Vector3()).multiplyScalar(1000);
    return { parts, counts, byName: new Map(parts.map(p => [p.name, p])), overall };
  }, [wardrobe, frame, electric, hardware]);
}

useGLTF.preload(ELECTRIC_GLB);
useGLTF.preload(HARDWARE_GLB);
