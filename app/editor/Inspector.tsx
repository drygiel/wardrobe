import type * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { FRAME_GLB } from '@/assets';
import { useApp } from '@/contexts/AppContext';
import type { LineData } from '@/components/Mesh';
import { GROUPS } from '@/components/parts';
import { grainAxis, sizeOf } from '@/components/grain';
import { rootOf, useCatalog } from './catalog';
import { Icon } from './icons';
import { inUnit, partLabel } from './labels';
import { keptSpans, PartDrawing } from './PartDrawing';
import { selection, useSelection } from './selection';
import { PIECES } from '@/sections/orderList';
import { ALL_LAYERS, BreakToggle, marksOf, PieceChips } from '@/sections/PieceChips';
import { type Focus, focusOf, NO_FOCUS, PieceOps } from '@/sections/PieceOps';
import styles from './Editor.module.scss';

const SIZE_NAMES = ['Długość', 'Szerokość', 'Grubość'];
const columnLabel = (columns: string[]) => (columns.length > 1 ? `${columns[0]}–${columns[columns.length - 1]}` : (columns[0] ?? '–'));

export function Inspector() {
  const app = useApp();
  const catalog = useCatalog();
  const { hover, pinned, edge } = useSelection();
  const mesh = pinned ?? hover;
  const part = mesh && catalog.byName.get(mesh.name);
  const svg = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);
  const edgeFromDrawing = useRef(false);
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [broken, setBroken] = useState(false);
  // The hole or groove in focus on the drawing and in the operations list, kept with the part it belongs to
  const [mark, setMark] = useState<{ name: string; focus: Focus } | null>(null);
  // The frame pieces in the editor share Frame.glb's geometry, so the order list's machining lands on them as is
  const frame = useGLTF(FRAME_GLB) as unknown as { nodes: Record<string, THREE.Mesh> };

  const showEdge = (line: LineData | null) => {
    edgeFromDrawing.current = !!line;
    selection.setEdge(line);
    app.showEdge.current?.(line);
  };

  // Esc can take the drawing away with the cursor still on an edge, and then no leave event comes
  useEffect(
    () => () => {
      if (edgeFromDrawing.current) showEdge(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinned],
  );

  const length = (millimetres: number) => inUnit(millimetres, app.unit);

  const unitSwitch = (
    <div className={`${styles.seg} ${styles.unitSwitch}`} role="group" aria-label="Jednostka wymiarów">
      {(['mm', 'cm'] as const).map(unit => (
        <button key={unit} aria-pressed={app.unit === unit} onClick={() => app.setUnit(unit)}>{unit}</button>
      ))}
    </div>
  );

  if (!mesh || !part) {
    const { x, y, z } = catalog.overall;
    return (
      <div className={styles.inspector}>
        <h2 className={styles.partName}>Cała szafa</h2>
        <dl className={styles.sizes}>
          <div><dt>Szerokość</dt><dd>{length(z)}</dd></div>
          <div><dt>Wysokość</dt><dd>{length(y)}</dd></div>
          <div><dt>Głębokość</dt><dd>{length(x)}</dd></div>
        </dl>
        <p className={styles.note}>Wymiary w {app.unit === 'mm' ? 'milimetrach' : 'centymetrach'}, {catalog.parts.length} elementów.</p>
        {app.wireframe ? (
          <p className={styles.note}>Najedź na element w modelu lub na liście, aby zobaczyć jego nazwę, słupek, wymiary i rysunek. Kliknięcie przypina element.</p>
        ) : (
          <>
            <p className={styles.note}>Włącz pomiar, aby wskazywać elementy i mierzyć krawędzie.</p>
            <button className="btn" onClick={() => app.setWireframe(true)}>Włącz pomiar</button>
          </>
        )}
        <div className={styles.inspectorActions}>{unitSwitch}</div>
      </div>
    );
  }

  const [long, wide, thick] = part.size;
  const group = GROUPS.find(g => g.id === part.group)!.label;
  const grain = grainAxis(part.name, mesh.geometry);
  const piece = PIECES.find(p => p.name === part.name);
  const focus = mark?.name === part.name ? mark.focus : NO_FOCUS;
  const marks = piece && { ...marksOf(piece, frame.nodes[piece.name], focus.hole, layers), activeGroove: focus.groove };
  const shortens = keptSpans(mesh.geometry, typeof grain === 'number' ? grain : undefined, marks?.holes).length > 1;
  const setFocus = (next: Focus) => setMark({ name: part.name, focus: next });

  const copy = async () => {
    await navigator.clipboard.writeText(`${part.name}\t${partLabel(part.name)}\t${length(long)} × ${length(wide)} × ${length(thick)} ${app.unit}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const sheet = svg.current!.cloneNode(true) as SVGSVGElement;
    sheet.querySelector('[data-pick]')?.remove();
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(sheet)], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${part.name}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.inspector}>
      <h2 className={styles.partName}>{part.name}</h2>
      {pinned && (
        <button className={`${styles.tool} ${styles.unpin}`} aria-label="Odepnij" title="Odepnij" onClick={() => selection.unpin()}>
          <Icon name="pin" />
        </button>
      )}
      <p className={styles.partMeta}>
        <span>{part.label}</span>
        <span>Słupek {columnLabel(part.columns)}</span>
      </p>
      <ol className={styles.crumbs} aria-label="Położenie w drzewie elementów">
        {[GROUPS.find(g => g.id === rootOf(part.group))!.label, ...part.path].map(crumb => (
          <li key={crumb}>{crumb}</li>
        ))}
      </ol>

      <dl className={styles.sizes}>
        {part.size.map((value, i) => (
          <div key={SIZE_NAMES[i]}>
            <dt>{SIZE_NAMES[i]}</dt>
            <dd>{length(value)}</dd>
          </div>
        ))}
        {/* Always there, so moving between parts does not shift the columns */}
        <div className={`${styles.twins} ${part.twins > 1 ? styles.many : ''}`}>
          <dt>Sztuk</dt>
          <dd>×{part.twins}</dd>
        </div>
      </dl>

      {piece && <PieceChips piece={piece} layers={layers} onToggle={layer => setLayers(old => ({ ...old, [layer]: !old[layer] }))} />}

      <div className={styles.sheet}>
        <PartDrawing
          marks={marks}
          broken={broken && shortens}
          onMark={piece && (m => setFocus(focusOf(m)))}
          ref={svg} geometry={mesh.geometry} code={part.name} unit={app.unit} edge={edge?.meshRef.current === mesh ? edge.points : null} lines={app.wireframe ? (selection.find(`line_${part.name}`)?.userData.lines as LineData[] | undefined) : undefined} onEdge={showEdge} onEdgeClick={line => app.centerOn.current?.(line.meshRef.current.localToWorld(line.midPoint.clone()))} grain={typeof grain === 'number' ? grain : undefined} />
        {shortens && <BreakToggle on={broken} onToggle={() => setBroken(!broken)} />}
      </div>

      {piece && <PieceOps piece={piece} focus={focus} onFocus={setFocus} unit={app.unit} />}

      <dl className={styles.facts}>
        <dt>Grupa</dt>
        <dd>{group}</dd>
        {grain !== null && (
          <>
            <dt>Słoje</dt>
            <dd>{grain === '?' ? 'niejednoznaczne w modelu' : `wzdłuż boku ${length(sizeOf(mesh.geometry)[grain] * 1000)} ${app.unit}`}</dd>
          </>
        )}
        <dt>Od lewej</dt>
        <dd>{length(part.from.left)} {app.unit}</dd>
        <dt>Od podłogi</dt>
        <dd>{length(part.from.floor)} {app.unit}</dd>
        <dt>Od tyłu</dt>
        <dd>{length(part.from.back)} {app.unit}</dd>
      </dl>

      <div className={styles.inspectorActions}>
        <button className={styles.tool} onClick={copy}>{copied ? 'Skopiowano' : 'Kopiuj wymiary'}</button>
        <button className={styles.tool} onClick={download}>Pobierz SVG</button>
        {unitSwitch}
      </div>
    </div>
  );
}
