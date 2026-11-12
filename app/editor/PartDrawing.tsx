import * as THREE from 'three';
import { type Ref, useMemo } from 'react';
import { markScale, sheetAxes } from '@/components/grain';
import type { LineData } from '@/components/Mesh';
import { contoursOf, edgeRuns } from './edgeView';
import type { Unit } from '@/contexts/AppContext';
import { inUnit } from './labels';

const W = 340;
const H = 268;
const TITLE = 24; // title strip at the bottom
const LEFT = 36;
const TOP = 30;
const RIGHT = 14;
const GAP = 34; // between the views, room for a dimension
const PAPER = '#e4e1da';
const INK = '#161412';
const DIM = '#5a544b';
const MEASURED = '#e01410'; // the red of the measured edge in the model
const FONT = 'Switzer, system-ui, sans-serif';
const GROOVE = '#f0b35a'; // the LED amber, only on the strip's groove

// Machining drawn over the part, in its own axes: dowel holes (entry point, inward axis) and LED grooves
export type DrawingMarks = {
  holes: { id: number; at: THREE.Vector3; dir: THREE.Vector3; r: number; depth: number }[];
  grooves: { min: THREE.Vector3; max: THREE.Vector3 }[];
  active?: number | null;
};

const edgeCache = new WeakMap<THREE.BufferGeometry, ArrayLike<number>>();

// Sharp edges only: a cylinder keeps its end circles, the view's outline adds its sides
const edgesOf = (geometry: THREE.BufferGeometry) => {
  let edges = edgeCache.get(geometry);
  if (!edges) {
    edges = new THREE.EdgesGeometry(geometry, 30).attributes.position.array;
    edgeCache.set(geometry, edges);
  }
  return edges;
};

const px = (v: number) => v.toFixed(1);

