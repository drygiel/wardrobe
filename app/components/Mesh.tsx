import React, { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { type ThreeElements } from '@react-three/fiber';
import { useCursor, useTexture, Line, Edges } from '@react-three/drei';
import { useApp } from '@/contexts/AppContext';
import { ATLAS } from '@/assets';
import { GrainMarks } from './GrainMarks';
import { DIMMED_OPACITY, HOVERED_OPACITY } from './parts';

// `overlay`: flat colour drawn over everything, for hardware without atlas space that sits inside the boards
export function Mesh({ overlay, ...props }: ThreeElements['mesh'] & { overlay?: string }) {
  const texture = useTexture(ATLAS);
  const { wireframe, grain } = useApp();
  const meshRef = useRef<THREE.Mesh>(null!);
  const wireframeGroup = useRef<THREE.Group>(null!);
  const edgesRef = useRef<ComponentRef<typeof Edges>>(null);
  const pickLines = useRef<ComponentRef<typeof Line>>(null);
  const [hovered, setHovered] = useState(false);

  const hideLines = props.name?.endsWith('BackPanel');

  const getColor = (hover = false) => {
    if (overlay) return overlay;
    const isWood = /^(DR|P\d\d)_/.test(props.name ?? '');
    if (hover) return isWood ? '#d2b98a' : '#bbb';
    return isWood ? '#e9d4ad' : 'white';
  };

  const materials = useMemo(() => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16; // three clamps it to the GPU limit; keeps shelves seen at an angle sharp
    return {
      // ['Shelve', 'Svelve', 'Support', 'Frame', 'Drawer']
      // MeshLambertMaterial
      xray: new THREE.MeshLambertMaterial({
        color: getColor(),
        transparent: true,
        opacity: 0.9,
        depthTest: !overlay,
        // depthWrite: true,
      }),
      solid: new THREE.MeshPhongMaterial({
        color: getColor(),
      }),
      textured: overlay
        ? new THREE.MeshBasicMaterial({ color: overlay, transparent: true, depthTest: false })
        : new THREE.MeshPhysicalMaterial({
            map: texture,
            roughness: 1,
            metalness: 0,
            reflectivity: 0,
          }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);

  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(props.geometry, 0.27),
    [props.geometry],
  );

  const visible = props.visible !== false;

  // The selected part draws last at full opacity; faded parts and their outlines stop writing depth so nothing hides it.
  // `hover`: a faded part under the cursor while another one is selected.
  const focus = (state: 'none' | 'selected' | 'dim' | 'hover') => {
    const dim = state === 'dim';
    const faded = dim || state === 'hover';
    const fade = dim ? DIMMED_OPACITY : HOVERED_OPACITY;
    materials.xray.opacity = faded ? fade : state === 'selected' ? 1 : 0.9;
    materials.xray.depthWrite = !faded;
    const { textured } = materials;
    if (!overlay && textured.transparent !== faded) {
      textured.transparent = faded;
      textured.needsUpdate = true; // three compiles opaque and transparent programs apart
    }
    textured.opacity = faded ? fade : 1;
    textured.depthWrite = !faded;
    meshRef.current.renderOrder = overlay ? 10 : state === 'selected' ? 5 : 1;
    pickLines.current?.layers.set(faded || !visible ? 2 : 1); // while another part is selected, these edges cannot be measured
    const outline = edgesRef.current;
    if (outline) {
      const material = outline.material as THREE.Material;
      const transparent = state !== 'none';
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = dim ? 0.08 : state === 'hover' ? 0.5 : 1;
      material.depthWrite = !faded;
      outline.renderOrder = overlay ? 11 : state === 'selected' ? 6 : 2; // the selected part's outline goes over its own faces
    }
    meshRef.current.children.forEach(child => {
      if ((child as THREE.LineSegments).isLineSegments) child.visible = !dim; // grain marks
    });
  };

  useCursor(visible && hovered && !wireframe && !!props.onClick);

  // Update wireframe's location (in case mesh was animated)
  useEffect(() => {
    if (!meshRef.current || !wireframeGroup.current) return;
    wireframeGroup.current.position.copy(meshRef.current.position);
    wireframeGroup.current.rotation.copy(meshRef.current.rotation);
  }, [wireframe]);

  // One LineSegments2 per mesh; a hit's faceIndex selects the edge, same 5px pick width as before
  const lines = useMemo(() => {
    const vec = new THREE.Vector3();
    const position = edgesGeometry.attributes.position;
    const lines: LineData[] = [];

    if (hideLines) return null;

    for (let i = 0, l = position.count; i < l; i += 2) {
      const from = vec.fromBufferAttribute(position, i).clone();
      const to = vec.fromBufferAttribute(position, i + 1).clone();
      const data: LineData = {
        name: `line_${props.name}_${i}`,
        points: [from, to],
        midPoint: from.clone().add(to).divideScalar(2),
        width: from.distanceTo(to),
        meshRef,
        onHover: () => {
          // meshRef.current!.material = materials.solid;
          materials.xray.color.set(getColor(true));
        },
        onBlur: () => {
          // meshRef.current!.material = materials.xray;
          materials.xray.color.set(getColor());
        },
      };
      lines.push(data);
    }

    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgesGeometry]);

  const linePoints = useMemo(() => lines?.flatMap(line => line.points), [lines]);

  const edges = lines && (
    <Line
      ref={pickLines}
      segments
      matrixAutoUpdate={false}
      name={`line_${props.name}`}
      color="black"
      depthTest={false}
      points={linePoints!}
      lineWidth={5}
      userData={{ lines }}
      layers={visible ? 1 : 2}
    />
  );

  return (
    <>
      <mesh
        ref={meshRef}
        name={props.name}
        geometry={props.geometry}
        position={props.position}
        rotation={props.rotation}
        visible={visible}
        renderOrder={overlay ? 10 : 1}
        layers={0}
        userData={{ overlay: !!overlay, highlight: (on: boolean) => materials.xray.emissive.set(on ? '#5e4a2c' : '#000000'), focus }}
        material={
          wireframe
            ? materials.xray // new THREE.MeshBasicMaterial({ visible: false })
            : materials.textured
        }
        onClick={event => {
          if (wireframe || !props.onClick) return;
          materials.textured.color.set(getColor());
          if (typeof props.onClick === 'function') props.onClick(event);
        }}
        onPointerEnter={event => {
          if (wireframe || !props.onClick) return;
          event.stopPropagation();
          setHovered(true);
          materials.textured.color.set(getColor(true));
        }}
        onPointerLeave={() => {
          if (wireframe || !props.onClick) return;
          setHovered(false);
          materials.textured.color.set(getColor());
        }}
      >
        {props.children}
        {grain && props.name && props.geometry && <GrainMarks name={props.name} geometry={props.geometry} />}
        <Edges
          ref={edgesRef}
          renderOrder={overlay ? 11 : 2}
          depthTest={!overlay}
          visible={wireframe && visible && !hideLines}
          linewidth={1}
          threshold={0.27}
          color="#666"
        />
      </mesh>

      <group ref={wireframeGroup} visible={wireframe}>
        {edges}
      </group>
    </>
  );
}

export interface LineData {
  name: string;
  midPoint: THREE.Vector3;
  width: number;
  points: [THREE.Vector3, THREE.Vector3];
  meshRef: React.RefObject<THREE.Mesh>;
  onHover: () => void;
  onBlur: () => void;
}
