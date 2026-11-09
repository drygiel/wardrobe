import { Link } from 'react-router';
import { FrameShowcase } from '@/components/FrameShowcase';
import { GROUPS } from '@/components/parts';
import MeasureLink from '@/sections/MeasureLink';
import Showcase from '@/sections/Showcase';
import PartsSection from '@/sections/PartsSection';
import PlanSection from '@/sections/PlanSection';
import Footer from '@/sections/Footer';
import { picture, renderSmall } from '@/assets';

// The measuring page with every group but the frame switched off
const MEASURE_FRAME = `/pomiar?hide=${GROUPS.map(group => group.id).filter(id => id !== 'frame').join()}`;

export default function RamaPage() {
  return (
    <>
      <title>Rama – Szafa 2025</title>
      <meta name="theme-color" content="#161412" />
      <Showcase
        nav={[
          { href: '/', label: 'Szafa' },
          { href: '#rozkroj', label: 'Rozkrój' },
          { href: '#formatki', label: 'Formatki' },
          { href: MEASURE_FRAME, label: 'Pomiar' },
          { href: '/galeria', label: 'Galeria' },
          { href: '/rama', label: 'Rama', current: true },
          { href: '/elektryka', label: 'Elektryka' },
        ]}
        heading="Rama szafy: 14 formatek z trzech płyt dębowych."
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
        steps={['Trzy płyty 3000 × 620 mm', 'Rozkrój na 14 formatek', 'Formatki wstają z płyt', 'Rama 2660 mm do sufitu']}
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
            { view: 'cut', name: 'Rozkrój na płyty', value: '3 × 3000 × 620 mm', text: '14 formatek ułożonych tak, żeby zostało jak najmniej odpadu. Między listwami 5 mm na rzaz.' },
            { view: 'front', name: 'Widok z przodu', value: '2688 × 2660 mm', text: 'Cała szafa bez frontów, rama razem z wnętrzem.' },
            { view: 'side', name: 'Widok z boku', value: '560 × 2660 mm', text: 'Głębokość ramy 530 mm, razem z uchwytami 560 mm.' },
          ]}
        />
      </main>
      <Footer />
    </>
  );
}
