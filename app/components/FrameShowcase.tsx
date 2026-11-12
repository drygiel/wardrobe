import * as THREE from 'three';
import { type RefObject, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { FRAME_BOARDS, FRAME_GLB, FRAME_PIECES, flatPiece } from '@/assets';
import { light } from '@/theme';
import { track } from '@/home/chapters';
import { damp, drift, easeInOut, moveCamera, type ShowcaseProgress, smoothstep } from './schematic';

type Result = GLTF & { nodes: Record<string, THREE.Mesh> };

const STILL = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The story along T (0..1 the hero scrolling away, then one whole step per chapter):
// 1..2 the frame goes back onto its boards, 2..3 the cutting plan from above, 3..4 assembly from the floor up, 4..5 the frame
const STORY = {
  // 1: assembled, 0: every piece lying on its board
  built: [
    [1.08, 1],
    [1.9, 0],
    [3.08, 0],
    [3.95, 1],
  ],
  boards: [
    [0.95, 0],
    [1.1, 1],
    [4.05, 1],
    [4.45, 0],
  ],
  az: [
    [0, 34],
    [1, 30],
    [1.7, 24],
    [2.3, 6],
    [2.9, 6],
    [3.35, 28],
    [4.05, 32],
    [4.7, 36],
  ],
  el: [
    [0, 8],
    [0.9, 14],
    [1.7, 30],
    [2.3, 70],
    [2.9, 70],
    [3.35, 30],
    [4.05, 22],
    [4.7, 10],
  ],
  // What the camera frames: the frame alone, the frame with its boards, the boards alone
  both: [
    [0.95, 0],
    [1.35, 1],
    [4.1, 1],
    [4.6, 0],
  ],
  plan: [
    [1.9, 0],
    [2.3, 1],
    [2.9, 1],
    [3.3, 0],
  ],
  // The chapters' copy takes the left of the screen (the bottom on a phone), so the scene moves aside
  aside: [
    [0.5, 0],
    [1, 1],
  ],
} as const;

const CLEAR = 0.15; // m: what a carried piece keeps below it over everything already standing
const LIFT = 0.25; // m: first straight up off the board
const BOARDS_GAP = 0.45; // m: the boards lie in front of the frame, this far from its front edge

type Piece = {
  name: string;
  geometry: THREE.BufferGeometry;
  centre: THREE.Vector3; // the geometry's centre in the mesh's own axes
  laid: THREE.Vector3; // world centres: on the board, just lifted, above its place in the frame, in place
  lifted: THREE.Vector3;
  above: THREE.Vector3;
  placed: THREE.Vector3;
  flat: THREE.Quaternion;
  upright: THREE.Quaternion;
};

const boxOf = (geometry: THREE.BufferGeometry, position: THREE.Vector3, quaternion: THREE.Quaternion) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1)));
};

const sphereOf = (box: THREE.Box3) => box.getBoundingSphere(new THREE.Sphere());

