import { createRoot } from 'react-dom/client';
import { AppProvider } from '@/contexts/AppContext';
import { Model as Wardrobe } from '@/components/Wardrobe';
import MeasureStage from '@/MeasureStage';
import './global.scss';

createRoot(document.getElementById('root')!).render(
  <AppProvider initial={{ grid: true, gizmo: true, view: 'initial', hideFronts: true }}>
    <MeasureStage>
      <Wardrobe />
    </MeasureStage>
  </AppProvider>,
);
