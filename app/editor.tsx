import { createRoot } from 'react-dom/client';
import { AppProvider } from '@/contexts/AppContext';
import Editor from '@/editor/Editor';
import './global.scss';

createRoot(document.getElementById('root')!).render(
  <AppProvider initial={{ grid: true, gizmo: true, view: 'initial', hideFronts: true, wireframe: true }}>
    <Editor />
  </AppProvider>,
);
