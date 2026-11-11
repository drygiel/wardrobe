import * as THREE from 'three';
import { useEffect, useMemo, useState } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { useXR, useXRInputSourceState, XRSpace } from '@react-three/xr';
import { useApp } from '@/contexts/AppContext';
import { useCatalog } from '@/editor/catalog';
import { inUnit, partLabel } from '@/editor/labels';
import { useSelection } from '@/editor/selection';
import type { SnapStatus } from './placement';

const WIDTH = 1024;
const HEIGHT = 800;
const METRES_WIDE = 0.34;
const GUTTER = 32;
const ROW = 84;
const GAP = 12;
const ROWS_TOP = 176;

const INK = '#e4e1da';
const PAPER = '#161412';
const LINE = '#3a3631';
const HOVER = '#2a2622';
const MUTED = '#a39d92';
const ACCENT = '#f0b35a';

type Button = { id: string; label: string; on?: boolean; action: () => void };
type Laid = Button & { x: number; y: number; w: number; h: number };

const layout = (rows: Button[][]): Laid[] =>
  rows.flatMap((row, r) => {
    const w = (WIDTH - GUTTER * 2 - GAP * (row.length - 1)) / row.length;
    return row.map((button, c) => ({ ...button, x: GUTTER + c * (w + GAP), y: ROWS_TOP + r * (ROW + GAP), w, h: ROW }));
  });

type Text = { title: string; detail: string; status: string; statusAccent: boolean };

function draw(context: CanvasRenderingContext2D, buttons: Laid[], hovered: string | null, text: Text) {
  context.fillStyle = PAPER;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textBaseline = 'middle';
  context.textAlign = 'left';

  context.fillStyle = INK;
  context.font = '500 46px Erode, serif';
  context.fillText(text.title, GUTTER, 48, WIDTH - GUTTER * 2);
  context.fillStyle = MUTED;
  context.font = '400 30px Switzer, sans-serif';
  context.fillText(text.detail, GUTTER, 100, WIDTH - GUTTER * 2);
  context.fillStyle = text.statusAccent ? ACCENT : MUTED;
  context.font = '500 30px Switzer, sans-serif';
  context.fillText(text.status, GUTTER, 142, WIDTH - GUTTER * 2);

  context.textAlign = 'center';
  context.font = '500 32px Switzer, sans-serif';
  for (const { id, label, on, x, y, w, h } of buttons) {
    context.fillStyle = on ? INK : id === hovered ? HOVER : PAPER;
    context.fillRect(x, y, w, h);
    context.strokeStyle = id === hovered ? ACCENT : LINE;
    context.lineWidth = 3;
    context.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    context.fillStyle = on ? PAPER : INK;
    context.fillText(label, x + w / 2, y + h / 2, w - 24);
  }

  context.textAlign = 'left';
  context.fillStyle = MUTED;
  context.font = '400 26px Switzer, sans-serif';
  context.fillText('Lewa gałka: przesuwa szafę. Prawa gałka: obraca.', GUTTER, HEIGHT - 102, WIDTH - GUTTER * 2);
  context.fillText('Grip: przesuń ręką. Oba gripy: obróć jak kierownicą.', GUTTER, HEIGHT - 66, WIDTH - GUTTER * 2);
  context.fillText('Spust: przyciski, drzwi i szuflady. W pomiarze wskaż krawędź, spust przypina.', GUTTER, HEIGHT - 30, WIDTH - GUTTER * 2);
}

const STATUS: Record<SnapStatus, string> = { free: '', wall: 'Przy ścianie', corner: 'W narożniku' };

type Props = {
  snap: boolean;
  setSnap: (on: boolean) => void;
  status: SnapStatus;
  wallCount: number;
  reset: () => void;
  night: boolean;
  setNight: (on: boolean) => void;
  brightness: number;
  stepBrightness: (steps: number) => void;
};

// One canvas on one quad: the menu costs a single draw call, and it can use the site's fonts and Polish glyphs as they are
export function XRPanel(props: Props) {
  const left = useXRInputSourceState('controller', 'left');
  const space = left?.inputSource.gripSpace;
  // Above the left hand and tilted to the face, clear of that controller's own ray
  return space ? (
    <XRSpace space={space}>
      <group position={[0, 0.17, 0.02]} rotation={[-0.5, 0, 0]}>
        <Panel {...props} />
      </group>
    </XRSpace>
  ) : null;
}

