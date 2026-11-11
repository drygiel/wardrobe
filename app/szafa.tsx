import HomeStage from '@/home/HomeStage';
import About from '@/sections/About';
import Gallery from '@/sections/Gallery';
import Footer from '@/sections/Footer';
import Meta from '@/sections/Meta';
import NextPage from '@/sections/NextPage';
import { pageAt } from '@/site';

export default function SzafaPage() {
  return (
    <>
      <Meta page={pageAt('/')} />
      <main>
        <HomeStage />
        <Gallery />
        <About />
        <NextPage after="/" />
      </main>
      <Footer />
    </>
  );
}
