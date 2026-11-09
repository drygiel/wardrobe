import { AppProvider } from '@/contexts/AppContext';
import Editor from '@/editor/Editor';

export default function EditorPage() {
  return (
    <AppProvider initial={{ grid: true, gizmo: true, view: 'initial', hideFronts: true, wireframe: true }}>
      <title>Szafa 2025 – edytor pomiarów</title>
      <meta name="theme-color" content="#161412" />
      <Editor />
    </AppProvider>
  );
}
