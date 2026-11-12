// Run with: npx tsx tests/cutlist.test.ts
import assert from 'node:assert/strict';
import { holeText, PIECES, plural, toCsv, totals } from '../app/sections/orderList';

assert.equal(plural(1, 'otwór', 'otwory', 'otworów'), 'otwór');
assert.equal(plural(72, 'otwór', 'otwory', 'otworów'), 'otwory');
assert.equal(plural(12, 'otwór', 'otwory', 'otworów'), 'otworów');
assert.equal(plural(15, 'formatka', 'formatki', 'formatek'), 'formatek');

// Every dowel is drilled into two pieces, 20 mm into each
const t = totals();
assert.equal(t.pieces, 15);
assert.equal(t.holes % 2, 0);
assert.ok(PIECES.every(p => p.holes.every(h => h.depth === 20 && h.d === 8)));
assert.ok(PIECES.every(p => p.board && /^BG\d$/.test(p.board)), 'every piece lies on a board');
assert.ok(PIECES.every(p => p.holes.every(h => h.entry.every((v, i) => v >= -0.1 && v <= p.box[i] + 0.1))), 'holes start on the piece');

const csv = toCsv();
assert.ok(csv.startsWith('﻿"Kod";"Formatka"'));
assert.equal(csv.split('\r\n').length, PIECES.length + 1);
assert.match(holeText(PIECES[0].holes[0]), /^J\d\d: .+, Ø8 × 20$/);

console.log('cutlist ok');
