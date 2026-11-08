import { type ReactNode, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
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
  PerspectiveCamera
} from '@react-three/drei';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { type SceneView, useApp } from '@/contexts/AppContext';
import { useXR } from '@react-three/xr';

interface ViewState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
  fit?: [halfWidth: number, halfHeight: number]; // orthographic presets frame this many metres
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
  // Doors face +x, column A is at +z; the top view sits a hair in front so "up" is defined
  front: { position: new THREE.Vector3(4, 1.33, -0.156), target: new THREE.Vector3(-0.235, 1.33, -0.156), zoom: 1, fit: [1.5, 1.5] },
  side: { position: new THREE.Vector3(-0.235, 1.33, -5), target: new THREE.Vector3(-0.235, 1.33, -0.156), zoom: 1, fit: [0.5, 1.5] },
  'side-z': { position: new THREE.Vector3(-0.235, 1.33, 5), target: new THREE.Vector3(-0.235, 1.33, -0.156), zoom: 1, fit: [0.5, 1.5] },
  // Rewritten every time the editor leaves perspective
  'last-3d': { position: new THREE.Vector3(), target: new THREE.Vector3(), zoom: 1 },
  top: { position: new THREE.Vector3(-0.225, 5.5, -0.156), target: new THREE.Vector3(-0.235, 1.33, -0.156), zoom: 1, fit: [1.5, 0.45] },
};

