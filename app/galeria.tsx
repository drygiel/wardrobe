import { RENDER_COUNT, renderSmall } from '@/assets';
import Footer from '@/sections/Footer';
import { useRenderViewer } from '@/sections/Gallery';
import { pageAt } from '@/site';
import Meta from '@/sections/Meta';
import NextPage from '@/sections/NextPage';
import PageHeader from '@/sections/PageHeader';
import header from '@/sections/PageHeader.module.scss';
import styles from './galeria.module.scss';

// The renders sorted by what they show; the numbers are the files in public/images
const GROUPS = [
  { title: 'W dzień', text: 'Zamknięta szafa w dziennym świetle: białe fronty w dębowej ramie i otwarty regał A.', alt: 'Zamknięta szafa w dzień', renders: [25, 28, 24, 27, 23, 18, 19, 15, 22] },
  { title: 'Wieczorem', text: 'Po zmroku świecą paski LED we frezach ramy, w regale A i we wnęce C.', alt: 'Szafa wieczorem przy świetle LED', renders: [6, 4, 3, 5, 10, 2, 7, 1, 26] },
  { title: 'Otwarta', text: 'Bez frontów widać podział wnętrza: półki, siedem szuflad szafy B i wąską wnękę C.', alt: 'Otwarta szafa, wnętrze z półkami i szufladami', renders: [12, 13, 11, 8, 9, 14] },
  { title: 'Wypełniona', text: 'Wnętrze z ubraniami, pudłami i narzędziami, żeby ocenić skalę półek.', alt: 'Wnętrze szafy wypełnione rzeczami', renders: [29, 30, 33] },
  { title: 'Pokój i rzuty', text: 'Szafa na tle całego pokoju oraz dwa rzuty z przodu: z frontami i bez.', alt: 'Pokój z szafą i rzut szafy', renders: [16, 17, 20, 21, 31, 32] },
];

export default function GaleriaPage() {
  const viewer = useRenderViewer();

  return (
    <>
      <Meta page={pageAt('/galeria')} />
      <PageHeader current="/galeria" />

      <main>
        <header className={header.intro}>
          <h1>Galeria</h1>
          <p>
            {RENDER_COUNT} rendery z Blendera, w pięciu grupach. Kliknij render, aby otworzyć go na pełnym ekranie.
          </p>
        </header>
        {GROUPS.map(group => (
          <section key={group.title} className={styles.group} aria-labelledby={`g-${group.renders[0]}`}>
            <header>
              <h2 id={`g-${group.renders[0]}`}>{group.title}</h2>
              <p>{group.text}</p>
            </header>
            <div className={styles.grid}>
              {group.renders.map((n, i) => (
                <button key={n} onClick={() => viewer.show(n)}>
                  <img src={renderSmall(n)} alt={`${group.alt}, ujęcie ${i + 1} z ${group.renders.length}`} width="1280" height="800" loading="lazy" />
                </button>
              ))}
            </div>
          </section>
        ))}
        {viewer.element}
        <NextPage after="/galeria" />
      </main>
      <Footer />
    </>
  );
}
