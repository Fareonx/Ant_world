import { CATEGORIES, TOTAL_WORDS } from './words.js';
import * as G from './game.js';

// ---------------------------------------------------------------------------
// Vəziyyət (state) və yaddaş
// ---------------------------------------------------------------------------

const STORE_KEY = 'impostor:v1';
const ALL_CAT_IDS = CATEGORIES.map((c) => c.id);
const NAME_MAX = 16;
const TIMER_MIN = 30;
const TIMER_MAX = 600;
const TIMER_STEP = 30;

const DEFAULT_SETTINGS = {
  imposters: 1,
  categories: ALL_CAT_IDS,
  mode: 'classic', // 'classic' | 'undercover'
  hint: true,
  timer: true,
  timerSec: 180,
  voting: true,
  scoring: true,
  imposterNotFirst: true,
  showCategory: true,
};

const uid = () => {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return b[0].toString(36) + b[1].toString(36);
};

const newPlayers = (n) => Array.from({ length: n }, () => ({ id: uid(), name: '' }));

const state = {
  screen: 'home', // home | setup | categories | rules | scores | game
  players: newPlayers(4),
  settings: { ...DEFAULT_SETTINGS },
  used: [], // istifadə olunmuş sözlər ("cat:index")
  lastKey: null,
  scores: {}, // adKey -> { name, points }
  game: null,
  installDismissed: false,
  scoresBack: 'home',
};

const ui = { modal: null, lastScreen: null };

function save() {
  try {
    const { screen, scoresBack, ...rest } = state;
    localStorage.setItem(STORE_KEY, JSON.stringify(rest));
  } catch {
    /* yaddaş əlçatan deyil — oyun yenə də işləyir */
  }
}

function load() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch {
    data = null;
  }
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data.players) && data.players.length >= G.MIN_PLAYERS && data.players.length <= G.MAX_PLAYERS) {
    state.players = data.players.map((p) => ({
      id: typeof p.id === 'string' ? p.id : uid(),
      name: typeof p.name === 'string' ? p.name.slice(0, NAME_MAX) : '',
    }));
  }
  if (data.settings && typeof data.settings === 'object') {
    const s = { ...DEFAULT_SETTINGS, ...data.settings };
    s.categories = Array.isArray(s.categories) ? ALL_CAT_IDS.filter((id) => s.categories.includes(id)) : ALL_CAT_IDS;
    s.mode = s.mode === 'undercover' ? 'undercover' : 'classic';
    s.timerSec = clamp(Number(s.timerSec) || DEFAULT_SETTINGS.timerSec, TIMER_MIN, TIMER_MAX);
    s.imposters = G.clampImposters(Number(s.imposters) || 1, state.players.length);
    state.settings = s;
  }
  if (Array.isArray(data.used)) state.used = data.used.filter((k) => typeof k === 'string');
  if (typeof data.lastKey === 'string') state.lastKey = data.lastKey;
  if (data.scores && typeof data.scores === 'object') state.scores = data.scores;
  state.installDismissed = Boolean(data.installDismissed);

  const g = data.game;
  if (g && Array.isArray(g.roster) && Array.isArray(g.order) && Array.isArray(g.imposters) && g.cfg) {
    // Məxfilik: tətbiq yenidən açılanda heç bir kart açıq qalmır.
    g.revealed = false;
    g.seen = false;
    g.peek = null;
    g.voteReady = false;
    g.voteSel = null;
    if (g.timer && g.timer.running && g.timer.endsAt - Date.now() <= 0) {
      g.timer.running = false;
      g.timer.remaining = 0;
      g.timer.done = true;
    }
    state.game = g;
  }
}

// ---------------------------------------------------------------------------
// Köməkçilər
// ---------------------------------------------------------------------------

const app = document.getElementById('app');

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const lowerAz = (s) => s.toLocaleLowerCase('az');
const hueFor = (i) => Math.round((i * 137.508 + 250) % 360);
const defaultName = (i) => `Oyunçu ${i + 1}`;
const nameOf = (p, i) => p.name.trim() || defaultName(i);

function initial(name) {
  const ch = Array.from(name.trim())[0] || '?';
  return ch.toLocaleUpperCase('az');
}

function avatar(name, hue, cls = '') {
  return `<span class="avatar ${cls}" style="--h:${hue}" aria-hidden="true">${esc(initial(name))}</span>`;
}

function fmtTime(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function haptic(ms = 15) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* iOS dəstəkləmir */
  }
}

let toastTimer = null;
function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function confirmModal({ title, text, ok, danger = false, onOk }) {
  ui.modal = { type: 'confirm', title, text, ok, danger, onOk };
  render();
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;

// ---------------------------------------------------------------------------
// Səs və ekranın sönməməsi (taymer üçün)
// ---------------------------------------------------------------------------

let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

function alarm() {
  haptic([200, 100, 200, 100, 400]);
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.28, 0.56].forEach((dt, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1175 : 880;
    gain.gain.setValueAtTime(0.0001, t0 + dt);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.24);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0 + dt);
    osc.stop(t0 + dt + 0.26);
  });
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// ---------------------------------------------------------------------------
// Oyun axını
// ---------------------------------------------------------------------------

function hideToast() {
  clearTimeout(toastTimer);
  document.querySelector('.toast')?.classList.remove('show');
}

function go(screen) {
  hideToast();
  if (screen === 'setup') state.settings.imposters = G.clampImposters(state.settings.imposters, state.players.length);
  state.screen = screen;
  ui.modal = null;
  window.scrollTo(0, 0);
  render();
}

function startGame() {
  const names = state.players.map(nameOf);
  const lowered = names.map(lowerAz);
  const dupIdx = lowered.findIndex((n, i) => lowered.indexOf(n) !== i);
  if (dupIdx !== -1) {
    toast(`«${names[dupIdx]}» adı iki dəfə yazılıb`);
    return;
  }
  if (!state.settings.categories.length) {
    toast('Ən azı bir kateqoriya seç');
    return;
  }
  state.settings.imposters = G.clampImposters(state.settings.imposters, state.players.length);
  const roster = state.players.map((p, i) => ({ id: p.id, name: names[i], hue: hueFor(i) }));
  const prev = state.game;
  const sameRoster = prev && prev.roster.map((p) => p.id).join() === roster.map((p) => p.id).join();
  newRound(roster, prev ? prev.round + 1 : 1, sameRoster ? prev.order[0] : null);
}

