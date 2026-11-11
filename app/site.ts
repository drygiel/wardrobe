// Figures the copy quotes, in millimetres. `parts` is every board, front, handle and LED strip, without hardware and wiring.
// `depthOverall` runs from the front of the handles to the back of the frame; the HDF backs sit inside it.
// tests/site.test.ts counts and measures them again in the exported models.
export const SIZE = { width: 2688, height: 2660, depth: 530, depthOverall: 560 };
export const SIZE_TEXT = `${SIZE.width} × ${SIZE.height} × ${SIZE.depth} mm`;
export const COUNTS = { parts: 98, sections: 4, framePieces: 15, boards: 3, drawers: 6, hinges: 17, hingedDoors: 7 };

export const SITE_URL = 'https://drygiel.github.io/wardrobe/';
export const REPO_URL = 'https://github.com/drygiel/wardrobe';

// One menu for every page, in the order the home page tells the story; the footer and the "next page" link read it too.
// `title` and `description` also go into each page's own HTML file at build time (vite.config.ts), for link previews.
export const PAGES = [
  {
    href: '/',
    label: 'Szafa',
    blurb: 'Od rysunku do gotowej szafy.',
    title: 'Szafa 2025 – projekt szafy na wymiar z modelem 3D',
    description: `Projekt szafy na wymiar w dębowej ramie, od podłogi do sufitu, ${SIZE_TEXT}: model 3D, rysunki techniczne, rozkrój ramy, okucia i elektryka LED.`,
  },
  {
    href: '/okucia',
    label: 'Okucia',
    blurb: 'Osiem szuflad i 17 zawiasów w ruchu.',
    title: 'Okucia – Szafa 2025',
    description: 'Okucia szafy: 8 szuflad głębokości 487 mm i 17 zawiasów puszkowych Ø35 mm na 7 drzwiach, z wymiarami z modelu 3D.',
  },
  {
    href: '/rama',
    label: 'Rama',
    blurb: '15 formatek z trzech dębowych płyt.',
    title: 'Rama – Szafa 2025',
    description: 'Dębowa rama szafy: 15 formatek z trzech płyt 3000 × 620 × 40 mm, rozkrój, lista formatek z frezami pod LED i wymiary.',
  },
  {
    href: '/elektryka',
    label: 'Elektryka',
    blurb: 'Osiem pasków LED, kable i otwory do wywiercenia.',
    title: 'Elektryka – Szafa 2025',
    description: 'Elektryka szafy: osiem pasków LED 24 V, ukryty włącznik i siedem kontaktronów. Schemat na żywo, arkusze wiercenia, montaż i lista zakupów.',
  },
  {
    href: '/plan',
    label: 'Plan',
    blurb: 'Rzuty, przekroje i zestawienie elementów.',
    title: 'Plan – Szafa 2025',
    description: `Rysunek techniczny szafy ${SIZE_TEXT}: widoki z przodu, z boku i z góry, cztery sekcje oraz zestawienie wszystkich elementów.`,
  },
  {
    href: '/galeria',
    label: 'Galeria',
    blurb: '33 rendery szafy w pokoju.',
    title: 'Galeria – Szafa 2025',
    description: '33 rendery szafy w pokoju: w dzień, wieczorem przy świetle LED, otwarta i wypełniona rzeczami.',
  },
  // Last: the measuring editor is a tool with its own screen, so the story ends there
  {
    href: '/pomiar',
    label: 'Pomiar',
    blurb: 'Każda krawędź i każdy element w 3D.',
    title: 'Pomiar – Szafa 2025',
    description: 'Edytor pomiarów szafy: model 3D, w którym każda krawędź pokazuje długość, a każdy element ma wymiary i rysunek do pobrania.',
  },
] as const;

export type Page = { href: string; title: string; description: string };
export type PagePath = (typeof PAGES)[number]['href'];

export const NOT_FOUND: Page = {
  href: '/',
  title: 'Nie ma takiej strony – Szafa 2025',
  description: 'Pod tym adresem nic nie ma. Wybierz jedną ze stron projektu szafy.',
};

export const pageAt = (path: PagePath) => PAGES.find(page => page.href === path)!;

// The page after this one; the last leads back to the start
export const nextPage = (path: PagePath) => PAGES[(PAGES.findIndex(page => page.href === path) + 1) % PAGES.length];

// Public address of a page; link previews and the canonical tag need it whole
export const urlOf = (href: string) => SITE_URL + href.slice(1);
