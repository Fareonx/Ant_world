// Brauzerdə tam oyun ssenarisi (iPhone ölçüsündə).
// İstifadə: npx http-server imposter -p 8080 &  sonra  node tests/e2e.mjs [screenshotsDir]
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(process.env.NPM_GLOBAL || '/opt/node22/lib/node_modules', 'playwright'));
}

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const SHOTS = process.argv[2] || null;
if (SHOTS) await mkdir(SHOTS, { recursive: true });

const browser = await playwright.chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'az-AZ',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

let shotN = 0;
async function shot(name) {
  if (!SHOTS) return;
  shotN++;
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SHOTS, `${String(shotN).padStart(2, '0')}-${name}.png`) });
}
async function fullShot(name) {
  if (!SHOTS) return;
  shotN++;
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SHOTS, `${String(shotN).padStart(2, '0')}-${name}.png`), fullPage: true });
}
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('impostor:v1')));
const act = (a, extra = '') => page.locator(`[data-action="${a}"]${extra}`).first().click();

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.home');
await shot('home');

// --- Ayarlar ---
await act('go', '[data-to="setup"]');
await page.waitForSelector('.setup');
await act('players-inc'); // 5 oyunçu
const names = ['Aysel', 'Fərid', 'Rəşad', 'Leyla', 'Orxan'];
const inputs = page.locator('[data-name-id]');
assert.equal(await inputs.count(), 5);
for (let i = 0; i < 5; i++) await inputs.nth(i).fill(names[i]);
await page.locator('.setup h2').first().click(); // blur
await act('imp-inc'); // 2 impostor
await act('imp-inc'); // maks 2 → toast
assert.equal((await store()).settings.imposters, 2);
await fullShot('setup');

// Kateqoriyalar
await act('go', '[data-to="categories"]');
await page.waitForSelector('.cat-grid');
await act('cat-none');
await page.locator('[data-action="cat"][data-id="animals"]').click();
await page.locator('[data-action="cat"][data-id="food"]').click();
await page.locator('[data-action="cat"][data-id="azerbaijan"]').click();
await shot('categories');
assert.deepEqual((await store()).settings.categories, ['food', 'animals', 'azerbaijan']);
await act('go', '[data-to="setup"]');

// Dublikat ad yoxlaması
await inputs.nth(4).fill('aysel');
await act('start');
assert.ok(await page.locator('.toast.show').isVisible(), 'duplicate toast');
assert.equal(await page.locator('.setup').count(), 1);
await inputs.nth(4).fill('Orxan');

// --- Raund 1 ---
await act('start');
await page.waitForSelector('.reveal');
let s = await store();
let g = s.game;
assert.equal(g.imposters.length, 2);
assert.equal(g.mode, 'classic');
assert.ok(g.hint, 'hint enabled by default');
assert.ok(!g.imposters.includes(g.order[0]), 'imposter speaks first');
const ids = g.roster.map((p) => p.id);
await shot('reveal-front');

for (let i = 0; i < 5; i++) {
  const pid = ids[i];
  assert.equal(await page.locator('.pass-name span').last().textContent(), names[i]);
  // Kartı açmadan keçmək olmaz
  assert.equal(await page.locator('[data-action="next-card"]').getAttribute('aria-disabled'), 'true');
  await act('reveal');
  await page.waitForTimeout(100);
  const back = await page.locator('.flip-card .face.back').textContent();
  if (g.imposters.includes(pid)) {
    assert.match(back, /impostorsan/i);
    assert.ok(back.includes(g.hint), 'imposter sees hint');
    assert.ok(!back.includes(g.word), 'imposter must not see word');
    if (!s.__impShot) {
      await shot('reveal-imposter');
      s.__impShot = true;
    }
  } else {
    assert.ok(back.includes(g.word));
    assert.ok(!back.includes(g.hint) || g.word.includes(g.hint));
    if (!s.__civShot) {
      await shot('reveal-civilian');
      s.__civShot = true;
    }
  }
  await act('next-card');
}

// --- Müzakirə ---
await page.waitForSelector('.order-list');
const orderNames = await page.locator('.order-name').allTextContents();
assert.deepEqual(orderNames, g.order.map((id) => g.roster.find((p) => p.id === id).name));
await act('timer-toggle');
await page.waitForTimeout(1300);
const tText = await page.locator('#timer-text').textContent();
assert.ok(tText < '3:00', `timer runs: ${tText}`);
await shot('discussion');

