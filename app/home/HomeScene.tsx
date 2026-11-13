import * as THREE from 'three';
import { type RefObject, Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import { type GLTF, LineMaterial, LineSegments2, LineSegmentsGeometry } from 'three-stdlib';
import {
  ATLAS,
  ELECTRIC_GLB,
  FRAME_ATLAS,
  FRAME_GLB,
  FRAME_PIECES,
  HARDWARE_GLB,
  WARDROBE_GLB,
} from '@/assets';
import { type WireMaterial, wireColor, wireMaterial } from '@/components/Electric';
import { DOORS, type Kind, kindOf, slideName, useParts } from '@/components/parts';
import { damp, drift, fitDistance, moveCamera, smoothstep } from '@/components/schematic';
import {
  doorsOpen,
  drawersOpen,
  frameBakeOn,
  LIVE_FROM,
  measuring,
  stateAt,
  stripped,
} from './chapters';
import hintStyles from '@/components/LineHint.module.scss';
import { light } from '@/theme';
import { DRAFT_LABELS, FLOOR_SEGMENTS, WALL_SEGMENTS } from './draft';
import { LAYERS, layerIndex, layerOfKind } from './layers';

// `yaw` turns the finished wardrobe, `frameYaw` the spread frame; `touched` is the last drag, performance.now() time;
// `active` the highlighted anatomy layer or -1; `pointer` the cursor in client pixels, `hover` the part under it while measuring;
// `overLink` the cursor is on a link or button, which then speaks for itself
export type HeroProgress = {
  p: number;
  yaw: number;
  frameYaw: number;
  touched: number;
  active: number;
  pointer: { x: number; y: number } | null;
  overLink: boolean;
  hover: string | null;
};

type Result = GLTF & { nodes: Record<string, THREE.Object3D> };

// Model space: front faces -X, the back sits at x = 0, section A at -Z, up is +Y
const CENTER = new THREE.Vector3(-0.265, 1.33, -1.344);
// Pens follow the theme, as --ink, --muted and --accent do in global.scss
const INK = light ? '#1b1815' : '#e0ddd6';
const FAINT = light ? '#9a9286' : '#7d766b';
const LED = light ? '#c47a14' : '#f0b35a';
const DOWEL = '#d9b27a'; // as hardwareColor() in components/Hardware.tsx, without pulling the editor's mesh code in
const DOWEL_CLEARANCE = 0.008; // m between a dowel's end and the mouth of its hole in the spread frame
const GROUND = (light ? new THREE.Vector3(0xeb, 0xe7, 0xdf) : new THREE.Vector3(0x16, 0x14, 0x12)).divideScalar(255); // --bg, written after colour conversion so ink surfaces vanish into the page

const B_DOORS = Object.keys(DOORS).filter(name => name.includes('_B_Door'));

// Line weight in CSS pixels and colour per kind, like the pens of a drawing
const PEN: Record<Kind, { width: number; color: string }> = {
  frame: { width: 1.5, color: INK },
  front: { width: 1.2, color: INK },
  aSide: { width: 1.2, color: INK },
  handle: { width: 1, color: INK },
  drawer: { width: 1, color: INK },
  shelf: { width: 1, color: INK },
  aShelf: { width: 1, color: INK },
  support: { width: 0.9, color: INK },
  back: { width: 0.7, color: FAINT },
  led: { width: 1.7, color: LED },
};

// One wave for every material: it spreads from the open doors, surfaces turn real behind it and lines die out
const uniforms = {
  uCenter: { value: new THREE.Vector3(-0.5, 1.33, -1.64) },
  uRadius: { value: -1 },
  uDrawY: { value: -1 },
};

// The frame-only bake, loaded when the page nears the frame chapter and blended over the atlas there
const frameBake = { uAlt: { value: null as THREE.Texture | null }, uAltMix: { value: 0 } };

function surfaceMaterial(alt?: typeof frameBake) {
  const material = new THREE.MeshStandardMaterial({
    roughness: 1,
    metalness: 0,
    transparent: true, // chapters fade whole kinds out
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, { uGround: { value: GROUND } }, alt);
    if (alt) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D uAlt;\nuniform float uAltMix;',
        )
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uAlt, vMapUv).rgb, uAltMix);\n#endif',
        );
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorld;\nuniform vec3 uCenter, uGround;\nuniform float uRadius;',
      )
      .replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
        float reveal = 1.0 - smoothstep(uRadius - 0.09, uRadius + 0.09, distance(vWorld, uCenter));
        gl_FragColor.rgb = mix(uGround, gl_FragColor.rgb, reveal) + vec3(0.94, 0.7, 0.35) * reveal * (1.0 - reveal) * 1.1;`,
      );
  };
  // Both variants share one onBeforeCompile source, so three needs telling apart
  material.customProgramCacheKey = () => (alt ? 'surface-alt' : 'surface');
  return material;
}

function lineMaterial(color: string, width: number) {
  const material = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: width,
    transparent: true,
    toneMapped: false,
  });
  Object.assign(material.uniforms, uniforms);
  material.vertexShader = material.vertexShader.replace(
    'void main() {',
    'varying vec3 vWorld;\nvoid main() {\nvWorld = (modelMatrix * vec4(position.y < 0.5 ? instanceStart : instanceEnd, 1.0)).xyz;',
  );
  material.fragmentShader = material.fragmentShader
    .replace(
      'void main() {',
      'varying vec3 vWorld;\nuniform vec3 uCenter;\nuniform float uRadius, uDrawY;\nvoid main() {\nif (vWorld.y > uDrawY) discard;',
    )
    .replace(
      'gl_FragColor = diffuseColor;',
      'gl_FragColor = vec4(diffuseColor.rgb, diffuseColor.a * smoothstep(uRadius - 0.09, uRadius + 0.09, distance(vWorld, uCenter)));',
    );
  return material;
}

function fatLines(positions: ArrayLike<number>, material: LineMaterial) {
  const line = new LineSegments2(
    new LineSegmentsGeometry().setPositions(Float32Array.from(positions)),
    material,
  );
  line.raycast = () => {};
  line.renderOrder = 1;
  return line;
}

const gridMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { uAlpha: { value: 1 } },
  vertexShader: `varying vec2 vP;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vP = w.zy;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `varying vec2 vP;
    uniform float uAlpha;
    float grid(float s) {
      vec2 g = abs(fract(vP / s - 0.5) - 0.5) / fwidth(vP / s);
      return 1.0 - min(min(g.x, g.y), 1.0);
    }
    void main() {
      float fade = 1.0 - smoothstep(1.6, 5.5, distance(vP, vec2(-1.344, 1.33)));
      gl_FragColor = vec4(${light ? '0.11, 0.09, 0.08' : '0.88, 0.87, 0.84'},(grid(0.1) * 0.05 + grid(0.5) * 0.13) * fade * uAlpha);
    }`,
});

