// Concealed hinge of a section B door as a four-bar linkage, top view in millimetres.
// x runs along the door from the inner face of the side (0); y points out of the wardrobe from the door's inner face (0).
// Measured in Szafa4.blend: door 18 mm, set 20 mm into the 40 mm frame, cup Ø35 × 12 mm 4 mm from the door edge,
// plate 38 × 12 mm on the 18 mm inner side, door clip 95°. The pivots are not in the model: a search over the arm
// and cup found these as the most compact linkage that opens the door to 95° without touching the frame.
type P = [number, number];

export const DOOR: P[] = [[-15, 0], [-15, 18], [578, 18], [578, 0]];
export const CUP = { x0: -11, x1: 24, y0: 0, y1: 12 };
export const PLATE = { x0: 0, x1: 12, y0: -40, y1: -2 };
export const SIDE = { x0: -18, x1: 0, y0: -200, y1: 0 };
export const FRAME = { x0: -58, x1: -18, y0: -200, y1: 38 };

export const A: P = [2, -6];
export const D: P = [22, -6];
const B0: P = [-6, 6];
const C0: P = [12, 3];
const CRANK = (-197 * Math.PI) / 240; // crank sweep from closed to 95°

const len = (p: P, q: P) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const angle0 = Math.atan2(C0[1] - B0[1], C0[0] - B0[0]);
const theta0 = Math.atan2(B0[1] - A[1], B0[0] - A[0]);

// C for crank angle theta, on one side of the line B→D
function linkage(theta: number, side: number) {
  const a = len(A, B0);
  const b = len(B0, C0);
  const c = len(D, C0);
  const B: P = [A[0] + a * Math.cos(theta), A[1] + a * Math.sin(theta)];
  const dx = D[0] - B[0];
  const dy = D[1] - B[1];
  const d = Math.hypot(dx, dy);
  const q = (b * b - c * c + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, b * b - q * q)) * side;
  return { B, C: [B[0] + (q * dx) / d + (h * dy) / d, B[1] + (q * dy) / d - (h * dx) / d] as P };
}

// The assembly branch the closed pose sits on; the linkage stays on it through the whole swing
const SIDE_OF_C = len(linkage(theta0, 1).C, C0) < len(linkage(theta0, -1).C, C0) ? 1 : -1;

// Pose with the door opened to this fraction of its full angle; the crank turns unevenly, so it is searched for
export function hingeOpened(fraction: number) {
  const goal = hingeAt(1).phi * Math.min(1, Math.max(0, fraction));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (hingeAt(mid).phi < goal) lo = mid;
    else hi = mid;
  }
  return hingeAt(hi);
}

// Pose at crank position t from 0 (closed) to 1 (open): the moving pivots and the door's rotation about its closed B
export function hingeAt(t: number) {
  const { B, C } = linkage(theta0 + CRANK * Math.min(1, Math.max(0, t)), SIDE_OF_C);
  const phi = Math.atan2(C[1] - B[1], C[0] - B[0]) - angle0;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  // Door points from closed to current pose
  const place = ([x, y]: P): P => [B[0] + (x - B0[0]) * cos - (y - B0[1]) * sin, B[1] + (x - B0[0]) * sin + (y - B0[1]) * cos];
  return { t, B, C, phi, place, matrix: [cos, sin, -sin, cos, B[0] - (B0[0] * cos - B0[1] * sin), B[1] - (B0[0] * sin + B0[1] * cos)] as const };
}