// The bare frame for /rama. It comes apart and goes together as a joiner would build it: one piece at a time, from the
// floor up, each lifted off its board, carried above everything already standing and lowered straight into its place
export function FrameShowcase({ progress }: { progress: RefObject<ShowcaseProgress> }) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as Result;
  const invalidate = useThree(s => s.invalidate);
  const meshes = useRef<Record<string, THREE.Mesh>>({});
  const yawGroup = useRef<THREE.Group>(null!);
  const look = useRef(new THREE.Vector3());
  const shown = useRef<number | null>(null); // T as drawn: eases after the scroll, so a fast scroll still plays every step

  const scene = useMemo(() => {
    const frame = new THREE.Box3();
    FRAME_PIECES.forEach(name => frame.union(boxOf(nodes[name].geometry, nodes[name].position, nodes[name].quaternion)));
    const sheets = new THREE.Box3();
    FRAME_BOARDS.forEach(name => sheets.union(boxOf(nodes[name].geometry, nodes[name].position, nodes[name].quaternion)));
    // Lay the boards out in front of the frame (its front faces -x), centred on it, so nothing waits where the frame stands
    const offset = new THREE.Vector3(frame.min.x - BOARDS_GAP - sheets.max.x, 0, (frame.min.z + frame.max.z) / 2 - (sheets.min.z + sheets.max.z) / 2);
    const boards = sheets.clone().translate(offset);

    const raw = FRAME_PIECES.map(name => {
      const node = nodes[name];
      const flatNode = nodes[flatPiece(name)];
      const laidAt = flatNode.position.clone().add(offset);
      node.geometry.computeBoundingBox();
      const centre = node.geometry.boundingBox!.getCenter(new THREE.Vector3());
      return {
        name,
        geometry: node.geometry,
        centre,
        flat: flatNode.quaternion.clone(),
        upright: node.quaternion.clone(),
        laid: laidAt.clone().add(centre.clone().applyQuaternion(flatNode.quaternion)),
        placed: node.position.clone().add(centre.clone().applyQuaternion(node.quaternion)),
        box: boxOf(node.geometry, node.position, node.quaternion),
      };
    });
    // Floor rails first, then what stands on them, the niche from its bottom, the shelf, the top rails last:
    // nothing is ever lowered through a piece already in place above it
    raw.sort((a, b) => Math.round(a.box.min.y * 100) - Math.round(b.box.min.y * 100) || a.box.max.y - b.box.max.y);

    let top = boards.max.y + 0.04; // the pieces lying on the boards
    const pieces: Piece[] = raw.map(p => {
      const rise = Math.max(0, top + CLEAR - p.box.min.y);
      top = Math.max(top, p.box.max.y);
      return { ...p, lifted: p.laid.clone().setY(p.laid.y + LIFT), above: p.placed.clone().setY(p.placed.y + rise) };
    });

    // The air the carried pieces pass through counts for the framing too
    const both = frame.clone().union(boards).expandByPoint(new THREE.Vector3(frame.min.x, top + CLEAR + 0.3, frame.min.z));
    return { pieces, offset, frame: sphereOf(frame), both: sphereOf(both), plan: sphereOf(boards) };
  }, [nodes]);

  // Flat oak: the baked atlas carries shadows from the interior, which look wrong on the bare frame
  const materials = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: '#cfae80', roughness: 0.9, metalness: 0 }),
      edges: new THREE.LineBasicMaterial({ color: '#161412', transparent: true, opacity: 0.55 }),
      // On bone paper a dark board would weigh more than the pieces it carries
      board: new THREE.MeshStandardMaterial({ color: light ? '#b3a894' : '#4a4239', roughness: 1, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    }),
    [],
  );

  const edges = useMemo(() => new Map(scene.pieces.map(p => [p.name, new THREE.EdgesGeometry(p.geometry, 25)])), [scene]);

  const centre = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const aim = new THREE.Vector3();

  useFrame((state, dt) => {
    const { T: goal, yaw } = progress.current;
    const camera = state.camera as THREE.PerspectiveCamera;
    let moving = false;

    const first = shown.current === null;
    shown.current = first || STILL ? goal : THREE.MathUtils.lerp(shown.current!, goal, damp(5, dt));
    if (Math.abs(shown.current - goal) < 1e-4) shown.current = goal;
    else moving = true;
    const T = shown.current;

    // One piece leaves as the one before it is lowered: two at most in the air, one by the boards and one by the frame
    const built = track(STORY.built, T);
    const n = scene.pieces.length;
    const slot = 1 / ((n - 1) * 0.65 + 1);
    scene.pieces.forEach((p, i) => {
      const mesh = meshes.current[p.name];
      if (!mesh) return;
      const t = THREE.MathUtils.clamp((built - i * slot * 0.65) / slot, 0, 1);
      if (t < 0.18) {
        centre.lerpVectors(p.laid, p.lifted, easeInOut(t / 0.18));
        quat.copy(p.flat);
      } else if (t < 0.68) {
        // Carried across: up first, turned late, so a long piece swings upright only once it is clear of everything
        const u = (t - 0.18) / 0.5;
        const across = easeInOut(u);
        centre.lerpVectors(p.lifted, p.above, across);
        centre.y = THREE.MathUtils.lerp(p.lifted.y, p.above.y, 1 - (1 - u) ** 3);
        quat.slerpQuaternions(p.flat, p.upright, smoothstep(0.15, 1, u));
      } else {
        centre.lerpVectors(p.above, p.placed, easeInOut((t - 0.68) / 0.32));
        quat.copy(p.upright);
      }
      mesh.quaternion.copy(quat);
      mesh.position.copy(centre).sub(p.centre.clone().applyQuaternion(quat));
    });

    materials.board.opacity = track(STORY.boards, T);
    materials.board.visible = materials.board.opacity > 0.01;

    const rot = yaw * (1 - smoothstep(0, 0.8, T));
    if (Math.abs(yawGroup.current.rotation.y - rot) > 1e-4) {
      yawGroup.current.rotation.y += (rot - yawGroup.current.rotation.y) * damp(6, dt);
      moving = true;
    }

    // Frame what the chapter is about, in the part of the screen its copy leaves free
    const both = track(STORY.both, T);
    const plan = track(STORY.plan, T);
    const aside = track(STORY.aside, T);
    const sphere = { centre: aim.copy(scene.frame.center).lerp(scene.both.center, both), radius: THREE.MathUtils.lerp(scene.frame.radius, scene.both.radius, both) };
    sphere.centre.lerp(scene.plan.center, plan);
    sphere.radius = THREE.MathUtils.lerp(sphere.radius, scene.plan.radius, plan);

    const { width, height } = state.size;
    const narrow = width < 768 || camera.aspect < 0.9;
    // Hero: the middle; story: the right 58 % beside the copy, or the top half above it on a phone
    const fracW = narrow ? 0.9 : THREE.MathUtils.lerp(0.62, 0.56, aside);
    const fracH = narrow ? THREE.MathUtils.lerp(0.62, 0.46, aside) : THREE.MathUtils.lerp(0.62, 0.78, aside);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(sphere.radius / (tan * fracH), sphere.radius / (tan * camera.aspect * fracW));

    const sway = drift(state.clock.elapsedTime);
    if (sway) moving = true;
    if (
      moveCamera(
        camera,
        look.current,
        sphere.centre,
        { az: track(STORY.az, T) + (sway?.az ?? 0), el: track(STORY.el, T) + (sway?.el ?? 0), dist, ty: 0 },
        dt,
        first,
      )
    )
      moving = true;
    camera.near = Math.max(0.1, dist - sphere.radius * 2);
    camera.far = dist + sphere.radius * 2;
    camera.setViewOffset(width, height, narrow ? 0 : -0.18 * aside * width, narrow ? 0.2 * aside * height : 0, width, height);
    camera.updateMatrixWorld();

    if (moving) invalidate();
  });

  const pivot = scene.frame.center;
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[-4, 6, -3]} intensity={2.6} />

      <group ref={yawGroup} position={[pivot.x, 0, pivot.z]}>
        <group position={[-pivot.x, 0, -pivot.z]}>
          {scene.pieces.map(p => (
            <mesh key={p.name} ref={m => void (m && (meshes.current[p.name] = m))} geometry={p.geometry} material={materials.wood}>
              <lineSegments geometry={edges.get(p.name)} material={materials.edges} />
            </mesh>
          ))}
          {FRAME_BOARDS.map(name => (
            <mesh
              key={name}
              geometry={nodes[name].geometry}
              material={materials.board}
              position={nodes[name].position.clone().add(scene.offset).setY(nodes[name].position.y - 0.002)}
              quaternion={nodes[name].quaternion}
            />
          ))}
        </group>
      </group>
    </>
  );
}
