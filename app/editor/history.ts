// Undo and redo over snapshots of the editor. The scene is polled, not told about changes: the camera, the selection
// and the doors live outside React state. A change counts once it has stood still for SETTLE ms, so a whole orbit drag,
// or a click that pins a part and flies the camera to it, is one step.
export const SETTLE = 300;
const LIMIT = 100;

export type Keyed = { key: string };

export type History<T extends Keyed> = {
  past: T[];
  future: T[];
  current: T | null;
  latest: T | null;
  since: number; // when `latest` last changed
  // After a step the scene is still moving to the restored state; what it settles on replaces `current` without a new entry
  restoring: boolean;
};

export const createHistory = <T extends Keyed>(): History<T> => ({ past: [], future: [], current: null, latest: null, since: 0, restoring: false });

const commit = <T extends Keyed>(history: History<T>, snapshot: T) => {
  if (history.current && !history.restoring && snapshot.key !== history.current.key) {
    history.past.push(history.current);
    if (history.past.length > LIMIT) history.past.shift();
    history.future = [];
  }
  history.current = snapshot;
  history.restoring = false;
};

// Called with what the scene looks like now
export function observe<T extends Keyed>(history: History<T>, snapshot: T, now: number) {
  if (snapshot.key !== history.latest?.key) {
    history.latest = snapshot;
    history.since = now;
  } else if (now - history.since >= SETTLE) commit(history, snapshot);
}

// The snapshot to restore, or null at the end of the stack
export function step<T extends Keyed>(history: History<T>, direction: 'undo' | 'redo'): T | null {
  // A change made a moment ago has not settled yet; it is still the thing to undo
  if (!history.restoring && history.latest) commit(history, history.latest);
  const [from, to] = direction === 'undo' ? [history.past, history.future] : [history.future, history.past];
  const target = from.pop();
  if (!target || !history.current) return null;
  to.push(history.current);
  history.current = target;
  history.restoring = true;
  return target;
}
