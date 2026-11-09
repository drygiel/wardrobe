import Footer from '@/sections/Footer';
import PageHeader from '@/sections/PageHeader';
import PlanSection from '@/sections/PlanSection';

export default function PlanPage() {
  return (
    <>
      <title>Rysunek techniczny – Szafa 2025</title>
      <meta name="theme-color" content="#161412" />
      <PageHeader current="/plan" />
      <main>
        <PlanSection />
      </main>
      <Footer />
    </>
  );
}