// The ink stage needs only the 100 kB model; the atlas arrives behind it and holds the wave back until then
function Atlas({
  surfaces,
  ready,
}: {
  surfaces: THREE.MeshStandardMaterial[];
  ready: RefObject<boolean>;
}) {
  const texture = useTexture(ATLAS);
  const invalidate = useThree(s => s.invalidate);
  useLayoutEffect(() => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    surfaces.forEach(m => {
      m.map = texture;
      m.needsUpdate = true;
    });
    ready.current = true;
    invalidate();
  }, [texture, surfaces, ready, invalidate]);
  return null;
}

// The wiring, x-rayed over the faint frame; loads behind the first view
function Wires({ materials }: { materials: RefObject<WireMaterial[]> }) {
  const electric = useGLTF(ELECTRIC_GLB) as unknown as Result;
  const nodes = useMemo(() => electric.scene.children as THREE.Mesh[], [electric]);
  const built = useMemo(
    () =>
      nodes.map(node => {
        const material = wireMaterial(wireColor(node.name));
        material.depthTest = false;
        material.visible = false;
        return material;
      }),
    [nodes],
  );
  useLayoutEffect(() => {
    materials.current = built;
  }, [built, materials]);
  return nodes.map((node, i) => (
    <mesh
      key={node.name}
      geometry={node.geometry}
      material={built[i]}
      position={node.position}
      quaternion={node.quaternion}
      renderOrder={2}
      raycast={() => null}
    />
  ));
}

type Part = {
  name: string;
  kind: Kind;
  geometry: THREE.BufferGeometry;
  base: THREE.Vector3;
  quat: THREE.Quaternion;
  delay: number;
  layer: number;
  box: THREE.Box3;
  apart: THREE.Vector3; // where a frame piece goes in its chapter
  flyDelay: number;
} & PartRest & {
    // How it leaves before the frame chapter: parts outside the frame and the back go straight out along `away`;
    // the fronts and everything inside the frame (null) shrink to nothing where they stand. Set once the frame is known.
    away: THREE.Vector3 | null;
    // Where a shrinking part shrinks to: its middle as it stands when the flight starts (doors and drawers are open)
    pin: THREE.Vector3 | null;
  };

const OUT = 1.2; // metres a part travels while it fades

// Which way a part leaves, given the frame's bounding box
function awayOf(part: { name: string; kind: Kind; box: THREE.Box3 }, frameBox: THREE.Box3) {
  if (
    part.kind === 'frame' ||
    part.kind === 'led' ||
    part.kind === 'front' ||
    part.kind === 'handle'
  )
    return null;
  if (part.name.endsWith('BackPanel')) return new THREE.Vector3(OUT, 0, 0); // the back slides off behind
  const centre = part.box.getCenter(new THREE.Vector3());
  if (frameBox.containsPoint(centre)) return null;
  // Outside the frame (section A, the D side panel): straight out across the face it sticks out of
  const out = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    const c = centre.getComponent(i);
    out.setComponent(
      i,
      c < frameBox.min.getComponent(i) ? -1 : c > frameBox.max.getComponent(i) ? 1 : 0,
    );
  }
  return out.normalize().multiplyScalar(OUT);
}

type PartRest = {
  line: LineSegments2;
  pivot?: { name: string; position: THREE.Vector3 };
  handles: {
    name: string;
    geometry: THREE.BufferGeometry;
    position: THREE.Vector3;
    line: LineSegments2;
  }[];
};

const edgeLine = (geometry: THREE.BufferGeometry, material: LineMaterial) =>
  fatLines(new THREE.EdgesGeometry(geometry, 25).attributes.position.array, material);
const INTRO_MS = 1500;
const LABELS_S = 0.6; // seconds the anatomy labels take to draw in or out
const FLIGHT_S = 0.6; // seconds the parts take to fly off before the frame chapter, or back
const ORBIT = 0.5; // phase, rad/s
const ORBIT_REACH = 0.45; // rad to each side of the swing's middle
const ORBIT_MIDDLE = -0.3; // towards section D, where the open doors hide the drawers least
const ORBIT_RESUME_MS = 2500;
const CALM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const point = new THREE.Vector3();

