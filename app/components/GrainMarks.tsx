import type * as THREE from 'three';
import { useMemo } from 'react';
import { grainHatch } from './grain';

const noRaycast = () => null;

// Child of its part, so the marks follow doors and drawers and hide with the part
export function GrainMarks({ name, geometry }: { name: string; geometry: THREE.BufferGeometry }) {
  const positions = useMemo(() => grainHatch(name, geometry), [name, geometry]);
  if (!positions) return null;
  return (
    <lineSegments raycast={noRaycast} renderOrder={3}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#6b3f1c" />
    </lineSegments>
  );
}