function newRound(roster, roundNumber, prevFirst) {
  const s = state.settings;
  const r = G.createRound({
    players: roster,
    settings: s,
    categories: CATEGORIES,
    usedKeys: state.used,
    lastKey: state.lastKey,
    prevFirst,
    roundNumber,
  });
  if (r.resetHistory) {
    const sel = new Set(s.categories);
    state.used = state.used.filter((k) => !sel.has(k.split(':')[0]));
  }
  state.used.push(r.wordKey);
  state.lastKey = r.wordKey;

  state.game = {
    ...r,
    roster,
    cfg: {
      timer: s.timer,
      timerSec: s.timerSec,
      voting: s.voting,
      scoring: s.scoring,
      showCategory: s.showCategory,
    },
    phase: 'reveal',
    revealIdx: 0,
    revealed: false,
    seen: false,
    peek: null,
    votes: {},
    voteIdx: 0,
    voteReady: false,
    voteSel: null,
    tally: null,
    guessed: {},
    winner: null,
    scored: false,
    timer: { total: s.timerSec, remaining: s.timerSec * 1000, running: false, endsAt: 0, done: false },
  };
  save();
  go('game');
}

function nextRound() {
  const g = state.game;
  commitScores();
  newRound(g.roster, g.round + 1, g.order[0]);
}

function setPhase(phase) {
  const g = state.game;
  if (g.phase === 'discuss' && phase !== 'discuss') {
    pauseTimer();
    keepAwake(false);
  }
  g.phase = phase;
  save();
  window.scrollTo(0, 0);
  render();
}

function scoreDelta(g) {
  if (!g.cfg.scoring) return null;
  const ids = g.roster.map((p) => p.id);
  if (g.cfg.voting && g.tally) {
    return G.scoreWithVotes({
      playerIds: ids,
      imposterIds: g.imposters,
      votes: g.votes,
      eliminatedIds: g.tally.eliminated,
      guessed: g.mode === 'classic' ? g.guessed : {},
    });
  }
  if (!g.cfg.voting && g.winner) return G.scoreByWinner({ playerIds: ids, imposterIds: g.imposters, winner: g.winner });
  return null;
}

function commitScores() {
  const g = state.game;
  if (!g || g.scored || g.phase !== 'result') return;
  const delta = scoreDelta(g);
  if (!delta) return;
  for (const p of g.roster) {
    const key = lowerAz(p.name);
    const entry = (state.scores[key] ||= { name: p.name, points: 0 });
    entry.name = p.name;
    entry.points += delta[p.id] || 0;
  }
  g.scored = true;
  save();
}

// Taymer
function timerLeft(t) {
  return t.running ? Math.max(0, t.endsAt - Date.now()) : t.remaining;
}

function pauseTimer() {
  const t = state.game?.timer;
  if (t && t.running) {
    t.remaining = timerLeft(t);
    t.running = false;
  }
}

function tick() {
  const g = state.game;
  if (state.screen !== 'game' || !g || g.phase !== 'discuss' || !g.cfg.timer) return;
  const t = g.timer;
  if (t.running && timerLeft(t) <= 0) {
    t.running = false;
    t.remaining = 0;
    t.done = true;
    keepAwake(false);
    save();
    alarm();
    if (!g.peek) render();
    return;
  }
  const text = document.getElementById('timer-text');
  const ring = document.getElementById('timer-ring');
  if (text && ring) {
    const left = timerLeft(t);
    text.textContent = fmtTime(left);
    ring.style.setProperty('--p', String(Math.min(1, left / (t.total * 1000))));
    ring.classList.toggle('low', left <= 10000 && left > 0);
  }
}

// ---------------------------------------------------------------------------
// Hadisələr (actions)
// ---------------------------------------------------------------------------

