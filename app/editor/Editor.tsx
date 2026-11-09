import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, XROrigin } from '@react-three/xr';
import { Link } from 'react-router';
import { type SceneView, useApp } from '@/contexts/AppContext';
import { useEventListener } from '@/hooks/useEventListener';
import Scene from '@/components/Scene';
import { Model as Wardrobe } from '@/components/Wardrobe';
import { Icon, type IconName } from './icons';
import { Inspector } from './Inspector';
import { selection } from './selection';
import { Sidebar } from './Sidebar';
import styles from './Editor.module.scss';

const VIEWS: { id: SceneView; label: string; icon: IconName }[] = [
  { id: 'initial', label: '3D', icon: 'perspective' },
  { id: 'front', label: 'Przód', icon: 'front' },
  { id: 'side', label: 'Bok', icon: 'side' },
  { id: 'top', label: 'Góra', icon: 'top' },
];

export default function Editor() {
  const app = useApp();
  const shell = useRef<HTMLDivElement>(null!);
  const press = useRef<[number, number] | null>(null);
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    app.inspect.current = selection.hover;
    return () => {
      app.inspect.current = null;
      // The store outlives this route; meshes it holds die with the scene
      selection.hover(null);
      selection.unpin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => selection.refocus(), [app.hidden, app.hiddenParts, app.column, app.grain]);

  const toggleOpen = () => {
    if (open) app.parts.current?.closeAll();
    else app.parts.current?.openAll();
    setOpen(!open);
  };

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : shell.current.requestFullscreen());

  // Follows the browser, since Esc leaves fullscreen without touching the button
  useEventListener('fullscreenchange', () => setIsFullscreen(document.fullscreenElement === shell.current));

  useEventListener('keydown', event => {
    if ((event.target as HTMLElement).matches('input') || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'm') app.setWireframe(w => !w);
    else if (key === 's') app.setGrain(g => !g);
    else if (key === 'escape') selection.unpin();
    else if (key >= '1' && key <= '4') app.toggleView(VIEWS[Number(key) - 1].id);
  });

  return (
    <div ref={shell} className={styles.shell}>
      <aside className={styles.side} aria-label="Grupy i elementy">
        <Link className={styles.brand} to="/">Szafa 2025</Link>
        <Suspense fallback={<p className={styles.note}>Wczytywanie modelu…</p>}>
          <Sidebar />
        </Suspense>
      </aside>

      <main className={styles.view}>
        <Canvas
          className={styles.canvas}
          dpr={[1, 1.75]}
          onCreated={state => (selection.root = state.scene)}
          onPointerDown={event => (press.current = [event.clientX, event.clientY])}
          onPointerLeave={() => selection.hover(null)}
          onClick={event => {
            const from = press.current;
            press.current = null; // a gizmo press never reaches onPointerDown and must not reuse this one
            if (app.wireframe && from && Math.hypot(event.clientX - from[0], event.clientY - from[1]) < 5) selection.pin();
          }}
        >
          <XR store={app.xr}>
            <XROrigin position={[2.5, 0, -0.5]} rotation={[0, Math.PI / 2, 0]} scale={1} />
            <Scene editorCamera>
              <Wardrobe />
            </Scene>
          </XR>
        </Canvas>

        <div className={styles.toolbar}>
          <div className={styles.tools}>
            <div className={styles.seg} role="group" aria-label="Tryb">
              <button aria-pressed={!app.wireframe} onClick={() => app.setWireframe(false)}><Icon name="render" />Wizualizacja</button>
              <button aria-pressed={app.wireframe} onClick={() => app.setWireframe(true)}><Icon name="measure" />Pomiar</button>
            </div>
            <div className={styles.seg} role="group" aria-label="Widok">
              {VIEWS.map(view => (
                <button key={view.id} aria-pressed={app.viewOn(view.id)} onClick={() => app.toggleView(view.id)}><Icon name={view.icon} />{view.label}</button>
              ))}
            </div>
          </div>
          <div className={styles.toolsEnd}>
            <div className={styles.seg} role="group" aria-label="Model">
              <button aria-pressed={app.grain} onClick={() => app.setGrain(g => !g)}><Icon name="grain" />Słoje</button>
              <button aria-pressed={open} title={open ? 'Zamknij drzwi i szuflady' : 'Otwórz drzwi i szuflady'} onClick={toggleOpen}>
                <Icon name={open ? 'close' : 'open'} />{open ? 'Zamknij wszystko' : 'Otwórz wszystko'}
              </button>
            </div>
            <div className={`${styles.seg} ${styles.pair}`} role="group" aria-label="Prezentacja">
              <button aria-pressed={isFullscreen} onClick={fullscreen}><Icon name="fullscreen" />Pełny ekran</button>
              <button onClick={() => app.xr.enterAR()}><Icon name="ar" />AR</button>
              <button onClick={() => app.xr.enterVR()}><Icon name="vr" />VR</button>
            </div>
          </div>
        </div>

        <p className={styles.status} aria-live="polite">
          {app.wireframe && (
            <span>
              Krawędź <b ref={app.readout}>–</b>
            </span>
          )}
          <span className={styles.keys}>M pomiar · S słoje · 1–4 widoki · klik przypina · Esc odpina</span>
        </p>
      </main>

      <aside className={styles.insp} aria-label="Inspektor elementu" aria-live="polite">
        <Suspense fallback={<p className={styles.note}>Wczytywanie modelu…</p>}>
          <Inspector />
        </Suspense>
      </aside>
    </div>
  );
}
