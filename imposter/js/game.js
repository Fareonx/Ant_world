// Oyunun təmiz məntiqi (DOM-dan asılı deyil, testlərlə yoxlanılır).

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;

export const POINTS = {
  civilianCorrectVote: 1, // vətəndaş impostora səs verdi
  imposterEscaped: 2, // impostor tutulmadı
  imposterGuessedWord: 1, // tutulan impostor sözü tapdı (klassik)
  civiliansWin: 1, // səsvermə olmadan: vətəndaşlar qazandı
  impostersWin: 2, // səsvermə olmadan: impostorlar qazandı
};

// Kriptoqrafik təsadüfi tam ədəd: 0..n-1, bərabər paylanma (modulo bias yoxdur).
export function randomInt(n) {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('n must be a positive integer');
  const range = 0x100000000;
  const limit = range - (range % n);
  const buf = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % n;
}

// Fisher–Yates qarışdırma. Yeni massiv qaytarır.
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function maxImposters(playerCount) {
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

export function clampImposters(count, playerCount) {
  return Math.min(Math.max(1, count), maxImposters(playerCount));
}

export function pickImposters(playerIds, count) {
  return shuffle(playerIds).slice(0, clampImposters(count, playerIds.length));
}

// Danışma sırası: hər raund yenidən qarışdırılır.
//  - imposterNotFirst: impostor birinci danışmır
//  - prevFirst: əvvəlki raundda birinci danışan bu dəfə birinci olmur
// Birinci danışan uyğun namizədlər arasından bərabər ehtimalla seçilir,
// qalanları təsadüfi qarışdırılır.
export function speakingOrder(playerIds, imposterIds, { imposterNotFirst = true, prevFirst = null } = {}) {
  const notImposter = (id) => !(imposterNotFirst && imposterIds.includes(id));
  let eligible = playerIds.filter((id) => notImposter(id) && id !== prevFirst);
  if (!eligible.length) eligible = playerIds.filter(notImposter);
  if (!eligible.length) eligible = playerIds.slice();
  const first = eligible[randomInt(eligible.length)];
  return [first, ...shuffle(playerIds.filter((id) => id !== first))];
}

export const wordKey = (catId, index) => `${catId}:${index}`;

// Seçilmiş kateqoriyalardan söz seçir.
// Əvvəlcə hələ istifadə olunmamış sözü olan kateqoriya bərabər ehtimalla seçilir,
// sonra həmin kateqoriyadan söz. Bütün sözlər bitəndə həmin kateqoriyaların
// tarixçəsi sıfırlanır (reset: true), amma son söz dərhal təkrarlanmır.
export function pickWord(categories, selectedIds, usedKeys = [], lastKey = null) {
  const used = new Set(usedKeys);
  const cats = categories.filter((c) => selectedIds.includes(c.id) && c.words.length);
  if (!cats.length) throw new Error('No categories selected');

  const poolsFor = (filter) =>
    cats
      .map((c) => ({ c, idxs: c.words.map((_, i) => i).filter((i) => filter(wordKey(c.id, i))) }))
      .filter((p) => p.idxs.length);

  let reset = false;
  let pools = poolsFor((k) => !used.has(k));
  if (!pools.length) {
    reset = true;
    pools = poolsFor((k) => k !== lastKey);
    if (!pools.length) pools = poolsFor(() => true);
  }

  const pool = pools[randomInt(pools.length)];
  const index = pool.idxs[randomInt(pool.idxs.length)];
  const [word, hint, undercover] = pool.c.words[index];
  return { catId: pool.c.id, index, key: wordKey(pool.c.id, index), word, hint, undercover, reset };
}

// Yeni raund yaradır.
export function createRound({
  players,
  settings,
  categories,
  usedKeys = [],
  lastKey = null,
  prevFirst = null,
  roundNumber = 1,
}) {
  const ids = players.map((p) => p.id);
  const pick = pickWord(categories, settings.categories, usedKeys, lastKey);
  const imposters = pickImposters(ids, settings.imposters);

  let civilianWord = pick.word;
  let imposterWord = null;
  if (settings.mode === 'undercover') {
    // Cütün hansı sözünün vətəndaşlara düşəcəyi də təsadüfidir.
    const swap = randomInt(2) === 1;
    civilianWord = swap ? pick.undercover : pick.word;
    imposterWord = swap ? pick.word : pick.undercover;
  }

  const order = speakingOrder(ids, imposters, {
    imposterNotFirst: settings.imposterNotFirst,
    prevFirst,
  });

  const category = categories.find((c) => c.id === pick.catId);
  return {
    round: roundNumber,
    mode: settings.mode,
    catId: pick.catId,
    catName: category.name,
    catEmoji: category.emoji,
    wordKey: pick.key,
    word: civilianWord,
    imposterWord,
    hint: settings.mode === 'classic' && settings.hint ? pick.hint : null,
    imposters,
    order,
    resetHistory: pick.reset,
  };
}

// Səslərin sayılması. votes: { səsVerənId: hədəfId }
// Ən çox səs toplayan k nəfər kənarlaşdırılır (k = impostor sayı).
// Sərhəddə bərabərlik olarsa, bərabər səs alanlar kənarlaşdırılmır.
export function tallyVotes(votes, playerIds, k) {
  const counts = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const target of Object.values(votes)) {
    if (target in counts) counts[target]++;
  }
  const sorted = playerIds
    .map((id) => ({ id, count: counts[id] }))
    .sort((a, b) => b.count - a.count);
  const cutoff = sorted[k] ? sorted[k].count : -1;
  const eliminated = sorted
    .slice(0, k)
    .filter((x) => x.count > 0 && x.count > cutoff)
    .map((x) => x.id);
  const tie = eliminated.length < k && sorted[k - 1] && sorted[k - 1].count > 0;
  return { counts, sorted, eliminated, tie: Boolean(tie) };
}

// Raundun nəticəsi: 'civilians' | 'imposters' | 'split'
export function roundOutcome(imposterIds, eliminatedIds) {
  const caught = imposterIds.filter((id) => eliminatedIds.includes(id)).length;
  if (caught === imposterIds.length) return 'civilians';
  if (caught === 0) return 'imposters';
  return 'split';
}

// Səsvermə ilə xal hesablanması. Qaytarır: { oyunçuId: xal }
export function scoreWithVotes({ playerIds, imposterIds, votes, eliminatedIds, guessed = {} }) {
  const delta = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const id of playerIds) {
    if (imposterIds.includes(id)) {
      if (!eliminatedIds.includes(id)) delta[id] += POINTS.imposterEscaped;
      else if (guessed[id]) delta[id] += POINTS.imposterGuessedWord;
    } else if (imposterIds.includes(votes[id])) {
      delta[id] += POINTS.civilianCorrectVote;
    }
  }
  return delta;
}

// Səsvermə olmadan: qalib tərəf əl ilə seçilir.
export function scoreByWinner({ playerIds, imposterIds, winner }) {
  const delta = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const id of playerIds) {
    const isImp = imposterIds.includes(id);
    if (winner === 'civilians' && !isImp) delta[id] += POINTS.civiliansWin;
    if (winner === 'imposters' && isImp) delta[id] += POINTS.impostersWin;
  }
  return delta;
}