// Anatomy view; the stack's middle sits this far towards the front of the model
const ANATOMY = { roll: 24, middle: -0.42 };
const DIMMED = 0.16;
const FRAME_CENTER = new THREE.Vector3(-0.265, 1.33, -1.14);
const DIVE = new THREE.Vector3(-0.235, -0.48, -0.3); // from the model's centre to the drawers of section B
const aim = new THREE.Vector3();
const boxOf = (node: THREE.Object3D) => {
  node.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(node);
};

type SceneProps = {
  progress: RefObject<HeroProgress>;
  labels: RefObject<HTMLDivElement>;
  finalText: RefObject<HTMLDivElement>;
  callouts: RefObject<HTMLDivElement>;
  hint: RefObject<HTMLDivElement>; // the length tooltip of the measured edge, styled like /pomiar's
  onCounts: (counts: number[]) => void;
  onLayer: (layer: number) => void; // the anatomy layer under the cursor, or -1
};

// Hover measuring of the closing drawing: the same red line and length tooltip as /pomiar, on the scene's own edges
const measureRay = new THREE.Raycaster();
const localRay = new THREE.Ray();
const inverse = new THREE.Matrix4();
const shifted = new THREE.Box3();
const offset = new THREE.Vector3();
const boxHit = new THREE.Vector3();
(measureRay.params as { Line2?: { threshold: number } }).Line2 = { threshold: 6 }; // px either side of an edge
const ndc = new THREE.Vector2();
const segStart = new THREE.Vector3();
const segEnd = new THREE.Vector3();

// Millimetres as /pomiar writes them: one decimal at most, Polish comma
const lengthText = (metres: number) =>
  (metres * 1000)
    .toFixed(1)
    .replace(/\.?0*$/, '')
    .replace('.', ',');

