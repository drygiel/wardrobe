import * as THREE from 'three';
import { type RefObject, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useAnimations, useGLTF, useTexture } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { ATLAS, FRAME_GLB, FRAME_PIECES, WARDROBE_GLB } from '@/assets';
import { DOORS, type Kind, kindOf, toggleAction } from './Wardrobe';
import { damp, easeInOut, fitDistance, moveCamera, poseAt, schematicMaterial, schematicMix, type ShowcaseProgress, smoothstep } from './schematic';

type Result = GLTF & { nodes: Record<string, THREE.Object3D> };

const FLAT: Record<Kind, string> = {
  front: '#d6d8d6',
  handle: '#3b3732',
  led: '#f0b35a',
  drawer: '#c8bba3',
  support: '#d4bf9a',
  shelf: '#e0cfae',
  aShelf: '#e0cfae',
  aSide: '#d4bf9a',
  back: '#2e2a26',
  frame: '#c8a473',
};

// Opacity per state: assembled, fronts out, interior out, light and frame, frame apart, assembled
const ALPHA: Record<Kind, number[]> = {
  front: [1, 1, 1, 0, 0, 1],
  handle: [1, 1, 1, 0, 0, 1],
  drawer: [1, 1, 1, 0, 0, 1],
  shelf: [1, 1, 1, 0, 0, 1],
  support: [1, 1, 1, 0, 0, 1],
  aShelf: [1, 1, 1, 0, 0, 1],
  aSide: [1, 1, 1, 0, 0, 1],
  back: [1, 1, 1, 0, 0, 1],
  led: [1, 1, 1, 1, 0, 1],
  frame: [1, 1, 1, 1, 1, 1],
};

// Model space: front faces -X, section A sits at -Z, up is +Y
const CENTER = new THREE.Vector3(-0.265, 1.33, -1.344);
const FRAME_CENTER = new THREE.Vector3(-0.265, 1.33, -1.14);

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Offset of a part in each of the six states
function keyframes(kind: Kind, c: THREE.Vector3): THREE.Vector3[] {
  const zero = v();
  const out = (o: THREE.Vector3, from: number) =>
    [zero, from <= 1 ? o : zero, o, o.clone().multiplyScalar(1.8), o.clone().multiplyScalar(1.8), zero];

  switch (kind) {
    case 'front':
      return out(v(-0.8), 1);
    case 'drawer':
      return out(v(-0.55), 2);
    case 'shelf':
      return out(v(-0.32, (c.y - CENTER.y) * 0.14), 2);
    case 'support':
      return out(v(-0.14), 2);
    case 'aShelf':
      return out(v(-0.22, 0, -0.18), 2);
    case 'aSide':
      return out(v(0, 0, -0.4), 2);
    case 'back':
      return out(v(0.35), 2);
    case 'led':
      return [zero, zero, v(-0.06), zero, zero, zero];
    case 'frame': {
      const d = c.clone().sub(FRAME_CENTER);
      return [zero, zero, zero, zero, v(d.x * 2, d.y * 0.25, d.z * 0.35), zero];
    }
    default:
      return [zero, zero, zero, zero, zero, zero];
  }
}

// Camera per whole step of T (0 hero, 1..6 breakdown states); az from the front towards section A
const POSES = [
  { az: 34, el: 6, dist: 1 },
  { az: 46, el: 14, dist: 1.12 },
  { az: 58, el: 16, dist: 1.35 },
  { az: 62, el: 18, dist: 1.55 },
  { az: 44, el: 14, dist: 1.3 },
  { az: 30, el: 12, dist: 1.35 },
  { az: 34, el: 8, dist: 1.08 },
];

type Part = {
  name: string;
  kind: Kind;
  geometry: THREE.BufferGeometry;
  base: THREE.Vector3;
  quat: THREE.Quaternion;
  z: number;
  keys: THREE.Vector3[];
  delay: number;
  pivot?: { name: string; position: THREE.Vector3 };
  handles: { name: string; geometry: THREE.BufferGeometry; position: THREE.Vector3 }[];
};

