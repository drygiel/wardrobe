import { useEffect } from 'react';

// Placed after a scene inside its Suspense: commits only once the models before it have loaded
export default function Ready({ onReady }: { onReady: (ready: boolean) => void }) {
  useEffect(() => {
    onReady(true);
    return () => onReady(false);
  }, [onReady]);
  return null;
}
