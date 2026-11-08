import * as THREE from 'three';
import { type ComponentRef, type ReactNode, type RefObject, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useCursor, useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import cn from 'classnames';
import { ELECTRIC_GLB, FRAME_GLB, FRAME_PIECES, WARDROBE_GLB } from '@/assets';
import { Electric, wireColor, type WireMaterial, wireMaterial } from '@/components/Electric';
import { boxes } from '@/components/PlanDrawing';
import { DOORS, useParts } from '@/components/parts';
import { damp } from '@/components/schematic';
import { useCircuit } from './circuit';
import { circuitsOf, DOOR_IDS, type DoorId, type LedId, LEDS, num } from './data';
import styles from './Elektryka.module.scss';

type Result = GLTF & { nodes: Record<string, THREE.Mesh> };
type View = { label: string; position: [number, number, number]; target: [number, number, number] };

const VIEWS: View[] = [
  { label: 'Cała szafa', position: [-6.4, 2.3, -4.2], target: [-0.26, 1.3, -1.34] },
  { label: 'Rozdzielnia', position: [-1.05, 1.32, -0.62], target: [-0.04, 1.13, -0.88] },
  { label: 'Zasilacz', position: [-0.95, 0.78, -0.72], target: [-0.05, 0.31, -0.9] },
];

// The whole-wardrobe view backs off on narrow canvases so the width still fits
function viewPosition(view: View, aspect: number) {
  const target = new THREE.Vector3(...view.target);
  const k = view === VIEWS[0] ? Math.max(1, 1.35 / aspect) : 1;
  return new THREE.Vector3(...view.position).sub(target).multiplyScalar(k).add(target);
}

const noRaycast = () => null;
const doorName = (id: DoorId) => Object.keys(DOORS).find(name => name.startsWith(`${id}_`))!;
const isWire = (name: string) => /Wire|Feed|Mains|Jumpers/.test(name);

function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

type SceneProps = { focus: LedId | null; fly: RefObject<View | null>; active: boolean; fine: boolean };

function XrayScene({ focus, fly, active, fine }: SceneProps) {
  const circuit = useCircuit();
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as Result;
  const frame = useGLTF(FRAME_GLB) as unknown as Result;
  const electric = useGLTF(ELECTRIC_GLB) as unknown as Result;
  const root = useRef<THREE.Group>(null!);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null!);
  const parts = useParts(root, wardrobe.scene, wardrobe.animations);
  const applied = useRef<Record<DoorId, boolean>>(Object.fromEntries(DOOR_IDS.map(id => [id, false])) as Record<DoorId, boolean>);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const aspect = useThree(s => s.viewport.aspect);
  const start = useMemo(() => viewPosition(VIEWS[0], aspect), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    DOOR_IDS.forEach(id => {
      if (circuit.doors[id] === applied.current[id]) return;
      if (parts.toggle(doorName(id))) applied.current[id] = circuit.doors[id];
    });
  }, [circuit.doors, parts]);

  const ghost = useMemo(() => new THREE.MeshBasicMaterial({ color: '#bfe3d2', transparent: true, opacity: 0.03, depthWrite: false, side: THREE.DoubleSide }), []);
  const line = useMemo(() => new THREE.LineBasicMaterial({ color: '#d6ece1', transparent: true, opacity: 0.17 }), []);
  const edges = useMemo(() => new Map<THREE.BufferGeometry, THREE.EdgesGeometry>(), []);
  const edgesOf = (geometry: THREE.BufferGeometry) => edges.get(geometry) ?? edges.set(geometry, new THREE.EdgesGeometry(geometry, 25)).get(geometry)!;

  const wires = useMemo(() => {
    const map = new Map<string, WireMaterial>();
    electric.scene.children.forEach(node => map.set(node.name, wireMaterial(wireColor(node.name))));
    return map;
  }, [electric]);

  const leds = useMemo(() => {
    const halo = haloTexture();
    return boxes(wardrobe.scene)
      .filter(b => b.name.startsWith('LED_'))
      .map(b => {
        const led = LEDS.find(l => b.name === `LED_${l.strip}`)!;
        const size = new THREE.Vector3().subVectors(b.max, b.min);
        return {
          led,
          name: b.name,
          center: new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5),
          scale: (size.y > size.z ? [0.34, size.y * 1.1, 1] : [size.z * 1.16, 0.3, 1]) as [number, number, number],
          strip: new THREE.MeshBasicMaterial({ color: '#46584d' }),
          halo: new THREE.SpriteMaterial({ map: halo, color: '#ffb65c', transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
          value: { current: 0 },
        };
      });
  }, [wardrobe]);

  const state = useRef({ circuit, focus });
  state.current = { circuit, focus };

  const dim = new THREE.Color('#46584d');
  const lit = new THREE.Color('#ffd9a0');

  useFrame((frameState, dt) => {
    const { circuit: c, focus: f } = state.current;
    const camera = frameState.camera;
    wires.forEach((material, name) => {
      const ids = circuitsOf(name);
      const energised = !ids.length || LEDS.some(led => ids.includes(led.id) && c.on(led));
      const opacity = !f || ids.includes(f) ? 1 : ids.length ? 0.1 : 0.45;
      material.uniforms.uTime.value = frameState.clock.elapsedTime;
      material.uniforms.uGlow.value += ((isWire(name) && energised ? 1 : 0) - material.uniforms.uGlow.value) * damp(5, dt);
      material.uniforms.uOpacity.value += (opacity - material.uniforms.uOpacity.value) * damp(9, dt);
      material.depthWrite = material.uniforms.uOpacity.value > 0.9;
    });
    leds.forEach(item => {
      item.value.current += (c.level(item.led) - item.value.current) * damp(2.4, dt); // the strip's own fade
      item.strip.color.lerpColors(dim, lit, item.value.current);
      item.halo.opacity = item.value.current * (f && f !== item.led.id ? 0.2 : 0.9);
    });
    const goal = fly.current;
    if (goal && controls.current) {
      const k = damp(3.6, dt);
      const position = viewPosition(goal, frameState.viewport.aspect);
      camera.position.lerp(position, k);
      controls.current.target.lerp(new THREE.Vector3(...goal.target), k);
      if (camera.position.distanceTo(position) < 0.01) fly.current = null;
    }
  });

  const onDoor = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 6) return;
    const id = event.eventObject.name.slice(0, 3) as DoorId;
    if (DOOR_IDS.includes(id)) {
      event.stopPropagation();
      circuit.toggleDoor(id);
    }
  };

  const part = (node: THREE.Object3D): ReactNode => {
    const children = node.children.map(part);
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) {
      return (
        <group key={node.name} name={node.name} position={node.position} quaternion={node.quaternion}>
          {children}
        </group>
      );
    }
    const led = leds.find(item => item.name === node.name);
    if (led) return <mesh key={node.name} name={node.name} geometry={mesh.geometry} position={node.position} quaternion={node.quaternion} material={led.strip} raycast={noRaycast} />;
    const door = node.name in DOORS && DOOR_IDS.includes(node.name.slice(0, 3) as DoorId);
    return (
      <mesh
        key={node.name}
        name={node.name}
        geometry={mesh.geometry}
        position={node.position}
        quaternion={node.quaternion}
        material={ghost}
        onClick={door ? onDoor : undefined}
        onPointerOver={door ? () => setHover(true) : undefined}
        onPointerOut={door ? () => setHover(false) : undefined}
        raycast={door ? undefined : noRaycast}
      >
        <lineSegments geometry={edgesOf(mesh.geometry)} material={line} raycast={noRaycast} />
        {children}
      </mesh>
    );
  };

  return (
    <>
      <PerspectiveCamera makeDefault fov={26} near={0.05} far={60} position={start} />
      <OrbitControls ref={controls} makeDefault target={VIEWS[0].target} enablePan={false} enabled={fine || active} enableZoom={active} enableDamping minDistance={0.4} maxDistance={24} onStart={() => (fly.current = null)} />
      <group ref={root}>
        {FRAME_PIECES.map(name => (
          <mesh key={name} geometry={frame.nodes[name].geometry} position={frame.nodes[name].position} quaternion={frame.nodes[name].quaternion} material={ghost} raycast={noRaycast}>
            <lineSegments geometry={edgesOf(frame.nodes[name].geometry)} material={line} raycast={noRaycast} />
          </mesh>
        ))}
        {wardrobe.scene.children.map(part)}
        <Electric root={root} materials={wires} />
        {leds.map(item => (
          <sprite key={item.name} position={item.center} scale={item.scale} material={item.halo} raycast={noRaycast} renderOrder={11} />
        ))}
      </group>
    </>
  );
}