export function WardrobeShowcase({ progress }: { progress: RefObject<ShowcaseProgress> }) {
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as Result;
  const frame = useGLTF(FRAME_GLB) as unknown as Result;
  const texture = useTexture(ATLAS);
  const root = useRef<THREE.Group>(null!);
  const yawGroup = useRef<THREE.Group>(null!);
  const meshes = useRef<Record<string, THREE.Mesh>>({});
  const lights = useRef<{ ambient?: THREE.AmbientLight; point?: THREE.PointLight; sun?: THREE.DirectionalLight }>({});
  const { actions } = useAnimations(wardrobe.animations, root);
  const invalidate = useThree(s => s.invalidate);
  const look = useRef(CENTER.clone());

  const parts = useMemo(() => {
    const list: Part[] = [];
    const add = (node: THREE.Object3D) => {
      const mesh = node as THREE.Mesh;
      const kind = kindOf(mesh.name);
      mesh.updateWorldMatrix(true, false);
      mesh.geometry.computeBoundingBox();
      const c = mesh.geometry.boundingBox!.getCenter(v()).applyMatrix4(mesh.matrixWorld);
      // Hinged doors sit in their F0x_Pivot, which the door clips rotate
      const parent = mesh.parent!;
      list.push({
        name: mesh.name,
        kind,
        geometry: mesh.geometry,
        base: mesh.position.clone(),
        quat: mesh.quaternion.clone(),
        z: mesh.getWorldPosition(v()).z,
        keys: keyframes(kind, c),
        delay: 0,
        pivot: parent.name.endsWith('_Pivot') ? { name: parent.name, position: parent.position.clone() } : undefined,
        handles: mesh.children
          .filter(ch => (ch as THREE.Mesh).isMesh)
          .map(ch => ({ name: ch.name, geometry: (ch as THREE.Mesh).geometry, position: ch.position.clone() })),
      });
    };

    Object.values(wardrobe.nodes).forEach(node => {
      if ((node as THREE.Mesh).isMesh && node.parent?.type !== 'Mesh') add(node);
    });
    FRAME_PIECES.forEach(name => add(frame.nodes[name]));

    // Stagger inside a kind from section A towards D
    const byKind = Object.groupBy(list, p => p.kind);
    Object.values(byKind).forEach(group => {
      group!.sort((a, b) => a.z - b.z).forEach((p, i, all) => (p.delay = all.length > 1 ? (i / (all.length - 1)) * 0.3 : 0));
    });
    return list;
  }, [wardrobe, frame]);

  const materials = useMemo(() => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    const kinds = Object.keys(FLAT) as Kind[];
    return Object.fromEntries(
      kinds.map(kind => [
        kind,
        {
          surface: schematicMaterial(texture, FLAT[kind], kind === 'led' ? '#f0b35a' : undefined),
          edges: new THREE.LineBasicMaterial({ color: '#161412', transparent: true, opacity: 0 }),
        },
      ]),
    ) as Record<Kind, { surface: THREE.MeshStandardMaterial; edges: THREE.LineBasicMaterial }>;
  }, [texture]);

  const edges = useMemo(() => {
    const map = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
    const get = (g: THREE.BufferGeometry) => map.get(g) ?? map.set(g, new THREE.EdgesGeometry(g, 25)).get(g)!;
    parts.forEach(p => {
      get(p.geometry);
      p.handles.forEach(h => get(h.geometry));
    });
    return map;
  }, [parts]);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const target = event.nativeEvent.target as HTMLElement;
    const clip = DOORS[event.eventObject.name];
    if (!clip || progress.current.T > 0.3 || event.delta > 6 || target.closest('a, button')) return;
    event.stopPropagation();
    toggleAction(actions[clip]!, event.eventObject.userData);
    invalidate();
  };

  const target = new THREE.Vector3();

  useFrame((state, dt) => {
    const { T, yaw } = progress.current;
    const camera = state.camera as THREE.PerspectiveCamera;
    let moving = false;
    const settle = (from: number, to: number, lambda = 8) => {
      if (Math.abs(to - from) < 1e-4) return to;
      moving = true;
      return from + (to - from) * damp(lambda, dt);
    };

    // Doors close once the page leaves the hero
    if (T > 0.6) {
      Object.entries(DOORS).forEach(([name, clip]) => {
        const data = meshes.current[name]?.userData;
        if (data?.open) toggleAction(actions[clip]!, data);
      });
    }
    if (Object.values(actions).some(a => a?.isRunning())) moving = true;

    schematicMix.value = settle(schematicMix.value, smoothstep(0.1, 0.85, T));
    const mix = schematicMix.value;

    const t = THREE.MathUtils.clamp(T - 1, 0, 5);
    const step = Math.min(5, Math.floor(t) + 1);
    const local = t - (step - 1);

    for (const p of parts) {
      const mesh = meshes.current[p.name];
      if (!mesh) continue;
      const lt = easeInOut(THREE.MathUtils.clamp((local - p.delay) / 0.7, 0, 1));
      target.lerpVectors(p.keys[step - 1], p.keys[step], lt).add(p.base);
      if (mesh.position.distanceToSquared(target) > 1e-8) {
        mesh.position.lerp(target, damp(9, dt));
        moving = true;
      }
    }

    const lk = easeInOut(THREE.MathUtils.clamp(local / 0.7, 0, 1));
    (Object.keys(materials) as Kind[]).forEach(kind => {
      const { surface, edges } = materials[kind];
      const alpha = THREE.MathUtils.lerp(ALPHA[kind][step - 1], ALPHA[kind][step], lk);
      surface.opacity = settle(surface.opacity, alpha, 9);
      surface.visible = surface.opacity > 0.01;
      surface.depthWrite = surface.opacity > 0.98;
      surface.emissiveIntensity = kind === 'led' ? mix * 1.4 : 0;
      edges.opacity = surface.opacity * mix * 0.6;
      edges.visible = edges.opacity > 0.01;
    });

    const { ambient, point, sun } = lights.current;
    if (ambient) ambient.intensity = THREE.MathUtils.lerp(10, 1.5, mix);
    if (point) point.intensity = THREE.MathUtils.lerp(10, 0, mix);
    if (sun) sun.intensity = THREE.MathUtils.lerp(0, 2.6, mix);

    yawGroup.current.rotation.y = settle(yawGroup.current.rotation.y, yaw * (1 - smoothstep(0, 0.8, T)), 6);

    // Camera: interpolate poses, fit the viewport, shift the model away from the text column
    const pose = poseAt(POSES, T);
    const narrow = camera.aspect < 0.9;
    const fit = fitDistance(camera, 1.35, 1.33, narrow ? 0.88 : 0.8, narrow ? 0.46 : 0.62);
    const lift = smoothstep(0, 1, T);
    pose.dist *= fit;
    pose.ty = (narrow ? THREE.MathUtils.lerp(-0.45, -0.85, lift) : THREE.MathUtils.lerp(-0.12, 0.95, lift)) * (fit / 7);
    if (moveCamera(camera, look.current, CENTER, pose, dt, state.clock.elapsedTime < 0.2)) moving = true;

    if (moving) invalidate();
  });

  const pivot = CENTER.clone().negate().setY(0);

  return (
    <>
      <ambientLight ref={l => void (lights.current.ambient = l ?? undefined)} intensity={10} />
      <pointLight ref={l => void (lights.current.point = l ?? undefined)} position={[-2, 2.2, 1]} intensity={10} />
      <directionalLight ref={l => void (lights.current.sun = l ?? undefined)} position={[-4, 6, 3]} intensity={0} />

      <group ref={yawGroup} position={[CENTER.x, 0, CENTER.z]}>
        <group position={pivot}>
          <group ref={root}>
            {parts.map(p => {
              const mesh = (
                <mesh
                  key={p.name}
                  name={p.name}
                  ref={m => void (m && (meshes.current[p.name] = m))}
                  geometry={p.geometry}
                  material={materials[p.kind].surface}
                  position={p.base}
                  quaternion={p.quat}
                  onClick={DOORS[p.name] ? onClick : undefined}
                >
                  <lineSegments geometry={edges.get(p.geometry)} material={materials[p.kind].edges} raycast={() => null} />
                  {p.handles.map(h => (
                    <mesh key={h.name} name={h.name} geometry={h.geometry} material={materials.handle.surface} position={h.position}>
                      <lineSegments geometry={edges.get(h.geometry)} material={materials.handle.edges} raycast={() => null} />
                    </mesh>
                  ))}
                </mesh>
              );
              return p.pivot ? (
                <group key={p.name} name={p.pivot.name} position={p.pivot.position}>
                  {mesh}
                </group>
              ) : (
                mesh
              );
            })}
          </group>
        </group>
      </group>
    </>
  );
}
