'use client';

import { Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { XR, XROrigin } from '@react-three/xr';
import { OrbitHandles } from '@react-three/handle';
import { PointerEvents } from '@react-three/xr';
import Button from 'antd/lib/button';
import Switch from 'antd/lib/switch';
import InputNumber from 'antd/lib/input-number';
import Layout from 'antd/lib/layout';
import cn from 'classnames';
import { useApp } from '@/contexts/AppContext';
import Scene from '@/components/Scene';
import styles from './App.module.scss';

function App() {
  const app = useApp();

  const fullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const elem = document.querySelector('#app');
    await (elem || document.body)?.requestFullscreen();
  };

  return (
    <div id="app" className={styles.App}>
      <Layout className={cn(styles.tools, { [styles.hidden]: !app.gizmo })}>
        <div className={styles.main}>
          <Switch
            checked={app.wireframe}
            onChange={() => app.setWireframe(w => !w)}
            checkedChildren="Wireframe"
            unCheckedChildren="Textures"
          />
          <Switch
            checked={app.orthographic}
            onChange={() => app.setOrthographic(o => !o)}
            checkedChildren="Orthographic"
            unCheckedChildren="Orthographic"
          />

          <Switch
            checked={app.grid}
            onChange={() => app.setGrid(g => !g)}
            checkedChildren="Grid"
            unCheckedChildren="Grid"
          />

          <Switch
            checked={app.hideFronts}
            onChange={() => app.setHideFronts(h => !h)}
            checkedChildren="Hide Fronts"
            unCheckedChildren="Hide Fronts"
          />

          <InputNumber
            value={app.layer}
            onChange={value => app.setLayer(value ?? 0)}
            min={0}
            max={3}
          />
        </div>

        <div className={styles.right}>
          <Button type="primary" onClick={() => fullscreen()}>
            Full Screen
          </Button>
          <Button type="primary" onClick={() => app.setView(app.view === 'initial' ? 'left-side' : 'initial')}>
            Reset Camera
          </Button>
          <Button onClick={() => app.xr.enterVR()}>VR</Button>
          <Button onClick={() => app.xr.enterAR()}>AR</Button>
          <Button onClick={() => app.xr.enterXR('immersive-ar')}>XR</Button>
        </div>
      </Layout>

      <Canvas shadows dpr={2}>
        <PointerEvents />
        <OrbitHandles />
        <XR store={app.xr}>
          <XROrigin position={[2.5, 0, -0.5]} rotation={[0, Math.PI / 2, 0]} scale={10} />
          <Scene />
        </XR>
        {process.env.NODE_ENV === 'development' && <Stats className={styles.stats} />}
      </Canvas>
    </div>
  );
}

export default App;