export function Xray() {
  const circuit = useCircuit();
  const stage = useRef<HTMLElement>(null!);
  const fly = useRef<View | null>(null);
  const [focus, setFocus] = useState<LedId | null>(null);
  const [view, setView] = useState(0);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const fine = useMemo(() => window.matchMedia('(pointer: fine)').matches, []);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) setActive(false);
    });
    io.observe(stage.current);
    return () => io.disconnect();
  }, []);

  return (
    <section id="przeswietlenie" ref={stage} className={styles.xray} aria-labelledby="przeswietlenie-h">
      <div className={styles.xrayStage} style={{ touchAction: active ? 'none' : 'pan-y' }} onPointerDown={() => setActive(true)}>
        <Canvas dpr={[1, 1.75]} frameloop={visible ? 'always' : 'never'} gl={{ alpha: true, antialias: true }}>
          <Suspense fallback={null}>
            <XrayScene focus={focus} fly={fly} active={active} fine={fine} />
          </Suspense>
        </Canvas>
        <p className={styles.stageHint}>{fine ? 'Przeciągnij, aby obrócić. Kliknij drzwi, aby je otworzyć.' : 'Stuknij, aby obracać. Stuknij drzwi, aby je otworzyć.'}</p>
      </div>

      <aside className={styles.xrayPanel}>
        <h2 id="przeswietlenie-h">Szafa na wylot</h2>
        <p>Kolory jak w kablach: czerwony 24 V, niebieski 230 V, żółty włącznik, biały kontaktrony, czarne moduły. Wybierz obwód, a reszta przygaśnie.</p>

        <div className={styles.views} role="group" aria-label="Widok kamery">
          {VIEWS.map((item, i) => (
            <button
              key={item.label}
              aria-pressed={view === i}
              onClick={() => {
                setView(i);
                fly.current = item;
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <ul className={styles.circuits}>
          {LEDS.map(led => (
            <li key={led.id}>
              <button aria-pressed={focus === led.id} className={cn(circuit.on(led) && styles.circuitOn)} onClick={() => setFocus(value => (value === led.id ? null : led.id))}>
                <i aria-hidden="true" />
                <span>
                  {led.id}, {led.place}
                </span>
                <small>
                  {led.doors ? led.doors.join(' i ') : 'S1'}, {num(led.wireMetres, 2)} m kabla
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}

useGLTF.preload(ELECTRIC_GLB);
