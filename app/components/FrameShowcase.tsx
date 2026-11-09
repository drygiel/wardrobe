import * as THREE from 'three';
import { type RefObject, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { FRAME_BOARDS, FRAME_GLB, FRAME_PIECES, flatPiece } from '@/assets';
import { damp, drift, easeInOut, fitDistance, moveCamera, type Pose, poseAt, type ShowcaseProgress, smoothstep } from './schematic';

type Result = GLTF & { nodes: Record<string, THREE.Mesh> };

// States: assembled, laid on the boards, boards close up, lifted off, rising, assembled
const BOARD_ALPHA = [0, 1, 1, 0.35, 0, 0];

const POSES: Pose[] = [
  { az: 34, el: 8, dist: 1, ty: 0 },
  { az: 24, el: 48, dist: 1.05, ty: -1.1 },
  { az: 12, el: 66, dist: 0.9, ty: -1.2 },
  { az: 28, el: 40, dist: 1.05, ty: -0.9 },
  { az: 44, el: 22, dist: 1.12, ty: -0.4 },
  { az: 34, el: 10, dist: 1.04, ty: 0 },
];

const CENTER = new THREE.Vector3(-0.265, 1.33, -1.14);

type Piece = {
  name: string;
  geometry: THREE.BufferGeometry;
  pos: THREE.Vector3[];
  quat: THREE.Quaternion[];
  delay: number;
};

// The bare frame for /rama: the 14 pieces travel between their place in the frame and their place on the boards
export function FrameShowcase({ progress }: { progress: RefObject<ShowcaseProgress> }) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as Result;
  const invalidate = useThree(s => s.invalidate);
  const meshes = useRef<Record<string, THREE.Mesh>>({});
  const yawGroup = useRef<THREE.Group>(null!);
  const look = useRef(CENTER.clone());

  // Centre the cutting layout under the frame
  const offset = useMemo(() => {
    const box = new THREE.Box3();
    FRAME_BOARDS.forEach(name => box.expandByObject(nodes[name]));
    const c = box.getCenter(new THREE.Vector3());
    return new THREE.Vector3(CENTER.x - c.x, 0, CENTER.z - c.z);
  }, [nodes]);

  const pieces = useMemo<Piece[]>(
    () =>
      FRAME_PIECES.map((name, i) => {
        const best = nodes[name];
        const flat = nodes[flatPiece(name)];
        const laid = flat.position.clone().add(offset);
        const lifted = laid.clone().setY(laid.y + 0.12);
        const rising = lifted.clone().lerp(best.position, 0.55).setY(THREE.MathUtils.lerp(lifted.y, best.position.y, 0.55) + 0.35);
        const half = flat.quaternion.clone().slerp(best.quaternion, 0.65);
        return {
          name,
          geometry: best.geometry,
          pos: [best.position, laid, laid, lifted, rising, best.position].map(p => p.clone()),
          quat: [best.quaternion, flat.quaternion, flat.quaternion, flat.quaternion, half, best.quaternion].map(q => q.clone()),
          delay: (i / (FRAME_PIECES.length - 1)) * 0.3,
        };
      }),
    [nodes, offset],
  );

  // Flat oak: the baked atlas carries shadows from the interior, which look wrong on the bare frame
  const materials = useMemo(() => {
    return {
      wood: new THREE.MeshStandardMaterial({ color: '#cfae80', roughness: 0.9, metalness: 0 }),
      edges: new THREE.LineBasicMaterial({ color: '#161412', transparent: true, opacity: 0.55 }),
      board: new THREE.MeshStandardMaterial({ color: '#4a4239', roughness: 1, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    };
  }, []);

  const edges = useMemo(() => new Map(pieces.map(p => [p.name, new THREE.EdgesGeometry(p.geometry, 25)])), [pieces]);

  const target = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  useFrame((state, dt) => {
    const { T, yaw } = progress.current;
    const camera = state.camera as THREE.PerspectiveCamera;
    let moving = false;

    const step = Math.min(5, Math.floor(T) + 1);
    const local = T - (step - 1);

    for (const p of pieces) {
      const mesh = meshes.current[p.name];
      if (!mesh) continue;
      const lt = easeInOut(THREE.MathUtils.clamp((local - p.delay) / 0.7, 0, 1));
      target.lerpVectors(p.pos[step - 1], p.pos[step], lt);
      quat.slerpQuaternions(p.quat[step - 1], p.quat[step], lt);
      if (mesh.position.distanceToSquared(target) > 1e-8 || mesh.quaternion.angleTo(quat) > 1e-4) {
        mesh.position.lerp(target, damp(9, dt));
        mesh.quaternion.slerp(quat, damp(9, dt));
        moving = true;
      }
    }

    const alpha = THREE.MathUtils.lerp(BOARD_ALPHA[step - 1], BOARD_ALPHA[step], easeInOut(THREE.MathUtils.clamp(local / 0.7, 0, 1)));
    if (Math.abs(materials.board.opacity - alpha) > 1e-3) {
      materials.board.opacity += (alpha - materials.board.opacity) * damp(8, dt);
      moving = true;
    }
    materials.board.visible = materials.board.opacity > 0.01;

    const rot = yaw * (1 - smoothstep(0, 0.8, T));
    if (Math.abs(yawGroup.current.rotation.y - rot) > 1e-4) {
      yawGroup.current.rotation.y += (rot - yawGroup.current.rotation.y) * damp(6, dt);
      moving = true;
    }

    const pose = poseAt(POSES, T);
    const narrow = camera.aspect < 0.9;
    const fit = fitDistance(camera, 1.25, 1.33, narrow ? 0.88 : 0.8, narrow ? 0.46 : 0.62);
    pose.dist *= fit;
    // Keep the model clear of the step list: below it on desktop, above it on phones
    pose.ty += (narrow ? -0.5 : 0.6) * smoothstep(0, 1, T) * (fit / 7);
    const sway = drift(state.clock.elapsedTime);
    if (sway) {
      pose.az += sway.az;
      pose.el += sway.el;
      moving = true;
    }
    if (moveCamera(camera, look.current, CENTER, pose, dt, state.clock.elapsedTime < 0.2)) moving = true;

    if (moving) invalidate();
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[-4, 6, -3]} intensity={2.6} />

      <group ref={yawGroup} position={[CENTER.x, 0, CENTER.z]}>
        <group position={[-CENTER.x, 0, -CENTER.z]}>
          {pieces.map(p => (
            <mesh
              key={p.name}
              ref={m => void (m && (meshes.current[p.name] = m))}
              geometry={p.geometry}
              material={materials.wood}
              position={p.pos[0]}
              quaternion={p.quat[0]}
            >
              <lineSegments geometry={edges.get(p.name)} material={materials.edges} />
            </mesh>
          ))}
          {FRAME_BOARDS.map(name => (
            <mesh
              key={name}
              geometry={nodes[name].geometry}
              material={materials.board}
              position={nodes[name].position.clone().add(offset).setY(nodes[name].position.y - 0.002)}
              quaternion={nodes[name].quaternion}
            />
          ))}
        </group>
      </group>
    </>
  );
}
