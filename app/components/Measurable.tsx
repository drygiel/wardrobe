import * as THREE from 'three';
import { type ComponentRef, type ReactNode, type Ref, useEffect, useRef } from 'react';
import { Line } from '@react-three/drei';
import { type ThreeElements, useFrame, useThree } from '@react-three/fiber';
import { cameraRaycast, type LineData } from './Mesh';
import { useApp } from '@/contexts/AppContext';
import { useEventListener } from '@/hooks/useEventListener';
import { LineHint } from '@/components/LineHint';
import { isShown } from '@/xr/placement';

// One array for every render: drei rebuilds the line's geometry whenever `points` changes identity,
// which threw away the edge set by showRedLine and left a dot at the part's origin
const NO_POINTS = [0, 0, 0, 0, 0, 0];
const NO_TICKS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const TICK_PX = 7; // half the length of an end tick on screen

type Props = Omit<ThreeElements['group'], 'ref'> & { ref?: Ref<THREE.Group>; children: ReactNode };

// Hover measuring shared by every model: raycasts edge lines on layer 1 and shows the red line with its length
export function Measurable({ ref, children, ...props }: Props) {
  // The measured edge: solid where it is in sight, dotted where a part covers it, with a skew tick at each end
  const redRef = useRef<THREE.Group>(null!);
  const lineRef = useRef<ComponentRef<typeof Line>>(null!);
  const hiddenRef = useRef<ComponentRef<typeof Line>>(null!);
  const ticksRef = useRef<ComponentRef<typeof Line>>(null!);
  const ends = useRef<[THREE.Vector3, THREE.Vector3] | null>(null);
  const sceneGroup = useRef<THREE.Group>(null!);
  const lineGroup = useRef<THREE.Group>(null!);
  const pointerPos = useRef<THREE.Vector2>(new THREE.Vector2());
  const { wireframe, line, inspect, showEdge } = useApp();

  const isLMBPressed = useRef(false);

  // An edge chosen outside the canvas; the hover loop below sleeps while the pointer is away
  useEffect(() => {
    showEdge.current = edge => {
      line.current = edge;
      if (edge) showRedLine(edge);
      else redRef.current.visible = false;
    };
    return () => {
      showEdge.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEventListener('pointerdown', () => (isLMBPressed.current = true));
  useEventListener('pointerup', () => (isLMBPressed.current = false));

  const { pointer, raycaster, camera, size } = useThree();

  useFrame(() => {
    if (isLMBPressed.current) return;
    if (!lineGroup.current || !lineRef.current || !sceneGroup.current) return;
    if (pointerPos.current.equals(pointer)) return;
    pointerPos.current.copy(pointer);

    if (!wireframe) {
      line.current = null;
      inspect.current?.(null);
      return;
    }

    raycaster.layers.set(1);
    raycaster.firstHitOnly = true;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(sceneGroup.current, true);
    raycaster.layers.set(0);

    const hit = intersects.find(i => i.object.name.startsWith('line'));
    const lineData = hit && (hit.object.userData.lines as LineData[])[hit.faceIndex!];

    if (inspect.current) {
      const faces = raycaster.intersectObject(sceneGroup.current, true).filter(i => (i.object as THREE.Mesh).isMesh && isShown(i.object));
      // Overlays are drawn over everything, so they win; otherwise an edge counts only when no surface covers it
      const face = faces.find(i => i.object.userData.overlay) ?? faces[0];
      const edgeOnTop = lineData && (!face || (!face.object.userData.overlay && hit.distance <= face.distance + 0.01));
      const picked = edgeOnTop ? lineData.meshRef.current : ((face?.object as THREE.Mesh) ?? null);
      inspect.current(picked, lineData ?? null);
    }

    if (!lineData) {
      const onBlur = line.current?.onBlur;
      line.current = null;
      redRef.current.visible = false;
      onBlur?.();
      return;
    }

    if (line.current === lineData) return;

    line.current?.onBlur();
    line.current = lineData;
    showRedLine(lineData);
    if (!inspect.current) line.current.onHover(); // the inspector brightens the whole part itself, this would darken it
  });

  const showRedLine = ({ meshRef, points }: LineData) => {
    redRef.current.position.copy(meshRef.current.position);
    redRef.current.rotation.copy(meshRef.current.rotation);
    const positions = points.map(p => [p.x, p.y, p.z]).flat();
    lineRef.current.geometry.setPositions(positions);
    hiddenRef.current.geometry.setPositions(positions);
    hiddenRef.current.computeLineDistances(); // the dashes are laid out along these
    ends.current = [points[0], points[1]];

    // The mesh's parent (a door's pivot, a handle's door) relative to the scene group places the line
    new THREE.Matrix4()
      .copy(sceneGroup.current.matrixWorld)
      .invert()
      .multiply(meshRef.current.parent!.matrixWorld)
      .decompose(lineGroup.current.position, lineGroup.current.quaternion, lineGroup.current.scale);
    redRef.current.visible = true;
    placeTicks();
  };

  // Ticks like on a dimension line: 45° across each end, facing the camera and the same size on screen at any distance
  const placeTicks = () => {
    if (!ends.current || !redRef.current.visible) return;
    const [from, to] = ends.current;
    redRef.current.updateWorldMatrix(true, false);
    const eye = redRef.current.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
    const along = to.clone().sub(from).normalize();
    const middle = from.clone().add(to).multiplyScalar(0.5);
    const across = new THREE.Vector3().crossVectors(along, eye.clone().sub(middle)).normalize();
    const ortho = camera as THREE.OrthographicCamera;
    const perspective = camera as THREE.PerspectiveCamera;
    const metresPerPixel = ortho.isOrthographicCamera
      ? (ortho.top - ortho.bottom) / ortho.zoom / size.height
      : (2 * eye.distanceTo(middle) * Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2)) / perspective.zoom / size.height;
    const half = along.add(across).normalize().multiplyScalar(TICK_PX * metresPerPixel);
    ticksRef.current.geometry.setPositions(
      [from, to].flatMap(end => [end.x - half.x, end.y - half.y, end.z - half.z, end.x + half.x, end.y + half.y, end.z + half.z]),
    );
  };

  // Runs after the hover loop above: the ticks follow the camera
  useFrame(placeTicks);

  return (
    <group {...props} dispose={null}>
      <group ref={lineGroup}>
        <LineHint />
        <group ref={redRef} visible={wireframe}>
          {/* The part in sight. renderOrder sorts only within a queue, and three draws all opaque objects before
              transparent ones: `transparent` keeps the outlines and faces of see-through parts from landing on top.
              polygonOffset lifts the line off the faces its own edge lies on. */}
          <Line ref={lineRef} points={NO_POINTS} lineWidth={2.5} raycast={cameraRaycast} color="red" renderOrder={1000} transparent polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
          {/* The part behind something: the same line, dotted, drawn only where the depth test fails */}
          <Line
            ref={hiddenRef}
            points={NO_POINTS}
            lineWidth={2}
            raycast={cameraRaycast}
            color="red"
            renderOrder={1000}
            transparent
            dashed
            dashSize={0.012}
            gapSize={0.012}
            depthFunc={THREE.GreaterDepth}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
          <Line ref={ticksRef} segments points={NO_TICKS} lineWidth={2} raycast={cameraRaycast} color="red" renderOrder={1000} transparent depthTest={false} />
        </group>
      </group>

      <group
        ref={node => {
          sceneGroup.current = node!;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        name="Scene"
      >
        {children}
      </group>
    </group>
  );
}
