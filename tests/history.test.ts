// Run with: npx tsx tests/history.test.ts
import assert from 'node:assert/strict';
import { createHistory, observe, SETTLE, step } from '../app/editor/history';

const history = createHistory<{ key: string }>();
let now = 0;
// The scene shows `key` and stands still long enough to count
const settle = (key: string) => {
  observe(history, { key }, (now += 10));
  observe(history, { key }, (now += SETTLE));
};

settle('a');
assert.equal(step(history, 'undo'), null, 'nothing before the first state');

// An orbit drag passes through many states and counts once
observe(history, { key: 'a1' }, (now += 10));
observe(history, { key: 'a2' }, (now += 10));
settle('b');
assert.equal(history.past.length, 1);

settle('c');
assert.equal(step(history, 'undo')?.key, 'b');
assert.equal(step(history, 'undo')?.key, 'a', 'a second press before the scene has caught up');
assert.equal(step(history, 'undo'), null);
assert.equal(step(history, 'redo')?.key, 'b');

// The scene lands near the restored state, not on it: no new entry, and redo survives
settle('b~');
assert.equal(history.current?.key, 'b~');
assert.equal(step(history, 'redo')?.key, 'c');
settle('c');

// A new change drops the redo stack
assert.equal(step(history, 'undo')?.key, 'b~');
settle('b~');
settle('d');
assert.equal(step(history, 'redo'), null);

// Undo right after a change, before it settled, undoes that change
observe(history, { key: 'e' }, (now += 10));
assert.equal(step(history, 'undo')?.key, 'd');
assert.equal(step(history, 'redo')?.key, 'e');

console.log('history: ok');
