// import styles from "./page.module.scss";
import { AppProvider } from '@/contexts/AppContext';
import Intro from '@/Intro';
import App from '@/App';

export default function Home() {
  return (
    <AppProvider>
      {process.env.NODE_ENV === 'production' && <Intro />}
      <section>
        <App />
      </section>
    </AppProvider>
  );
}
