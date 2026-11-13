import * as THREE from 'three';
import { type ReactNode, Suspense, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { type ThreeElements, type ThreeEvent } from '@react-three/fiber';
import { GLTF } from 'three-stdlib';
import { Mesh } from './Mesh';
import { Measurable } from './Measurable';
import { Electric } from './Electric';
import { Hardware } from './Hardware';
import { DOORS, kindOf, slideName, useParts } from './parts';
import { useApp } from '@/contexts/AppContext';
import { FRAME_GLB, FRAME_PIECES, WARDROBE_GLB } from '@/assets';

type FrameResult = GLTF & { nodes: Record<string, THREE.Mesh> };

export function Model(props: Omit<ThreeElements['group'], 'ref'>) {
  const sceneGroup = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(WARDROBE_GLB) as unknown as GLTF;
  const frame = useGLTF(FRAME_GLB) as unknown as FrameResult;
  const { hideFronts, electric, hidden, shown, parts: partsApi } = useApp();
  const parts = useParts(sceneGroup, scene, animations, hideFronts);

  useEffect(() => {
    partsApi.current = parts;
  });

  const onPartClick = (event: ThreeEvent<MouseEvent>) => {
    if (parts.toggle(event.eventObject.name)) event.stopPropagation();
  };

  // Rebuilds the glTF tree; pivots stay groups with their names so the door springs find them
  const part = (node: THREE.Object3D): ReactNode => {
    const children = node.children.map(part);
    if (!(node as THREE.Mesh).isMesh) {
      return (
        <group key={node.name} name={node.name} position={node.position} rotation={node.rotation}>
          {children}
        </group>
      );
    }
    const door = node.name in DOORS;
    const drawer = kindOf(node.name) === 'drawer';
    const mesh = (
      <Mesh
        key={node.name}
        name={node.name}
        geometry={(node as THREE.Mesh).geometry}
        position={node.position}
        rotation={node.rotation}
        visible={shown(node)}
        onClick={door || drawer ? onPartClick : undefined}
      >
        {children}
      </Mesh>
    );
    return drawer ? (
      <group key={node.name} name={slideName(node.name)}>
        {mesh}
      </group>
    ) : (
      mesh
    );
  };

  return (
    <Measurable ref={sceneGroup} {...props}>
      {FRAME_PIECES.map(name => (
        <Mesh key={name} name={name} geometry={frame.nodes[name].geometry} position={frame.nodes[name].position} rotation={frame.nodes[name].rotation} visible={shown(frame.nodes[name])} />
      ))}
      {scene.children.map(part)}
      {electric && (
        <Suspense fallback={null}>
          <Electric root={sceneGroup} shown={shown} />
        </Suspense>
      )}
      {!(hidden.has('dowels') && hidden.has('hinges') && hidden.has('blocks') && hidden.has('pins') && hidden.has('interiorDowels')) && (
        <Suspense fallback={null}>
          <Hardware root={sceneGroup} shown={shown} />
        </Suspense>
      )}
    </Measurable>
  );
}

useGLTF.preload(WARDROBE_GLB);
useGLTF.preload(FRAME_GLB);
