import { useEffect, useRef } from 'react';

// Adds the global `in` class once the element scrolls into view (children rise with a stagger)
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('reveal');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add('in');
        io.disconnect();
      },
      { rootMargin: '0px 0px -15% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
