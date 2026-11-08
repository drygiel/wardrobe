const base = import.meta.env.BASE_URL;

export const WARDROBE_GLB = `${base}models/Wardrobe.glb`;
export const FRAME_GLB = `${base}models/Frame.glb`;
export const ELECTRIC_GLB = `${base}models/Electric.glb`;
export const HARDWARE_GLB = `${base}models/Hardware.glb`;
// Desktops get the 8K atlas; phones keep 4K (about 43 MB of GPU memory instead of 170 MB)
const desktop = window.matchMedia('(pointer: fine) and (min-width: 1024px)').matches;
export const ATLAS = `${base}models/Wardrobe${desktop ? '-8k' : ''}.webp`;

export const RENDER_COUNT = 33;
export const renderSmall = (n: number) => `${base}images/s/${n}.webp`;
export const renderLarge = (n: number) => `${base}images/l/${n}.webp`;
export const picture = (name: string) => `${base}images/frame/${name}.webp`;

// Frame pieces exported from Szafa4.blend (1_Frame); their copies laid on the boards (CutPlan) are Plan_P01..Plan_P14
export const FRAME_PIECES = [
  'P01_D_Post-Rear-R',
  'P02_B_Rail-Bottom-Rear',
  'P03_C_Side-L',
  'P04_C_Bottom',
  'P05_C_Side-R',
  'P06_C_Top',
  'P07_B_Rail-Top-Front',
  'P08_B_Rail-Bottom-Front',
  'P09_D_Post-Front-R',
  'P10_D_Rail-Top-Rear',
  'P11_D_Crossbar-Bottom-R',
  'P12_D_Crossbar-Top-R',
  'P13_B_Rail-Top-Rear',
  'P14_B_Side-L',
] as const;

export const FRAME_BOARDS = ['Plan_Sheet-BG1', 'Plan_Sheet-BG2', 'Plan_Sheet-BG3'] as const;

export const flatPiece = (name: string) => `Plan_${name.slice(0, 3)}`;