export function HomeScene({ progress, labels, finalText, callouts, hint, onCounts, onLayer }: SceneProps) {
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as Result;
  const frame = useGLTF(FRAME_GLB) as unknown as Result;
  const hardware = useGLTF(HARDWARE_GLB) as unknown as Result;
  const root = useRef<THREE.Group>(null!);
  const yawGroup = useRef<THREE.Group>(null!);
  const wraps = useRef<Record<string, THREE.Group>>({});
  const motion = useParts(root, wardrobe.scene, wardrobe.animations);
  const invalidate = useThree(s => s.invalidate);
  const look = useRef(CENTER.clone());
  const smooth = useRef(progress.current.p);
  const openNow = useRef('');
  const wires = useRef<WireMaterial[]>([]);
  const atlasReady = useRef(false);
  const started = useRef(0);
  const hovering = useRef(false);
  const orbit = useRef(0);
  const frameBakeAsked = useRef(false);
  const drawn = useRef(0); // how far the anatomy labels are drawn, 0..1
  const flight = useRef(0); // how far the non-frame parts have flown off, 0..1
  const bakeShown = useRef(false); // the frame wears its own bake
  const lit = useRef(LAYERS.map(() => 1));
  const layerUnder = useRef(-1); // -2 after the cursor was on a link: the next layer under it is reported whatever it is

  const materials = useMemo(() => {
    const kinds = Object.keys(PEN) as Kind[];
    return Object.fromEntries(
      kinds.map(kind => [
        kind,
        {
          surface: surfaceMaterial(kind === 'frame' ? frameBake : undefined),
          line: lineMaterial(PEN[kind].color, PEN[kind].width),
        },
      ]),
    ) as Record<Kind, { surface: THREE.MeshStandardMaterial; line: LineMaterial }>;
  }, []);

  const parts = useMemo(() => {
    const list: Part[] = [];
    const add = (node: THREE.Object3D) => {
      const mesh = node as THREE.Mesh;
      const kind = kindOf(mesh.name);
      const parent = mesh.parent!;
      const box = boxOf(mesh);
      const centre = box.getCenter(new THREE.Vector3()).sub(FRAME_CENTER);
      list.push({
        name: mesh.name,
        kind,
        geometry: mesh.geometry,
        base: mesh.position.clone(),
        quat: mesh.quaternion.clone(),
        // Depth grows from section A towards D. The fronts start first everywhere: grown no less than anything
        // behind them, they always stay in front, so no drawer or shelf pokes through a closed door.
        delay:
          kind === 'front'
            ? 0
            : THREE.MathUtils.clamp(
                (mesh.getWorldPosition(new THREE.Vector3()).z + 2.688) / 2.688,
                0,
                1,
              ) * 0.35,
        layer: layerOfKind(kind),
        box,
        // scripts/bake.py --frame spreads the pieces by the same factors for the frame-only bake
        apart: new THREE.Vector3(centre.x * 1.2, centre.y * 0.14, centre.z * 0.2),
        away: null,
        pin: null,
        flyDelay: THREE.MathUtils.clamp((LAYERS[layerOfKind(kind)].x + 2.2) / 3.6, 0, 1) * 0.15,
        line: edgeLine(mesh.geometry, materials[kind].line),
        pivot: parent.name.endsWith('_Pivot')
          ? { name: parent.name, position: parent.position.clone() }
          : undefined,
        handles: mesh.children
          .filter(ch => (ch as THREE.Mesh).isMesh)
          .map(ch => ({
            name: ch.name,
            geometry: (ch as THREE.Mesh).geometry,
            position: ch.position.clone(),
            line: edgeLine((ch as THREE.Mesh).geometry, materials.handle.line),
          })),
      });
    };
    Object.values(wardrobe.nodes).forEach(node => {
      if ((node as THREE.Mesh).isMesh && node.parent?.type !== 'Mesh') add(node);
    });
    FRAME_PIECES.forEach(name => add(frame.nodes[name]));
    const frameBox = list
      .filter(p => p.kind === 'frame')
      .reduce((box, p) => box.union(p.box), new THREE.Box3());
    list.forEach(p => (p.away = awayOf(p, frameBox)));
    return list;
  }, [wardrobe, frame, materials]);

  const draft = useMemo(() => {
    const wall = lineMaterial(INK, 0.9);
    const floor = lineMaterial(INK, 0.9);
    return {
      wall,
      floor,
      wallLines: fatLines(WALL_SEGMENTS, wall),
      floorLines: fatLines(FLOOR_SEGMENTS, floor),
    };
  }, []);

  const surfaces = useMemo(() => Object.values(materials).map(m => m.surface), [materials]);
  // Top to bottom, the order they slide out in
  const drawers = useMemo(
    () =>
      parts
        .filter(p => p.kind === 'drawer' && p.name.includes('_B_'))
        .sort((a, b) => b.box.max.y - a.box.max.y)
        .map(p => p.name),
    [parts],
  );

  // Part names to their anatomy layer, for pointing at the model; a handle is found through the front it hangs on
  const layerOfPart = useMemo(() => new Map(parts.map(part => [part.name, part.layer])), [parts]);

  // Hinges, dowels and mount blocks appear only in the anatomy: outlines merged per layer, closed-door poses
  const hardwareLayers = useMemo(() => {
    const collected = [layerIndex('hinges'), layerIndex('dowels')].map(layer => ({
      layer,
      material: lineMaterial(INK, 0.8),
      positions: [] as number[],
      boxes: [] as THREE.Box3[],
    }));
    const edges = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
    hardware.scene.updateMatrixWorld(true);
    hardware.scene.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || /^(PIN|DW)_/.test(mesh.name)) return; // shelf pins and interior dowels live on /okucia, not in the anatomy
      const target = collected[mesh.name.startsWith('H') ? 0 : 1];
      const outline =
        edges.get(mesh.geometry) ??
        edges.set(mesh.geometry, new THREE.EdgesGeometry(mesh.geometry, 25)).get(mesh.geometry)!;
      target.positions.push(
        ...outline.clone().applyMatrix4(mesh.matrixWorld).attributes.position.array,
      );
      target.boxes.push(boxOf(mesh));
    });
    return collected.map(({ layer, material, positions, boxes }) => ({
      layer,
      material,
      boxes,
      line: fatLines(positions, material),
    }));
  }, [hardware]);

  // A line lands on a real element: the point of any element in its layer closest to the layer's `at` spot
  // Dowels of the frame chapter. Each stays on the axis of its hole in the piece whose end it goes into (the host longest
  // along the dowel) and waits just outside that hole, on the side of the piece it joins, so it is never inside either.
  const dowels = useMemo(() => {
    const pieces = parts.filter(p => p.kind === 'frame');
    const list: {
      name: string;
      geometry: THREE.BufferGeometry;
      matrix: THREE.Matrix4;
      apart: THREE.Vector3;
    }[] = [];
    hardware.scene.updateMatrixWorld(true);
    hardware.scene.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !/^J\d\d_/.test(mesh.name)) return;
      const box = boxOf(mesh);
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
      const hosts = pieces.filter(p => p.box.clone().expandByScalar(0.005).containsPoint(centre));
      const apart = new THREE.Vector3();
      if (hosts.length) {
        const extent = (p: Part) => p.box.max[axis] - p.box.min[axis];
        const anchor = hosts.reduce((a, b) => (extent(b) > extent(a) ? b : a));
        const others = hosts.filter(p => p !== anchor);
        const otherCentre =
          others.reduce((sum, p) => sum + p.box.getCenter(new THREE.Vector3())[axis], 0) /
          Math.max(1, others.length);
        const towards =
          Math.sign(otherCentre - anchor.box.getCenter(new THREE.Vector3())[axis]) || 1;
        apart.copy(anchor.apart);
        // From the anchor's box, not the dowel's middle: a mitred end reaches past the hole
        apart[axis] +=
          towards > 0
            ? anchor.box.max[axis] + DOWEL_CLEARANCE - box.min[axis]
            : anchor.box.min[axis] - DOWEL_CLEARANCE - box.max[axis];
      }
      list.push({
        name: mesh.name,
        geometry: mesh.geometry,
        matrix: mesh.matrixWorld.clone(),
        apart,
      });
    });
    return list;
  }, [parts, hardware]);
  const dowelMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: DOWEL, roughness: 0.8, transparent: true }),
    [],
  );
  const dowelGroups = useRef<THREE.Group[]>([]);

  const measure = useMemo(() => {
    const redMaterial = new LineMaterial({
      color: new THREE.Color(LED).getHex(), // gold, in the home page's own accent rather than /pomiar's red
      linewidth: 2.5,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    });
    const red = new LineSegments2(
      new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 0, 0]),
      redMaterial,
    );
    red.renderOrder = 1000;
    red.visible = false;
    red.raycast = () => {};
    const glow = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: INK,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    glow.matrixAutoUpdate = false;
    glow.visible = false;
    glow.raycast = () => {};
    const lines = parts.flatMap(p => [p.line, ...p.handles.map(h => h.line)]);
    return { red, redMaterial, glow, lines, edge: '' };
  }, [parts]);

  const anchors = useMemo(
    () =>
      LAYERS.map((layer, i) => {
        const boxes = [
          ...parts.filter(p => p.layer === i).map(p => p.box),
          ...hardwareLayers.filter(h => h.layer === i).flatMap(h => h.boxes),
        ];
        const all = boxes.reduce((sum, box) => sum.union(box), new THREE.Box3());
        const [u, v] = layer.at;
        const spot = new THREE.Vector3(
          (all.min.x + all.max.x) / 2,
          THREE.MathUtils.lerp(all.min.y, all.max.y, v),
          THREE.MathUtils.lerp(all.min.z, all.max.z, u),
        );
        const onElement = (box: THREE.Box3) => box.clampPoint(spot, new THREE.Vector3());
        return boxes
          .map(onElement)
          .reduce((best, candidate) =>
            candidate.distanceToSquared(spot) < best.distanceToSquared(spot) ? candidate : best,
          );
      }),
    [parts, hardwareLayers],
  );

  useLayoutEffect(() => {
    const hinges = new Set<string>();
    let fixings = 0;
    hardware.scene.traverse(node => {
      if (!(node as THREE.Mesh).isMesh || /^(PIN|DW)_/.test(node.name)) return;
      if (node.name.startsWith('H')) hinges.add(node.name.slice(0, 3));
      else fixings++;
    });
    onCounts(
      LAYERS.map((layer, i) => {
        if (layer.id === 'hinges') return hinges.size;
        if (layer.id === 'dowels') return fixings;
        return parts.filter(p => p.layer === i).reduce((sum, p) => sum + 1 + p.handles.length, 0);
      }),
    );
  }, [parts, hardware, onCounts]);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const target = event.nativeEvent.target as HTMLElement;
    if (
      progress.current.p < LIVE_FROM ||
      progress.current.p > 1 ||
      event.delta > 6 ||
      target.closest('a, button')
    )
      return;
    if (motion.toggle(event.eventObject.name)) event.stopPropagation();
  };

  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const goal = progress.current.p;
    const { width, height } = state.size;
    let moving = false;

    // Reduced motion: the scene follows the scroll exactly, without easing after it
    if (CALM || Math.abs(goal - smooth.current) < 1e-4) smooth.current = goal;
    else {
      smooth.current += (goal - smooth.current) * damp(7, dt);
      moving = true;
    }
    const p = smooth.current;
    const s = stateAt(p);

    // The drawing rises from the floor when the page opens
    const now = performance.now();
    started.current ||= now;
    const intro = CALM ? 1 : Math.min(1, (now - started.current) / INTRO_MS);
    if (intro < 1) moving = true;
    uniforms.uDrawY.value = -0.4 + smoothstep(0, 1, intro) * 3.8;
    uniforms.uRadius.value = atlasReady.current ? s.wipe * (1 - s.dark) * 3.6 - 0.3 : -1;

    // Loaded and on the GPU from the start, so swapping it in later costs no frame
    if (!frameBakeAsked.current) {
      frameBakeAsked.current = true;
      new THREE.TextureLoader().load(FRAME_ATLAS, texture => {
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 16;
        state.gl.initTexture(texture);
        frameBake.uAlt.value = texture;
        invalidate();
      });
    }
    // The frame's own bake cuts in where the pieces start to part and stays, both ways, until the wardrobe is whole
    // again, every other part back, so the atlas's dark joint bands never show on a bare frame.
    bakeShown.current = frameBakeOn(p) || (bakeShown.current && flight.current > 0);
    frameBake.uAltMix.value = frameBake.uAlt.value && bakeShown.current ? 1 : 0;

    // Applied only when the scroll position asks for a change, so clicks on the finished wardrobe stay
    const open = [...(doorsOpen(p) ? B_DOORS : []), ...drawers.slice(0, drawersOpen(p))];
    if (open.join() !== openNow.current) {
      openNow.current = open.join();
      motion.openOnly(open);
    }

    // Outer layers leave first, so nothing passes through what is still in place
    const parted = LAYERS.map(
      layer => smoothstep(0, 1, (s.explode - (1 - Math.abs(layer.x) / 2.2) * 0.3) / 0.7) * layer.x,
    );
    const active = progress.current.active;
    lit.current = lit.current.map((value, i) => {
      const target = active < 0 || active === i ? 1 : DIMMED;
      if (Math.abs(target - value) < 1e-3) return target;
      moving = true;
      return value + (target - value) * damp(20, dt);
    });

    // Leaving the drawers for the frame, every other part flies off; once started it finishes on its own clock
    const strip = stripped(p) ? 1 : 0;
    if (flight.current !== strip) {
      const step = Math.min(dt, 0.05) / FLIGHT_S;
      flight.current = CALM
        ? strip
        : strip
          ? Math.min(1, flight.current + step)
          : Math.max(0, flight.current - step);
      moving = true;
    }

    for (const part of parts) {
      const wrap = wraps.current[part.name];
      if (!wrap) continue;
      const k = THREE.MathUtils.clamp((s.extrude - part.delay) / 0.65, 0, 1);
      // Never quite flat: the parts keep their depth order
      wrap.scale.x = 0.02 + 0.98 * k * k * (3 - 2 * k);
      wrap.position.x = parted[part.layer] + (part.kind === 'front' ? (1 - s.fronts) * -0.5 : 0);
      if (part.kind === 'frame') {
        wrap.position.x += part.apart.x * s.apart;
        wrap.position.y = part.apart.y * s.apart;
        wrap.position.z = part.apart.z * s.apart;
      } else if (part.kind !== 'led') {
        const t = THREE.MathUtils.clamp((flight.current - part.flyDelay) / 0.55, 0, 1);
        if (t <= 0) {
          wrap.scale.y = wrap.scale.z = 1;
          wrap.position.y = wrap.position.z = 0;
          part.pin = null;
        } else if (part.away) {
          // Straight out, speeding up
          const out = t * t;
          wrap.position.x += part.away.x * out;
          wrap.position.y = part.away.y * out;
          wrap.position.z = part.away.z * out;
        } else {
          // Shrinks to nothing about its own middle, measured as it stands, open doors and drawers included
          if (!part.pin) {
            wrap.scale.set(1, 1, 1);
            part.pin = new THREE.Box3().setFromObject(wrap).getCenter(new THREE.Vector3());
          }
          const size = Math.max(1e-3, 1 - t * (2 - t));
          wrap.scale.set(size, size, size);
          wrap.position.x += part.pin.x * (1 - size);
          wrap.position.y = part.pin.y * (1 - size);
          wrap.position.z = part.pin.z * (1 - size);
        }
      }
    }

    dowelMaterial.opacity = s.apart;
    dowelMaterial.visible = s.apart > 0.01;
    dowels.forEach((dowel, i) =>
      dowelGroups.current[i]?.position.copy(dowel.apart).multiplyScalar(s.apart),
    );

    wires.current.forEach(material => {
      material.visible = s.wires > 0.01;
      material.uniforms.uOpacity.value = s.wires;
      material.uniforms.uGlow.value = CALM ? 0 : s.wires;
      material.uniforms.uTime.value = now / 1000;
    });
    if (s.wires > 0.01 && !CALM) moving = true; // current keeps running along the cables

    for (const { layer, line, material } of hardwareLayers) {
      line.position.x = parted[layer];
      material.opacity = smoothstep(0, 0.35, s.explode) * lit.current[layer];
      material.linewidth = 0.8 * state.viewport.dpr;
      line.visible = material.opacity > 0.01;
    }

    (Object.keys(materials) as Kind[]).forEach(kind => {
      const { surface, line } = materials[kind];
      const alpha =
        (kind === 'front' || kind === 'handle' ? s.fronts : 1) *
        (kind === 'frame' ? 1 : kind === 'led' ? s.led : 1 - smoothstep(0.1, 0.55, flight.current));
      surface.opacity = alpha;
      surface.visible = alpha > 0.01;
      surface.depthWrite = alpha > 0.98;
      line.opacity = alpha * lit.current[layerOfKind(kind)] * (kind === 'frame' ? s.frameInk : 1);
      line.visible = line.opacity > 0.01;
      line.linewidth =
        (PEN[kind].width + (kind === 'led' ? 1.8 * s.wires : 0)) * state.viewport.dpr;
    });
    draft.wall.opacity = s.dims * 0.75;
    draft.wall.linewidth = 0.9 * state.viewport.dpr;
    draft.floor.opacity = s.floor * 0.75;
    draft.floor.linewidth = 0.9 * state.viewport.dpr;
    gridMaterial.uniforms.uAlpha.value = s.grid;

    const g = yawGroup.current;
    // The finished wardrobe orbits by itself until the cursor is on it or someone drags it; across the front only, it stands against a wall
    if (
      p > 0.99 &&
      p < 1.01 &&
      !CALM &&
      !hovering.current &&
      now - progress.current.touched > ORBIT_RESUME_MS
    ) {
      orbit.current += ORBIT * Math.min(dt, 0.1);
      progress.current.yaw +=
        (Math.sin(orbit.current) * ORBIT_REACH + ORBIT_MIDDLE - progress.current.yaw) *
        damp(1.2, dt);
      moving = true;
    }
    const turned =
      progress.current.yaw * smoothstep(LIVE_FROM - 0.05, 1, p) * (1 - s.unturn) +
      (THREE.MathUtils.degToRad(s.frameSpin) + progress.current.frameYaw) * s.apart;
    if (Math.abs(turned - g.rotation.y) < 1e-4) g.rotation.y = turned;
    else {
      g.rotation.y += (turned - g.rotation.y) * damp(6, dt);
      moving = true;
    }

    // Dolly zoom: the distance follows the fov, so the model keeps its size while perspective opens
    camera.fov = s.fov;
    const narrow = width < 768 || camera.aspect < 0.9;
    // The finished view fits the band between the nav and the copy; its box leaves room for the open doors in a full turn
    const top = narrow ? 64 : 88;
    const bottom = (finalText.current?.offsetTop ?? height) - 16;
    const drawing = fitDistance(camera, 1.35, 1.33, narrow ? 0.7 : 0.58, narrow ? 0.44 : 0.62);
    const finished = fitDistance(camera, 1.6, 1.6, narrow ? 0.94 : 0.8, (bottom - top) / height);
    const stack = fitDistance(camera, 3, 2.3, narrow ? 0.92 : 0.62, narrow ? 0.5 : 0.86);
    const lerp = THREE.MathUtils.lerp;
    const dist = lerp(lerp(drawing, finished, s.settle) * s.dist, stack, s.pose);
    const shiftY = lerp(
      lerp(narrow ? -0.14 : 0.04, (top + bottom) / 2 / height - 0.5, s.settle),
      narrow ? -0.12 : 0,
      s.pose,
    );
    aim.copy(CENTER);
    aim.x += ANATOMY.middle * s.pose;
    aim.addScaledVector(DIVE, s.dive);
    // None on the flat drawing at both ends, whose near-orthographic view would lose its elevation
    const sway = drift(state.clock.elapsedTime);
    const swayWeight = sway ? smoothstep(3, 30, s.fov) : 0;
    if (swayWeight > 0) moving = true;
    moveCamera(
      camera,
      look.current,
      aim,
      {
        az: s.az + s.spin * s.pose + (sway?.az ?? 0) * swayWeight,
        el: s.el + (sway?.el ?? 0) * swayWeight,
        dist,
        ty: 0,
      },
      dt,
      true,
    );
    camera.rotateZ(THREE.MathUtils.degToRad(ANATOMY.roll * s.pose));
    camera.near = Math.max(0.1, dist - 5);
    camera.far = dist + 9;
    camera.setViewOffset(
      width,
      height,
      narrow ? 0 : -s.shiftX * width,
      -shiftY * height,
      width,
      height,
    );
    camera.updateMatrixWorld();

    DRAFT_LABELS.forEach((label, i) => {
      const el = labels.current?.children[i] as HTMLElement | undefined;
      if (!el) return;
      point.set(...label.at).project(camera);
      el.style.transform = `translate(${((point.x + 1) / 2) * width}px, ${((1 - point.y) / 2) * height}px) translate(-50%, -50%)`;
      el.style.opacity = String(s[label.layer] * smoothstep(0.6, 1, intro));
    });

    // Once the labels start drawing or retracting they finish on their own clock, whatever the scroll does next
    const wanted = s.labels > 0.5 ? 1 : 0;
    if (drawn.current !== wanted) {
      const step = Math.min(dt, 0.05) / LABELS_S;
      drawn.current = CALM
        ? wanted
        : wanted
          ? Math.min(1, drawn.current + step)
          : Math.max(0, drawn.current - step);
      moving = true;
    }
    const box = callouts.current;
    if (box) {
      box.style.opacity = String(Math.min(1, drawn.current * 3));
      box.style.visibility = drawn.current > 0 ? 'visible' : 'hidden';
    }

    // Each label's line: along its row, then 45 degrees down to the layer
    if (box && drawn.current > 0) {
      const origin = box.getBoundingClientRect();
      LAYERS.forEach((layer, i) => {
        const li = box.querySelector<HTMLElement>(`li[data-i="${i}"]`);
        const g = box.querySelector<SVGGElement>(`g[data-i="${i}"]`);
        if (!li || !g) return;
        point.copy(anchors[i]);
        point.x += parted[i];
        point.project(camera);
        const x = ((point.x + 1) / 2) * width;
        const y = ((1 - point.y) / 2) * height;
        const row = li.getBoundingClientRect();
        const rowY = row.top + row.height / 2 - origin.top;
        const right = layer.side === 'right';
        const startX = right ? row.left - origin.left - 10 : row.right - origin.left + 10;
        const run = Math.abs(rowY - y) * (right ? 1 : -1);
        const elbow = right ? Math.min(startX, x + run) : Math.max(startX, x + run);
        const line = g.children[0] as SVGPolylineElement;
        line.setAttribute('points', `${startX},${rowY} ${elbow},${rowY} ${x},${y}`);
        line.style.strokeDashoffset = String(1 - smoothstep(i * 0.06, 1, drawn.current));
        g.children[1].setAttribute('cx', String(x));
        g.children[1].setAttribute('cy', String(y));
      });
    }

    // Measuring: the part under the cursor lights up, the edge nearest the cursor gets the red line and its length
    let hovered: THREE.Object3D | null = null;
    let edge: { line: LineSegments2; index: number } | null = null;
    const at = progress.current.pointer;
    if (measuring(p) && at && root.current) {
      const rect = state.gl.domElement.getBoundingClientRect();
      ndc.set(
        ((at.x - rect.left) / rect.width) * 2 - 1,
        -((at.y - rect.top) / rect.height) * 2 + 1,
      );
      measureRay.setFromCamera(ndc, camera);
      const face = measureRay
        .intersectObject(root.current, true)
        .find(
          h =>
            (h.object as THREE.Mesh).isMesh &&
            ((h.object as THREE.Mesh).material as THREE.Material).visible,
        );
      const hits: THREE.Intersection[] = [];
      // A kind faded out (the fronts in this drawing) hides its material, not its line objects
      measure.lines.forEach(
        line =>
          line.visible &&
          line.material.visible &&
          LineSegments2.prototype.raycast.call(line, measureRay, hits),
      );
      // An edge counts only where no surface covers it, as on /pomiar
      const top = hits
        // 3 mm: the shelves stand 2 to 20 mm behind the doors, and only edges on the front face itself may pass
        .filter(h => !face || h.distance <= face.distance + 0.003)
        .sort((a, b) => a.distance - b.distance)[0];
      if (top) edge = { line: top.object as LineSegments2, index: top.faceIndex! };
      hovered = edge ? edge.line.parent : (face?.object ?? null);
    }
    progress.current.hover = hovered?.name ?? null;

    const { glow, red, redMaterial } = measure;
    glow.visible = !!hovered;
    if (hovered) {
      glow.geometry = (hovered as THREE.Mesh).geometry;
      glow.matrix.copy(hovered.matrixWorld);
    }
    red.visible = !!edge;
    const tip = hint.current;
    if (edge) {
      const geometry = edge.line.geometry as LineSegmentsGeometry;
      segStart.fromBufferAttribute(
        geometry.attributes.instanceStart as THREE.BufferAttribute,
        edge.index,
      );
      segEnd.fromBufferAttribute(
        geometry.attributes.instanceEnd as THREE.BufferAttribute,
        edge.index,
      );
      const metres = segStart.distanceTo(segEnd);
      segStart.applyMatrix4(edge.line.matrixWorld);
      segEnd.applyMatrix4(edge.line.matrixWorld);
      const key = `${edge.line.id}:${edge.index}`;
      if (key !== measure.edge) {
        measure.edge = key;
        red.geometry.setPositions([
          segStart.x,
          segStart.y,
          segStart.z,
          segEnd.x,
          segEnd.y,
          segEnd.z,
        ]);
        if (tip) {
          tip.querySelector(`.${hintStyles.value}`)!.textContent = lengthText(metres);
          const d = segEnd.clone().sub(segStart);
          tip.classList.toggle(
            hintStyles.vertical,
            Math.abs(d.y) > Math.abs(d.x) && Math.abs(d.y) > Math.abs(d.z),
          );
        }
      }
      redMaterial.linewidth = 2.5 * state.viewport.dpr;
      if (tip) {
        point.copy(segStart).add(segEnd).multiplyScalar(0.5).project(camera);
        tip.style.transform = `translate(${((point.x + 1) / 2) * width}px, ${((1 - point.y) / 2) * height}px) translate(-50%, -50%)`;
      }
    } else measure.edge = '';
    tip?.classList.toggle(hintStyles.hidden, !edge);

    // Anatomy: the layer under the cursor lights its label and line, as pointing at the label does
    if (progress.current.overLink) layerUnder.current = -2;
    else {
      let under = -1;
      if (drawn.current > 0.5 && at && root.current) {
        const rect = state.gl.domElement.getBoundingClientRect();
        ndc.set(((at.x - rect.left) / rect.width) * 2 - 1, -((at.y - rect.top) / rect.height) * 2 + 1);
        measureRay.setFromCamera(ndc, camera);
        let nearest = Infinity;
        for (const hit of measureRay.intersectObject(root.current, true)) {
          let node: THREE.Object3D | null = hit.object;
          while (node && !layerOfPart.has(node.name)) node = node.parent;
          if (!node) continue;
          under = layerOfPart.get(node.name)!;
          nearest = hit.distance;
          break;
        }
        // Hinges and dowels are drawn as merged outlines, so their boxes stand in for them
        localRay.copy(measureRay.ray).applyMatrix4(inverse.copy(root.current.matrixWorld).invert());
        for (const { layer, boxes } of hardwareLayers) {
          for (const box of boxes) {
            shifted.copy(box).translate(offset.set(parted[layer], 0, 0));
            if (localRay.intersectBox(shifted, boxHit) && boxHit.distanceTo(localRay.origin) < nearest) {
              nearest = boxHit.distanceTo(localRay.origin);
              under = layer;
            }
          }
        }
      }
      if (under !== layerUnder.current) {
        layerUnder.current = under;
        onLayer(under);
      }
    }

    if (moving) invalidate();
  });

  const pivot = CENTER.clone().negate().setY(0);

  return (
    <>
      <ambientLight intensity={10} />
      <primitive object={measure.glow} />
      <primitive object={measure.red} />
      <pointLight position={[-2, 2.2, 1]} intensity={10} />

      <mesh
        material={gridMaterial}
        position={[0.004, CENTER.y, CENTER.z]}
        rotation={[0, Math.PI / 2, 0]}
        renderOrder={-1}
        raycast={() => null}
      >
        <planeGeometry args={[16, 11]} />
      </mesh>
      <primitive object={draft.wallLines} />
      <primitive object={draft.floorLines} />

      <Suspense fallback={null}>
        <Atlas surfaces={surfaces} ready={atlasReady} />
      </Suspense>

      <group
        ref={yawGroup}
        position={[CENTER.x, 0, CENTER.z]}
        onPointerOver={event => void (event.pointerType === 'mouse' && (hovering.current = true))}
        onPointerOut={() => void (hovering.current = false)}
      >
        <group position={pivot}>
          <group ref={root}>
            {dowels.map((dowel, i) => (
              <group key={dowel.name} ref={g => void (g && (dowelGroups.current[i] = g))}>
                <mesh
                  geometry={dowel.geometry}
                  material={dowelMaterial}
                  matrix={dowel.matrix}
                  matrixAutoUpdate={false}
                  raycast={() => null}
                />
              </group>
            ))}
            {hardwareLayers.map(h => (
              <primitive key={h.layer} object={h.line} />
            ))}
            <Suspense fallback={null}>
              <Wires materials={wires} />
            </Suspense>
            {parts.map(part => {
              const { surface } = materials[part.kind];
              const mesh = (
                <mesh
                  name={part.name}
                  geometry={part.geometry}
                  material={surface}
                  position={part.base}
                  quaternion={part.quat}
                  onClick={DOORS[part.name] || part.kind === 'drawer' ? onClick : undefined}
                >
                  <primitive object={part.line} />
                  {part.handles.map(h => (
                    <mesh
                      key={h.name}
                      name={h.name}
                      geometry={h.geometry}
                      material={materials.handle.surface}
                      position={h.position}
                    >
                      <primitive object={h.line} />
                    </mesh>
                  ))}
                </mesh>
              );
              return (
                <group key={part.name} ref={g => void (g && (wraps.current[part.name] = g))}>
                  {part.pivot ? (
                    <group name={part.pivot.name} position={part.pivot.position}>
                      {mesh}
                    </group>
                  ) : part.kind === 'drawer' ? (
                    <group name={slideName(part.name)}>{mesh}</group>
                  ) : (
                    mesh
                  )}
                </group>
              );
            })}
          </group>
        </group>
      </group>
    </>
  );
}