const actions = {
  noop() {},
  go(el) {
    if (el.dataset.to === 'scores') state.scoresBack = state.screen === 'game' ? 'game' : 'home';
    go(el.dataset.to);
  },
  resume() {
    go('game');
  },
  home() {
    go('home');
  },

  // --- Ayarlar ---
  'players-inc'() {
    if (state.players.length >= G.MAX_PLAYERS) return toast(`Maksimum ${G.MAX_PLAYERS} oyunçu`);
    state.players.push({ id: uid(), name: '' });
    afterPlayersChange();
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll('[data-name-id]');
      inputs[inputs.length - 1]?.focus();
    });
  },
  'players-dec'() {
    if (state.players.length <= G.MIN_PLAYERS) return toast(`Minimum ${G.MIN_PLAYERS} oyunçu`);
    state.players.pop();
    afterPlayersChange();
  },
  'player-remove'(el) {
    if (state.players.length <= G.MIN_PLAYERS) return toast(`Minimum ${G.MIN_PLAYERS} oyunçu`);
    state.players = state.players.filter((p) => p.id !== el.dataset.id);
    afterPlayersChange();
  },
  'imp-inc'() {
    const max = G.maxImposters(state.players.length);
    if (state.settings.imposters >= max) {
      return toast(`${state.players.length} oyunçu üçün maksimum ${max} impostor`);
    }
    state.settings.imposters++;
    save();
    render();
  },
  'imp-dec'() {
    if (state.settings.imposters <= 1) return toast('Ən azı 1 impostor olmalıdır');
    state.settings.imposters--;
    save();
    render();
  },
  mode(el) {
    state.settings.mode = el.dataset.mode;
    save();
    render();
  },
  toggle(el) {
    const key = el.dataset.key;
    state.settings[key] = !state.settings[key];
    if (key === 'hint') haptic();
    save();
    render();
  },
  'timer-inc'() {
    state.settings.timerSec = clamp(state.settings.timerSec + TIMER_STEP, TIMER_MIN, TIMER_MAX);
    save();
    render();
  },
  'timer-dec'() {
    state.settings.timerSec = clamp(state.settings.timerSec - TIMER_STEP, TIMER_MIN, TIMER_MAX);
    save();
    render();
  },
  cat(el) {
    const id = el.dataset.id;
    const sel = new Set(state.settings.categories);
    sel.has(id) ? sel.delete(id) : sel.add(id);
    state.settings.categories = ALL_CAT_IDS.filter((c) => sel.has(c));
    save();
    render();
  },
  'cat-all'() {
    state.settings.categories = ALL_CAT_IDS.slice();
    save();
    render();
  },
  'cat-none'() {
    state.settings.categories = [];
    save();
    render();
  },
  start() {
    startGame();
  },

  // --- Kartlar ---
  reveal() {
    const g = state.game;
    if (g.peek) {
      g.peek.revealed = !g.peek.revealed;
      g.peek.seen = true;
    } else {
      g.revealed = !g.revealed;
      g.seen = true;
    }
    haptic();
    render();
  },
  'next-card'() {
    const g = state.game;
    if (g.peek) {
      g.peek = null;
      render();
      return;
    }
    if (!g.seen) return;
    g.revealed = false;
    g.seen = false;
    if (g.revealIdx < g.roster.length - 1) {
      g.revealIdx++;
      save();
      render();
    } else {
      setPhase('discuss');
    }
  },
  'peek-open'() {
    ui.modal = { type: 'peek' };
    render();
  },
  'peek-pick'(el) {
    ui.modal = null;
    state.game.peek = { id: el.dataset.id, revealed: false, seen: false };
    window.scrollTo(0, 0);
    render();
  },

  // --- Müzakirə / taymer ---
  'timer-toggle'() {
    const t = state.game.timer;
    if (t.running) {
      pauseTimer();
      keepAwake(false);
    } else {
      if (t.remaining <= 0) t.remaining = t.total * 1000;
      t.endsAt = Date.now() + t.remaining;
      t.running = true;
      t.done = false;
      unlockAudio();
      keepAwake(true);
    }
    save();
    render();
  },
  'timer-add'() {
    const t = state.game.timer;
    if (t.running) t.endsAt += 30000;
    else t.remaining += 30000;
    t.total = Math.max(t.total, Math.ceil(timerLeft(t) / 1000));
    t.done = false;
    save();
    render();
  },
  'timer-reset'() {
    const t = state.game.timer;
    t.running = false;
    t.total = state.game.cfg.timerSec;
    t.remaining = t.total * 1000;
    t.done = false;
    keepAwake(false);
    save();
    render();
  },
  'to-vote'() {
    const g = state.game;
    if (g.cfg.voting) {
      g.votes = {};
      g.voteIdx = 0;
      g.voteReady = false;
      g.voteSel = null;
      setPhase('vote');
    } else {
      setPhase('result');
    }
  },

  // --- Səsvermə ---
  'vote-ready'() {
    state.game.voteReady = true;
    render();
  },
  'vote-pick'(el) {
    state.game.voteSel = el.dataset.id;
    haptic();
    render();
  },
  'vote-confirm'() {
    const g = state.game;
    if (!g.voteSel) return;
    g.votes[g.roster[g.voteIdx].id] = g.voteSel;
    g.voteSel = null;
    g.voteReady = false;
    if (g.voteIdx < g.roster.length - 1) {
      g.voteIdx++;
      save();
      render();
    } else {
      g.tally = G.tallyVotes(g.votes, g.roster.map((p) => p.id), g.imposters.length);
      setPhase('tally');
    }
  },
  'to-result'() {
    setPhase('result');
    haptic(40);
  },

  // --- Nəticə ---
  guess(el) {
    const g = state.game;
    if (g.scored) return;
    g.guessed[el.dataset.id] = !g.guessed[el.dataset.id];
    save();
    render();
  },
  winner(el) {
    const g = state.game;
    if (g.scored) return;
    g.winner = el.dataset.w;
    save();
    render();
  },
  'next-round'() {
    nextRound();
  },
  'to-setup'() {
    commitScores();
    go('setup');
  },
  'to-scores'() {
    commitScores();
    state.scoresBack = 'game';
    go('scores');
  },
  'scores-back'() {
    go(state.scoresBack === 'game' && state.game ? 'game' : 'home');
  },
  'scores-reset'() {
    confirmModal({
      title: 'Xallar sıfırlansın?',
      text: 'Bütün oyunçuların xalları silinəcək.',
      ok: 'Sıfırla',
      danger: true,
      onOk() {
        state.scores = {};
        save();
      },
    });
  },
  exit() {
    confirmModal({
      title: 'Ana səhifəyə qayıdılsın?',
      text: 'Raund yadda qalacaq — «Davam et» ilə qayıda bilərsən.',
      ok: 'Bəli, çıx',
      onOk() {
        pauseTimer();
        keepAwake(false);
        save();
        state.screen = 'home';
      },
    });
  },

  // --- Modal ---
  'modal-ok'() {
    const m = ui.modal;
    ui.modal = null;
    m?.onOk?.();
    render();
  },
  'modal-cancel'() {
    ui.modal = null;
    render();
  },
  'install-dismiss'() {
    state.installDismissed = true;
    save();
    render();
  },
};

function afterPlayersChange() {
  state.settings.imposters = G.clampImposters(state.settings.imposters, state.players.length);
  save();
  render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const fn = actions[el.dataset.action];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
});

document.addEventListener('input', (e) => {
  const input = e.target.closest('[data-name-id]');
  if (!input) return;
  const p = state.players.find((x) => x.id === input.dataset.nameId);
  if (!p) return;
  p.name = input.value.slice(0, NAME_MAX);
  const i = state.players.indexOf(p);
  const av = input.parentElement.querySelector('.avatar');
  if (av) av.textContent = initial(nameOf(p, i));
  save();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('[data-name-id]')) {
    e.preventDefault();
    const inputs = [...document.querySelectorAll('[data-name-id]')];
    const next = inputs[inputs.indexOf(e.target) + 1];
    next ? next.focus() : e.target.blur();
  }
  if (e.key === 'Escape' && ui.modal) actions['modal-cancel']();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const t = state.game?.timer;
    if (t?.running && state.screen === 'game' && state.game.phase === 'discuss') keepAwake(true);
    tick();
  }
});

// ---------------------------------------------------------------------------
// Ekranlar
// ---------------------------------------------------------------------------