function Panel({ snap, setSnap, status, wallCount, reset, night, setNight, brightness, stepBrightness }: Props) {
  const app = useApp();
  const catalog = useCatalog();
  const session = useXR(xr => xr.session);
  const ar = useXR(xr => xr.mode === 'immersive-ar');
  const { hover, pinned, edge } = useSelection();
  const [hovered, setHovered] = useState<string | null>(null);
  const [, redraw] = useState(0);
  const [canvas, texture] = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return [canvas, texture] as const;
  }, []);

  const part = catalog.byName.get((pinned ?? hover)?.name ?? '');
  const length = (millimetres: number) => inUnit(millimetres, app.unit);
  const open = Boolean(app.parts.current?.openState());
  const scan = (session as (XRSession & { initiateRoomCapture?: () => Promise<void> }) | undefined)?.initiateRoomCapture;

  const buttons = layout([
    [
      { id: 'render', label: 'Wizualizacja', on: !app.wireframe, action: () => app.setWireframe(false) },
      { id: 'measure', label: 'Pomiar', on: app.wireframe, action: () => app.setWireframe(true) },
    ],
    [
      { id: 'fronts', label: 'Fronty', on: !app.hideFronts, action: () => app.toggleGroup('fronts') },
      {
        id: 'open',
        label: open ? 'Zamknij wszystko' : 'Otwórz wszystko',
        action: () => {
          if (open) app.parts.current?.closeAll();
          else app.parts.current?.openAll();
          redraw(n => n + 1);
        },
      },
    ],
    [
      { id: 'snap', label: 'Przyciągaj do ścian', on: snap, action: () => setSnap(!snap) },
      { id: 'reset', label: 'Ustaw przede mną', action: reset },
    ],
    [
      { id: 'night', label: 'Tryb nocny', on: night, action: () => setNight(!night) },
      { id: 'darker', label: 'Ciemniej', action: () => stepBrightness(-1) },
      { id: 'brighter', label: `Jaśniej (${Math.round(brightness * 100)}%)`, action: () => stepBrightness(1) },
    ],
    [
      { id: 'unit', label: `Jednostka: ${app.unit}`, action: () => app.setUnit(app.unit === 'mm' ? 'cm' : 'mm') },
      ...(ar && wallCount === 0 && scan ? [{ id: 'scan', label: 'Skanuj pokój', action: () => scan.call(session) }] : []),
      { id: 'exit', label: 'Wyjdź', action: () => session?.end() },
    ],
  ]);

  const { x, y, z } = catalog.overall;
  const text = {
    title: part ? partLabel(part.name) : 'Cała szafa',
    detail: `${part ? `${part.name}: ${part.size.map(length).join(' × ')}` : `${length(z)} × ${length(y)} × ${length(x)}`} ${app.unit}${edge ? `, krawędź ${length(edge.width * 1000)} ${app.unit}` : ''}`,
    status: STATUS[status] || (ar && wallCount === 0 ? 'Brak ścian. Wykonaj skan pokoju, aby przyciągać szafę.' : wallCount ? `Wykryte ściany: ${wallCount}` : ''),
    statusAccent: status !== 'free',
  };
  const signature = JSON.stringify([text, hovered, buttons.map(b => [b.id, b.label, b.on])]);

  useEffect(() => {
    draw(canvas.getContext('2d')!, buttons, hovered, text);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => () => texture.dispose(), [texture]);

  const hit = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!event.uv) return undefined;
    const px = event.uv.x * WIDTH;
    const py = (1 - event.uv.y) * HEIGHT;
    return buttons.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
  };

  return (
    <mesh
      onPointerMove={event => setHovered(hit(event)?.id ?? null)}
      onPointerLeave={() => setHovered(null)}
      onClick={event => hit(event)?.action()}
    >
      <planeGeometry args={[METRES_WIDE, (METRES_WIDE * HEIGHT) / WIDTH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
