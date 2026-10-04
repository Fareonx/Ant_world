import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  randomInt,
  shuffle,
  maxImposters,
  clampImposters,
  pickImposters,
  speakingOrder,
  pickWord,
  createRound,
  tallyVotes,
  roundOutcome,
  scoreWithVotes,
  scoreByWinner,
  wordKey,
} from '../imposter/js/game.js';
import { CATEGORIES } from '../imposter/js/words.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

test('randomInt stays in range and covers every value', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = randomInt(7);
    assert.ok(v >= 0 && v < 7);
    seen.add(v);
  }
  assert.equal(seen.size, 7);
  assert.throws(() => randomInt(0));
});

test('shuffle is a permutation and does not mutate input', () => {
  const input = ids(10);
  const copy = input.slice();
  const out = shuffle(input);
  assert.deepEqual(input, copy);
  assert.deepEqual(out.slice().sort(), copy.slice().sort());
});

test('maxImposters keeps imposters a minority', () => {
  assert.equal(maxImposters(3), 1);
  assert.equal(maxImposters(4), 1);
  assert.equal(maxImposters(5), 2);
  assert.equal(maxImposters(7), 3);
  assert.equal(maxImposters(20), 9);
  assert.equal(clampImposters(5, 4), 1);
  assert.equal(clampImposters(0, 10), 1);
});

test('pickImposters returns unique players of requested size', () => {
  for (let i = 0; i < 200; i++) {
    const imp = pickImposters(ids(8), 3);
    assert.equal(imp.length, 3);
    assert.equal(new Set(imp).size, 3);
  }
});

test('every player can become imposter (roughly uniform)', () => {
  const counts = {};
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const [imp] = pickImposters(ids(6), 1);
    counts[imp] = (counts[imp] || 0) + 1;
  }
  for (const id of ids(6)) {
    assert.ok(counts[id] > N / 6 * 0.8 && counts[id] < N / 6 * 1.2, `${id}: ${counts[id]}`);
  }
});

test('speakingOrder: permutation, imposter never first, previous first never repeats', () => {
  const players = ids(5);
  for (let i = 0; i < 500; i++) {
    const imps = pickImposters(players, 2);
    const prevFirst = players[randomInt(players.length)];
    const order = speakingOrder(players, imps, { imposterNotFirst: true, prevFirst });
    assert.deepEqual(order.slice().sort(), players.slice().sort());
    assert.ok(!imps.includes(order[0]));
    // prevFirst can only stay first if no other civilian exists
    const otherCivs = players.filter((p) => !imps.includes(p) && p !== prevFirst);
    if (otherCivs.length) assert.notEqual(order[0], prevFirst);
  }
});

test('speakingOrder changes between rounds', () => {
  const players = ids(6);
  const orders = new Set();
  for (let i = 0; i < 30; i++) orders.add(speakingOrder(players, ['p1']).join(','));
  assert.ok(orders.size > 20);
});

test('speakingOrder allows imposter first when option is off', () => {
  const players = ids(3);
  let impFirst = 0;
  for (let i = 0; i < 600; i++) {
    if (speakingOrder(players, ['p1'], { imposterNotFirst: false })[0] === 'p1') impFirst++;
  }
  assert.ok(impFirst > 100);
});

test('pickWord only uses selected categories and avoids used words', () => {
  const used = [];
  const selected = ['food', 'animals'];
  const total = CATEGORIES.filter((c) => selected.includes(c.id)).reduce((n, c) => n + c.words.length, 0);
  for (let i = 0; i < total; i++) {
    const p = pickWord(CATEGORIES, selected, used);
    assert.ok(selected.includes(p.catId));
    assert.ok(!used.includes(p.key), 'repeated before pool exhausted');
    assert.equal(p.reset, false);
    used.push(p.key);
  }
  const next = pickWord(CATEGORIES, selected, used, used[used.length - 1]);
  assert.equal(next.reset, true);
  assert.notEqual(next.key, used[used.length - 1]);
});

test('pickWord throws with no categories', () => {
  assert.throws(() => pickWord(CATEGORIES, [], []));
});

