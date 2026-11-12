import * as THREE from 'three';
import { type Ref, useMemo } from 'react';
import { markScale, sheetAxes } from '@/components/grain';
import type { LineData } from '@/components/Mesh';
import { contoursOf, edgeRuns } from './edgeView';
import type { Unit } from '@/contexts/AppContext';
import { inUnit } from './labels';

const WIDTH = 340; // the sheet's default size, in its own units
const HEIGHT = 268;
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
const GRAIN = '#8a5a2b'; // oak brown for the grain arrow
const GROOVE = '#f0b35a'; // the LED amber, only on the strip's groove
const HOLE = '#2f6690'; // the site's --hole on paper: dowel holes apart from the outline
const HOLE_ON = '#1c6fc0'; // the hole in focus, a brighter blue of the same family
const GROOVE_ON = '#c47f1c'; // the groove in focus: its amber, deepened for the outline

// Machining drawn over the part, in its own axes: dowel holes (entry point, inward axis), LED grooves, mitres traced bold
export type DrawingMarks = {
  holes: { id: number; at: THREE.Vector3; dir: THREE.Vector3; r: number; depth: number; from?: number[] }[]; // from: mm to the edges the order list measures from
  grooves: { min: THREE.Vector3; max: THREE.Vector3 }[];
  mitres?: boolean;
  active?: number | null; // hole id
  activeGroove?: number | null; // groove index
};

// A hole or a groove under the pointer on the sheet, by the same ids the marks carry
export type MarkHover = { hole: number } | { groove: number } | null;

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

type Guide = { d: string; x: number; y: number; text: string; vertical: boolean };
type HoleMark = { key: string; id: number; guides: Guide[]; circle?: { x: number; y: number; r: number }; entry?: { x: number; y: number }; bore?: string; axisLine?: string };

const BREAK = 12; // sheet units between the two halves of a broken view

// The lengths of a long part worth drawing, along its longest side: both ends and the ground around every hole, each
// kept as far out as the part is thick; what lies between is left out, as on a broken view. One span: nothing to leave out
export function keptSpans(geometry: THREE.BufferGeometry, grain: number | undefined, holes: readonly { at: THREE.Vector3 }[] = []) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const lo = min.toArray();
  const hi = max.toArray();
  const size = hi.map((v, i) => v - lo[i]);
  const [a, b, c] = sheetAxes(size, grain);
  const reach = Math.max(0.12, 1.5 * Math.max(size[b], size[c]));
  const spans = [[lo[a], lo[a] + reach], [hi[a] - reach, hi[a]], ...holes.map(h => [h.at.getComponent(a) - reach / 2, h.at.getComponent(a) + reach / 2])]
    .map(([s, e]) => [Math.max(lo[a], s), Math.min(hi[a], e)])
    .sort((m, n) => m[0] - n[0]);
  const merged: number[][] = [];
  // A gap shorter than the ends it would part is not worth a break
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] - last[1] < reach) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  return merged;
}

