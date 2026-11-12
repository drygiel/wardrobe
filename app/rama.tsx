import { Link } from 'react-router';
import { Icon } from '@/editor/icons';
import { FrameShowcase } from '@/components/FrameShowcase';
import Showcase from '@/sections/Showcase';
import CutList from '@/sections/CutList';
import LedSection from '@/sections/LedSection';
import Footer from '@/sections/Footer';
import Meta from '@/sections/Meta';
import NextPage from '@/sections/NextPage';
import { COUNTS, pageAt, SIZE } from '@/site';

export default function RamaPage() {
  return (
    <>
      <Meta page={pageAt('/rama')} />
      <Showcase
        current="/rama"
        heading={
          <>
            Rama szafy:{' '}
            <Link className="mention" to="#zamowienie">
              {COUNTS.framePieces} formatek
            </Link>{' '}
            z trzech płyt dębowych.
          </>
        }
        facts={
          <>
            Płyty 3000 × 620 × 40 mm.{' '}
            <Link className="mention" to="#led">
              Frezy pod LED
            </Link>{' '}
            i ścięcia 45°.
          </>
        }
        hint="Przeciągnij, aby obrócić."
        actions={
          <Link className="btn" to="#rozkroj">
            Rozłóż na płyty
            <Icon name="down" />
          </Link>
        }
        id="rozkroj"
        label="Z płyty do ramy"
        chapters={[
          {
            title: 'Trzy płyty z litego dębu',
            text: (
              <>
                Cała rama mieści się na{' '}
                <Link className="mention" to="#zamowienie">
                  trzech płytach 3000 × 620 × 40 mm
                </Link>
                . Rozbieramy ją od góry, formatka po formatce, i odkładamy każdą tam, skąd została wycięta.
              </>
            ),
          },
          {
            title: `Rozkrój na ${COUNTS.framePieces} formatek`,
            text: (
              <>
                Formatki ułożone tak, żeby zostało jak najmniej odpadu. Między listwami 5 mm na rzaz. Każda ma{' '}
                <Link className="mention" to="#zamowienie">
                  swój kod, od P01 do P15
                </Link>
                .
              </>
            ),
          },
          {
            title: 'Montaż od podłogi',
            text: (
              <>
                Najpierw wieńce dolne, potem boki i słupki,{' '}
                <Link className="mention" to="/plan">
                  wnęka C
                </Link>{' '}
                z półką, na końcu wieńce górne. Każda formatka wchodzi na swoje miejsce z góry.
              </>
            ),
          },
          {
            title: `Rama ${SIZE.height} mm do sufitu`,
            text: (
              <>
                <Link className="mention" to="#led">
                  Frezy pod LED
                </Link>{' '}
                i ścięcia 45° składają się w jedną ramę. Wymiary i otwory każdej formatki są niżej, w liście do stolarni.
              </>
            ),
            link: { to: '#zamowienie', label: 'Lista do stolarni' },
          },
        ]}
        scene={progress => <FrameShowcase progress={progress} />}
      />
      <main>
        <CutList />
        <LedSection />
        <NextPage after="/rama" />
      </main>
      <Footer />
    </>
  );
}
