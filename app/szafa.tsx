import { Link } from 'react-router';
import { WardrobeShowcase } from '@/components/WardrobeShowcase';
import MeasureLink from '@/sections/MeasureLink';
import Showcase from '@/sections/Showcase';
import PlanSection from '@/sections/PlanSection';
import Gallery from '@/sections/Gallery';
import FrameTeaser from '@/sections/FrameTeaser';
import Footer from '@/sections/Footer';
import { picture, renderSmall } from '@/assets';

export default function SzafaPage() {
  return (
    <>
      <title>Szafa 2025</title>
      <meta name="theme-color" content="#161412" />
      <Showcase
        nav={[
          { href: '#budowa', label: 'Budowa' },
          { href: '/pomiar', label: 'Pomiar' },
          { href: '#plan', label: 'Plan' },
          { href: '/galeria', label: 'Galeria' },
          { href: '/rama', label: 'Rama' },
          { href: '/elektryka', label: 'Elektryka' },
        ]}
        heading="Szafa z litego dębu, od podłogi do sufitu."
        facts="268,8 × 266 × 53 cm. Cztery części, 86 elementów."
        hint="Przeciągnij, aby obrócić. Kliknij drzwi, aby je otworzyć."
        actions={
          <>
            <Link className="link" to="#budowa">
              Rozłóż na części
            </Link>
            <Link className="btn" to="/pomiar">
              Zmierz szafę
            </Link>
          </>
        }
        id="budowa"
        title="Z czego się składa"
        steps={[
          'Fronty odsuwają się',
          'Szuflady i półki wychodzą',
          'Zostaje światło i rama',
          'Rama: 14 formatek',
          '86 elementów wraca na miejsce',
        ]}
        photos={[
          [renderSmall(31), renderSmall(24)],
          [renderSmall(29), renderSmall(30)],
          [renderSmall(6), renderSmall(12)],
          [picture('boards'), renderSmall(14)],
          [renderSmall(26), renderSmall(1)],
        ]}
        scene={progress => <WardrobeShowcase progress={progress} />}
      />
      <main>
        <MeasureLink
          title="Zmierz sam"
          text="Najedź kursorem na krawędź, a pojawi się jej długość. Kliknij element, aby zobaczyć jego wymiary i rysunek."
          to="/pomiar"
        />
        <PlanSection />
        <Gallery />
        <FrameTeaser />
      </main>
      <Footer />
    </>
  );
}
