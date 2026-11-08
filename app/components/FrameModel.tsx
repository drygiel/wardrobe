import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import type { GLTF } from 'three-stdlib';
import { Mesh } from './Mesh';
import { Measurable } from './Measurable';
import { FRAME_GLB, FRAME_PIECES } from '@/assets';

type FrameResult = GLTF & { nodes: Record<string, THREE.Mesh> };

// The bare oak frame (1_Frame), measurable like the full wardrobe
export function FrameModel(props: Omit<ThreeElements['group'], 'ref'>) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as FrameResult;

  return (
    <Measurable {...props}>
      {FRAME_PIECES.map(name => (
        <Mesh key={name} name={name} geometry={nodes[name].geometry} position={nodes[name].position} rotation={nodes[name].rotation} />
      ))}
    </Measurable>
  );
}