const LOGO = `
<svg viewBox="0 0 120 120" class="logo-svg" aria-hidden="true">
  <defs>
    <linearGradient id="lg-hat" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9b7bff"/><stop offset="1" stop-color="#ff4d8d"/>
    </linearGradient>
  </defs>
  <path d="M30 104c6-14 18-21 30-21s24 7 30 21z" fill="url(#lg-hat)" opacity=".85"/>
  <path d="M33 52c1-21 11-33 27-33s26 12 27 33z" fill="url(#lg-hat)"/>
  <path d="M34 44h52l1 8H33z" fill="#140f33" opacity=".55"/>
  <ellipse cx="60" cy="53" rx="47" ry="8.5" fill="url(#lg-hat)"/>
  <path d="M31 66c18-7 40-7 58 0 2 10-4 16-13 16-7 0-12-4-16-9-4 5-9 9-16 9-9 0-15-6-13-16z" fill="#f4f2ff"/>
  <ellipse cx="45" cy="71" rx="6.5" ry="4.2" fill="#0a0b14"/>
  <ellipse cx="75" cy="71" rx="6.5" ry="4.2" fill="#0a0b14"/>
  <circle cx="47" cy="70" r="1.4" fill="#fff"/><circle cx="77" cy="70" r="1.4" fill="#fff"/>
</svg>`;

function header(title, backAttrs = 'data-action="home"', right = '') {
  return `
  <header class="topbar">
    <button class="icon-btn" ${backAttrs} aria-label="Geri">‹</button>
    <h1 class="topbar-title">${title}</h1>
    <div class="topbar-right">${right}</div>
  </header>`;
}

function stepper(value, decAction, incAction, label, decDisabled, incDisabled) {
  return `
  <div class="stepper" role="group" aria-label="${label}">
    <button class="step-btn ${decDisabled ? 'dim' : ''}" data-action="${decAction}" aria-label="Azalt">−</button>
    <output class="step-val">${value}</output>
    <button class="step-btn ${incDisabled ? 'dim' : ''}" data-action="${incAction}" aria-label="Artır">+</button>
  </div>`;
}

function switchRow(key, icon, title, desc = '', extra = '') {
  const on = state.settings[key];
  return `
  <div class="switch-row-wrap">
    <button class="switch-row ${on ? 'on' : ''}" data-action="toggle" data-key="${key}" role="switch" aria-checked="${on}">
      <span class="sr-icon">${icon}</span>
      <span class="sr-text"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</span>
      <span class="switch" aria-hidden="true"></span>
    </button>
    ${on ? extra : ''}
  </div>`;
}

function installBanner() {
  if (!isIOS || isStandalone() || state.installDismissed) return '';
  return `
  <div class="install">
    <span class="install-icon">📲</span>
    <p><b>Tətbiq kimi quraşdır:</b> Safari-də <span class="kbd">Paylaş ⬆︎</span> düyməsinə bas, sonra <span class="kbd">Add to Home Screen</span> seç.</p>
    <button class="icon-btn small" data-action="install-dismiss" aria-label="Bağla">✕</button>
  </div>`;
}

function screenHome() {
  const g = state.game;
  const hasScores = Object.keys(state.scores).length > 0;
  return `
  <main class="screen home">
    <div class="home-hero">
      <div class="logo">${LOGO}</div>
      <h1 class="title">İMPOSTOR</h1>
      <p class="tagline">Aranızdakı impostoru tapın!</p>
      <p class="stats">${CATEGORIES.length} kateqoriya · ${TOTAL_WORDS} söz</p>
    </div>
    <div class="stack">
      ${g ? `<button class="btn btn-primary" data-action="resume">▶ Davam et · Raund ${g.round}</button>` : ''}
      <button class="btn ${g ? 'btn-secondary' : 'btn-primary'}" data-action="go" data-to="setup">${g ? '✨ Yeni oyun' : '▶ Oyuna başla'}</button>
      <div class="row">
        <button class="btn btn-ghost" data-action="go" data-to="rules">📖 Qaydalar</button>
        <button class="btn btn-ghost" data-action="go" data-to="scores" ${hasScores ? '' : 'data-empty="1"'}>🏆 Xallar</button>
      </div>
    </div>
    ${installBanner()}
  </main>`;
}

