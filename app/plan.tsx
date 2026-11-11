import { Suspense } from 'react';
import Footer from '@/sections/Footer';
import Inventory from '@/sections/Inventory';
import Meta from '@/sections/Meta';
import NextPage from '@/sections/NextPage';
import PageHeader from '@/sections/PageHeader';
import PlanSection from '@/sections/PlanSection';
import { pageAt } from '@/site';
import styles from '@/sections/PageHeader.module.scss';

export default function PlanPage() {
  return (
    <>
      <Meta page={pageAt('/plan')} />
      <PageHeader current="/plan" />
      <main>
        <header className={styles.intro}>
          <h1>Plan</h1>
          <p>Rysunek techniczny szafy w trzech rzutach i czterech sekcjach, a pod nim zestawienie wszystkich elementów. Wymiary w milimetrach, z modelu 3D.</p>
        </header>
        <PlanSection title="Rzuty i sekcje" />
        <Suspense fallback={<p className="loading-row" role="status">Ładuję dane z modelu 3D</p>}>
          <Inventory />
        </Suspense>
        <NextPage after="/plan" />
      </main>
      <Footer />
    </>
  );
}
