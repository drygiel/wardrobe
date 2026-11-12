import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { Link } from 'react-router';
import { type SceneView, useApp } from '@/contexts/AppContext';
import { useEventListener } from '@/hooks/useEventListener';
import Scene from '@/components/Scene';
import { Model as Wardrobe } from '@/components/Wardrobe';
import Mark from '@/sections/Mark';
import { HoverPulse } from './HoverPulse';
import { Icon, type IconName } from './icons';
import { Inspector } from './Inspector';
import { PanelResizer } from './PanelResizer';
import { selection, useSelection } from './selection';
import { readLink, ShareLink } from './ShareLink';
import { Sidebar } from './Sidebar';
import { UndoHistory } from './UndoHistory';
import styles from './Editor.module.scss';

const VIEWS: { id: SceneView; label: string; icon: IconName }[] = [
  { id: 'initial', label: '3D', icon: 'perspective' },
  { id: 'front', label: 'Przód', icon: 'front' },
  { id: 'side', label: 'Bok', icon: 'side' },
  { id: 'top', label: 'Góra', icon: 'top' },
];

// Shown in the status bar; the keys themselves are handled in Editor and UndoHistory
const SHORTCUTS: [keys: string[], label: string][] = [
  [['M'], 'pomiar'],
  [['S'], 'słoje'],
  [['O'], 'drzwi'],
  [['F'], 'pełny ekran'],
  [['1–4'], 'widoki'],
  [['Klik'], 'przypina'],
  [['Esc'], 'odpina'],
  [['Ctrl', 'Z'], 'cofa'],
  [['Ctrl', 'Y'], 'ponawia'],
];