// The parts of segment p-q that lie in the kept spans along axis a
function clipToSpans(p: number[], q: number[], a: number, spans: number[][]) {
  if (spans.length < 2) return [[p, q]];
  const out: number[][][] = [];
  const at = (t: number) => p.map((v, i) => v + (q[i] - v) * t);
  for (const [s, e] of spans) {
    let t1 = 0;
    let t2 = 1;
    if (Math.abs(q[a] - p[a]) < 1e-9) {
      if (p[a] < s - 1e-6 || p[a] > e + 1e-6) continue;
    } else {
      const u = (s - p[a]) / (q[a] - p[a]);
      const w = (e - p[a]) / (q[a] - p[a]);
      t1 = Math.max(0, Math.min(u, w));
      t2 = Math.min(1, Math.max(u, w));
    }
    if (t2 > t1 + 1e-6) out.push([at(t1), at(t2)]);
  }
  return out;
}

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
  onMark,
  marks,
  snap,
  width = WIDTH,
  height = HEIGHT,
  inset = 0,
  broken = false,
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
  onMark?: (mark: MarkHover) => void;
  marks?: DrawingMarks;
  snap?: number; // mm: rounds the dimensions, which Draco's quantisation leaves a tenth off
  width?: number;
  height?: number;
  inset?: number; // room kept free on the right of the views, above the title strip, for something laid over the sheet
  broken?: boolean; // a long part drawn with its plain middle left out, between break lines; dimensions stay true
  ref?: Ref<SVGSVGElement>;
}) {
  const W = width;
  const H = height;
  const drawing = useMemo(() => {
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    const lo = min.toArray();
    const hi = max.toArray();
    const size = hi.map((v, i) => v - lo[i]);
    const [a, b, c] = sheetAxes(size, grain);
    const spans = broken ? keptSpans(geometry, grain, marks?.holes) : [[lo[a], hi[a]]];
    const breaks = spans.length - 1;
    const kept = spans.reduce((sum, [s, e]) => sum + e - s, 0);

    const right = RIGHT + inset;
    const scale = Math.min((W - LEFT - right - GAP - breaks * BREAK) / (kept + size[c] || 1), (H - TITLE - TOP - GAP - 8) / (size[b] + size[c] || 1));
    const wa = kept * scale + breaks * BREAK;
    const wb = size[b] * scale;
    const wc = size[c] * scale;
    const x0 = LEFT + (W - LEFT - right - GAP - wa - wc) / 2;
    const y0 = TOP + (H - TITLE - TOP - GAP - 8 - wb - wc) / 2;
    const xSide = x0 + wa + GAP;
    const yPlan = y0 + wb + GAP;

    // Along the long side each kept span follows the one before it after a break's width; a point in a gap sits at its edge
    const starts: number[] = [];
    spans.reduce((at, [s, e]) => (starts.push(at), at + (e - s) * scale + BREAK), x0);
    const X = (v: number[]) => {
      const i = Math.max(0, spans.findLastIndex(([s]) => v[a] >= s - 1e-9));
      return starts[i] + (Math.min(v[a], spans[i][1]) - spans[i][0]) * scale;
    };
    const cut = (p: number[], q: number[]) => clipToSpans(p, q, a, spans);
    const Y = (v: number[]) => y0 + (hi[b] - v[b]) * scale;
    const YP = (v: number[]) => yPlan + (hi[c] - v[c]) * scale;
    const XS = (v: number[]) => xSide + (v[c] - lo[c]) * scale;

    const edges = edgesOf(geometry);
    let d = '';
    let slant = ''; // edges at an angle in a view: on a frame piece, only the 45° cuts
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      const segment = `M${px(x1)} ${px(y1)}L${px(x2)} ${px(y2)}`;
      d += segment;
      if (Math.abs(x2 - x1) > 0.5 && Math.abs(y2 - y1) > 0.5) slant += segment;
    };
    for (let i = 0; i < edges.length; i += 6) {
      const p = [edges[i], edges[i + 1], edges[i + 2]];
      const q = [edges[i + 3], edges[i + 4], edges[i + 5]];
      cut(p, q).forEach(([m, n]) => {
        line(X(m), Y(m), X(n), Y(n));
        line(X(m), YP(m), X(n), YP(n));
      });
      line(XS(p), Y(p), XS(q), Y(q));
    }
    const dimension = (axis: number) => inUnit(snap ? Math.round((size[axis] * 1000) / snap) * snap : size[axis] * 1000, unit);
    // Screen right × screen up points at the viewer; (a, b, c) may be an odd permutation of the axes
    const cyclic = (b - a + 3) % 3 === 1 ? 1 : -1;
    // `box`: the view's outline on the sheet, left, top, right, bottom; `h` and `v`: the part's axes along the sheet's x and y;
    // `cut`: splits a segment at the breaks, in the two views that show the long side
    const whole = (p: number[], q: number[]) => [[p, q]];
    const views = [
      { axis: c, sign: cyclic, at: (v: number[]) => [X(v), Y(v)], box: [x0, y0, x0 + wa, y0 + wb], h: a, v: b, cut },
      { axis: b, sign: -cyclic, at: (v: number[]) => [X(v), YP(v)], box: [x0, yPlan, x0 + wa, yPlan + wc], h: a, v: c, cut },
      { axis: a, sign: -cyclic, at: (v: number[]) => [XS(v), Y(v)], box: [xSide, y0, xSide + wc, y0 + wb], h: c, v: b, cut: whole },
    ];
    const inGap = (v: number[]) => !spans.some(([s, e]) => v[a] >= s - 1e-6 && v[a] <= e + 1e-6);
    const contours = contoursOf(geometry);
    let contour = '';
    views.forEach(view => {
      const segments = contours[view.axis];
      for (let i = 0; i < segments.length; i += 6) {
        view.cut(segments.slice(i, i + 3), segments.slice(i + 3, i + 6)).forEach(([m, n]) => {
          const [fx, fy] = view.at(m);
          const [tx, ty] = view.at(n);
          contour += `M${px(fx)} ${px(fy)}L${px(tx)} ${px(ty)}`;
        });
      }
    });
    // Break lines: each cut end of the part closes with a straight line kinked into a Z across it, a little past both sides
    let breakLines = '';
    starts.slice(1).forEach(start => {
      [start - BREAK + 2, start - 2].forEach(x => {
        [
          [y0, y0 + wb],
          [yPlan, yPlan + wc],
        ].forEach(([top, bottom]) => {
          const mid = (top + bottom) / 2;
          const k = Math.min(3, (bottom - top) / 4 + 1);
          breakLines += `M${px(x)} ${px(top - 3)}V${px(mid - k)}L${px(x + 2.5)} ${px(mid - k / 2)}L${px(x - 2.5)} ${px(mid + k / 2)}L${px(x)} ${px(mid + k)}V${px(bottom + 3)}`;
        });
      });
    });
    // The grain arrow sits in the longest kept span, not across a break
    const longest = spans.reduce((m, span, i) => (span[1] - span[0] > spans[m][1] - spans[m][0] ? i : m), 0);
    const grainRoom = (spans[longest][1] - spans[longest][0]) * scale;
    return {
      d,
      slant,
      contour,
      breakLines,
      grainAt: starts[longest] + grainRoom / 2,
      grainRoom,
      edges,
      views,
      inGap,
      lo,
      hi,
      scale,
      x0,
      y0,
      wa,
      wb,
      wc,
      xSide,
      yPlan,
      a,
      markSize: 0.12 + 0.2 * markScale(size[a], size[b]),
      labels: [dimension(a), dimension(b), dimension(c)],
    };
  }, [geometry, unit, grain, snap, W, H, inset, broken, marks?.holes]);

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
      const p = edge[0].toArray();
      const q = edge[1].toArray();
      const along = (t: number) => p.map((v, i) => v + (q[i] - v) * t);
      edgeRuns(geometry, edge, view, drawing.edges).forEach(run => {
        view.cut(along(run.from), along(run.to)).forEach(([m, n]) => {
          const [fx, fy] = view.at(m);
          const [tx, ty] = view.at(n);
          const path = `M${px(fx)} ${px(fy)}L${px(tx)} ${px(ty)}`;
          if (run.hidden) dashed += path;
          else solid += path;
        });
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
          const d = view
            .cut(p, q)
            .map(([m, n]) => {
              const [fx, fy] = view.at(m);
              const [tx, ty] = view.at(n);
              return `M${px(fx)} ${px(fy)}L${px(tx)} ${px(ty)}`;
            })
            .join('');
          return d ? [{ key: `${v}-${i}`, line, d, depth: (p[view.axis] + q[view.axis]) * view.sign }] : [];
        })
        .sort((m, n) => m.depth - n.depth),
    );
  }, [lines, drawing]);

  // Holes as circles where the view looks down them, as dashed bores elsewhere; grooves as amber boxes in every view
  const machining = useMemo(() => {
    if (!marks) return null;
    const { views, scale, a, lo, hi } = drawing;
    // A groove is a box; at a break it splits into the pieces that lie in the kept spans
    const grooves = marks.grooves.flatMap((g, i) =>
      views.flatMap((view, v) =>
        view.cut(g.min.toArray(), g.max.toArray()).map(([m, n], k) => {
          const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(j => view.at([j & 1 ? n[0] : m[0], j & 2 ? n[1] : m[1], j & 4 ? n[2] : m[2]]));
          const xs = corners.map(c => c[0]);
          const ys = corners.map(c => c[1]);
          return { key: `${i}-${v}-${k}`, id: i, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        }),
      ),
    );
    // The active hole set out from the nearest edge of each view along both sheet axes, dotted, as the drill is placed
    // From the edge the order list measures from, when one of its distances fits; else from the nearer edge
    // Distances come from the part's own coordinates, so they stay true across a break
    const guidesOf = (x: number, y: number, at: number[], view: (typeof views)[number], from: number[] = []) => {
      const { box } = view;
      const listed = (mm: number) => from.some(v => Math.abs(v - mm) < 2);
      // To the low or the high end of axis i, in mm; the sheet's y runs down, against the part's axis
      const pick = (i: number) => {
        const low = (at[i] - lo[i]) * 1000;
        const high = (hi[i] - at[i]) * 1000;
        const toLow = listed(low) && !listed(high) ? true : listed(high) && !listed(low) ? false : low <= high;
        return { mm: toLow ? low : high, toLow };
      };
      const across = pick(view.h);
      const down = pick(view.v);
      const nearX = across.toLow ? box[0] : box[2];
      const nearY = down.toLow ? box[3] : box[1];
      const length = (mm: number) => inUnit(Math.round(mm), unit);
      const guides: Guide[] = [];
      if (Math.abs(x - nearX) > 1.5) guides.push({ d: `M${px(x)} ${px(y)}H${px(nearX)}`, x: (x + nearX) / 2, y: y - 3, text: length(across.mm), vertical: false });
      if (Math.abs(y - nearY) > 1.5) guides.push({ d: `M${px(x)} ${px(y)}V${px(nearY)}`, x: x + 3, y: (y + nearY) / 2, text: length(down.mm), vertical: true });
      return guides;
    };
    const holes = marks.holes.flatMap(hole =>
      views.flatMap((view, v): HoleMark[] => {
        const at = hole.at.toArray();
        if (view.h === a && drawing.inGap(at)) return [];
        const [x, y] = view.at(at);
        const guides = hole.id === marks.active ? guidesOf(x, y, at, view, hole.from) : [];
        if (Math.abs(hole.dir.getComponent(view.axis)) > 0.9) return [{ key: `${hole.id}-${v}`, id: hole.id, guides, circle: { x, y, r: Math.max(1.6, hole.r * scale) } }];
        const end = view.at(hole.at.clone().addScaledVector(hole.dir, hole.depth).toArray());
        const len = Math.hypot(end[0] - x, end[1] - y) || 1;
        const nx = ((-(end[1] - y) / len) * hole.r * scale) || 0;
        const ny = (((end[0] - x) / len) * hole.r * scale) || 0;
        const bore = `M${px(x + nx)} ${px(y + ny)}L${px(end[0] + nx)} ${px(end[1] + ny)}M${px(x - nx)} ${px(y - ny)}L${px(end[0] - nx)} ${px(end[1] - ny)}M${px(end[0] + nx)} ${px(end[1] + ny)}L${px(end[0] - nx)} ${px(end[1] - ny)}`;
        return [{ key: `${hole.id}-${v}`, id: hole.id, guides, entry: { x, y }, bore, axisLine: `M${px(x)} ${px(y)}L${px(end[0])} ${px(end[1])}` }];
      }),
    );
    return { grooves, holes };
  }, [marks, drawing, unit]);

  const { d, slant, contour, breakLines, grainAt, grainRoom, x0, y0, wa, wb, wc, xSide, a, markSize, labels } = drawing;

  // Double-headed arrow along the grain, the usual mark on a cutting drawing
  let grainArrow = '';
  if (grain === a) {
    const cx = grainAt;
    const cy = y0 + wb / 2;
    const half = Math.max(8, Math.min(60, wa * markSize, grainRoom / 2 - 4)); // the sheet fits every part; the arrow still tells size
    grainArrow = `M${cx - half} ${cy}H${cx + half}M${cx - half + 5} ${cy - 4}L${cx - half} ${cy}L${cx - half + 5} ${cy + 4}M${cx + half - 5} ${cy - 4}L${cx + half} ${cy}L${cx + half - 5} ${cy + 4}`;
  }

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rysunek techniczny ${code}, wymiary w ${unit}: ${labels.join(' na ')}`}>
      <rect width={W} height={H} fill={PAPER} />
      <path d={d} fill="none" stroke={INK} strokeWidth={0.7} strokeLinecap="round" />
      <path d={contour} fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
      {breakLines && <path d={breakLines} fill="none" stroke={INK} strokeWidth={0.7} strokeLinejoin="round" />}
      {marks?.mitres && <path d={slant} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />}
      {machining?.grooves.map(g => {
        const on = g.id === marks?.activeGroove;
        return (
          <rect
            key={g.key}
            x={g.x}
            y={g.y}
            width={Math.max(g.w, 1.2)}
            height={Math.max(g.h, 1.2)}
            fill={GROOVE}
            fillOpacity={on ? 0.9 : 0.45}
            stroke={on ? GROOVE_ON : GROOVE}
            strokeWidth={on ? 1.2 : 0.8}
          />
        );
      })}
      {machining?.holes.map(h => {
        const on = h.id === marks?.active;
        const color = on ? HOLE_ON : HOLE;
        return h.circle ? (
          <g key={h.key}>
            {on && <circle cx={h.circle.x} cy={h.circle.y} r={h.circle.r + 5} fill="none" stroke={HOLE_ON} strokeWidth={1.2} />}
            <circle cx={h.circle.x} cy={h.circle.y} r={h.circle.r} fill={on ? HOLE_ON : PAPER} fillOpacity={on ? 0.25 : 1} stroke={color} strokeWidth={on ? 1.4 : 0.9} />
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
      {machining?.holes.flatMap(h =>
        h.guides.map((g, i) => (
          <g key={`${h.key}-guide-${i}`} pointerEvents="none">
            <path d={g.d} stroke={HOLE_ON} strokeWidth={0.7} strokeDasharray="1.5 2" fill="none" />
            <text
              x={g.x}
              y={g.y}
              fill={HOLE_ON}
              fontFamily={FONT}
              fontSize={8}
              fontWeight={600}
              textAnchor={g.vertical ? 'start' : 'middle'}
              dominantBaseline={g.vertical ? 'middle' : 'auto'}
              stroke={PAPER}
              strokeWidth={2.5}
              paintOrder="stroke"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {g.text}
            </text>
          </g>
        )),
      )}
      {grainArrow && <path d={grainArrow} fill="none" stroke={GRAIN} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />}
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
      {/* Over the edge picks, which would take a groove a few units wide and a hole beside an edge; a hole gets a wider disc */}
      {onMark && machining && (
        <g fill="transparent" stroke="none">
          {machining.grooves.map(g => (
            <rect key={`hit-${g.key}`} x={g.x - 2} y={g.y - 2} width={g.w + 4} height={g.h + 4} onPointerEnter={() => onMark({ groove: g.id })} onPointerLeave={() => onMark(null)} />
          ))}
          {machining.holes.map(h => {
            const at = h.circle ?? h.entry!;
            return <circle key={`hit-${h.key}`} cx={at.x} cy={at.y} r={6} onPointerEnter={() => onMark({ hole: h.id })} onPointerLeave={() => onMark(null)} />;
          })}
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
