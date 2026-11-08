import { createRoot } from 'react-dom/client';
import { AppProvider } from '@/contexts/AppContext';
import { Model as Wardrobe } from '@/components/Wardrobe';
import { WardrobeShowcase } from '@/components/WardrobeShowcase';
import MeasureStage from '@/MeasureStage';
import Showcase from '@/sections/Showcase';
import PlanSection from '@/sections/PlanSection';
import Gallery from '@/sections/Gallery';
import FrameTeaser from '@/sections/FrameTeaser';
import Footer from '@/sections/Footer';
import { picture, renderSmall } from '@/assets';
import './global.scss';

createRoot(document.getElementById('root')!).render(
  <>
    <Showcase
      nav={[
        { href: '#budowa', label: 'Budowa' },
        { href: '#pomiar', label: 'Pomiar' },
        { href: '#plan', label: 'Plan' },
        { href: '#galeria', label: 'Galeria' },
        { href: 'rama.html', label: 'Rama' },
        { href: 'elektryka.html', label: 'Elektryka' },
      ]}
      heading="Szafa z litego dębu, od podłogi do sufitu."
      facts="268,8 × 266 × 53 cm. Cztery części, 86 elementów."
      hint="Przeciągnij, aby obrócić. Kliknij drzwi, aby je otworzyć."
      actions={
        <>
          <a className="link" href="#budowa">
            Rozłóż na części
          </a>
          <a className="btn" href="#pomiar">
            Zmierz szafę
          </a>
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
      <AppProvider initial={{ wireframe: true, grid: true, gizmo: true, active: false, view: 'left-side' }}>
        <MeasureStage
          electric
          embedded={{
            id: 'pomiar',
            title: 'Zmierz sam',
            text: 'Najedź kursorem na krawędź. Długość pojawi się przy czerwonej linii.',
          }}
        >
          <Wardrobe />
        </MeasureStage>
      </AppProvider>
      <PlanSection />
      <Gallery />
      <FrameTeaser />
    </main>
    <Footer />
  </>,
);
