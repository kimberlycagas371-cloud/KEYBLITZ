/* ==========================================================================
   KeyBlitz · script.js
   Sections: 1 Data · 2 State · 3 Sound · 4 Theme & icons · 5 Difficulty
             6 Combo · 7 Game round · 8 Login · 9 Start-up
   ========================================================================== */

'use strict';


/* 1. DATA ---------------------------------------------------------------- */

/** File name shown in the editor title bar for each language. */
const FILE_NAMES = {
  HTML: 'index.html',
  CSS: 'style.css',
  JavaScript: 'app.js',
  Python: 'main.py',
  SQL: 'query.sql',
  Git: 'terminal',
  Network: 'terminal',
  Linux: 'bash',
  Java: 'Main.java',
  PHP: 'index.php',
  C: 'main.c',
};

/** Typing snippets as [language, code]. Difficulty is picked by length. */
const SNIPPETS = [
  // HTML
  ['HTML', '<a href="index.html">Home</a>'],
  ['HTML', '<img src="logo.png" alt="Logo">'],
  ['HTML', '<input type="text" id="name">'],
  ['HTML', '<h1>Hello</h1>'],

  // CSS
  ['CSS', 'body { margin: 0; color: #333; }'],
  ['CSS', '.box { display: flex; gap: 8px; }'],

  // JavaScript
  ['JavaScript', 'const sum = (a, b) => a + b;'],
  ['JavaScript', 'for (let i = 0; i < 10; i++) {'],
  ['JavaScript', 'console.log("Hello, world!");'],
  ['JavaScript', 'document.getElementById("btn");'],
  ['JavaScript', 'const total = items.reduce((a, b) => a + b.price, 0);'],
  ['JavaScript', 'if (user !== null && user.age >= 18) {'],
  ['JavaScript', 'fetch("/api/users").then(r => r.json());'],

  // Python
  ['Python', 'def greet(name): return "Hi " + name'],
  ['Python', 'for x in range(5): print(x)'],
  ['Python', 'nums = [n * 2 for n in data]'],
  ['Python', 'print("Hi")'],

  // SQL
  ['SQL', 'SELECT * FROM students WHERE gpa > 2.0;'],
  ['SQL', 'INSERT INTO users (name) VALUES ("Kim");'],
  ['SQL', 'UPDATE items SET qty = 5 WHERE id = 1;'],
  ['SQL', 'SELECT * FROM t;'],
  ['SQL', 'SELECT name, AVG(grade) FROM scores GROUP BY name;'],

  // Git
  ['Git', 'git commit -m "fix login bug"'],
  ['Git', 'git push origin main'],
  ['Git', 'git checkout -b new-feature'],
  ['Git', 'git status'],

  // Networking
  ['Network', 'ping 192.168.1.1'],
  ['Network', 'ipconfig /all'],

  // Linux
  ['Linux', 'sudo apt update && sudo apt upgrade'],
  ['Linux', 'chmod 755 script.sh'],
  ['Linux', 'cd Documents'],
  ['Linux', 'ls -la'],
  ['Linux', 'docker run -d -p 8080:80 nginx:latest'],
  ['Linux', 'while [ $count -lt 10 ]; do echo $count; done'],

  // Java / PHP / C
  ['Java', 'public static void main(String[] args) {'],
  ['Java', 'int age = 20;'],
  ['PHP', 'echo "Welcome, " . $user;'],
  ['C', 'printf("%d\\n", total);'],
];

/** Difficulty settings: round length in seconds and which snippets qualify. */
const LEVELS = {
  easy:   { label: 'Easy',   seconds: 90, accepts: (len) => len <= 27 },
  medium: { label: 'Medium', seconds: 60, accepts: (len) => len > 27 && len < 36 },
  hard:   { label: 'Hard',   seconds: 45, accepts: (len) => len >= 36 },
};

/** Combo milestones: label shown + notes played as [frequency, delay]. */
const MILESTONES = [
  { at: 10,  label: 'Nice!',           notes: [[660, 0], [784, 0.08]] },
  { at: 25,  label: 'Great!',          notes: [[523, 0], [659, 0.08], [784, 0.16]] },
  { at: 50,  label: 'Awesome!',        notes: [[523, 0], [659, 0.07], [784, 0.14], [1047, 0.21]] },
  { at: 100, label: 'UNSTOPPABLE!', notes: [[523, 0], [659, 0.06], [784, 0.12], [1047, 0.18], [1319, 0.24], [1568, 0.3]] },
];

