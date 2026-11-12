import { useId } from 'react';

/*
 * Brand mark of Szafa 2025: the oak frame seen face-on. Four members meet in 45° mitres (the open
 * diagonals), and the top one carries the milled groove with the amber LED strip lighting the opening.
 *
 * Brand rules
 * - Colours: the frame is currentColor (--ink on the page), the strip and its glow are --accent.
 *   The light theme needs no separate artwork: both tokens switch under [data-theme='light'].
 *   On a photo or a 3D scene give it a --bg halo (drop-shadow), never a box behind it.
 * - Logotype: mark + "Szafa" in --font-display (Erode 500) + "2025" in --font-text (Switzer 500),
 *   smaller, tracked out, tabular, in --muted. Mark height is 1.2× the "Szafa" font size.
 * - Minimum size: mark 16 px (favicon); full logotype with the mark at least 20 px high.
 * - Clear space: one frame member, 6/32 of the mark's height, on every side.
 * - Don't recolour the frame amber, rotate it, fill the opening, or set the mark without its strip.
 * public/favicon.svg repeats this drawing with fixed colours, since a tab has no page tokens.
 */
export default function Mark({ className }: { className?: string }) {
  const glow = useId();
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={glow} x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.32 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="16" height="16" fill={`url(#${glow})`} />
      <path fill="currentColor" d="M3 2h26l-6 6h-1V6H10v2H9zM2 3l6 6v14l-6 6zM30 3v26l-6-6V9zM3 30l6-6h14l6 6z" />
      <rect x="10" y="6" width="12" height="2" style={{ fill: 'var(--accent)' }} />
    </svg>
  );
}
