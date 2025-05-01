'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { type ThreeElements } from '@react-three/fiber';
import { useCursor, useTexture, Line, Edges } from '@react-three/drei';
import { useApp } from '@/contexts/AppContext';

export function Mesh(props: ThreeElements['mesh']) {
  const texture = useTexture(`${process.env.NEXT_PUBLIC_BASEPATH ?? ''}/models/Wardrobe.jpg`);
  const { wireframe } = useApp();
  const meshRef = useRef<THREE.Mesh>(null!);
  const wireframeGroup = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  const hideLines = props.name === 'BackCap';

  const getColor = (hover = false) => {
    const isWood = ['Drawer', 'Frame'].some(w => props.name?.includes(w));
    if (hover) return isWood ? '#d2b98a' : '#bbb';
    return isWood ? '#e9d4ad' : 'white';
  };

  const materials = useMemo(() => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    return {
      // ['Shelve', 'Svelve', 'Support', 'Frame', 'Drawer']
      // MeshLambertMaterial
      xray: new THREE.MeshLambertMaterial({
        color: getColor(),
        transparent: true,
        opacity: 0.9,
        // depthWrite: true,
      }),
      solid: new THREE.MeshPhongMaterial({
        color: getColor(),
      }),
      textured: new THREE.MeshPhysicalMaterial({
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

  useCursor(visible && hovered && !wireframe && !!props.onClick);

  // Update wireframe's location (in case mesh was animated)
  useEffect(() => {
    if (!meshRef.current || !wireframeGroup.current) return;
    wireframeGroup.current.position.copy(meshRef.current.position);
    wireframeGroup.current.rotation.copy(meshRef.current.rotation);
  }, [wireframe]);

  const edges = useMemo(() => {
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

    return lines.map(line => (
      <Line
        matrixAutoUpdate={false}
        key={line.name}
        name={line.name}
        color="black"
        depthTest={false}
        points={line.points}
        lineWidth={5}
        userData={line}
        layers={visible ? 1 : 2}
      />
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgesGeometry, visible]);

  return (
    <>
      <mesh
        ref={meshRef}
        name={props.name}
        geometry={props.geometry}
        position={props.position}
        rotation={props.rotation}
        visible={visible}
        renderOrder={1}
        layers={0}
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
        <Edges
          renderOrder={2}
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