function screenSetup() {
  const s = state.settings;
  const n = state.players.length;
  const maxImp = G.maxImposters(n);
  const selCats = CATEGORIES.filter((c) => s.categories.includes(c.id));
  const wordCount = selCats.reduce((sum, c) => sum + c.words.length, 0);
  const undercover = s.mode === 'undercover';

  const names = state.players
    .map(
      (p, i) => `
      <li class="name-row">
        ${avatar(nameOf(p, i), hueFor(i))}
        <input class="name-input" data-name-id="${p.id}" value="${esc(p.name)}" placeholder="${defaultName(i)}"
          maxlength="${NAME_MAX}" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="words" enterkeyhint="next"
          aria-label="${i + 1}-ci oyunçunun adı">
        <button class="icon-btn small ghost" data-action="player-remove" data-id="${p.id}" aria-label="Sil" ${n <= G.MIN_PLAYERS ? 'aria-disabled="true"' : ''}>✕</button>
      </li>`,
    )
    .join('');

  const chips = selCats.length
    ? selCats.slice(0, 8).map((c) => `<span class="chip">${c.emoji} ${esc(c.name)}</span>`).join('') +
      (selCats.length > 8 ? `<span class="chip">+${selCats.length - 8}</span>` : '')
    : `<span class="chip warn">Heç bir kateqoriya seçilməyib</span>`;

  const timerExtra = `
    <div class="sub-setting">
      <span>Müddət</span>
      ${stepper(fmtTime(s.timerSec * 1000), 'timer-dec', 'timer-inc', 'Taymer müddəti', s.timerSec <= TIMER_MIN, s.timerSec >= TIMER_MAX)}
    </div>`;

  return `
  <main class="screen setup">
    ${header('Oyun ayarları')}

    <section class="card">
      <div class="card-head">
        <div><h2>👥 Oyunçular</h2><p class="muted">${G.MIN_PLAYERS}–${G.MAX_PLAYERS} nəfər · adları yaz</p></div>
        ${stepper(n, 'players-dec', 'players-inc', 'Oyunçu sayı', n <= G.MIN_PLAYERS, n >= G.MAX_PLAYERS)}
      </div>
      <ol class="name-list">${names}</ol>
      ${n < G.MAX_PLAYERS ? `<button class="btn btn-dashed" data-action="players-inc">＋ Oyunçu əlavə et</button>` : ''}
    </section>

    <section class="card">
      <div class="card-head">
        <div><h2>🕵️ İmpostor sayı</h2><p class="muted">${n} oyunçu üçün maksimum ${maxImp}</p></div>
        ${stepper(s.imposters, 'imp-dec', 'imp-inc', 'İmpostor sayı', s.imposters <= 1, s.imposters >= maxImp)}
      </div>
    </section>

    <section class="card">
      <h2>🎮 Rejim</h2>
      <div class="segmented" role="radiogroup">
        <button class="seg ${!undercover ? 'on' : ''}" data-action="mode" data-mode="classic" role="radio" aria-checked="${!undercover}">Klassik</button>
        <button class="seg ${undercover ? 'on' : ''}" data-action="mode" data-mode="undercover" role="radio" aria-checked="${undercover}">Undercover</button>
      </div>
      <p class="muted mode-desc">${
        undercover
          ? 'İmpostor oxşar, amma <b>fərqli söz</b> alır və impostor olduğunu <b>bilmir</b>. Hər kəs şübhəlidir!'
          : 'Hamı eyni sözü görür, impostor isə yalnız <b>«Sən impostorsan!»</b> yazısını görür.'
      }</p>
    </section>

    <button class="card card-link" data-action="go" data-to="categories">
      <div class="card-link-body">
        <h2>🗂 Kateqoriyalar</h2>
        <p class="muted">${selCats.length} / ${CATEGORIES.length} seçilib · ${wordCount} söz</p>
        <div class="chips">${chips}</div>
      </div>
      <span class="chev" aria-hidden="true">›</span>
    </button>

    <button class="card hint-card ${s.hint && !undercover ? 'on' : ''}" data-action="toggle" data-key="hint"
      role="switch" aria-checked="${s.hint && !undercover}" ${undercover ? 'disabled' : ''}>
      <span class="bulb" aria-hidden="true">💡</span>
      <span class="hint-text">
        <b>İmpostora ipucu</b>
        <small>${
          undercover
            ? 'Undercover rejimində ipucu olmur'
            : s.hint
              ? 'Açıqdır — impostor sözlə uzaqdan bağlı bir ipucu görür'
              : 'Bağlıdır — impostor heç bir ipucu görmür'
        }</small>
      </span>
      <span class="switch" aria-hidden="true"></span>
    </button>

    <section class="card list-card">
      ${switchRow('timer', '⏱', 'Müzakirə taymeri', 'Vaxt bitəndə siqnal', timerExtra)}
      ${switchRow('voting', '🗳', 'Tətbiqdə səsvermə', 'Hər kəs gizli səs verir')}
      ${switchRow('scoring', '🏆', 'Xal hesabı', 'Raundlar arası xallar')}
      ${switchRow('imposterNotFirst', '🙅', 'İmpostor birinci danışmasın')}
      ${switchRow('showCategory', '📂', 'Kateqoriyanı göstər', 'Kartda kateqoriya yazılır')}
    </section>

    <footer class="footer">
      <button class="btn btn-primary btn-lg" data-action="start" ${selCats.length ? '' : 'aria-disabled="true"'}>▶ Oyuna başla</button>
    </footer>
  </main>`;
}

function screenCategories() {
  const sel = new Set(state.settings.categories);
  const all = sel.size === CATEGORIES.length;
  const tiles = CATEGORIES.map(
    (c) => `
    <button class="cat-tile ${sel.has(c.id) ? 'on' : ''}" data-action="cat" data-id="${c.id}" role="checkbox" aria-checked="${sel.has(c.id)}">
      <span class="cat-emoji">${c.emoji}</span>
      <span class="cat-name">${esc(c.name)}</span>
      <span class="cat-count">${c.words.length} söz</span>
      <span class="check" aria-hidden="true">✓</span>
    </button>`,
  ).join('');
  return `
  <main class="screen">
    ${header('Kateqoriyalar', 'data-action="go" data-to="setup"')}
    <div class="toolbar">
      <span class="muted">${sel.size} / ${CATEGORIES.length} seçilib</span>
      <button class="pill-btn" data-action="${all ? 'cat-none' : 'cat-all'}">${all ? 'Təmizlə' : '✓ Hamısını seç'}</button>
    </div>
    <div class="cat-grid">${tiles}</div>
    <footer class="footer">
      <button class="btn btn-primary" data-action="go" data-to="setup" ${sel.size ? '' : 'aria-disabled="true"'}>${
        sel.size ? `Hazır · ${sel.size} kateqoriya` : 'Ən azı birini seç'
      }</button>
    </footer>
  </main>`;
}

function screenRules() {
  const P = G.POINTS;
  return `
  <main class="screen">
    ${header('Qaydalar')}
    <section class="card prose">
      <h2>🎯 Məqsəd</h2>
      <p>Hamı eyni gizli sözü bilir — <b>impostordan</b> başqa. Vətəndaşlar impostoru tapmalı, impostor isə özünü ələ verməməlidir.</p>
    </section>
    <section class="card prose">
      <h2>🃏 Necə oynanılır</h2>
      <ol>
        <li>Oyunçuların adlarını, impostor sayını və kateqoriyaları seç.</li>
        <li>Telefonu növbə ilə ötürün. Hər kəs <b>öz kartına</b> baxır və gizlədir.</li>
        <li>Müzakirədə hər kəs ekranda göstərilən <b>sıra ilə</b> sözlə bağlı bir söz və ya ifadə deyir. Sıra hər raund təsadüfi dəyişir.</li>
        <li>Çox açıq danışma — impostor sözü tapa bilər! Çox gizli danışsan, səni impostor sanarlar.</li>
        <li>Sonra kimin impostor olduğuna səs verin və nəticəyə baxın.</li>
      </ol>
    </section>
    <section class="card prose">
      <h2>💡 İpucu</h2>
      <p>İpucu açıq olanda impostor sözlə <b>uzaqdan</b> bağlı bir söz görür. Məsələn, «Futbol» üçün ipucu «Yaşıl» ola bilər. Bu, sözü birbaşa açmır, yalnız istiqamət verir.</p>
    </section>
    <section class="card prose">
      <h2>🎭 Undercover rejimi</h2>
      <p>İmpostor oxşar, amma fərqli söz alır (məsələn, «Pizza» əvəzinə «Lahmacun») və impostor olduğunu bilmir. Diqqətli olun!</p>
    </section>
    <section class="card prose">
      <h2>🏆 Xallar</h2>
      <ul>
        <li>Vətəndaş impostora səs verdisə: <b>+${P.civilianCorrectVote}</b></li>
        <li>İmpostor tutulmadısa: <b>+${P.imposterEscaped}</b></li>
        <li>Tutulan impostor sözü təxmin etdisə (klassik): <b>+${P.imposterGuessedWord}</b></li>
        <li>Səsvermə bağlı olanda: qalib vətəndaşlar <b>+${P.civiliansWin}</b>, qalib impostor <b>+${P.impostersWin}</b></li>
      </ul>
      <p class="muted">Səslər bərabər olanda heç kim kənarlaşdırılmır.</p>
    </section>
    <footer class="footer">
      <button class="btn btn-primary" data-action="go" data-to="setup">▶ Oyuna başla</button>
    </footer>
  </main>`;
}