// Kartıma yenidən bax
await act('peek-open');
await page.waitForSelector('.modal');
await shot('peek-modal');
await page.locator('[data-action="peek-pick"]').nth(2).click();
await page.waitForSelector('.reveal');
await act('reveal');
await act('next-card');
await page.waitForSelector('.order-list');

// --- Səsvermə: hamı 1-ci impostora səs verir ---
await act('to-vote');
const target = g.imposters[0];
for (let i = 0; i < 5; i++) {
  await act('vote-ready');
  const voter = ids[i];
  // vətəndaşlar 1-ci impostora, impostorlar isə bir vətəndaşa səs verir
  const civ = ids.find((x) => !g.imposters.includes(x));
  const pick = g.imposters.includes(voter) ? civ : target;
  await page.locator(`[data-action="vote-pick"][data-id="${pick}"]`).click();
  if (i === 0) await shot('vote');
  await act('vote-confirm');
}
await page.waitForSelector('.tally-list');
await shot('tally');
s = await store();
const civVictim = ids.find((x) => !g.imposters.includes(x));
assert.deepEqual(s.game.tally.eliminated, [target, civVictim]);

await act('to-result');
await page.waitForSelector('.result-card');
assert.match(await page.locator('.banner').textContent(), /Heç-heçə/);
// Son şans: tutulan impostor sözü tapdı
await page.locator(`[data-action="guess"][data-id="${target}"]`).click();
await fullShot('result');

// --- Raund 2 ---
const word1 = g.word;
const first1 = g.order[0];
await act('next-round');
await page.waitForSelector('.reveal');
s = await store();
const scores = Object.fromEntries(Object.values(s.scores).map((x) => [x.name, x.points]));
const nameOf = (id) => g.roster.find((p) => p.id === id).name;
assert.equal(scores[nameOf(target)], 1, 'caught imposter guessed word: +1');
assert.equal(scores[nameOf(g.imposters[1])], 2, 'escaped imposter: +2');
for (const id of ids.filter((x) => !g.imposters.includes(x))) assert.equal(scores[nameOf(id)], 1, 'civilian correct vote');
assert.equal(s.game.round, 2);
assert.notEqual(s.game.word, word1, 'new word');
assert.notEqual(s.game.order[0], first1, 'first speaker changes');
assert.equal(s.used.length, 2);

// Ana səhifə → Davam et (məxfilik: kart bağlı açılır)
await act('reveal');
await act('exit');
await act('modal-ok');
await page.waitForSelector('.home');
await page.reload();
await page.waitForSelector('[data-action="resume"]');
await shot('home-resume');
await act('resume');
await page.waitForSelector('.reveal');
assert.equal(await page.locator('.flip-card.revealed').count(), 0, 'card hidden after reload');

// --- Undercover rejimi, səsvermə bağlı ---
await act('exit');
await act('modal-ok');
await act('go', '[data-to="setup"]');
await act('mode', '[data-mode="undercover"]');
assert.ok(await page.locator('.hint-card').isDisabled());
await act('toggle', '[data-key="voting"]');
await act('toggle', '[data-key="timer"]');
await act('start');
await page.waitForSelector('.reveal');
s = await store();
g = s.game;
assert.equal(g.mode, 'undercover');
assert.equal(g.hint, null);
for (let i = 0; i < 5; i++) {
  await act('reveal');
  const back = await page.locator('.flip-card .face.back').textContent();
  assert.match(back, /Sənin sözün/);
  assert.ok(!/impostor/i.test(back), 'undercover does not know');
  assert.ok(back.includes(g.imposters.includes(ids[i]) ? g.imposterWord : g.word));
  if (g.imposters.includes(ids[i]) && i < 5) await shot('undercover-card');
  await act('next-card');
}
await page.waitForSelector('.order-list');
assert.equal(await page.locator('.timer-card').count(), 0);
await act('to-vote'); // səsvermə bağlı → birbaşa nəticə
await page.waitForSelector('.result-card');
await act('winner', '[data-w="imposters"]');
await fullShot('undercover-result');
await act('to-scores');
await page.waitForSelector('.score-list');
await shot('scores');

// Qaydalar
await act('scores-back');
await act('exit');
await act('modal-ok');
await act('go', '[data-to="rules"]');
await fullShot('rules');

assert.deepEqual(errors, [], `console errors: ${errors.join('\n')}`);
await browser.close();
console.log('E2E OK');
