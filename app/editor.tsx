import { createRoot } from 'react-dom/client';
import { AppProvider } from '@/contexts/AppContext';
import App from '@/App';
import './global.scss';

createRoot(document.getElementById('root')!).render(
  <AppProvider initial={{ grid: true, gizmo: true, view: 'initial', hideFronts: true }}>
    <section>
      <App />
    </section>
  </AppProvider>,
);
