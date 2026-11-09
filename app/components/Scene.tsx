import { type ReactNode, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
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
import { XRStage } from '@/xr/XRStage';
import { orbitShift } from './orbitAround';

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
  // Rewritten every time the editor leaves perspective; a link opened straight in ortho falls back on this
  'last-3d': { position: new THREE.Vector3(3.3077, 0.2, -3.6753), target: new THREE.Vector3(-0.235, 1.33, -0.156), zoom: 1 },
  top: { position: new THREE.Vector3(-0.225, 5.5, -0.156), target: new THREE.Vector3(-0.235, 1.33, -0.156), zoom: 1, fit: [1.5, 0.45] },
};

// The orthographic presets already aim at the middle of the wardrobe
export const editorGoal = (view: SceneView): ViewState => (view === 'initial' ? { ...Views[view], target: Views.front.target } : Views[view]);

// Zoom that frames an orthographic preset when the frustum is one metre tall from its centre
export const fitZoom = (view: SceneView, aspect: number) => {
  const fit = Views[view].fit;
  return fit ? 1 / Math.max(fit[1], fit[0] / aspect) : 1;
};

type LinkCamera = { position?: THREE.Vector3; target?: THREE.Vector3; zoom?: number };

export default function Scene({
  children,
  editorCamera = false,
  link,
  orbitCenter,
}: {
  children: ReactNode;
  editorCamera?: boolean;
  link?: LinkCamera;
  orbitCenter?: () => THREE.Vector3 | null; // what the middle mouse button orbits around
}) {
  const app = useApp();
  const size = useThree(s => s.size);
  // The editor flies to an orthographic preset in perspective; app.orthographic is what was asked for, ortho what is on screen
  const [arrived, setArrived] = useState(app.orthographic);
  if (!app.orthographic && arrived) setArrived(false);
  const ortho = app.orthographic && (arrived || !editorCamera);
  const goalOf = (view: SceneView): ViewState => (editorCamera ? editorGoal(view) : Views[view]);

  const camState = useMemo(() => {
    // The editor keeps its view in the address, so an empty one always means the default view
    const stored = editorCamera ? null : sessionStorage.getItem('camera');
    if (!stored) {
      const goal = goalOf(app.view);
      return {
        ...goal,
        position: link?.position ?? goal.position,
        target: link?.target ?? goal.target,
        // Zoom is tuned for a wide stage; a tall canvas (the editor between its panels) must not crop the model
        zoom: Views[editorCamera ? 'initial' : app.view].zoom * Math.min(1, size.width / size.height / 1.2),
      };
    }
    const state = JSON.parse(stored);

    return {
      position: new THREE.Vector3(...state.position),
      target: new THREE.Vector3(...state.target),
      zoom: state?.zoom as number,
    } as ViewState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A link opened in ortho starts on a one-metre frustum, see fitZoom
  const [orthoStartZoom] = useState(() =>
    editorCamera && app.orthographic ? (link?.zoom ?? fitZoom(app.view, size.width / size.height)) : camState.zoom,
  );

  const camera = useThree(t => t.camera);
  const controls = useThree(state => state.controls as ComponentRef<typeof OrbitControls>);
  const perCamRef = useRef<THREE.PerspectiveCamera>(null!);
  const orthoCamRef = useRef<THREE.OrthographicCamera>(null!);
  // A copy: this ref is overwritten on every projection switch and must not change the presets
  const target = useRef(camState.target.clone());
  const isPresenting = useXR(xr => xr.session != null);
  const isAR = useXR(xr => xr.mode === 'immersive-ar');
  // Camera orientation when the current drag began; set only while a pointer is down
  const grabbed = useRef<THREE.Quaternion | null>(null);
  // drei rebuilds the controls for a new camera, which would drop an orbit that leaves ortho mid-drag.
  // Built on this stand-in, one instance serves both cameras.
  const standIn = useMemo(() => new THREE.PerspectiveCamera(), []);
  // Set by a middle-button press
  const orbitPoint = useRef<THREE.Vector3 | null>(null);
  const orbitFrom = useRef(new THREE.Quaternion());

  // Capture: this must run before OrbitControls handles the same press
  useEffect(() => {
    const element = controls?.domElement;
    if (!element || !orbitCenter) return;
    const onPress = (event: PointerEvent) => {
      if (event.button === 1) event.preventDefault(); // no browser autoscroll
      orbitPoint.current = event.button === 1 && !event.shiftKey && !event.ctrlKey && !event.metaKey ? orbitCenter() : null;
      orbitFrom.current.copy(controls.object.quaternion);
    };
    element.addEventListener('pointerdown', onPress, true);
    return () => element.removeEventListener('pointerdown', onPress, true);
  }, [controls, orbitCenter]);

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
  const centering = useRef<TWEEN.Group>(new TWEEN.Group());

  // Moves camera and target together: the element comes to the middle, angle and distance stay
  useEffect(() => {
    if (!controls || !editorCamera) return;
    app.centerOn.current = point => {
      if (tweens.current.getAll().some(tween => tween.isPlaying())) return; // a flight to a preset finishes first
      const position = controls.object.position.clone().add(point).sub(controls.target);
      centering.current.removeAll();
      centering.current.add(
        new TWEEN.Tween(controls.object.position).to(position, 400).easing(TWEEN.Easing.Quadratic.InOut).start(),
        new TWEEN.Tween(controls.target).to(point, 400).easing(TWEEN.Easing.Quadratic.InOut).start(),
      );
    };
    return () => {
      app.centerOn.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, editorCamera]);

  const orthoHalfHeight = useRef(1);
  const servedTick = useRef(0);

  useEffect(() => {
    if (!controls || isPresenting || app.viewTick === servedTick.current) return;
    // A preset that changes the projection waits for the controls on the new camera
    if (Boolean((controls.object as THREE.OrthographicCamera).isOrthographicCamera) !== ortho) return;
    servedTick.current = app.viewTick;
    const goal = goalOf(app.view);
    const flying = editorCamera && !ortho;
    const enteringOrtho = flying && app.orthographic;

    // A flight redirected midway has already left the view to come back to
    if (enteringOrtho && !tweens.current.getAll().some(tween => tween.isPlaying())) {
      Views['last-3d'].position.copy(controls.object.position);
      Views['last-3d'].target.copy(controls.target);
    }

    tweens.current.removeAll();
    tweens.current.add(
      new TWEEN.Tween(controls.object.position)
        .to(goal.position, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .interpolation(TWEEN.Interpolation.Bezier)
        .onComplete(() => {
          if (enteringOrtho) setArrived(true);
        })
        .start(),
      new TWEEN.Tween(controls.target)
        .to(goal.target, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .interpolation(TWEEN.Interpolation.Bezier)
        .start(),
    );
    // Perspective ends on the preset's framing, so the projection changes without a jump
    const halfHeight = flying ? frustumHeightAtDistance(perCamRef.current, goal.position.distanceTo(goal.target)) / 2 : orthoHalfHeight.current;
    const zoom = goal.fit && app.orthographic ? halfHeight / Math.max(goal.fit[1], goal.fit[0] / (size.width / size.height)) : flying ? camState.zoom : null;
    if (zoom !== null) {
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

    if (!ortho) {
      perCamRef.current.position.copy(orthoCamRef.current.position);
      if (editorCamera) {
        // The flight in left its zoom here; orbiting out of ortho starts no tween that would restore it
        perCamRef.current.zoom = camState.zoom;
        perCamRef.current.updateProjectionMatrix();
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

    orthoCamRef.current.position.copy(perCamRef.current.position);
    const distance = perCamRef.current.position.distanceTo(controls.target);
    const halfWidth = frustumWidthAtDistance(perCamRef.current, distance) / 2;
    const halfHeight = frustumHeightAtDistance(perCamRef.current, distance) / 2;
    orthoCamRef.current.top = halfHeight;
    orthoCamRef.current.bottom = -halfHeight;
    orthoCamRef.current.left = -halfWidth;
    orthoCamRef.current.right = halfWidth;
    orthoCamRef.current.zoom = editorCamera ? perCamRef.current.zoom : Math.min(Math.max(1, perCamRef.current.zoom), 3);
    orthoHalfHeight.current = halfHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ortho, isPresenting]);

  // drei puts the orthographic frustum back in pixels whenever the canvas resizes
  useEffect(() => {
    const camera = orthoCamRef.current;
    if (!ortho || !camera) return;
    const half = orthoHalfHeight.current;
    camera.top = half;
    camera.bottom = -half;
    camera.left = -half * (size.width / size.height);
    camera.right = half * (size.width / size.height);
    camera.updateProjectionMatrix();
  }, [size, ortho]);

  useFrame(() => {
    tweens.current?.update();
    centering.current.update();
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
        visible={app.grid && !isAR}
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
        makeDefault={!ortho || isPresenting}
        ref={perCamRef}
        position={camState.position}
        zoom={camState.zoom}
        near={0.01}
        far={1000}
        fov={71}
      />

      {!isPresenting && (
        <OrthographicCamera
          makeDefault={ortho}
          ref={orthoCamRef}
          position={camState.position}
          zoom={orthoStartZoom}
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
          // ROTATE on the middle button also makes Shift + middle a pan, built into OrbitControls
          {...(editorCamera && { mouseButtons: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN } })}
          onStart={() => {
            centering.current.removeAll(); // the user takes the camera over
            grabbed.current = controls.object.quaternion.clone();
          }}
          onChange={() => {
            if (orbitPoint.current) {
              const turn = controls.object.quaternion.clone().multiply(orbitFrom.current.clone().invert());
              const shift = orbitShift(controls.target, orbitPoint.current, turn);
              controls.object.position.add(shift);
              controls.target.add(shift);
              orbitFrom.current.copy(controls.object.quaternion);
            }
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
            if (editorCamera) return; // its view lives in the address

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
          enableDamping={!editorCamera}
          dampingFactor={0.05}
          // maxPolarAngle={Math.PI/2}
        />
      )}

      {/* The gizmo's Hud renders the scene itself, which a headset must not get twice per frame */}
      {app.gizmo && !isPresenting && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport hideNegativeAxes axisHeadScale={0.8} {...editorGizmo} />
        </GizmoHelper>
      )}

      <ambientLight intensity={app.wireframe ? 1 : 10} />
      <pointLight position={[0.8, 2.2, -1.5]} color="white" intensity={app.wireframe ? 2 : 10} />

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
        <XRStage>
          <group position={[-0.5, 0, -1.5]} rotation={[0, Math.PI, 0]}>
            {children}
          </group>
        </XRStage>
      </Suspense>
    </>
  );
}
