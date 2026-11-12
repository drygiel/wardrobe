import { Link } from 'react-router';
import { Icon } from '@/editor/icons';
import { FrameShowcase } from '@/components/FrameShowcase';
import Showcase from '@/sections/Showcase';
import CutList from '@/sections/CutList';
import Footer from '@/sections/Footer';
import Meta from '@/sections/Meta';
import NextPage from '@/sections/NextPage';
import { COUNTS, pageAt, SIZE } from '@/site';
import { picture, renderSmall } from '@/assets';

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
          <Link className="btn" to="#rozkroj">
            Rozłóż na płyty
            <Icon name="down" />
          </Link>
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
        <CutList />
        <NextPage after="/rama" />
      </main>
      <Footer />
    </>
  );
}
