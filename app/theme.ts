const KEY = 'wardrobe.theme';

const stored = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// Read once: the 3D scenes build their materials from it, so a change reloads the page
export const light = stored() === 'light';

export const THEME_COLOR = light ? '#ebe7df' : '#161412'; // --bg, for the browser's own chrome

// The measuring editor and the solder-mask page keep their own dark palettes; index.html repeats this test before first paint
const DARK_ONLY = /\/(pomiar|elektryka)\/?$/;

export const applyTheme = (pathname: string) => {
  document.documentElement.dataset.theme = light && !DARK_ONLY.test(pathname) ? 'light' : 'dark';
};

export const toggleTheme = () => {
  try {
    localStorage.setItem(KEY, light ? 'dark' : 'light');
  } catch {
    return; // private mode: nowhere to keep the choice across the reload
  }
  // shortcut: reloads instead of rebuilding every scene's materials live; upgrade if the reload gets in the way
  location.reload();
};