function screenScores() {
  const rows = Object.values(state.scores).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'az'));
  const medals = ['🥇', '🥈', '🥉'];
  const list = rows.length
    ? `<ol class="score-list">${rows
        .map((r) => {
          const rank = rows.findIndex((x) => x.points === r.points);
          return `<li class="score-row ${rank === 0 && r.points > 0 ? 'top' : ''}">
            <span class="rank">${medals[rank] && r.points > 0 ? medals[rank] : rank + 1}</span>
            <span class="score-name">${esc(r.name)}</span>
            <span class="score-pts">${r.points}</span>
          </li>`;
        })
        .join('')}</ol>`
    : `<div class="empty"><div class="empty-emoji">🏆</div><p>Hələ xal yoxdur.<br>Bir raund oynayın!</p></div>`;
  const inGame = state.scoresBack === 'game' && state.game;
  return `
  <main class="screen">
    ${header('Xal cədvəli', 'data-action="scores-back"')}
    <section class="card">${list}</section>
    <footer class="footer">
      ${inGame ? `<button class="btn btn-primary" data-action="next-round">▶ Növbəti raund</button>` : ''}
      ${rows.length ? `<button class="btn btn-ghost" data-action="scores-reset">↺ Xalları sıfırla</button>` : ''}
    </footer>
  </main>`;
}

// --- Oyun ekranları ---

const playerById = (g, id) => g.roster.find((p) => p.id === id);

function gameTop(label, right = '', left = '<button class="icon-btn" data-action="exit" aria-label="Çıx">✕</button>') {
  return `
  <header class="topbar game-top">
    ${left}
    <div class="topbar-title small">${label}</div>
    <div class="topbar-right">${right}</div>
  </header>`;
}

function cardBack(g, pid) {
  const isImp = g.imposters.includes(pid);
  const cat = g.cfg.showCategory ? `<p class="card-cat">${g.catEmoji} ${esc(g.catName)}</p>` : '';
  if (isImp && g.mode === 'classic') {
    return `
    <div class="face back imp">
      <div class="imp-icon">🕵️</div>
      <div class="word imp-word">Sən impostorsan!</div>
      <p class="sub">Sözü bilmirsən. Diqqətlə dinlə və özünü ələ vermə!</p>
      ${g.hint ? `<div class="hint-pill"><span>💡 İpucu</span><b>${esc(g.hint)}</b></div>` : ''}
      ${cat}
    </div>`;
  }
  const word = isImp ? g.imposterWord : g.word;
  return `
  <div class="face back civ">
    <p class="label">Sənin sözün</p>
    <div class="word">${esc(word)}</div>
    ${cat}
    <p class="sub">Yadda saxla və heç kimə göstərmə</p>
  </div>`;
}

function screenReveal(g) {
  const peek = g.peek;
  const pid = peek ? peek.id : g.roster[g.revealIdx].id;
  const p = playerById(g, pid);
  const revealed = peek ? peek.revealed : g.revealed;
  const seen = peek ? peek.seen : g.seen;
  const total = g.roster.length;
  const isLast = !peek && g.revealIdx === total - 1;
  const label = peek ? 'Karta yenidən baxış' : `Raund ${g.round} · Kart ${g.revealIdx + 1}/${total}`;
  const btn = peek ? (seen ? '✓ Gizlət və qayıt' : '‹ Geri qayıt') : isLast ? '✓ Gizlət və müzakirəyə keç' : '✓ Gizlət və telefonu ötür';
  const canGo = seen || Boolean(peek);
  const pct = peek ? 100 : ((g.revealIdx + (seen ? 1 : 0)) / total) * 100;

  return `
  <main class="screen game reveal">
    ${peek ? gameTop(label, '', '<button class="icon-btn" data-action="next-card" aria-label="Geri">‹</button>') : gameTop(label)}
    <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
    <div class="pass">
      <p class="muted">Telefonu bu oyunçuya ver:</p>
      <div class="pass-name">${avatar(p.name, p.hue, 'lg')}<span>${esc(p.name)}</span></div>
    </div>
    <button class="flip-card ${revealed ? 'revealed' : ''}" data-action="reveal" aria-label="${revealed ? 'Kartı gizlət' : 'Kartı aç'}">
      <div class="flip-inner">
        <div class="face front">
          <div class="front-q">?</div>
          <p class="front-text">Kartı açmaq üçün toxun</p>
          <p class="front-warn">🙈 Başqaları ekrana baxmasın!</p>
        </div>
        ${cardBack(g, pid)}
      </div>
    </button>
    <footer class="footer">
      <button class="btn btn-primary" data-action="next-card" ${canGo ? '' : 'aria-disabled="true"'}>${canGo ? btn : 'Əvvəlcə kartına bax'}</button>
    </footer>
  </main>`;
}

