'use client';

import { useEffect, useRef, EffectCallback, DependencyList } from 'react';

export const useNonInitialEffect = (
  effect: EffectCallback,
  deps?: DependencyList,
): ReturnType<EffectCallback> => {
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    return effect();
  }, deps);
};
