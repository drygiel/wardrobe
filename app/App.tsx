'use client';

import { Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import '@ant-design/v5-patch-for-react-19';
import { Switch, InputNumber, Button, Layout } from 'antd';
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

        <Button onClick={() => fullscreen()}>Full Screen</Button>

        <Button>VR Mode</Button>
      </Layout>

      <Canvas shadows dpr={2}>
        <Scene />
        <Stats className={styles.stats} />
      </Canvas>
    </div>
  );
}

export default App;