function screenDiscuss(g) {
  const t = g.timer;
  const left = timerLeft(t);
  const order = g.order
    .map((id, i) => {
      const p = playerById(g, id);
      return `<li class="order-row ${i === 0 ? 'first' : ''}">
        <span class="num">${i + 1}</span>${avatar(p.name, p.hue)}<span class="order-name">${esc(p.name)}</span>
        ${i === 0 ? '<span class="badge">Birinci</span>' : ''}
      </li>`;
    })
    .join('');

  const timer = g.cfg.timer
    ? `
    <section class="card timer-card ${t.done ? 'done' : ''}">
      <div id="timer-ring" class="timer-ring ${left <= 10000 && left > 0 ? 'low' : ''}" style="--p:${Math.min(1, left / (t.total * 1000))}">
        <span id="timer-text">${t.done ? '0:00' : fmtTime(left)}</span>
        ${t.done ? '<small>Vaxt bitdi!</small>' : ''}
      </div>
      <div class="timer-btns">
        <button class="btn btn-secondary" data-action="timer-toggle">${t.running ? '⏸ Pauza' : left < t.total * 1000 && left > 0 ? '▶ Davam' : '▶ Başlat'}</button>
        <button class="btn btn-ghost" data-action="timer-add">+30 san</button>
        <button class="btn btn-ghost" data-action="timer-reset">↺ Sıfırla</button>
      </div>
    </section>`
    : '';

  return `
  <main class="screen game">
    ${gameTop(`Raund ${g.round}`, `<button class="icon-btn" data-action="peek-open" aria-label="Kartıma bax">👁</button>`)}
    <h1 class="screen-title">Müzakirə</h1>
    ${g.cfg.showCategory ? `<div class="cat-pill">${g.catEmoji} Kateqoriya: <b>${esc(g.catName)}</b></div>` : ''}
    ${timer}
    <section class="card">
      <h2>🎲 Danışma sırası</h2>
      <p class="muted">Hər kəs növbə ilə sözlə bağlı <b>bir söz</b> deyir. Çox açıq demə — impostor da dinləyir!</p>
      <ol class="order-list">${order}</ol>
    </section>
    <button class="btn btn-ghost" data-action="peek-open">👁 Sözümü unutdum</button>
    <footer class="footer">
      <button class="btn btn-primary" data-action="to-vote">${g.cfg.voting ? '🗳 Səsverməyə keç' : '🔍 İmpostoru göstər'}</button>
    </footer>
  </main>`;
}

function screenVote(g) {
  const voter = g.roster[g.voteIdx];
  const total = g.roster.length;
  const label = `Səsvermə · ${g.voteIdx + 1}/${total}`;
  const pct = (g.voteIdx / total) * 100;

  if (!g.voteReady) {
    return `
    <main class="screen game">
      ${gameTop(label)}
      <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
      <div class="pass pass-center">
        <p class="muted">Telefonu bu oyunçuya ver:</p>
        <div class="pass-name big">${avatar(voter.name, voter.hue, 'xl')}<span>${esc(voter.name)}</span></div>
        <p class="muted">🙈 Səsini gizli ver — başqaları baxmasın</p>
      </div>
      <footer class="footer">
        <button class="btn btn-primary" data-action="vote-ready">🗳 Səs ver</button>
      </footer>
    </main>`;
  }

  const choices = g.roster
    .filter((p) => p.id !== voter.id)
    .map(
      (p) => `
      <button class="vote-opt ${g.voteSel === p.id ? 'on' : ''}" data-action="vote-pick" data-id="${p.id}" role="radio" aria-checked="${g.voteSel === p.id}">
        ${avatar(p.name, p.hue)}<span>${esc(p.name)}</span>
      </button>`,
    )
    .join('');
  const sel = g.voteSel ? playerById(g, g.voteSel) : null;
  return `
  <main class="screen game">
    ${gameTop(label)}
    <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
    <h1 class="screen-title">${esc(voter.name)}, sənin fikrincə impostor kimdir?</h1>
    ${g.imposters.length > 1 ? `<p class="muted center">Bu raundda ${g.imposters.length} impostor var. Bir nəfərə səs ver.</p>` : ''}
    <div class="vote-grid" role="radiogroup">${choices}</div>
    <footer class="footer">
      <button class="btn btn-primary" data-action="vote-confirm" ${sel ? '' : 'aria-disabled="true"'}>${
        sel ? `✓ ${esc(sel.name)} — təsdiqlə` : 'Birini seç'
      }</button>
    </footer>
  </main>`;
}

function screenTally(g) {
  const t = g.tally;
  const max = Math.max(1, ...Object.values(t.counts));
  const rows = t.sorted
    .map(({ id, count }) => {
      const p = playerById(g, id);
      const elim = t.eliminated.includes(id);
      return `<li class="tally-row ${elim ? 'elim' : ''}">
        ${avatar(p.name, p.hue)}
        <div class="tally-main">
          <span class="tally-name">${esc(p.name)}${elim ? ' <span class="badge danger">Kənarlaşdırıldı</span>' : ''}</span>
          <div class="bar"><div style="width:${(count / max) * 100}%"></div></div>
        </div>
        <b class="tally-count">${count}</b>
      </li>`;
    })
    .join('');
  const names = t.eliminated.map((id) => esc(playerById(g, id).name)).join(', ');
  const verdict = t.eliminated.length
    ? `Kənarlaşdırılır: <b>${names}</b>${t.tie ? '<br><small>Digər yer üçün səslər bərabərdir</small>' : ''}`
    : 'Səslər bərabərdir — heç kim kənarlaşdırılmadı';
  return `
  <main class="screen game">
    ${gameTop(`Raund ${g.round}`)}
    <h1 class="screen-title">Səsvermənin nəticəsi</h1>
    <section class="card"><ol class="tally-list">${rows}</ol></section>
    <div class="verdict">${verdict}</div>
    <footer class="footer">
      <button class="btn btn-primary btn-lg" data-action="to-result">🔍 İmpostoru göstər</button>
    </footer>
  </main>`;
}

