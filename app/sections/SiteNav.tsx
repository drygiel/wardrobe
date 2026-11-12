import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import cn from 'classnames';
import { Icon } from '@/editor/icons';
import { PAGES, type PagePath } from '@/site';
import ThemeToggle from './ThemeToggle';
import styles from './SiteNav.module.scss';

type Props = {
  current?: PagePath;
  // Over a 3D scene the words carry a halo of the background
  halo?: boolean;
  // Pages with their own fixed palette have no theme to switch
  toggle?: boolean;
};

// Wordmark and menu, the same on every page; sits in the top corners of the nearest positioned parent
export default function SiteNav({ current, halo, toggle = true }: Props) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null!);
  const buttonRef = useRef<HTMLButtonElement>(null!);

  // The folded menu of a phone closes on Escape and on a tap beside it
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current.focus();
    };
    const outside = (event: PointerEvent) => {
      if (!navRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  return (
    <>
      <Link className={cn(styles.wordmark, halo && styles.halo)} to="/">
        Szafa 2025
      </Link>
      <nav ref={navRef} className={cn(styles.nav, halo && styles.halo, open && styles.open)} aria-label="Nawigacja">
        <button ref={buttonRef} type="button" className={styles.menu} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>
          <Icon name={open ? 'cross' : 'menu'} />
          Menu
        </button>
        <ul id="site-menu" onClick={() => setOpen(false)}>
          {PAGES.map(page => (
            <li key={page.href}>
              <Link to={page.href} aria-current={page.href === current ? 'page' : undefined}>
                {page.label}
              </Link>
            </li>
          ))}
          {toggle && <ThemeToggle />}
        </ul>
      </nav>
    </>
  );
}
