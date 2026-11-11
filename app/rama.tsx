import { Link } from 'react-router';
import { FrameShowcase } from '@/components/FrameShowcase';
import { GROUPS } from '@/components/parts';
import MeasureLink from '@/sections/MeasureLink';
import Showcase from '@/sections/Showcase';
import PartsSection from '@/sections/PartsSection';
import PlanSection from '@/sections/PlanSection';
import Footer from '@/sections/Footer';
import Meta from '@/sections/Meta';
import NextPage from '@/sections/NextPage';
import { COUNTS, pageAt, SIZE } from '@/site';
import { picture, renderSmall } from '@/assets';

// The measuring page with every group but the frame switched off
const MEASURE_FRAME = `/pomiar?hide=${GROUPS.map(group => group.id).filter(id => id !== 'frame').join()}`;

export default function RamaPage() {
  return (
    <>
      <Meta page={pageAt('/rama')} />
      <Showcase
        current="/rama"
        heading={`Rama szafy: ${COUNTS.framePieces} formatek z trzech płyt dębowych.`}
        facts="Płyty 3000 × 620 × 40 mm. Frezy pod LED i ścięcia 45°."
        hint="Przeciągnij, aby obrócić."
        actions={
          <>
            <Link className="link" to="#formatki">
              Lista formatek
            </Link>
            <Link className="btn" to="#rozkroj">
              Rozłóż na płyty
            </Link>
          </>
        }
        id="rozkroj"
        title="Z płyty do ramy"
        steps={['Trzy płyty 3000 × 620 mm', `Rozkrój na ${COUNTS.framePieces} formatek`, 'Formatki wstają z płyt', `Rama ${SIZE.height} mm do sufitu`]}
        photos={[
          [picture('boards'), renderSmall(19)],
          [renderSmall(12), picture('led')],
          [renderSmall(8), renderSmall(14)],
          [renderSmall(26), renderSmall(24)],
        ]}
        scene={progress => <FrameShowcase progress={progress} />}
      />
      <main>
        <PartsSection />
        <MeasureLink
          title="Zmierz ramę"
          text="Pomiary otworzą się na samej ramie. Najedź na krawędź formatki, aby zobaczyć jej długość."
          to={MEASURE_FRAME}
        />
        <PlanSection
          title="Rozkrój i wymiary"
          rows={[
            { view: 'cut', name: 'Rozkrój na płyty', value: '3 × 3000 × 620 mm', text: `${COUNTS.framePieces} formatek ułożonych tak, żeby zostało jak najmniej odpadu. Między listwami 5 mm na rzaz.` },
            { view: 'front', name: 'Widok z przodu', value: `${SIZE.width} × ${SIZE.height} mm`, text: 'Cała szafa bez frontów, rama razem z wnętrzem.' },
            { view: 'side', name: 'Widok z boku', value: `${SIZE.depthOverall} × ${SIZE.height} mm`, text: `Głębokość ramy ${SIZE.depth} mm, z uchwytami razem ${SIZE.depthOverall} mm.` },
          ]}
        />
        <NextPage after="/rama" />
      </main>
      <Footer />
    </>
  );
}
