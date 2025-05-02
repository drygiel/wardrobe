import Head from 'next/head';
import { AppProvider } from '@/contexts/AppContext';
import Intro from '@/Intro';
import App from '@/App';

export default function Home() {
  return (
    <>
      <Head>
        <title>Wardrobe 2025</title>
      </Head>
      <AppProvider>
        <Intro />
        <section>
          <App />
        </section>
      </AppProvider>
    </>
  );
}
