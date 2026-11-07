const base = import.meta.env.BASE_URL;

export const WARDROBE_GLB = `${base}models/Wardrobe.glb`;
export const FRAME_GLB = `${base}models/Frame.glb`;
export const ATLAS = `${base}models/Wardrobe.webp`;

export const RENDER_COUNT = 33;
export const renderSmall = (n: number) => `${base}images/s/${n}.webp`;
export const renderLarge = (n: number) => `${base}images/l/${n}.webp`;
export const picture = (name: string) => `${base}images/frame/${name}.webp`;

// Frame pieces exported from Szafa4.blend (Frame.Best); laid-out copies on the boards carry a leading "_"
export const FRAME_PIECES = [
  'FrameBLeft',
  'FrameDRightFront',
  'FrameBTopFront',
  'FrameBBottomFront',
  'FrameCLeft',
  'FrameCRight',
  'FrameCBottom',
  'FrameCTop',
  'FrameBBottomBack',
  'FrameBTopBack',
  'FrameDTop',
  'FrameDRightBack',
  'FrameDRightTop',
  'FrameDRightBottom',
] as const;

export const FRAME_BOARDS = ['FrameFullBG1', 'FrameFullBG2', 'FrameFullBG3'] as const;
