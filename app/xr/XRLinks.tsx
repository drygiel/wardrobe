import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useXRStore } from '@react-three/xr';
import { Icon } from '@/editor/icons';

type Mode = 'immersive-vr' | 'immersive-ar';
type Arrival = { xr?: Mode } | null;

const MODES = [
  { mode: 'immersive-vr', label: 'Zobacz w VR', icon: 'vr' },
  { mode: 'immersive-ar', label: 'Zobacz w AR', icon: 'ar' },
] as const;

// The editor's ?xr emulator stands in for a headset there, so the links count it as one
const emulated = () => new URLSearchParams(location.search).has('xr');

function useSupported() {
  const [supported, setSupported] = useState<Partial<Record<Mode, boolean>>>({});
  useEffect(() => {
    let live = true;
    for (const { mode } of MODES) {
      const check = emulated() ? Promise.resolve(true) : (navigator.xr?.isSessionSupported(mode) ?? Promise.resolve(false));
      void check.catch(() => false).then(on => live && setSupported(s => ({ ...s, [mode]: on })));
    }
    return () => {
      live = false;
    };
  }, []);
  return supported;
}

// Only the editor's canvas carries XR, so the links lead there and it enters the session on arrival
export function XRLinks({ className }: { className?: string }) {
  const navigate = useNavigate();
  const supported = useSupported();
  const checked = MODES.every(({ mode }) => supported[mode] !== undefined);
  const missing = checked && MODES.some(({ mode }) => !supported[mode]);

  return (
    <div className={className} role="group" aria-label="Rzeczywistość rozszerzona i wirtualna">
      {MODES.map(({ mode, label, icon }) => (
        <button
          key={mode}
          type="button"
          className="btn"
          disabled={!supported[mode]}
          title={supported[mode] === false ? 'To urządzenie nie obsługuje tego trybu' : undefined}
          onClick={() => navigate(`/pomiar${location.search}`, { state: { xr: mode } })}
        >
          <Icon name={icon} />
          {label}
        </button>
      ))}
      {missing && <p>VR i AR działają w goglach, np. Meta Quest, a AR także w telefonie z Androidem.</p>}
    </div>
  );
}

// Inside <XR>: the store can only start a session once the canvas has handed it the renderer
export function EnterOnArrival() {
  const store = useXRStore();
  const navigate = useNavigate();
  const here = useLocation();
  const mode = (here.state as Arrival)?.xr;

  useEffect(() => {
    if (!mode) return;
    // A reload or the back button must not start it again
    void navigate({ pathname: here.pathname, search: here.search, hash: here.hash }, { replace: true, state: null });
    // Fails when the click's user activation ran out on the way; the toolbar's AR and VR buttons still work
    store.enterXR(mode).catch(console.error);
  }, [mode, store, navigate, here.pathname, here.search, here.hash]);

  return null;
}