const STORAGE_KEYS = { best: 'ct-best', nickname: 'ct-nick' };


/* 2. STATE & DOM --------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

const el = {
  brand: $('brand'),
  logout: $('logout-btn'),
  sound: $('sound-btn'),
  theme: $('theme-btn'),
  login: $('login'),
  nickname: $('nickname'),
  loginBtn: $('login-btn'),
  app: $('app'),
  subtitle: $('subtitle'),
  timer: $('timer'),
  wpm: $('wpm'),
  accuracy: $('accuracy'),
  snippets: $('snippets'),
  best: $('best'),
  progress: $('progress'),
  game: $('game'),
  filename: $('filename'),
  combo: $('combo'),
  comboCount: $('combo-count'),
  code: $('code'),
  popup: $('popup'),
  input: $('typing-input'),
  result: $('result'),
};

const state = {
  level: 'medium',
  seconds: LEVELS.medium.seconds,
  snippet: null,        // [language, code] currently on screen
  snippetIndex: -1,     // index inside the filtered pool (avoids repeats)
  startedAt: 0,         // timestamp of the first keystroke
  timerId: null,
  typedKeys: 0,
  mistakes: 0,
  snippetsDone: 0,
  correctChars: 0,
  finished: false,
  combo: 0,
  topCombo: 0,
  muted: false,
};

/** Personal bests per difficulty: { easy: {wpm, combo}, ... } */
const best = loadBest();

function loadBest() {
  const empty = () => ({ wpm: 0, combo: 0 });
  const result = { easy: empty(), medium: empty(), hard: empty() };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.best));
    if (!saved) return result;

    if (typeof saved.w === 'number') {
      // Old format (before difficulty levels) counts as Medium
      result.medium = { wpm: saved.w, combo: saved.c || 0 };
    } else {
      for (const level of Object.keys(result)) {
        if (saved[level]) {
          result[level] = { wpm: Number(saved[level].w) || 0, combo: Number(saved[level].c) || 0 };
        }
      }
    }
  } catch (err) { /* storage blocked or corrupted: start fresh */ }

  return result;
}

function saveBest() {
  const data = {};
  for (const level of Object.keys(best)) {
    data[level] = { w: best[level].wpm, c: best[level].combo };
  }
  try {
    localStorage.setItem(STORAGE_KEYS.best, JSON.stringify(data));
  } catch (err) { /* ignore */ }
}


/* 3. SOUND --------------------------------------------------------------- */

let audioCtx = null;

/** Play one short synthesized tone (nothing is downloaded). */
function playTone(frequency, duration, type = 'sine', volume = 0.06, delay = 0) {
  if (state.muted) return;

  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = audioCtx.currentTime + delay;

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch (err) { /* audio not available */ }
}

const sfx = {
  key:   () => playTone(520 + Math.random() * 80, 0.05, 'triangle', 0.04),
  error: () => playTone(140, 0.16, 'sawtooth', 0.05),
  done:  () => { playTone(660, 0.12, 'sine', 0.07); playTone(880, 0.16, 'sine', 0.07, 0.09); },
  tick:  () => playTone(420, 0.07, 'square', 0.025),
  end:   () => [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.22, 'sine', 0.07, i * 0.12)),
};


/* 4. THEME & ICONS ------------------------------------------------------- */

const svg = (inner) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICONS = {
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  soundOn: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
  soundOff: svg('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/>'),
  trophy: svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
};

