import * as THREE from 'three';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useGLTF } from '@react-three/drei';
import { FRAME_GLB, FRAME_PIECES, HARDWARE_GLB, WARDROBE_GLB } from '@/assets';
import { boxes } from '@/components/PlanDrawing';
import { groupOf, kindOf } from '@/components/parts';
import { LED_METRES, num } from '@/electric/data';
import { measure } from '@/home/layers';
import table from '@/okucia/Okucia.module.scss';
import styles from './Inventory.module.scss';

type Box = ReturnType<typeof boxes>[number];

// Edge lengths of a part's box in millimetres, shortest first
const edges = (box: Box) => [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z].map(m => Math.round(m * 1000)).sort((a, b) => a - b);

// The value most parts of a group share
function common(values: number[]) {
  const seen = new Map<number, number>();
  values.forEach(value => seen.set(value, (seen.get(value) ?? 0) + 1));
  return [...seen].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const thickness = (list: Box[]) => `${common(list.map(box => edges(box)[0]))} mm`;

// Every group of parts counted in the exported models, each with the page that shows it in detail
export default function Inventory() {
  const wardrobe = useGLTF(WARDROBE_GLB) as unknown as { scene: THREE.Object3D };
  const frame = useGLTF(FRAME_GLB) as unknown as { scene: THREE.Object3D };
  const hardware = useGLTF(HARDWARE_GLB) as unknown as { scene: THREE.Object3D };

  const rows = useMemo(() => {
    const parts = boxes(wardrobe.scene);
    const of = (test: (name: string) => boolean) => parts.filter(box => test(box.name));
    const framePieces = boxes(frame.scene, FRAME_PIECES);
    const fixings = boxes(hardware.scene);
    const interior = of(name => groupOf(name) === 'interior');
    const fronts = of(name => kindOf(name) === 'front');
    const back = of(name => kindOf(name) === 'back');
    const dowels = fixings.filter(box => /^J\d\d_/.test(box.name));
    const blocks = fixings.filter(box => /^MB\d_/.test(box.name));
    const pins = fixings.filter(box => box.name.startsWith('PIN_'));
    const innerDowels = fixings.filter(box => box.name.startsWith('DW_'));
    const dowel = dowels.length ? edges(dowels[0]) : [];
    const block = blocks.length ? edges(blocks[0]) : [];

    const list = [
      { name: 'Formatki ramy', count: framePieces.length, size: thickness(framePieces), note: 'Lity dąb, z trzech płyt 3000 × 620 × 40 mm', to: '/rama', label: 'Rama' },
      { name: 'Półki i przegrody', count: interior.length, size: thickness(interior), note: 'Wnętrze sekcji A, B, C i D', to: measure('interior'), label: 'Pomiar' },
      { name: 'Szuflady', count: of(name => kindOf(name) === 'drawer').length, size: 'gł. 487 mm', note: 'Pięć w szafie B, jedna we wnęce C', to: '/okucia#szuflady', label: 'Okucia' },
      { name: 'Fronty', count: fronts.length, size: thickness(fronts), note: 'Drzwi, front regału A i maskownica', to: measure('fronts'), label: 'Pomiar' },
      { name: 'Uchwyty', count: of(name => kindOf(name) === 'handle').length, size: '–', note: 'Na drzwiach dolnych', to: measure('fronts'), label: 'Pomiar' },
      { name: 'Plecy i panel boczny', count: back.length, size: thickness(back), note: 'Zamykają szafę od tyłu i od boku', to: measure('back'), label: 'Pomiar' },
      { name: 'Paski LED', count: of(name => kindOf(name) === 'led').length, size: `${num(LED_METRES, 2)} m`, note: '24 V, w rowkach 18 × 7,5 mm', to: '/elektryka', label: 'Elektryka' },
      { name: 'Zawiasy', count: fixings.filter(box => box.name.endsWith('_Cup')).length, size: 'puszka Ø35 mm', note: 'Na siedmiu drzwiach', to: '/okucia#zawiasy', label: 'Okucia' },
      { name: 'Podpórki półek', count: pins.length, size: 'Ø5 × 16 mm', note: `Po cztery pod ${pins.length / 4} półkami`, to: '/okucia#podporki', label: 'Okucia' },
      { name: 'Kołki', count: dowels.length, size: dowel.length ? `Ø${dowel[0]} × ${dowel[2]} mm` : '–', note: 'Łączą formatki ramy', to: measure('frame', 'dowels'), label: 'Pomiar' },
      { name: 'Kołki wnętrza', count: innerDowels.length, size: 'Ø8 × 30 mm', note: 'Łączą półki i przegrody wnętrza', to: '/okucia#kolki', label: 'Okucia' },
      { name: 'Klocki montażowe', count: blocks.length, size: block.length ? `${block.join(' × ')} mm` : '–', note: 'W szafie D', to: measure('frame', 'blocks'), label: 'Pomiar' },
    ];
    // The first seven rows are the parts the site counts as "elementy"; hinges, dowels and blocks are hardware
    return { list, parts: list.slice(0, 7).reduce((sum, row) => sum + row.count, 0) };
  }, [wardrobe, frame, hardware]);

  return (
    <section id="zestawienie" className={styles.inventory} aria-labelledby="zestawienie-h">
      <header>
        <h2 id="zestawienie-h">Zestawienie elementów</h2>
        <p>Policzone w modelu 3D. Model nie podaje producentów okuć ani materiału płyt wnętrza i frontów, dlatego nie ma ich w tabeli.</p>
      </header>
      <div className={styles.scroll}>
        <table className={table.table}>
          <thead>
            <tr>
              <th scope="col">Element</th>
              <th scope="col">Sztuk</th>
              <th scope="col">Grubość lub wymiar</th>
              <th scope="col">Uwagi</th>
              <th scope="col">Szczegóły</th>
            </tr>
          </thead>
          <tbody>
            {rows.list.map(row => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td>{row.count}</td>
                <td>{row.size}</td>
                <td className={styles.note}>{row.note}</td>
                <td>
                  <Link className="link" to={row.to}>
                    {row.label}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Razem bez okuć</th>
              <td>{rows.parts}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={styles.after}>
        „Razem bez okuć” to formatki, półki, szuflady, fronty, uchwyty, plecy i paski LED. Zawiasy, kołki i klocki liczone są osobno. Pomiar pokazuje 219 elementów, bo dolicza też każdą część
        okuć i elektryki.
      </p>
    </section>
  );
}