test('word data: every entry has word, distinct hint and distinct undercover word', () => {
  const ids = new Set();
  for (const c of CATEGORIES) {
    assert.ok(!ids.has(c.id), `duplicate category ${c.id}`);
    ids.add(c.id);
    assert.ok(c.words.length >= 20, `${c.id} has only ${c.words.length} words`);
    const words = c.words.map((w) => w[0].toLocaleLowerCase('az'));
    assert.equal(new Set(words).size, words.length, `duplicate word in ${c.id}`);
    for (const entry of c.words) {
      assert.equal(entry.length, 3, `${c.id}: ${entry}`);
      const [w, h, u] = entry.map((s) => s.trim());
      assert.ok(w && h && u, `${c.id}: empty field in ${entry}`);
      const lw = w.toLocaleLowerCase('az');
      const lh = h.toLocaleLowerCase('az');
      assert.notEqual(lw, lh, `${c.id}: hint equals word ${w}`);
      assert.notEqual(lw, u.toLocaleLowerCase('az'), `${c.id}: undercover equals word ${w}`);
      assert.notEqual(lh, u.toLocaleLowerCase('az'), `${c.id}: hint equals undercover word for ${w}`);
      assert.ok(!lh.includes(lw) && !lw.includes(lh), `${c.id}: hint "${h}" overlaps word "${w}"`);
      // Hint must not be another word of the same category (too close).
      assert.ok(!words.includes(lh), `${c.id}: hint "${h}" is a word in the same category`);
    }
  }
});

test('createRound classic: hint only when enabled, undercover word null', () => {
  const players = ids(5).map((id) => ({ id, name: id }));
  const base = { categories: ['food'], imposters: 2, imposterNotFirst: true, mode: 'classic' };
  const r1 = createRound({ players, settings: { ...base, hint: true }, categories: CATEGORIES });
  assert.equal(r1.imposters.length, 2);
  assert.ok(r1.hint);
  assert.equal(r1.imposterWord, null);
  assert.ok(!r1.imposters.includes(r1.order[0]));
  const r2 = createRound({ players, settings: { ...base, hint: false }, categories: CATEGORIES });
  assert.equal(r2.hint, null);
});

test('createRound undercover: imposter gets the paired word, no hint', () => {
  const players = ids(6).map((id) => ({ id, name: id }));
  const settings = { categories: ['animals'], imposters: 1, imposterNotFirst: true, mode: 'undercover', hint: true };
  for (let i = 0; i < 50; i++) {
    const r = createRound({ players, settings, categories: CATEGORIES });
    assert.equal(r.hint, null);
    assert.ok(r.imposterWord);
    assert.notEqual(r.imposterWord, r.word);
    const [catId, idx] = r.wordKey.split(':');
    const entry = CATEGORIES.find((c) => c.id === catId).words[Number(idx)];
    assert.deepEqual([r.word, r.imposterWord].sort(), [entry[0], entry[2]].sort());
  }
});

test('tallyVotes: clear winner is eliminated', () => {
  const players = ids(4);
  const t = tallyVotes({ p1: 'p2', p3: 'p2', p4: 'p2', p2: 'p1' }, players, 1);
  assert.deepEqual(t.eliminated, ['p2']);
  assert.equal(t.tie, false);
  assert.equal(t.counts.p2, 3);
});

test('tallyVotes: tie means nobody eliminated', () => {
  const t = tallyVotes({ p1: 'p2', p2: 'p1', p3: 'p4', p4: 'p3' }, ids(4), 1);
  assert.deepEqual(t.eliminated, []);
  assert.equal(t.tie, true);
});

test('tallyVotes: partial tie with two imposters', () => {
  const players = ids(6);
  const votes = { p1: 'p2', p3: 'p2', p4: 'p2', p2: 'p5', p5: 'p6', p6: 'p1' };
  const t = tallyVotes(votes, players, 2);
  assert.deepEqual(t.eliminated, ['p2']);
  assert.equal(t.tie, true);
});

test('roundOutcome', () => {
  assert.equal(roundOutcome(['a'], ['a']), 'civilians');
  assert.equal(roundOutcome(['a'], ['b']), 'imposters');
  assert.equal(roundOutcome(['a', 'b'], ['a']), 'split');
});

test('scoreWithVotes', () => {
  const playerIds = ids(5);
  const imposterIds = ['p1', 'p2'];
  const votes = { p1: 'p3', p2: 'p3', p3: 'p1', p4: 'p1', p5: 'p4' };
  const { eliminated } = tallyVotes(votes, playerIds, 2);
  assert.deepEqual(eliminated.sort(), ['p1', 'p3']);
  const delta = scoreWithVotes({ playerIds, imposterIds, votes, eliminatedIds: eliminated, guessed: { p1: true } });
  assert.deepEqual(delta, { p1: 1, p2: 2, p3: 1, p4: 1, p5: 0 });
});

test('scoreByWinner', () => {
  const playerIds = ids(4);
  assert.deepEqual(scoreByWinner({ playerIds, imposterIds: ['p2'], winner: 'civilians' }), { p1: 1, p2: 0, p3: 1, p4: 1 });
  assert.deepEqual(scoreByWinner({ playerIds, imposterIds: ['p2'], winner: 'imposters' }), { p1: 0, p2: 2, p3: 0, p4: 0 });
});

test('wordKey format', () => {
  assert.equal(wordKey('food', 3), 'food:3');
});