function isDarkTheme() {
  const manual = document.documentElement.dataset.theme;
  return manual ? manual === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateThemeIcon() {
  el.theme.innerHTML = isDarkTheme() ? ICONS.moon : ICONS.sun;
}

function toggleTheme() {
  document.documentElement.dataset.theme = isDarkTheme() ? 'light' : 'dark';
  updateThemeIcon();
  sfx.tick();
  refocusInput();
}

function toggleSound() {
  state.muted = !state.muted;
  el.sound.innerHTML = state.muted ? ICONS.soundOff : ICONS.soundOn;
  sfx.done();
  refocusInput();
}

function refocusInput() {
  if (!el.input.disabled) el.input.focus();
}


/* 5. DIFFICULTY ---------------------------------------------------------- */

function setLevel(level, { restart = true } = {}) {
  state.level = level;
  state.seconds = LEVELS[level].seconds;

  document.querySelectorAll('.level-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });

  el.subtitle.textContent =
    `Type each snippet exactly. ${state.seconds} seconds. The clock starts on your first keystroke.`;

  showBest();
  if (restart) startRound();
}

function showBest() {
  const { wpm, combo } = best[state.level];
  el.best.innerHTML =
    `${ICONS.trophy}${LEVELS[state.level].label}: best WPM <b>${wpm}</b> · best combo <b>${combo}</b>`;
}


/* 6. COMBO --------------------------------------------------------------- */

function setCombo(value) {
  state.combo = value;

  el.comboCount.textContent = value;
  el.combo.classList.toggle('active', value >= 5);

  // Restart the bump animation
  el.combo.classList.remove('bump');
  void el.combo.offsetWidth;
  if (value) el.combo.classList.add('bump');
}

/** Plays a milestone jingle and shows its label. Returns true if one fired. */
function checkMilestone(combo) {
  const last = MILESTONES[MILESTONES.length - 1];
  const milestone =
    MILESTONES.find((m) => m.at === combo) ||
    (combo > last.at && combo % 50 === 0 ? last : null);

  if (!milestone) return false;

  milestone.notes.forEach(([freq, delay]) => playTone(freq, 0.18, 'sine', 0.07, delay));

  el.popup.textContent = milestone.label;
  el.popup.classList.remove('show');
  void el.popup.offsetWidth;
  el.popup.classList.add('show');
  return true;
}


/* 7. GAME ROUND ---------------------------------------------------------- */

function escapeHtml(char) {
  return char
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '&nbsp;');
}

/** Choose a random snippet for the current difficulty (never the same twice in a row). */
function pickSnippet() {
  const { accepts } = LEVELS[state.level];
  const pool = SNIPPETS.filter(([, code]) => accepts(code.length));

  let index;
  do {
    index = Math.floor(Math.random() * pool.length);
  } while (index === state.snippetIndex && pool.length > 1);

  state.snippetIndex = index;
  state.snippet = pool[index];

  el.filename.textContent = FILE_NAMES[state.snippet[0]];
  el.input.value = '';
  renderSnippet('');
}

/** Draw the snippet with correct / wrong / pending colors and the cursor. */
function renderSnippet(typed) {
  const target = state.snippet[1];

  el.code.innerHTML = [...target].map((char, i) => {
    let cls = 'ch-todo';
    if (i < typed.length) cls = typed[i] === char ? 'ch-ok' : 'ch-bad';
    if (i === typed.length) cls += ' ch-cursor';
    return `<span class="${cls}">${escapeHtml(char)}</span>`;
  }).join('');
}

function updateStats() {
  const minutes = state.startedAt ? (Date.now() - state.startedAt) / 60000 : 0;

  // 5 characters = 1 word
  el.wpm.textContent = minutes > 0.02 ? Math.round(state.correctChars / 5 / minutes) : 0;
  el.accuracy.textContent = state.typedKeys
    ? `${Math.round(((state.typedKeys - state.mistakes) / state.typedKeys) * 100)}%`
    : '100%';
  el.snippets.textContent = state.snippetsDone;
}

function tick() {
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  const left = Math.max(0, state.seconds - elapsed);

  if (left <= 5 && left > 0 && el.timer.textContent !== String(left)) sfx.tick();

  el.timer.textContent = left;
  el.progress.style.width = `${(left / state.seconds) * 100}%`;
  updateStats();

  if (left <= 0) finishRound();
}

function startRound() {
  clearInterval(state.timerId);
  setCombo(0);

  Object.assign(state, {
    topCombo: 0,
    startedAt: 0,
    typedKeys: 0,
    mistakes: 0,
    snippetsDone: 0,
    correctChars: 0,
    finished: false,
    snippetIndex: -1,
  });

  el.result.hidden = true;
  el.game.hidden = false;
  el.input.disabled = false;
  el.timer.textContent = state.seconds;
  el.progress.style.width = '100%';

  updateStats();
  pickSnippet();
  el.input.focus();
}

function finishRound() {
  state.finished = true;
  clearInterval(state.timerId);
  el.input.disabled = true;
  updateStats();
  sfx.end();

  const wpm = Number(el.wpm.textContent);
  const record = best[state.level];
  const newWpmRecord = wpm > record.wpm;
  const newComboRecord = state.topCombo > record.combo;

  if (newWpmRecord) record.wpm = wpm;
  if (newComboRecord) record.combo = state.topCombo;
  if (newWpmRecord || newComboRecord) saveBest();
  showBest();

  const rank =
    wpm >= 60 ? 'Senior Developer' :
    wpm >= 40 ? 'Junior Developer' :
    wpm >= 25 ? 'Intern' :
                'Hello World';

  el.game.hidden = true;
  el.result.hidden = false;
  el.result.innerHTML = `
    <p class="rank-title">${rank}</p>
    <div class="big-wpm">${wpm}</div>
    <p class="muted">words per minute</p>
    <p class="muted">${el.accuracy.textContent} accuracy · ${state.snippetsDone} snippets · top combo ${state.topCombo} · ${LEVELS[state.level].label}</p>
    ${newWpmRecord || newComboRecord ? '<p class="rank-title new-best">New personal best!</p>' : ''}
    <button id="again-btn">Play again</button>
  `;
  $('again-btn').addEventListener('click', startRound);
}

/** Runs on every keystroke in the typing box. */
function handleInput(event) {
  if (state.finished) return;

  const value = event.target.value;
  const target = state.snippet[1];

  // The clock starts on the first keystroke
  if (!state.startedAt) {
    state.startedAt = Date.now();
    state.timerId = setInterval(tick, 250);
  }

  if (event.inputType === 'insertText') {
    state.typedKeys++;
    const lastIndex = value.length - 1;

    if (value[lastIndex] !== target[lastIndex]) {
      state.mistakes++;
      setCombo(0);
      sfx.error();
    } else {
      setCombo(state.combo + 1);
      state.topCombo = Math.max(state.topCombo, state.combo);
      if (!checkMilestone(state.combo)) sfx.key();
    }
  }

  // Snippet completed
  if (value === target) {
    state.snippetsDone++;
    state.correctChars += value.length + 1;
    sfx.done();

    el.game.classList.add('flash');
    setTimeout(() => el.game.classList.remove('flash'), 250);

    pickSnippet();
    return;
  }

  renderSnippet(value);
}


/* 8. LOGIN --------------------------------------------------------------- */

function nicknameIsValid() {
  return el.nickname.value.trim().length >= 2;
}

function login() {
  if (!nicknameIsValid()) return;

  try {
    localStorage.setItem(STORAGE_KEYS.nickname, el.nickname.value.trim().slice(0, 16));
  } catch (err) { /* ignore */ }

  el.login.hidden = true;
  el.app.hidden = false;
  el.brand.hidden = false;
  el.logout.hidden = false;
  startRound();
}

function logout() {
  clearInterval(state.timerId);
  state.finished = true;

  el.app.hidden = true;
  el.brand.hidden = true;
  el.logout.hidden = true;
  el.login.hidden = false;
  el.nickname.focus();
}


/* 9. START-UP ------------------------------------------------------------ */

// Buttons
el.theme.addEventListener('click', toggleTheme);
el.sound.addEventListener('click', toggleSound);
el.logout.addEventListener('click', logout);
el.loginBtn.addEventListener('click', login);

document.querySelectorAll('.level-btn').forEach((btn) => {
  btn.addEventListener('click', () => setLevel(btn.dataset.level));
});

// Typing + nickname field
el.input.addEventListener('input', handleInput);
el.nickname.addEventListener('input', () => { el.loginBtn.disabled = !nicknameIsValid(); });
el.nickname.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

// Restore the last nickname, then draw the first screen
try {
  el.nickname.value = localStorage.getItem(STORAGE_KEYS.nickname) || '';
} catch (err) { /* ignore */ }

el.loginBtn.disabled = !nicknameIsValid();
el.sound.innerHTML = ICONS.soundOn;
updateThemeIcon();
setLevel('medium', { restart: false });
startRound();