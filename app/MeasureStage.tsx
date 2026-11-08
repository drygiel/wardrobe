import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { XR, XROrigin } from '@react-three/xr';
import cn from 'classnames';
import { useApp } from '@/contexts/AppContext';
import Scene from '@/components/Scene';
import styles from './MeasureStage.module.scss';

type Props = {
  children: ReactNode;
  // Embedded in a scrolling page: a card over the scene, camera controls on click
  embedded: { id: string; title: string; text: string };
  // The model on this stage can show its wiring
  electric?: boolean;
};

export default function MeasureStage({ children, embedded, electric }: Props) {
  const app = useApp();
  const stageRef = useRef<HTMLElement>(null!);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && app.setActive(false);
    const io = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (!entry.isIntersecting) app.setActive(false);
    });
    io.observe(stageRef.current);
    window.addEventListener('keydown', onKey);
    return () => {
      io.disconnect();
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  const fullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await stageRef.current.requestFullscreen();
  };

  const toggles = (
    <div className={styles.toggles}>
      <label>
        <input type="checkbox" checked={app.wireframe} onChange={() => app.setWireframe(w => !w)} />
        Tryb pomiaru
      </label>
      <label>
        <input type="checkbox" checked={app.orthographic} onChange={() => app.setOrthographic(o => !o)} />
        Rzut prostokątny
      </label>
      <label>
        <input type="checkbox" checked={app.grid} onChange={() => app.setGrid(g => !g)} />
        Siatka
      </label>
      <label>
        <input type="checkbox" checked={app.hideFronts} onChange={() => app.toggleGroup('fronts')} />
        Bez frontów
      </label>
      {electric && (
        <label>
          <input type="checkbox" checked={app.electric} onChange={() => app.toggleGroup('electric')} />
          Elektryka
        </label>
      )}
      <label>
        Warstwa
        <input
          className={styles.layer}
          type="number"
          value={app.layer}
          onChange={event => app.setLayer(Math.min(3, Math.max(0, Number(event.target.value) || 0)))}
          min={0}
          max={3}
        />
      </label>
    </div>
  );

  const actions = (
    <div className={styles.actions}>
      <button className="link" onClick={() => fullscreen()}>
        Pełny ekran
      </button>
      <button className="link" onClick={() => app.setView(app.view === 'initial' ? 'left-side' : 'initial')}>
        Reset widoku
      </button>
      <button className="link" onClick={() => app.xr.enterAR()}>
        AR
      </button>
      <button className="link" onClick={() => app.xr.enterVR()}>
        VR
      </button>
    </div>
  );

  return (
    <section
      id={embedded.id}
      ref={stageRef}
      className={cn(styles.stage, styles.embedded)}
      aria-labelledby={`${embedded.id}-h`}
    >
      <Canvas
        className={styles.canvas}
        dpr={[1, 1.75]}
        frameloop={visible ? 'always' : 'never'}
        onPointerDown={() => !app.active && app.setActive(true)}
      >
        <XR store={app.xr}>
          <XROrigin position={[2.5, 0, -0.5]} rotation={[0, Math.PI / 2, 0]} scale={1} />
          <Scene>{children}</Scene>
        </XR>
        {import.meta.env.DEV && <Stats className={styles.stats} />}
      </Canvas>

      <aside className={styles.card}>
        <h2 id={`${embedded.id}-h`}>{embedded.title}</h2>
        <p>{embedded.text}</p>
        <p className={styles.touchHint}>Stuknij scenę, aby nią obracać. Esc lub przewinięcie kończy.</p>
        <p className={styles.readout} aria-live="polite">
          <span ref={app.readout}>–</span>
        </p>
        <dl className={styles.keys}>
          <dt>Obrót</dt>
          <dd>lewy przycisk myszy</dd>
          <dt>Przesuwanie</dt>
          <dd>prawy przycisk lub Shift</dd>
          <dt>Przybliżenie</dt>
          <dd>kółko, do kursora</dd>
          <dt>Telefon</dt>
          <dd>1 palec obraca, 2 przybliżają</dd>
        </dl>
        {toggles}
        {actions}
      </aside>
      <p className={styles.hint}>
        {app.active ? 'Esc kończy sterowanie kamerą.' : 'Kliknij scenę, aby obracać i przybliżać.'}
      </p>
    </section>
  );
}
