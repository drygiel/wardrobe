import * as THREE from 'three';
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import cn from 'classnames';
import { FRAME_GLB } from '@/assets';
import styles from './PartsSection.module.scss';

type Group = { name: string; size: string; pieces: string[]; text: string };

// Dimensions from 1_Frame in Szafa4.blend; LED channels and 45° cuts from the cutting plan
const GROUPS: Group[] = [
  { name: 'Bok lewy', size: '2650 × 530 × 40', pieces: ['P14_B_Side-L'], text: 'Bok szafy B. Frez LED 18 × 7,5 mm od 580 do 2630 mm, końce chowają się pod deskami regału A. Ścięcie 45° od frontu.' },
  { name: 'Pas przedni D', size: '2650 × 200 × 40', pieces: ['P09_D_Post-Front-R'], text: 'Frez LED przez całą długość, końce pod półkami sekcji D. Ścięcia 45° na obu końcach.' },
  { name: 'Wieniec górny', size: '2280 × 200 × 40', pieces: ['P07_B_Rail-Top-Front'], text: 'Przód górnego wieńca. Ścięcia 45° tam, gdzie spotyka boki.' },
  { name: 'Wieniec dolny', size: '2280 × 200 × 40', pieces: ['P08_B_Rail-Bottom-Front'], text: 'Przód dolnego wieńca, stoi na podłodze. Ścięcia 45° na narożnikach.' },
  { name: 'Boki wnęki C', size: '2 × 1300 × 530 × 40', pieces: ['P03_C_Side-L', 'P05_C_Side-R'], text: 'Dwa boki wnęki, każdy z frezem LED od środka i jednym ścięciem 45°.' },
  { name: 'Dno i wieniec C', size: '530 × 360 × 40, 330 × 360 × 40', pieces: ['P04_C_Bottom', 'P06_C_Top'], text: 'Zamykają wnękę od dołu i od góry. Dno ma dwa ścięcia 45°.' },
  { name: 'Półka C', size: '422 × 280 × 40', pieces: ['P15_C_Shelf'], text: 'Dzieli wnękę C na wysokości 2021 mm. Cofnięta o 108 mm od frontu, równo z frezem LED, sięga do tylnej ściany.' },
  { name: 'Listwy tylne', size: '2200, 1195, 645 × 40 × 40', pieces: ['P02_B_Rail-Bottom-Rear', 'P13_B_Rail-Top-Rear', 'P10_D_Rail-Top-Rear'], text: 'Trzy listwy 40 × 40 mm z tyłu ramy: dolna, górna B i górna D.' },
  { name: 'Słupek tylny D', size: '2650 × 40 × 40', pieces: ['P01_D_Post-Rear-R'], text: 'Tylny narożnik szafy D, od podłogi do sufitu.' },
  { name: 'Poprzeczki D', size: '2 × 290 × 40 × 40', pieces: ['P12_D_Crossbar-Top-R', 'P11_D_Crossbar-Bottom-R'], text: 'Łączą pas przedni ze słupkiem tylnym. Mają tę samą siatkę, są wymienne.' },
];

type Result = { nodes: Record<string, THREE.Mesh> };

export function Preview({ active }: { active: string[] }) {
  const { nodes } = useGLTF(FRAME_GLB) as unknown as Result;
  const pieces = useMemo(() => GROUPS.flatMap(g => g.pieces), []);
  const materials = useMemo(
    () => ({
      on: new THREE.MeshStandardMaterial({ color: '#f0b35a', roughness: 0.9 }),
      off: new THREE.MeshStandardMaterial({ color: '#8f8577', roughness: 1 }),
    }),
    [],
  );

  return (
    <group position={[0.265, -1.33, 1.14]}>
      {pieces.map(name => (
        <mesh key={name} geometry={nodes[name].geometry} position={nodes[name].position} quaternion={nodes[name].quaternion} material={active.includes(name) ? materials.on : materials.off} />
      ))}
    </group>
  );
}

// Big names on the left, the frame on the right with the hovered pieces lit
export default function PartsSection() {
  const [index, setIndex] = useState(0);
  const group = GROUPS[index];

  return (
    <section id="formatki" className={styles.parts} aria-labelledby="formatki-h">
      <div className={styles.names}>
        <h2 id="formatki-h">Formatki</h2>
        <ul>
          {GROUPS.map((g, i) => (
            <li key={g.name} className={cn({ [styles.on]: i === index })}>
              <button aria-pressed={i === index} onMouseEnter={() => setIndex(i)} onFocus={() => setIndex(i)} onClick={() => setIndex(i)}>
                <span className={styles.big}>{g.name}</span>
                <span className={styles.meta}>{g.size} mm</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <figure className={styles.preview}>
        <div className={styles.view} aria-hidden="true">
          <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ fov: 30, position: [-5.2, 2.4, -3.6], near: 0.1, far: 50 }} onCreated={s => s.camera.lookAt(0, 0, 0)}>
            <ambientLight intensity={1.6} />
            <directionalLight position={[-4, 6, -3]} intensity={2.4} />
            <Suspense fallback={null}>
              <Preview active={group.pieces} />
            </Suspense>
          </Canvas>
        </div>
        <figcaption aria-live="polite">{group.text}</figcaption>
      </figure>
    </section>
  );
}
