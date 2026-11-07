import { createRoot } from 'react-dom/client';
import { AppProvider } from '@/contexts/AppContext';
import Intro from '@/Intro';
import App from '@/App';
import './global.scss';

createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <Intro />
    <section>
      <App />
    </section>
  </AppProvider>,
);