export default function Scene({ children, editorCamera = false }: { children: ReactNode; editorCamera?: boolean }) {
  const app = useApp();
  const size = useThree(s => s.size);
  // The orthographic presets already aim at the middle of the wardrobe
  const goalOf = (view: SceneView): ViewState => (editorCamera && view === 'initial' ? { ...Views[view], target: Views.front.target } : Views[view]);

  const camState = useMemo(() => {
    const stored = sessionStorage.getItem('camera');
    // Zoom is tuned for a wide stage; a tall canvas (the editor between its panels) must not crop the model
    if (!stored) return { ...goalOf(app.view), zoom: Views[app.view].zoom * Math.min(1, size.width / size.height / 1.2) };
    const state = JSON.parse(stored);

    return {
      position: new THREE.Vector3(...state.position),
      target: editorCamera ? Views.front.target : new THREE.Vector3(...state.target),
      zoom: state?.zoom as number,
    } as ViewState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const camera = useThree(t => t.camera);
  const controls = useThree(state => state.controls as ComponentRef<typeof OrbitControls>);
  const perCamRef = useRef<THREE.PerspectiveCamera>(null!);
  const orthoCamRef = useRef<THREE.OrthographicCamera>(null!);
  // A copy: this ref is overwritten on every projection switch and must not change the presets
  const target = useRef(camState.target.clone());
  const xr = useXR();
  const isPresenting = !!xr.session;
  // Camera orientation when the current drag began; set only while a pointer is down
  const grabbed = useRef<THREE.Quaternion | null>(null);
  // drei rebuilds the controls for a new camera, which would drop an orbit that leaves ortho mid-drag.
  // Built on this stand-in, one instance serves both cameras.
  const standIn = useMemo(() => new THREE.PerspectiveCamera(), []);

  useLayoutEffect(() => {
    if (editorCamera && controls) controls.object = camera;
  }, [editorCamera, controls, camera]);

  useEffect(() => {
    camera?.layers.set(app.layer);
  }, [app.layer, camera]);

  // OrbitControls blocks touch scrolling while connected; give the page back its scroll when inactive
  useEffect(() => {
    if (controls?.domElement) controls.domElement.style.touchAction = app.active ? 'none' : 'pan-y';
  }, [app.active, controls]);

  const frustumHeightAtDistance = (camera: THREE.PerspectiveCamera, distance: number) => {
    const vFov = (camera.fov * Math.PI) / 180;
    return Math.tan(vFov / 2) * distance * 2;
  };

  const frustumWidthAtDistance = (camera: THREE.PerspectiveCamera, distance: number) =>
    frustumHeightAtDistance(camera, distance) * camera.aspect;

  const tweens = useRef<TWEEN.Group>(new TWEEN.Group());

  const orthoHalfHeight = useRef(1);
  const servedTick = useRef(0);

  useEffect(() => {
    if (!controls || isPresenting || app.viewTick === servedTick.current) return;
    // A preset that changes the projection waits for the controls on the new camera
    if (Boolean((controls.object as THREE.OrthographicCamera).isOrthographicCamera) !== app.orthographic) return;
    servedTick.current = app.viewTick;
    const goal = goalOf(app.view);

    tweens.current.removeAll();
    tweens.current.add(
      new TWEEN.Tween(controls.object.position)
        .to(goal.position, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .interpolation(TWEEN.Interpolation.Bezier)
        .start(),
      new TWEEN.Tween(controls.target)
        .to(goal.target, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .interpolation(TWEEN.Interpolation.Bezier)
        .start(),
    );
    if (goal.fit && app.orthographic) {
      const zoom = orthoHalfHeight.current / Math.max(goal.fit[1], goal.fit[0] / (size.width / size.height));
      tweens.current.add(
        new TWEEN.Tween(controls.object)
          .to({ zoom }, 500)
          .easing(TWEEN.Easing.Quadratic.InOut)
          .onUpdate(() => controls.object.updateProjectionMatrix())
          .start(),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.viewTick, controls, camera, isPresenting]);

  useEffect(() => {
    if (!controls || isPresenting) return;
    target.current.copy(controls.target);

    if (!app.orthographic) {
      perCamRef.current.position.copy(orthoCamRef.current.position);
      if (editorCamera) {
        // Back off to the distance where the target plane keeps the size it had in ortho
        const halfHeight = orthoHalfHeight.current / orthoCamRef.current.zoom;
        const distance = (halfHeight * perCamRef.current.zoom) / Math.tan((perCamRef.current.fov * Math.PI) / 360);
        perCamRef.current.position.sub(controls.target).setLength(distance).add(controls.target);
        return;
      }
      const oldY = perCamRef.current.position.y;
      perCamRef.current.position.y = oldY / orthoCamRef.current.zoom;
      return;
    }

    if (editorCamera) {
      Views['last-3d'].position.copy(perCamRef.current.position);
      Views['last-3d'].target.copy(controls.target);
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
    orthoHalfHeight.current = halfHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.orthographic, isPresenting]);

  // drei puts the orthographic frustum back in pixels whenever the canvas resizes
  useEffect(() => {
    const ortho = orthoCamRef.current;
    if (!app.orthographic || !ortho) return;
    const half = orthoHalfHeight.current;
    ortho.top = half;
    ortho.bottom = -half;
    ortho.left = -half * (size.width / size.height);
    ortho.right = half * (size.width / size.height);
    ortho.updateProjectionMatrix();
  }, [size, app.orthographic]);

  useFrame(() => {
    tweens.current?.update();
  });

  // Enlarges the hovered axis head, which drei only does for a gizmo it drives itself
  const scaleAxisHead = (event: ThreeEvent<PointerEvent>, scale: number) => {
    if ((event.object as THREE.Sprite).isSprite) event.object.scale.setScalar(scale);
  };

  // disabled drops drei's own orbit animation; an axis opens an orthographic preset instead
  const editorGizmo = editorCamera && {
    disabled: true,
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      if (!(event.object as THREE.Sprite).isSprite) return;
      event.stopPropagation();
      event.nativeEvent.stopPropagation(); // the editor must not take this press for a click on the model
      const { x, y } = event.object.position;
      app.toggleView(x ? 'front' : y ? 'top' : 'side-z');
    },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => scaleAxisHead(event, 0.96),
    onPointerOut: (event: ThreeEvent<PointerEvent>) => scaleAxisHead(event, 0.8),
  };

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
        cellColor="#3a3631"
        sectionColor="#6b645a"
        fadeDistance={20}
        fadeStrength={3}
      />

      <PerspectiveCamera
        makeDefault={!app.orthographic || isPresenting}
        ref={perCamRef}
        position={camState.position}
        zoom={camState.zoom}
        near={0.01}
        far={1000}
        fov={71}
      />

      {!isPresenting && (
        <OrthographicCamera
          makeDefault={app.orthographic}
          ref={orthoCamRef}
          position={camState.position}
          zoom={camState.zoom}
          near={0.01}
          far={1000}
        />
      )}

      {!isPresenting && (
        <OrbitControls
          makeDefault
          camera={editorCamera ? standIn : undefined}
          enabled={app.active}
          target={target.current}
          zoomToCursor={!editorCamera}
          onStart={() => {
            grabbed.current = controls.object.quaternion.clone();
          }}
          onChange={() => {
            if (!grabbed.current) return;
            // A preset turning the camera is not the user orbiting
            if (tweens.current.getAll().some(tween => tween.isPlaying())) grabbed.current.copy(controls.object.quaternion);
            // Panning and zooming keep the orientation, so ortho survives them
            else if (editorCamera && app.orthographic && controls.object.quaternion.angleTo(grabbed.current) > 0.005) {
              grabbed.current = null;
              app.setOrthographic(false);
            }
          }}
          onEnd={() => {
            grabbed.current = null;
            // Only perspective views are restored after a reload
            if (editorCamera && app.orthographic) return;

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
              !editorCamera &&
              !app.orthographic &&
              Math.abs(controls.getPolarAngle() - Math.PI / 2) < 0.02 &&
              Math.abs(controls.getAzimuthalAngle() - Math.PI / 2) < 0.02
            ) {
              controls.object.position.copy(Views.front.position);
              controls.target.copy(Views.front.target);
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
      )}

      {app.gizmo && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport hideNegativeAxes axisHeadScale={0.8} {...editorGizmo} />
        </GizmoHelper>
      )}

      <ambientLight intensity={app.wireframe ? 1 : 10} />
      <pointLight position={[0.8, 2.2, -1.5]} color="white" intensity={app.wireframe ? 2 : 10} />
      
      {/* VR-specific elements */}
      {isPresenting && (
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshBasicMaterial color="white" transparent opacity={0.1} />
        </mesh>
      )}

      <Suspense
        fallback={
          <group position={[0, 1, 0]}>
            <Html prepend center>
              <Loader
                dataStyles={{ color: '#e4e1da' }}
                innerStyles={{ backgroundColor: '#221f1b' }}
                barStyles={{ backgroundColor: '#f0b35a' }}
                dataInterpolation={p => `${p.toFixed(0)}%`}
              />
            </Html>
          </group>
        }
      >
        <group position={[-0.5, 0, -1.5]} rotation={[0, Math.PI, 0]}>
          {children}
        </group>
      </Suspense>
    </>
  );
}
