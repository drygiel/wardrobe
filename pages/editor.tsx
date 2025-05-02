import Head from 'next/head';
import { AppProvider } from '@/contexts/AppContext';
import App from '@/App';

export default function EditorPage() {
  return (
    <>
      <Head>
        <title>Wardrobe 2025 - Editor</title>
      </Head>
      <AppProvider initial={{ grid: true, gizmo: true, view: 'initial', hideFronts: true }}>
        <section>
          <App />
        </section>
      </AppProvider>
    </>
  );
}
