import * as THREE from 'three';
import { type ReactNode, type RefObject, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { type XRControllerState, useXR, useXRStore, XROrigin } from '@react-three/xr';
import type { LineData } from '@/components/Mesh';
import { useApp } from '@/contexts/AppContext';
import { inUnit } from '@/editor/labels';
import { selection, useSelection } from '@/editor/selection';
import { type Footprint, nearestEdge, placementMatrix, type Pose, snapToWalls, type SnapStatus, type Wall, wallFromPolygon, wrapAngle, yawFacing } from './placement';
import { XRPanel } from './XRPanel';

const START_DISTANCE = 2; // metres in front of the viewer
const STICK_SPEED = 1; // metres per second at full tilt
const DEAD_ZONE = 0.2;
const noRaycast = () => null;

// The carcass only: doors and drawers swing out, and hidden parts still count for standing against a wall
const isCarcass = (name: string) => /^P\d\d_|BackPanel/.test(name);

function footprintOf(root: THREE.Object3D): Footprint | null {
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !isCarcass(mesh.name)) return;
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(toRoot.clone().multiply(mesh.matrixWorld)));
  });
  if (box.isEmpty()) return null;
  return { cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, minY: box.min.y, halfX: (box.max.x - box.min.x) / 2, halfZ: (box.max.z - box.min.z) / 2 };
}

function readRoom(frame: XRFrame, reference: XRReferenceSpace, planes: ReadonlyArray<XRPlane>) {
  const walls: Wall[] = [];
  let floorY: number | null = null;
  for (const plane of planes) {
    const pose = frame.getPose(plane.planeSpace, reference);
    if (!pose) continue;
    const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
    if (plane.orientation === 'horizontal') {
      if (plane.semanticLabel === 'floor') floorY = pose.transform.position.y;
    } else if (!plane.semanticLabel || plane.semanticLabel === 'wall') {
      const points = [...plane.polygon].map(p => new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(matrix));
      walls.push(wallFromPolygon(points, new THREE.Vector3(0, 1, 0).transformDirection(matrix)));
    }
  }
  return { walls, floorY };
}

// Heading of a space's forward axis, around +y; null when it points almost straight up or down
function headingOf({ orientation: q }: XRRigidTransform) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  return Math.hypot(forward.x, forward.z) < 0.2 ? null : Math.atan2(-forward.x, -forward.z);
}

const deadZone = (value = 0) => (Math.abs(value) < DEAD_ZONE ? 0 : value);

type Grab = { input: XRControllerState; x: number; z: number; heading: number; raw: Pose };

// Everything the headset needs and the desktop must not pay for: moving the wardrobe, the wrist menu, the measuring ray
function XRRig({ placed }: { placed: RefObject<THREE.Group> }) {
  const store = useXRStore();
  const pose = useRef<Pose | null>(null);
  const grab = useRef<Grab | null>(null);
  const foot = useRef<Footprint | null>(null);
  const floor = useRef(0);
  const statusRef = useRef<SnapStatus>('free');
  const shadow = useRef<THREE.Mesh>(null!);
  const [snap, setSnap] = useState(true);
  const [status, setStatus] = useState<SnapStatus>('free');
  const [wallCount, setWallCount] = useState(0);

  const show = (next: Pose) => {
    pose.current = next;
    placementMatrix(next, foot.current!, floor.current, placed.current.matrix);
    placed.current.matrixWorldNeedsUpdate = true;
    shadow.current.position.set(next.x, floor.current + 0.005, next.z);
    shadow.current.rotation.set(-Math.PI / 2, 0, next.yaw, 'YXZ');
    shadow.current.scale.set(foot.current!.halfX * 2, foot.current!.halfZ * 2, 1);
  };

  useEffect(() => {
    const group = placed.current;
    return () => {
      group.matrix.identity();
      group.matrixWorldNeedsUpdate = true;
    };
  }, [placed]);

  useFrame((state, delta, frame?: XRFrame) => {
    const reference = state.gl.xr.getReferenceSpace();
    if (!frame || !reference) return;
    foot.current ??= footprintOf(placed.current);
    const viewer = frame.getViewerPose(reference);
    if (!foot.current || !viewer) return;

    const { detectedPlanes, inputSourceStates } = store.getState();
    const room = readRoom(frame, reference, detectedPlanes);
    if (room.walls.length !== wallCount) setWallCount(room.walls.length);
    floor.current = room.floorY ?? 0;

    const head = viewer.transform.position;
    const heading = headingOf(viewer.transform) ?? 0;

    if (!pose.current) {
      const x = head.x - Math.sin(heading) * START_DISTANCE;
      const z = head.z - Math.cos(heading) * START_DISTANCE;
      show({ x, z, yaw: yawFacing(head.x - x, head.z - z) });
    }

    const pressed = (input: XRControllerState) => input.gamepad['xr-standard-squeeze']?.state === 'pressed' && !!input.inputSource.gripSpace;
    const controllers = inputSourceStates.filter((input): input is XRControllerState => input.type === 'controller');
    const input = controllers.find(c => c === grab.current?.input && pressed(c)) ?? controllers.find(pressed);
    const grip = input && frame.getPose(input.inputSource.gripSpace!, reference);
    shadow.current.visible = !!grip;

    if (!input || !grip) {
      grab.current = null;
      return;
    }

    const { x, z } = grip.transform.position;
    const gripHeading = headingOf(grip.transform) ?? grab.current?.heading ?? 0;
    if (grab.current?.input !== input) grab.current = { input, x, z, heading: gripHeading, raw: { ...pose.current! } };
    const held = grab.current;

    // The hand moves it one to one and the wrist turns it on the spot; the stick is for rooms longer than an arm
    const stick = input.gamepad['xr-standard-thumbstick'];
    const right = deadZone(stick?.xAxis) * STICK_SPEED * delta;
    const away = -deadZone(stick?.yAxis) * STICK_SPEED * delta;
    held.raw.x += x - held.x + Math.cos(heading) * right - Math.sin(heading) * away;
    held.raw.z += z - held.z - Math.sin(heading) * right - Math.cos(heading) * away;
    held.raw.yaw += wrapAngle(gripHeading - held.heading);
    held.x = x;
    held.z = z;
    held.heading = gripHeading;

    const snapped = snap ? snapToWalls(held.raw, foot.current, room.walls, head) : { pose: held.raw, status: 'free' as const };
    show({ ...snapped.pose });
    if (snapped.status !== statusRef.current) {
      if (snapped.status !== 'free') input.inputSource.gamepad?.hapticActuators?.[0]?.pulse?.(0.6, 40);
      statusRef.current = snapped.status;
      setStatus(snapped.status);
    }
  }, -900);

  const reset = () => {
    grab.current = null;
    pose.current = null;
    statusRef.current = 'free';
    setStatus('free');
  };

  return (
    <>
      <mesh ref={shadow} visible={false} raycast={noRaycast} renderOrder={2}>
        <planeGeometry />
        <meshBasicMaterial color={status === 'free' ? '#f0b35a' : '#7fd18b'} transparent opacity={0.3} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <EdgeLabel />
      <Suspense fallback={null}>
        <XRPanel snap={snap} setSnap={setSnap} status={status} wallCount={wallCount} reset={reset} />
      </Suspense>
    </>
  );
}

