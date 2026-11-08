import * as THREE from 'three';
import { type ReactNode, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { type ThreeElements, type ThreeEvent } from '@react-three/fiber';
import { GLTF } from 'three-stdlib';
import { Mesh } from './Mesh';
import { Measurable } from './Measurable';
import { useApp } from '@/contexts/AppContext';
import { FRAME_GLB, FRAME_PIECES, WARDROBE_GLB } from '@/assets';

export type Kind = 'front' | 'handle' | 'led' | 'drawer' | 'support' | 'shelf' | 'aShelf' | 'aSide' | 'back' | 'frame';

// Part kind from its Szafa4.blend object name
export const kindOf = (name: string): Kind => {
  if (/(Back|Side)Panel$/.test(name)) return 'back';
  if (name.startsWith('LED_')) return 'led';
  if (name.endsWith('_Handle')) return 'handle';
  if (/^F\d\d_/.test(name)) return 'front';
  if (name.startsWith('DR_')) return 'drawer';
  if (/^IN_.*(Side|Divider|Strip)/.test(name)) return 'support';
  if (name === 'A_Carcass') return 'aSide';
  if (name.startsWith('A_')) return 'aShelf';
  if (/^P\d\d_/.test(name)) return 'frame';
  return 'shelf';
};

// Door mesh to its clip: hinged doors swing on their F0x_Pivot, the section A door rotates itself
export const DOORS: Record<string, string> = {
  'F01_B_Door-Bottom-L': 'Hinge.Pivot.B.BLAction',
  'F02_B_Door-Bottom-R': 'Hinge.Pivot.B.BRAction',
  'F03_B_Door-Top-L': 'Hinge.Pivot.B.TLAction',
  'F04_B_Door-Top-R': 'Hinge.Pivot.B.TRAction',
  'F05_C_Door-Bottom': 'Hinge.Pivot.C.BAction',
  'F06_D_Door-Bottom': 'Hinge.Pivot.D.BAction',
  'F07_D_Door-Top': 'Hinge.Pivot.D.TAction',
  'F09_A_Door': 'OpenBShelve',
};

type FrameResult = GLTF & { nodes: Record<string, THREE.Mesh> };

// Plays a door clip forward or back; the open state lives on the clicked object
export function toggleAction(action: THREE.AnimationAction, data: Record<string, unknown>) {
  action.reset();

  if (data.open) {
    action.timeScale = -1;
    action.time = action.getClip().duration;
  } else {
    action.timeScale = 1;
  }

  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  data.open = !data.open;
}

export function Model(props: Omit<ThreeElements['group'], 'ref'>) {
  const sceneGroup = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(WARDROBE_GLB) as unknown as GLTF;
  const frame = useGLTF(FRAME_GLB) as unknown as FrameResult;
  const { actions } = useAnimations(animations, sceneGroup);
  const { hideFronts } = useApp();

  const onDoorClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    toggleAction(actions[DOORS[event.eventObject.name]]!, event.eventObject.userData);
  };

  // Rebuilds the glTF tree; pivots stay groups with their names so the door clips find them
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
    return (
      <Mesh
        key={node.name}
        name={node.name}
        geometry={(node as THREE.Mesh).geometry}
        position={node.position}
        rotation={node.rotation}
        visible={door || kindOf(node.name) === 'handle' ? !hideFronts : undefined}
        onClick={door ? onDoorClick : undefined}
      >
        {children}
      </Mesh>
    );
  };

  return (
    <Measurable ref={sceneGroup} {...props}>
      {FRAME_PIECES.map(name => (
        <Mesh key={name} name={name} geometry={frame.nodes[name].geometry} position={frame.nodes[name].position} rotation={frame.nodes[name].rotation} />
      ))}
      {scene.children.map(part)}
    </Measurable>
  );
}

useGLTF.preload(WARDROBE_GLB);
useGLTF.preload(FRAME_GLB);
