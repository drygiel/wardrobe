import { type RefObject, useEffect, useRef } from 'react';
import styles from './Editor.module.scss';

const MIN_VIEW = 510; // the toolbar's left and right clusters still fit side by side
const KEY_STEP = 16;

const PANELS = {
  side: { variable: '--side-w', min: 240, max: 480, direction: 1, label: 'Szerokość panelu elementów', className: styles.resizerSide },
  insp: { variable: '--insp-w', min: 300, max: 600, direction: -1, label: 'Szerokość inspektora', className: styles.resizerInsp },
};

// The border between a panel and the model. Writes a CSS variable, so dragging does not re-render the editor
export function PanelResizer({ shell, panel }: { shell: RefObject<HTMLDivElement>; panel: keyof typeof PANELS }) {
  const { variable, min, max, direction, label, className } = PANELS[panel];
  const handle = useRef<HTMLDivElement>(null!);
  const grab = useRef<number | null>(null); // panel width minus the signed pointer position when the drag began

  const read = (name: string) => parseFloat(getComputedStyle(shell.current).getPropertyValue(name));

  const resize = (width: number) => {
    const room = read(variable) + shell.current.querySelector('main')!.clientWidth - MIN_VIEW;
    const next = Math.round(Math.max(min, Math.min(max, room, width)));
    shell.current.style.setProperty(variable, `${next}px`);
    handle.current.ariaValueNow = String(next);
  };

  useEffect(() => {
    handle.current.ariaValueNow = String(read(variable));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={handle}
      className={`${styles.resizer} ${className}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        grab.current = read(variable) - direction * event.clientX;
      }}
      onPointerMove={event => grab.current !== null && resize(grab.current + direction * event.clientX)}
      onLostPointerCapture={() => (grab.current = null)}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        resize(read(variable) + direction * (event.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP));
      }}
    />
  );
}
