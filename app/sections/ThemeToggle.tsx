import { light, toggleTheme } from '@/theme';

// Last item of a page's top menu: a sun or a moon, for the theme it switches to
export default function ThemeToggle() {
  const label = light ? 'Włącz ciemny motyw' : 'Włącz jasny motyw';
  return (
    <li>
      <button type="button" onClick={toggleTheme} aria-label={label} title={label}>
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          {light ? (
            <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" strokeLinejoin="round" />
          ) : (
            <>
              <circle cx="10" cy="10" r="3.6" />
              <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
            </>
          )}
        </svg>
      </button>
    </li>
  );
}