function Dimension({ x1, y1, x2, y2, label, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const tick = (x: number, y: number) => `M${x - 3} ${y + 3}L${x + 3} ${y - 3}`;
  const tx = vertical ? x1 - 5 : (x1 + x2) / 2;
  const ty = vertical ? (y1 + y2) / 2 : y1 - 5;
  return (
    <g>
      <path d={`M${x1} ${y1}L${x2} ${y2}${tick(x1, y1)}${tick(x2, y2)}`} stroke={DIM} strokeWidth={0.8} fill="none" />
      <text x={tx} y={ty} fill={INK} fontFamily={FONT} fontSize={11} fontWeight={500} textAnchor="middle" transform={vertical ? `rotate(-90 ${tx} ${ty})` : undefined} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {label}
      </text>
    </g>
  );
}

// Three orthographic views of a part from its own edges, longest side horizontal
export function PartDrawing({
  geometry,
  code,
  unit,
  grain,
  edge,
  lines,
  onEdge,
  onEdgeClick,
  marks,
  snap,
  ref,
}: {
  geometry: THREE.BufferGeometry;
  code: string;
  unit: Unit;
  grain?: number;
  edge?: readonly [THREE.Vector3, THREE.Vector3] | null; // the edge measured in the model, in the part's own axes
  lines?: LineData[]; // the part's measurable edges; hovering one on the sheet reports it
  onEdge?: (line: LineData | null) => void;
  onEdgeClick?: (line: LineData) => void;
  marks?: DrawingMarks;
  snap?: number; // mm: rounds the dimensions, which Draco's quantisation leaves a tenth off
  ref?: Ref<SVGSVGElement>;
}) {
  const drawing = useMemo(() => {
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    const lo = min.toArray();
    const hi = max.toArray();
    const size = hi.map((v, i) => v - lo[i]);
    const [a, b, c] = sheetAxes(size, grain);

    const scale = Math.min((W - LEFT - RIGHT - GAP) / (size[a] + size[c] || 1), (H - TITLE - TOP - GAP - 8) / (size[b] + size[c] || 1));
    const wa = size[a] * scale;
    const wb = size[b] * scale;
    const wc = size[c] * scale;
    const x0 = LEFT + (W - LEFT - RIGHT - GAP - wa - wc) / 2;
    const y0 = TOP + (H - TITLE - TOP - GAP - 8 - wb - wc) / 2;
    const xSide = x0 + wa + GAP;
    const yPlan = y0 + wb + GAP;

    const X = (v: number[]) => x0 + (v[a] - lo[a]) * scale;
    const Y = (v: number[]) => y0 + (hi[b] - v[b]) * scale;
    const YP = (v: number[]) => yPlan + (hi[c] - v[c]) * scale;
    const XS = (v: number[]) => xSide + (v[c] - lo[c]) * scale;

    const edges = edgesOf(geometry);
    let d = '';
    for (let i = 0; i < edges.length; i += 6) {
      const p = [edges[i], edges[i + 1], edges[i + 2]];
      const q = [edges[i + 3], edges[i + 4], edges[i + 5]];
      d += `M${px(X(p))} ${px(Y(p))}L${px(X(q))} ${px(Y(q))}`;
      d += `M${px(X(p))} ${px(YP(p))}L${px(X(q))} ${px(YP(q))}`;
      d += `M${px(XS(p))} ${px(Y(p))}L${px(XS(q))} ${px(Y(q))}`;
    }
    const dimension = (axis: number) => inUnit(snap ? Math.round((size[axis] * 1000) / snap) * snap : size[axis] * 1000, unit);
    // Screen right × screen up points at the viewer; (a, b, c) may be an odd permutation of the axes
    const cyclic = (b - a + 3) % 3 === 1 ? 1 : -1;
    const views = [
      { axis: c, sign: cyclic, at: (v: number[]) => [X(v), Y(v)] },
      { axis: b, sign: -cyclic, at: (v: number[]) => [X(v), YP(v)] },
      { axis: a, sign: -cyclic, at: (v: number[]) => [XS(v), Y(v)] },
    ];
    const contours = contoursOf(geometry);
    let contour = '';
    views.forEach(view => {
      const segments = contours[view.axis];
      for (let i = 0; i < segments.length; i += 6) {
        const [fx, fy] = view.at(segments.slice(i, i + 3));
        const [tx, ty] = view.at(segments.slice(i + 3, i + 6));
        contour += `M${px(fx)} ${px(fy)}L${px(tx)} ${px(ty)}`;
      }
    });
    return { d, contour, edges, views, scale, x0, y0, wa, wb, wc, xSide, yPlan, a, markSize: 0.12 + 0.2 * markScale(size[a], size[b]), labels: [dimension(a), dimension(b), dimension(c)] };
  }, [geometry, unit, grain, snap]);

  // The measured edge in each view: solid where visible, dashed where it lies under something, a dot when seen end-on
  const measured = useMemo(() => {
    if (!edge) return null;
    let solid = '';
    let dashed = '';
    const dots: number[][] = [];
    drawing.views.forEach(view => {
      const from = view.at(edge[0].toArray());
      const to = view.at(edge[1].toArray());
      if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 1.5) {
        dots.push(from);
        return;
      }
      const along = (t: number) => `${px(from[0] + (to[0] - from[0]) * t)} ${px(from[1] + (to[1] - from[1]) * t)}`;
      edgeRuns(geometry, edge, view, drawing.edges).forEach(run => {
        const path = `M${along(run.from)}L${along(run.to)}`;
        if (run.hidden) dashed += path;
        else solid += path;
      });
    });
    return { solid, dashed, dots };
  }, [edge, drawing, geometry]);

  // Invisible wide strokes over each edge, nearest to the viewer last so it wins where edges coincide
  const pickPaths = useMemo(() => {
    if (!lines) return [];
    return drawing.views.flatMap((view, v) =>
      lines
        .flatMap((line, i) => {
          const [p, q] = line.points.map(point => point.toArray());
          const from = view.at(p);
          const to = view.at(q);
          if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 1.5) return [];
          return [{ key: `${v}-${i}`, line, d: `M${px(from[0])} ${px(from[1])}L${px(to[0])} ${px(to[1])}`, depth: (p[view.axis] + q[view.axis]) * view.sign }];
        })
        .sort((m, n) => m.depth - n.depth),
    );
  }, [lines, drawing]);

  // Holes as circles where the view looks down them, as dashed bores elsewhere; grooves as amber boxes in every view
  const machining = useMemo(() => {
    if (!marks) return null;
    const { views, scale } = drawing;
    const grooves = marks.grooves.flatMap((g, i) =>
      views.map((view, v) => {
        const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(k => view.at([k & 1 ? g.max.x : g.min.x, k & 2 ? g.max.y : g.min.y, k & 4 ? g.max.z : g.min.z]));
        const xs = corners.map(c => c[0]);
        const ys = corners.map(c => c[1]);
        return { key: `${i}-${v}`, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      }),
    );
    const holes = marks.holes.flatMap(hole =>
      views.map((view, v) => {
        const [x, y] = view.at(hole.at.toArray());
        if (Math.abs(hole.dir.getComponent(view.axis)) > 0.9) return { key: `${hole.id}-${v}`, id: hole.id, circle: { x, y, r: Math.max(1.6, hole.r * scale) } };
        const end = view.at(hole.at.clone().addScaledVector(hole.dir, hole.depth).toArray());
        const len = Math.hypot(end[0] - x, end[1] - y) || 1;
        const nx = ((-(end[1] - y) / len) * hole.r * scale) || 0;
        const ny = (((end[0] - x) / len) * hole.r * scale) || 0;
        const bore = `M${px(x + nx)} ${px(y + ny)}L${px(end[0] + nx)} ${px(end[1] + ny)}M${px(x - nx)} ${px(y - ny)}L${px(end[0] - nx)} ${px(end[1] - ny)}M${px(end[0] + nx)} ${px(end[1] + ny)}L${px(end[0] - nx)} ${px(end[1] - ny)}`;
        return { key: `${hole.id}-${v}`, id: hole.id, entry: { x, y }, bore, axisLine: `M${px(x)} ${px(y)}L${px(end[0])} ${px(end[1])}` };
      }),
    );
    return { grooves, holes };
  }, [marks, drawing]);

  const { d, contour, x0, y0, wa, wb, wc, xSide, a, markSize, labels } = drawing;

  // Double-headed arrow along the grain, the usual mark on a cutting drawing
  let grainArrow = '';
  if (grain === a) {
    const cx = x0 + wa / 2;
    const cy = y0 + wb / 2;
    const half = Math.max(8, Math.min(60, wa * markSize)); // the sheet fits every part; the arrow still tells size
    grainArrow = `M${cx - half} ${cy}H${cx + half}M${cx - half + 5} ${cy - 4}L${cx - half} ${cy}L${cx - half + 5} ${cy + 4}M${cx + half - 5} ${cy - 4}L${cx + half} ${cy}L${cx + half - 5} ${cy + 4}`;
  }

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rysunek techniczny ${code}, wymiary w ${unit}: ${labels.join(' na ')}`}>
      <rect width={W} height={H} fill={PAPER} />
      <path d={d} fill="none" stroke={INK} strokeWidth={0.7} strokeLinecap="round" />
      <path d={contour} fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
      {machining?.grooves.map(g => (
        <rect key={g.key} x={g.x} y={g.y} width={Math.max(g.w, 1.2)} height={Math.max(g.h, 1.2)} fill={GROOVE} fillOpacity={0.45} stroke={GROOVE} strokeWidth={0.8} />
      ))}
      {machining?.holes.map(h => {
        const on = h.id === marks?.active;
        const color = on ? MEASURED : DIM;
        return h.circle ? (
          <g key={h.key}>
            {on && <circle cx={h.circle.x} cy={h.circle.y} r={h.circle.r + 5} fill="none" stroke={MEASURED} strokeWidth={1.2} />}
            <circle cx={h.circle.x} cy={h.circle.y} r={h.circle.r} fill={on ? MEASURED : PAPER} fillOpacity={on ? 0.25 : 1} stroke={color} strokeWidth={on ? 1.4 : 0.9} />
            <path d={`M${px(h.circle.x - h.circle.r - 2)} ${px(h.circle.y)}H${px(h.circle.x + h.circle.r + 2)}M${px(h.circle.x)} ${px(h.circle.y - h.circle.r - 2)}V${px(h.circle.y + h.circle.r + 2)}`} stroke={color} strokeWidth={0.5} />
          </g>
        ) : (
          <g key={h.key} fill="none" stroke={color} strokeWidth={on ? 1.3 : 0.7}>
            {on && h.entry && <circle cx={h.entry.x} cy={h.entry.y} r={5} strokeWidth={1.2} />}
            <path d={h.bore} strokeDasharray="2.5 2" />
            <path d={h.axisLine} strokeDasharray="6 2 1 2" strokeWidth={0.4} />
          </g>
        );
      })}
      {grainArrow && <path d={grainArrow} fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />}
      <Dimension x1={x0} y1={y0 - 11} x2={x0 + wa} y2={y0 - 11} label={labels[0]} />
      <Dimension x1={x0 - 11} y1={y0} x2={x0 - 11} y2={y0 + wb} label={labels[1]} vertical />
      <Dimension x1={xSide} y1={y0 - 11} x2={xSide + wc} y2={y0 - 11} label={labels[2]} />
      {measured && (
        <g fill="none" stroke={MEASURED} strokeWidth={2}>
          <path d={measured.solid} />
          <path d={measured.dashed} strokeDasharray="5 4" />
          {measured.dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.6} fill={MEASURED} stroke="none" />
          ))}
        </g>
      )}
      {pickPaths.length > 0 && (
        <g data-pick fill="none" stroke="transparent" strokeWidth={8} pointerEvents="stroke" style={{ cursor: 'pointer' }} onPointerLeave={() => onEdge?.(null)}>
          {pickPaths.map(pick => (
            <path key={pick.key} d={pick.d} onPointerEnter={() => onEdge?.(pick.line)} onClick={() => onEdgeClick?.(pick.line)} />
          ))}
        </g>
      )}
      <path d={`M0 ${H - TITLE}H${W}`} stroke={INK} strokeWidth={0.8} />
      <text x={10} y={H - 8} fill={INK} fontFamily={FONT} fontSize={11} fontWeight={600}>
        {code}
      </text>
      <text x={W - 10} y={H - 8} fill={DIM} fontFamily={FONT} fontSize={11} textAnchor="end">
        wymiary w {unit}
      </text>
    </svg>
  );
}