function screenResult(g) {
  const imps = g.imposters.map((id) => playerById(g, id));
  const plural = imps.length > 1;
  const voting = g.cfg.voting && g.tally;
  const eliminated = voting ? g.tally.eliminated : [];

  let banner = '';
  if (voting) {
    const outcome = G.roundOutcome(g.imposters, eliminated);
    banner = {
      civilians: `<div class="banner win">🎉 Vətəndaşlar qazandı!</div>`,
      imposters: `<div class="banner lose">🕵️ ${plural ? 'İmpostorlar' : 'İmpostor'} qazandı!</div>`,
      split: `<div class="banner split">⚖️ Heç-heçə — biri tutuldu, biri qaçdı</div>`,
    }[outcome];
  } else if (g.winner) {
    banner =
      g.winner === 'civilians'
        ? `<div class="banner win">🎉 Vətəndaşlar qazandı!</div>`
        : `<div class="banner lose">🕵️ ${plural ? 'İmpostorlar' : 'İmpostor'} qazandı!</div>`;
  }

  const impList = imps
    .map((p) => {
      const status = voting ? (eliminated.includes(p.id) ? '<span class="badge ok">Tutuldu</span>' : '<span class="badge danger">Qaçdı</span>') : '';
      return `<div class="imp-person">${avatar(p.name, p.hue, 'lg')}<span>${esc(p.name)}</span>${status}</div>`;
    })
    .join('');

  const words =
    g.mode === 'undercover'
      ? `<div class="word-pair">
          <div><p class="label">Vətəndaşların sözü</p><div class="word sm">${esc(g.word)}</div></div>
          <div><p class="label">İmpostorun sözü</p><div class="word sm imp-text">${esc(g.imposterWord)}</div></div>
        </div>`
      : `<p class="label">Gizli söz</p><div class="word">${esc(g.word)}</div>
         ${g.hint ? `<p class="muted">💡 İmpostorun ipucusu: <b>${esc(g.hint)}</b></p>` : ''}`;

  // Son şans: tutulan impostor sözü təxmin edir (klassik + səsvermə + xal)
  const caught = imps.filter((p) => eliminated.includes(p.id));
  const lastChance =
    g.cfg.scoring && voting && g.mode === 'classic' && caught.length
      ? `<section class="card">
          <h2>🎯 Son şans</h2>
          <p class="muted">Tutulan impostor sözü təxmin etsin. Düz tapdısa, işarələ (+${G.POINTS.imposterGuessedWord}).</p>
          ${caught
            .map(
              (p) => `<button class="switch-row ${g.guessed[p.id] ? 'on' : ''}" data-action="guess" data-id="${p.id}" role="switch" aria-checked="${Boolean(
                g.guessed[p.id],
              )}" ${g.scored ? 'disabled' : ''}>
                ${avatar(p.name, p.hue)}<span class="sr-text"><b>${esc(p.name)} sözü tapdı</b></span><span class="switch"></span>
              </button>`,
            )
            .join('')}
        </section>`
      : '';

  const winnerPick =
    g.cfg.scoring && !g.cfg.voting
      ? `<section class="card">
          <h2>Kim qazandı?</h2>
          <div class="row">
            <button class="btn ${g.winner === 'civilians' ? 'btn-primary' : 'btn-secondary'}" data-action="winner" data-w="civilians" ${g.scored ? 'disabled' : ''}>👥 Vətəndaşlar</button>
            <button class="btn ${g.winner === 'imposters' ? 'btn-danger' : 'btn-secondary'}" data-action="winner" data-w="imposters" ${g.scored ? 'disabled' : ''}>🕵️ ${plural ? 'İmpostorlar' : 'İmpostor'}</button>
          </div>
        </section>`
      : '';

  const delta = scoreDelta(g);
  const gains = delta
    ? g.roster
        .filter((p) => delta[p.id] > 0)
        .map((p) => `<span class="chip gain">${esc(p.name)} +${delta[p.id]}</span>`)
        .join('') || '<span class="chip">Bu raundda heç kim xal qazanmadı</span>'
    : '';

  return `
  <main class="screen game">
    ${gameTop(`Raund ${g.round}`)}
    ${banner}
    <section class="card result-card">
      <p class="label">${plural ? 'İmpostorlar' : 'İmpostor'}</p>
      <div class="imp-list">${impList}</div>
      <div class="divider"></div>
      ${words}
      ${g.cfg.showCategory ? `<p class="card-cat">${g.catEmoji} ${esc(g.catName)}</p>` : ''}
    </section>
    ${lastChance}
    ${winnerPick}
    ${gains ? `<section class="card"><h2>🏆 Bu raundun xalları</h2><div class="chips">${gains}</div></section>` : ''}
    <footer class="footer">
      <button class="btn btn-primary btn-lg" data-action="next-round">▶ Növbəti raund</button>
      <div class="row">
        <button class="btn btn-ghost" data-action="to-setup">⚙️ Ayarlar</button>
        ${g.cfg.scoring ? `<button class="btn btn-ghost" data-action="to-scores">🏆 Xallar</button>` : ''}
      </div>
    </footer>
  </main>`;
}

function screenGame() {
  const g = state.game;
  if (!g) {
    state.screen = 'home';
    return screenHome();
  }
  if (g.peek) return screenReveal(g);
  switch (g.phase) {
    case 'reveal':
      return screenReveal(g);
    case 'discuss':
      return screenDiscuss(g);
    case 'vote':
      return screenVote(g);
    case 'tally':
      return screenTally(g);
    case 'result':
      return screenResult(g);
    default:
      return screenHome();
  }
}

function renderModal() {
  const m = ui.modal;
  if (!m) return '';
  if (m.type === 'confirm') {
    return `
    <div class="modal-backdrop" data-action="modal-cancel">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(m.title)}" data-action="noop">
        <h2>${esc(m.title)}</h2>
        <p class="muted">${esc(m.text)}</p>
        <div class="row">
          <button class="btn btn-ghost" data-action="modal-cancel">Ləğv et</button>
          <button class="btn ${m.danger ? 'btn-danger' : 'btn-primary'}" data-action="modal-ok">${esc(m.ok)}</button>
        </div>
      </div>
    </div>`;
  }
  if (m.type === 'peek') {
    const g = state.game;
    const list = g.roster
      .map((p) => `<button class="vote-opt" data-action="peek-pick" data-id="${p.id}">${avatar(p.name, p.hue)}<span>${esc(p.name)}</span></button>`)
      .join('');
    return `
    <div class="modal-backdrop" data-action="modal-cancel">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Kim kartına baxmaq istəyir?" data-action="noop">
        <h2>👁 Kim kartına baxır?</h2>
        <p class="muted">Adını seç, sonra telefonu həmin oyunçuya ver.</p>
        <div class="vote-grid">${list}</div>
        <button class="btn btn-ghost" data-action="modal-cancel">Bağla</button>
      </div>
    </div>`;
  }
  return '';
}

const SCREENS = {
  home: screenHome,
  setup: screenSetup,
  categories: screenCategories,
  rules: screenRules,
  scores: screenScores,
  game: screenGame,
};

function render() {
  const g = state.game;
  const key = state.screen === 'game' && g ? `game:${g.phase}:${g.peek ? 'peek' : ''}:${g.revealIdx}:${g.voteIdx}:${g.voteReady}` : state.screen;
  const html = (SCREENS[state.screen] || screenHome)();
  app.innerHTML = html + renderModal();
  if (key !== ui.lastScreen) {
    app.firstElementChild?.classList.add('enter');
    ui.lastScreen = key;
  }
  document.body.classList.toggle('modal-open', Boolean(ui.modal));
}

// ---------------------------------------------------------------------------
// Başlanğıc
// ---------------------------------------------------------------------------

load();
render();
setInterval(tick, 250);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
