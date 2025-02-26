'use client';

import { useEffect, useRef } from 'react';

type EventMap = HTMLElementEventMap & {
  [key: string]: CustomEvent;
};

export function useEventListener<K extends keyof EventMap>(
  eventName: K,
  handler: (event: EventMap[K]) => void,
  element: HTMLElement | Window = window
) {
  const savedHandler = useRef<(event: EventMap[K]) => void>(null);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const isSupported = element && element.addEventListener;
    if (!isSupported) return;

    const eventListener = (event: Event) => savedHandler.current!(event as EventMap[K]);

    element.addEventListener(eventName as string, eventListener);
    return () => {
      element.removeEventListener(eventName as string, eventListener);
    };
  }, [eventName, element]);
}