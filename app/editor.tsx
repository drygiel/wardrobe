import { AppProvider } from '@/contexts/AppContext';
import Editor from '@/editor/Editor';
import { readLink } from '@/editor/ShareLink';

export default function EditorPage() {
  const link = readLink();

  return (
    <AppProvider initial={{ grid: true, gizmo: true, view: link.view ?? 'initial', orthographic: Boolean(link.view), hideFronts: true, wireframe: link.wireframe }}>
      <title>Szafa 2025 – edytor pomiarów</title>
      <meta name="theme-color" content="#161412" />
      <Editor />
    </AppProvider>
  );
}