// The length of the hovered edge, where the eyes are; the wrist menu is for everything else
function EdgeLabel() {
  const { unit } = useApp();
  const { edge } = useSelection();
  const sprite = useRef<THREE.Sprite>(null!);
  const [canvas, texture] = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 112;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return [canvas, texture] as const;
  }, []);

  useEffect(() => {
    if (!edge) return;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#161412';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f0b35a';
    context.font = '600 60px Switzer, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${inUnit(edge.width * 1000, unit)} ${unit}`, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
  }, [edge, unit, canvas, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ gl }) => {
    if (!edge) return;
    const point = edge.meshRef.current.localToWorld(edge.midPoint.clone());
    sprite.current.position.copy(point);
    // Same apparent size at any distance
    const height = point.distanceTo(gl.xr.getCamera().getWorldPosition(new THREE.Vector3())) * 0.05;
    sprite.current.scale.set((height * canvas.width) / canvas.height, height, 1);
  });

  return (
    <sprite ref={sprite} visible={!!edge} raycast={noRaycast} renderOrder={1001}>
      <spriteMaterial map={texture} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
}

// Controller rays over the model. Two rays on it at once would flicker, so the first one keeps it
function useRayMeasure(presenting: boolean) {
  const app = useApp();
  const owner = useRef<number | null>(null);

  const clear = () => {
    owner.current = null;
    selection.hover(null);
    app.showEdge.current?.(null);
  };

  useEffect(() => {
    if (!presenting || !app.wireframe) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting, app.wireframe]);

  return {
    onPointerMove(event: ThreeEvent<PointerEvent>) {
      const mesh = event.object as THREE.Mesh;
      if (!app.wireframe || !mesh.isMesh || !mesh.userData.focus) return;
      owner.current ??= event.pointerId;
      if (owner.current !== event.pointerId) return;
      const edge = nearestEdge(mesh.userData.lines as LineData[] | null, mesh.worldToLocal(event.point.clone()));
      selection.hover(mesh, edge);
      app.showEdge.current?.(edge);
    },
    onPointerLeave(event: ThreeEvent<PointerEvent>) {
      if (event.pointerId === owner.current) clear();
    },
    onClick() {
      if (app.wireframe && owner.current !== null) selection.pin();
    },
  };
}

// Wraps the model. On the desktop it adds nothing; in a headset the model belongs to the room and the viewer stands still at the origin
export function XRStage({ children }: { children: ReactNode }) {
  const presenting = useXR(xr => xr.session != null);
  const placed = useRef<THREE.Group>(null!);
  const measure = useRayMeasure(presenting);

  // drei's cameras claim the default camera whenever makeDefault flips, which can land after the XR store's own claim
  useFrame(state => {
    const camera = state.gl.xr.getCamera();
    if (state.gl.xr.isPresenting && state.camera !== camera) state.set({ camera });
  }, -1001);

  return (
    <>
      <XROrigin>{presenting && <XRRig placed={placed} />}</XROrigin>
      <group ref={placed} matrixAutoUpdate={false} {...(presenting && measure)}>
        {children}
      </group>
    </>
  );
}
