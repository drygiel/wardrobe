'use client';

import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import cn from 'classnames';
import { useApp } from '@/contexts/AppContext';
import type { LineData } from '@/components/Mesh';
import styles from './LineHint.module.scss';

export function LineHint() {
  const { line } = useApp();
  const htmlRef = useRef<HTMLDivElement>(null!);
  const hintGroup = useRef<THREE.Group>(null);
  const lineGroup = useRef<THREE.Group>(null);
  const lastLine = useRef<LineData | null>(null);

  useFrame(() => {
    if (lastLine.current === line.current) return;
    lastLine.current = line.current;

    if (!hintGroup.current || !lineGroup.current || !htmlRef.current) return;

    htmlRef.current.classList.toggle(styles.hidden, !line.current);
    if (!line.current) return;

    const { meshRef, midPoint, width, points } = line.current;

    hintGroup.current.position.copy(meshRef.current.position);
    hintGroup.current.rotation.copy(meshRef.current.rotation);
    lineGroup.current.position.copy(midPoint);

    const xLen = Math.abs(points[0].x - points[1].x);
    const yLen = Math.abs(points[0].y - points[1].y);
    const zLen = Math.abs(points[0].z - points[1].z);
    const isVertical = yLen > xLen && yLen > zLen;

    htmlRef.current.querySelector(`.${styles.value}`)!.textContent = format(width);

    if (htmlRef.current.classList.contains(styles.vertical) === isVertical) return;
    htmlRef.current.style.visibility = 'hidden';
    htmlRef.current.classList.toggle(styles.vertical, isVertical);
    setTimeout(() => htmlRef.current.style.visibility = 'visible', 50);
  });

  const format = (n: number | undefined) => {
    if (!n) return '';
    const result = (n * 100).toFixed(1);
    return result.replace(/\.?0*$/, ''); // Remove trailing zeros and dot
  };

  return (
    <group ref={hintGroup}>
      <group ref={lineGroup}>
        <Html ref={htmlRef} className={cn(styles.hint, styles.hidden)} center pointerEvents="none">
          <div role="tooltip">
            <div>
              <span className={styles.value} />
              <span className={styles.unit}>cm</span>
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}