export default function Editor() {
  const app = useApp();
  const { pinned } = useSelection();
  const shell = useRef<HTMLDivElement>(null!);
  const press = useRef<[number, number] | null>(null);
  const [link] = useState(readLink);
  const [open, setOpen] = useState(link.open === 'all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    app.inspect.current = selection.hover;
    return () => {
      app.inspect.current = null;
      // The store outlives this route; meshes it holds die with the scene
      selection.hover(null);
      selection.hoverGroup([]);
      selection.unpin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first real mouse movement switches off the touch layout, whatever the browser says about hover (Editor.module.scss)
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      shell.current.dataset.mouse = '';
      window.removeEventListener('pointermove', onMove);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    selection.shown = app.shown;
    selection.refocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.hidden, app.hiddenParts, app.columns, app.grain]);

  // Only on the switch: a link opened in the render mode may carry a selection of its own
  const wasMeasuring = useRef(app.wireframe);
  useEffect(() => {
    if (wasMeasuring.current && !app.wireframe) selection.unpin();
    wasMeasuring.current = app.wireframe;
  }, [app.wireframe]);

  // The wrist menu opens and closes doors too
  useEffect(() => {
    if (!app.presenting) setOpen(open => (app.parts.current ? Boolean(app.parts.current.openState()) : open));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.presenting]);

  const toggleOpen = () => {
    if (open) app.parts.current?.closeAll();
    else app.parts.current?.openAll();
    setOpen(!open);
  };

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : shell.current.requestFullscreen());

  // Follows the browser, since Esc leaves fullscreen without touching the button
  useEventListener('fullscreenchange', () => setIsFullscreen(document.fullscreenElement === shell.current));

  // One way back, for the button and for Esc: first out of the selection, then out of the isolation
  const back = () => (selection.pinned ? selection.unpin() : app.exitIsolation());

  useEventListener('keydown', event => {
    if ((event.target as HTMLElement).matches('input') || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'm') app.setWireframe(w => !w);
    else if (key === 's') app.setGrain(g => !g);
    else if (key === 'o') toggleOpen();
    else if (key === 'f') fullscreen();
    else if (key === 'escape') back();
    else if (key >= '1' && key <= '4') app.toggleView(VIEWS[Number(key) - 1].id);
  });

  return (
    <div ref={shell} className={styles.shell}>
      <aside className={styles.side} aria-label="Grupy i elementy">
        <Link className={styles.brand} to="/">
          <Mark />
          Szafa 2025
        </Link>
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
            <Scene editorCamera link={link} orbitCenter={selection.orbitCenter}>
              <Wardrobe />
              <HoverPulse />
              <Suspense fallback={null}>
                <ShareLink />
                {/* The doors moved without the button: its label follows them, as after an XR session */}
                <UndoHistory onRestore={() => setOpen(Boolean(app.parts.current?.openState()))} />
              </Suspense>
            </Scene>
          </XR>
        </Canvas>

        <div className={styles.toolbar}>
          <div className={styles.tools}>
            <div className={styles.seg} role="group" aria-label="Tryb">
              <button aria-pressed={!app.wireframe} onClick={() => app.setWireframe(false)}><Icon name="render" />Wizualizacja</button>
              <button aria-pressed={app.wireframe} title="Skrót: M przełącza tryb" onClick={() => app.setWireframe(true)}><Icon name="measure" />Pomiar<kbd className={styles.key}>M</kbd></button>
            </div>
            <div className={styles.seg} role="group" aria-label="Widok">
              {VIEWS.map((view, i) => (
                <button key={view.id} aria-pressed={app.viewOn(view.id)} title={`Skrót: ${i + 1}`} onClick={() => app.toggleView(view.id)}>
                  <Icon name={view.icon} />{view.label}<kbd className={styles.key}>{i + 1}</kbd>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.toolsEnd}>
            <div className={`${styles.seg} ${styles.pair}`} role="group" aria-label="Prezentacja">
              <button aria-pressed={isFullscreen} title="Skrót: F" onClick={fullscreen}><Icon name="fullscreen" />Pełny ekran<kbd className={styles.key}>F</kbd></button>
              <button onClick={() => app.xr.enterAR()}><Icon name="ar" />AR</button>
              <button onClick={() => app.xr.enterVR()}><Icon name="vr" />VR</button>
            </div>
            {(pinned || app.isolated) && (
              <div className={styles.seg}>
                <button
                  className={styles.exitIsolation}
                  title={pinned ? 'Odepnij zaznaczony element' : 'Pokaż z powrotem resztę szafy'}
                  onClick={back}
                >
                  <Icon name="undo" />Cofnij<kbd>Esc</kbd>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.corner}>
          <div className={styles.seg} role="group" aria-label="Model">
            <button aria-pressed={app.grain} title="Skrót: S" onClick={() => app.setGrain(g => !g)}><Icon name="grain" />Słoje<kbd className={styles.key}>S</kbd></button>
            <button aria-pressed={open} title={`${open ? 'Zamknij drzwi i szuflady' : 'Otwórz drzwi i szuflady'}. Skrót: O`} onClick={toggleOpen}>
              <Icon name={open ? 'close' : 'open'} />{open ? 'Zamknij wszystko' : 'Otwórz wszystko'}<kbd className={styles.key}>O</kbd>
            </button>
          </div>
        </div>
      </main>

      <aside className={styles.insp} aria-label="Inspektor elementu" aria-live="polite">
        <Suspense fallback={<p className={styles.note}>Wczytywanie modelu…</p>}>
          <Inspector />
        </Suspense>
      </aside>

      {/* The status bar of an application: what the cursor measures on the left, the keys on the right */}
      <footer className={styles.bar}>
        <p className={styles.status} aria-live="polite">
          {app.wireframe ? (
            <>
              Krawędź <b ref={app.readout}>–</b>
            </>
          ) : (
            'Wizualizacja'
          )}
        </p>
        <ul className={styles.keys} aria-label="Skróty klawiszowe">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={label}>
              {keys.map(key => (
                <kbd key={key}>{key}</kbd>
              ))}
              {label}
            </li>
          ))}
        </ul>
      </footer>

      <PanelResizer shell={shell} panel="side" />
      <PanelResizer shell={shell} panel="insp" />
    </div>
  );
}
