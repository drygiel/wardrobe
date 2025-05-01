'use client';

import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import {
  Grid,
  OrbitControls,
  GizmoViewport,
  GizmoHelper,
  Loader,
  Html,
  OrthographicCamera,
  PerspectiveCamera,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Model as Wardrobe } from '../components/Wardrobe';
import { type SceneView, useApp } from '@/contexts/AppContext';
import { useNonInitialEffect } from '@/hooks/useNonInitialEffect';
import { IfInSessionMode, XROrigin } from '@react-three/xr';

interface ViewState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
}

const Views: Record<SceneView, ViewState> = {
  initial: {
    position: new THREE.Vector3(3.3077, 0.2, -3.6753),
    target: new THREE.Vector3(0.599, 1.5577, -0.0982),
    zoom: 1.7,
  },
  'left-side': {
    position: new THREE.Vector3(3.3, 1.42, 2.58),
    target: new THREE.Vector3(0.65, 1.32, -0.45),
    zoom: 1.7,
  },
};

export default function Scene() {
  const camState = useMemo(() => {
    const stored = sessionStorage.getItem('camera');
    if (!stored) return Views.initial;
    const state = JSON.parse(stored);

    return {
      position: new THREE.Vector3(...state.position),
      target: new THREE.Vector3(...state.target),
      zoom: state?.zoom as number,
    } as ViewState;
  }, []);

  const app = useApp();
  const camera = useThree(t => t.camera);
  const controls = useThree(state => state.controls as ComponentRef<typeof OrbitControls>);
  const perCamRef = useRef<THREE.PerspectiveCamera>(null!);
  const orthoCamRef = useRef<THREE.OrthographicCamera>(null!);
  const target = useRef(camState.target);

  useEffect(() => {
    camera?.layers.set(app.layer);
  }, [app.layer, camera]);

  const frustumHeightAtDistance = (camera: THREE.PerspectiveCamera, distance: number) => {
    const vFov = (camera.fov * Math.PI) / 180;
    return Math.tan(vFov / 2) * distance * 2;
  };

  const frustumWidthAtDistance = (camera: THREE.PerspectiveCamera, distance: number) =>
    frustumHeightAtDistance(camera, distance) * camera.aspect;

  const tweens = useRef<TWEEN.Group>(new TWEEN.Group());

  useNonInitialEffect(() => {
    if (!controls) return;

    tweens.current.removeAll();
    tweens.current.add(
      new TWEEN.Tween(controls.object.position)
        .to(Views[app.view].position, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .interpolation(TWEEN.Interpolation.Bezier)
        .start(),
      new TWEEN.Tween(controls.target)
        .to(Views[app.view].target, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .interpolation(TWEEN.Interpolation.Bezier)
        .start(),
    );
  }, [app.view]);

  useEffect(() => {
    if (!controls) return;
    target.current.copy(controls.target);

    if (!app.orthographic) {
      perCamRef.current.position.copy(orthoCamRef.current.position);
      const oldY = perCamRef.current.position.y;
      perCamRef.current.position.y = oldY / orthoCamRef.current.zoom;
      return;
    }

    orthoCamRef.current.position.copy(perCamRef.current.position);
    const distance = perCamRef.current.position.distanceTo(controls.target);
    const halfWidth = frustumWidthAtDistance(perCamRef.current, distance) / 2;
    const halfHeight = frustumHeightAtDistance(perCamRef.current, distance) / 2;
    orthoCamRef.current.top = halfHeight;
    orthoCamRef.current.bottom = -halfHeight;
    orthoCamRef.current.left = -halfWidth;
    orthoCamRef.current.right = halfWidth;
    orthoCamRef.current.zoom = Math.min(Math.max(1, perCamRef.current.zoom), 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.orthographic]);

  useFrame(() => {
    tweens.current?.update();
  });

  return (
    <>
      <Grid
        visible={app.grid}
        renderOrder={-1}
        position={[0.5, 0, 0.5]}
        infiniteGrid
        cellSize={0.5}
        cellThickness={0.6}
        sectionSize={1}
        sectionThickness={1}
        sectionColor="black"
        fadeDistance={20}
        fadeStrength={3}
      />

      <PerspectiveCamera
        makeDefault={!app.orthographic}
        ref={perCamRef}
        position={camState.position}
        zoom={camState.zoom}
        near={0.01}
        far={1000}
        fov={71}
      />

      <IfInSessionMode deny={['immersive-ar', 'immersive-vr']}>
        <OrthographicCamera
          makeDefault={app.orthographic}
          ref={orthoCamRef}
          position={camState.position}
          zoom={camState.zoom}
          near={0.01}
          far={1000}
        />

        <OrbitControls
          makeDefault
          target={target.current}
          zoomToCursor
          onEnd={() => {
            // console.log('target', {
            //   p: controls.object.position
            //     .toArray()
            //     .map(n => n.toFixed(2))
            //     .join(', '),
            //   t: controls.target
            //     .toArray()
            //     .map(n => n.toFixed(2))
            //     .join(', '),
            //   z: controls.object.zoom.toFixed(2),
            // });

            if (
              !app.orthographic &&
              Math.abs(controls.getPolarAngle() - Math.PI / 2) < 0.02 &&
              Math.abs(controls.getAzimuthalAngle() - Math.PI / 2) < 0.02
            ) {
              controls.object.position.set(3, 1.4, 0);
              controls.target.set(-1, 1.4, 0);
              controls.object.zoom = 1.7;
              app.setOrthographic(true);
              return;
            }

            const camState = {
              position: controls.object.position.toArray(),
              target: controls.target.toArray(),
              zoom: controls.object.zoom,
            };
            sessionStorage.setItem('camera', JSON.stringify(camState));
          }}
          maxDistance={6}
          minDistance={0.3}
          zoomSpeed={2}
          enableDamping
          dampingFactor={0.05}
          // maxPolarAngle={Math.PI/2}
        />
        {app.gizmo && (
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport hideNegativeAxes axisHeadScale={0.8} />
          </GizmoHelper>
        )}
      </IfInSessionMode>

      <ambientLight intensity={app.wireframe ? 1 : 10} />
      <pointLight position={[0.8, 2.2, -1.5]} color="white" intensity={app.wireframe ? 2 : 10} />

      <XROrigin position={[1, 0, -0.5]} />

      <Suspense
        fallback={
          <group position={[0, 1, 0]}>
            <Html prepend center>
              <Loader
                dataStyles={{ color: 'black' }}
                innerStyles={{ backgroundColor: 'gray' }}
                barStyles={{ backgroundColor: 'black' }}
                dataInterpolation={p => `${p.toFixed(0)}%`}
              />
            </Html>
          </group>
        }
      >
        <Wardrobe position={[-0.5, 0, -1.5]} rotation={[0, Math.PI, 0]} />
      </Suspense>
    </>
  );
}
