import * as THREE from 'three';
import { type ComponentRef, type ReactNode, type Ref, useRef } from 'react';
import { Line } from '@react-three/drei';
import { type ThreeElements, useFrame, useThree } from '@react-three/fiber';
import type { LineData } from './Mesh';
import { useApp } from '@/contexts/AppContext';
import { useEventListener } from '@/hooks/useEventListener';
import { LineHint } from '@/components/LineHint';

type Props = Omit<ThreeElements['group'], 'ref'> & { ref?: Ref<THREE.Group>; children: ReactNode };

// The raycaster does not skip invisible objects
const isShown = (object: THREE.Object3D | null): boolean => !object || (object.visible && isShown(object.parent));

// Hover measuring shared by every model: raycasts edge lines on layer 1 and shows the red line with its length
export function Measurable({ ref, children, ...props }: Props) {
  const lineRef = useRef<ComponentRef<typeof Line>>(null!);
  const sceneGroup = useRef<THREE.Group>(null!);
  const lineGroup = useRef<THREE.Group>(null!);
  const pointerPos = useRef<THREE.Vector2>(new THREE.Vector2());
  const { wireframe, line, inspect } = useApp();

  const isLMBPressed = useRef(false);

  useEventListener('pointerdown', () => (isLMBPressed.current = true));
  useEventListener('pointerup', () => (isLMBPressed.current = false));

  const { pointer, raycaster, camera } = useThree();

  useFrame(() => {
    if (isLMBPressed.current) return;
    if (!lineGroup.current || !lineRef.current || !sceneGroup.current) return;
    if (pointerPos.current.equals(pointer)) return;
    pointerPos.current.copy(pointer);

    if (!wireframe) {
      line.current = null;
      inspect.current?.(null);
      return;
    }

    raycaster.layers.set(1);
    raycaster.firstHitOnly = true;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(sceneGroup.current, true);
    raycaster.layers.set(0);

    const hit = intersects.find(i => i.object.name.startsWith('line'));
    const lineData = hit && (hit.object.userData.lines as LineData[])[hit.faceIndex!];

    if (inspect.current) {
      const faces = raycaster.intersectObject(sceneGroup.current, true).filter(i => (i.object as THREE.Mesh).isMesh && isShown(i.object));
      // Overlays are drawn over everything, so they win; otherwise an edge counts only when no surface covers it
      const face = faces.find(i => i.object.userData.overlay) ?? faces[0];
      const edgeOnTop = lineData && (!face || (!face.object.userData.overlay && hit.distance <= face.distance + 0.01));
      const picked = edgeOnTop ? lineData.meshRef.current : ((face?.object as THREE.Mesh) ?? null);
      inspect.current(picked, lineData ?? null);
    }

    if (!lineData) {
      const onBlur = line.current?.onBlur;
      line.current = null;
      lineRef.current.visible = false;
      onBlur?.();
      return;
    }

    if (line.current === lineData) return;

    line.current?.onBlur();
    line.current = lineData;
    showRedLine(lineData);
    if (!inspect.current) line.current.onHover(); // the inspector brightens the whole part itself, this would darken it
  });

  const showRedLine = ({ meshRef, points }: LineData) => {
    lineRef.current.position.copy(meshRef.current.position);
    lineRef.current.rotation.copy(meshRef.current.rotation);
    lineRef.current.geometry.setPositions(points.map(p => [p.x, p.y, p.z]).flat());

    // The mesh's parent (a door's pivot, a handle's door) relative to the scene group places the line
    new THREE.Matrix4()
      .copy(sceneGroup.current.matrixWorld)
      .invert()
      .multiply(meshRef.current.parent!.matrixWorld)
      .decompose(lineGroup.current.position, lineGroup.current.quaternion, lineGroup.current.scale);
    lineRef.current.visible = true;
  };

  return (
    <group {...props} dispose={null}>
      <group ref={lineGroup}>
        <LineHint />
        <Line
          ref={lineRef}
          visible={wireframe}
          points={[0, 0, 0, 0, 0, 0]}
          lineWidth={2.5}
          color="red"
          renderOrder={1000}
        />
      </group>

      <group
        ref={node => {
          sceneGroup.current = node!;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        name="Scene"
      >
        {children}
      </group>
    </group>
  );
}
