import HomeStage from '@/home/HomeStage';
import Gallery from '@/sections/Gallery';
import Footer from '@/sections/Footer';

export default function SzafaPage() {
  return (
    <>
      <title>Szafa 2025</title>
      <meta name="theme-color" content="#161412" />
      <HomeStage
        nav={[
          { href: '/pomiar', label: 'Pomiar' },
          { href: '/plan', label: 'Plan' },
          { href: '/okucia', label: 'Okucia' },
          { href: '/galeria', label: 'Galeria' },
          { href: '/rama', label: 'Rama' },
          { href: '/elektryka', label: 'Elektryka' },
        ]}
      />
      <main>
        <Gallery />
      </main>
      <Footer />
    </>
  );
}
