import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { selection } from './selection';

const PERIOD = 1.2; // seconds from bright to plain and back
const PEAK = 1.2; // strength of the glow at its brightest, see `pulse` in Mesh.tsx

// The parts of the list row under the cursor breathe between their plain colour and a bright one,
// so the eye finds them in the model. One loop for all of them, instead of a frame callback in every part.
export function HoverPulse() {
  const seen = useRef<{ group: readonly unknown[]; since: number }>({ group: [], since: 0 });
  const still = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);

  useFrame(({ clock }) => {
    const group = selection.group;
    if (!group.length || still.current) return; // reduced motion keeps the steady highlight
    // Each new row starts at its brightest
    if (seen.current.group !== group) seen.current = { group, since: clock.elapsedTime };
    const wave = 0.5 + 0.5 * Math.cos(((clock.elapsedTime - seen.current.since) / PERIOD) * Math.PI * 2);
    group.forEach(mesh => mesh.userData.pulse?.(wave * PEAK));
  });

  return null;
}
