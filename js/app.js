(function () {
const FILES = 'abcdefgh';
const SQUARES = []; for (let r = 8; r >= 1; r--) for (const f of FILES) SQUARES.push(f + r);
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const COLOR = { w: 'White', b: 'Black' };
const PAT = {
  p: [40], n: [40, 70, 40], b: [40, 70, 40, 70, 40], r: [180], q: [180, 90, 180], k: [180, 90, 180, 90, 180],
  empty: [8], check: [350, 120, 350], success: [60, 50, 60, 50, 220], error: [220], edge: [15, 40, 15]
};
const START = TPC_START;
const LESSONS = TPC_LESSONS;
const CAN_VIBRATE = typeof navigator.vibrate === 'function';

const PIECE_INFO = {
  p: { how: 'Moves forward one square, or two on its first move. Captures one square diagonally forward.', points: '1 point', buzz: '1 short', mark: '•' },
  n: { how: 'Moves in an L: two squares one way, then one to the side. Jumps over other pieces.', points: '3 points', buzz: '2 short', mark: '• •' },
  b: { how: 'Moves diagonally, as far as it likes. Stays on one colour of square.', points: '3 points', buzz: '3 short', mark: '• • •' },
  r: { how: 'Moves in straight lines along files and ranks, as far as it likes.', points: '5 points', buzz: '1 long', mark: '—' },
  q: { how: 'Moves in any straight line or diagonal, as far as she likes.', points: '9 points', buzz: '2 long', mark: '— —' },
  k: { how: 'Moves one square in any direction. If he is trapped in check, the game is lost.', points: 'Priceless', buzz: '3 long', mark: '— — —' }
};

/* Pieces are drawn here rather than taken from a font, so they look the same on every device and work offline. */
const PIECE_ART = {
  p: '<circle class="fill" cx="50" cy="28" r="15"/><path class="fill" d="M37 46H63L58 53C58 63 64 71 72 80H28C36 71 42 63 42 53Z"/><rect class="fill" x="20" y="78" width="60" height="13" rx="3"/>',
  n: '<path class="fill" d="M28 80C28 62 38 55 47 46C43 45 37 49 31 51C24 53 18 46 21 40L38 20L38 8L49 17C70 19 80 42 80 80Z"/><circle class="mark" cx="44" cy="30" r="4"/><rect class="fill" x="20" y="78" width="60" height="13" rx="3"/>',
  b: '<circle class="fill" cx="50" cy="11" r="6"/><path class="fill" d="M50 17C63 28 69 38 69 47C69 57 62 62 59 65L64 80H36L41 65C38 62 31 57 31 47C31 38 37 28 50 17Z"/><path class="mark" d="M47 33H53V41H61V47H53V55H47V47H39V41H47Z"/><rect class="fill" x="20" y="78" width="60" height="13" rx="3"/>',
  r: '<path class="fill" d="M24 12H37V23H44V12H56V23H63V12H76V36L67 44V70L76 80H24L33 70V44L24 36Z"/><rect class="fill" x="20" y="78" width="60" height="13" rx="3"/>',
  q: '<path class="fill" d="M15 31L33 53L35 22L50 50L65 22L67 53L85 31L74 80H26Z"/><circle class="fill" cx="15" cy="27" r="6"/><circle class="fill" cx="35" cy="17" r="6"/><circle class="fill" cx="65" cy="17" r="6"/><circle class="fill" cx="85" cy="27" r="6"/><rect class="fill" x="20" y="78" width="60" height="13" rx="3"/>',
  k: '<path class="fill" d="M45 4H55V12H63V22H55V34H45V22H37V12H45Z"/><path class="fill" d="M50 37C61 25 85 27 84 47C83 60 73 67 71 80H29C27 67 17 60 16 47C15 27 39 25 50 37Z"/><rect class="fill" x="20" y="78" width="60" height="13" rx="3"/>'
};
const pieceSvg = (type, color) => `<svg class="pc ${color}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${PIECE_ART[type]}</svg>`;

const TOUR = TPC_TOUR;

/* Line icons, drawn here so they work offline and follow the text colour (including forced colours). */
const ICONS = {
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  speakerOff: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5V14"/><path d="M12 17.2v.1"/>',
  repeat: '<path d="M4 11a8 8 0 0 1 14.3-4.9L20 8"/><path d="M20 3.5V8h-4.5"/><path d="M20 13a8 8 0 0 1-14.3 4.9L4 16"/><path d="M4 20.5V16h4.5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  board: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h17M12 3.5v17"/><path d="M3.5 7.75h8.5M12 16.25h8.5"/>',
  last: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  flip: '<path d="M7 20V4M7 4L4 7M7 4l3 3"/><path d="M17 4v16M17 20l-3-3M17 20l3-3"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.6.5.8 1.2.8 2V16h6v-.4c0-.8.2-1.5.8-2A6 6 0 0 0 12 3z"/>',
  captions: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M13 10h4M7 14h7M16 14h1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  next: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  todo: '<circle cx="12" cy="12" r="7"/>',
  ear: '<path d="M7 9.5a5.5 5.5 0 1 1 9.4 3.9c-1.2 1.2-2.4 2-2.4 3.8a3 3 0 0 1-5.5 1.6"/><path d="M10 10a2 2 0 1 1 3 1.7"/>',
  hand: '<path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.3a6 6 0 0 1-5.4-3.4l-1.6-3.4a1.5 1.5 0 0 1 2.7-1.3L8 14.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>',
  reader: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 9.5h2M11 9.5h2M15 9.5h2M7 12.5h10"/>',
  deaf: '<path d="M7 9.5a5.5 5.5 0 1 1 9.4 3.9c-1.2 1.2-2.4 2-2.4 3.8a3 3 0 0 1-5.5 1.6"/><path d="M4 4l16 16"/>'
};
const iconSvg = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
function paintIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { if (el.dataset.painted !== el.dataset.icon) { el.innerHTML = iconSvg(el.dataset.icon); el.dataset.painted = el.dataset.icon; } }); }
const HAS_SPEECH = 'speechSynthesis' in window;

const DEFAULTS = {
  speech: false, rate: 1, volume: 1, voice: '', sound: false, haptics: true, explore: false, flash: true, brief: false,
  contrast: false, letters: false, coords: false, hints: true, calm: false,
  theme: 'auto', textSize: 'normal', cpu: 'gentle', opponent: 'cpu', onboarded: false, captionsOpen: false
};
const settings = Object.assign({}, DEFAULTS);
function readJson(key) { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
Object.assign(settings, readJson('tpc-settings'));
/* App speech is opt-in for each visit. It is kept for this tab only, never between visits,
   so the app cannot start talking before someone chooses it. */
settings.speech = (() => { try { return sessionStorage.getItem('tpc-speech') === '1'; } catch (e) { return false; } })();
function save() {
  const keep = Object.assign({}, settings); delete keep.speech;
  try { localStorage.setItem('tpc-settings', JSON.stringify(keep)); } catch (e) {}
  try { sessionStorage.setItem('tpc-speech', settings.speech ? '1' : '0'); } catch (e) {}
}
const done = readJson('tpc-done');
function saveDone() { try { localStorage.setItem('tpc-done', JSON.stringify(done)); } catch (e) {} }

const S = {
  game: new Chess(), selected: null, focus: 'e2', flipped: false, last: null, hint: null, busy: false, timer: null,
  lesson: null, step: 0, awaitNext: false, complete: false, saved: null, typed: false, tourReturn: null
};
const $ = id => document.getElementById(id);
const boardEl = $('board'), srP = $('sr-polite'), banner = $('banner'), logEl = $('log');
const cells = {};
const cap = s => s[0].toUpperCase() + s.slice(1);

/* No sound of any kind until the person has pressed a key or touched the screen. */
let userActed = false;
for (const t of ['pointerdown', 'keydown']) addEventListener(t, () => { userActed = true; }, { capture: true, once: true });

/* ---------- Feedback channels ---------- */
let audioCtx = null;
function ctx() {
  if (!userActed) return null;
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
function beep(freq, type, peak, length, pan, delay = 0) {
  const a = ctx(); if (!a) return;
  const at = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  o.connect(g);
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(a.destination); } else g.connect(a.destination);
  o.start(at); o.stop(at + length + 0.03);
}
const soundOn = () => settings.sound && !settings.calm;
function tone(sq, piece, force) {
  if (!force && !soundOn()) return;
  const scale = [0, 2, 4, 5, 7, 9, 11, 12], r = +sq[1] - 1, f = FILES.indexOf(sq[0]);
  beep(261.63 * Math.pow(2, scale[r] / 12), piece ? 'triangle' : 'sine', piece ? 0.22 : 0.12, piece ? 0.22 : 0.12, (f - 3.5) / 3.5);
}
function chime(level) {
  if (!soundOn()) return;
  if (level === 'success') [523, 659, 784].forEach((n, i) => beep(n, 'triangle', 0.18, 0.18, 0, i * 0.11));
  else if (level === 'error') beep(196, 'sine', 0.16, 0.25, 0);
  else if (level === 'alert') [880, 660].forEach((n, i) => beep(n, 'square', 0.08, 0.2, 0, i * 0.2));
}
function buzz(p, force) { if ((!settings.haptics && !force) || !p || !CAN_VIBRATE || !userActed) return; try { navigator.vibrate(p); } catch (e) {} }

let voices = [];
function loadVoices() {
  if (!HAS_SPEECH) return;
  try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
  fillVoices();
}
function say(t, force) {
  if ((!settings.speech && !force) || !userActed || !HAS_SPEECH || !t) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.rate = settings.calm ? Math.min(settings.rate, 0.9) : settings.rate;
    u.volume = settings.volume;
    const v = settings.voice && voices.find(x => x.voiceURI === settings.voice);
    if (v) { u.voice = v; u.lang = v.lang; }
    speechSynthesis.speak(u);
  } catch (e) {}
}
function stopSpeech(quiet) {
  if (HAS_SPEECH) try { speechSynthesis.cancel(); } catch (e) {}
  if (!quiet) { banner.textContent = 'Speech stopped.'; banner.dataset.level = 'info'; }
}
function flash() {
  if (!settings.flash || settings.calm) return;
  const w = $('boardWrap'); w.classList.add('flash');
  clearTimeout(flash.t); flash.t = setTimeout(() => w.classList.remove('flash'), 1400);
}
function logAdd(t, level) {
  const li = document.createElement('li'); li.dataset.level = level;
  const tm = document.createElement('time'); tm.textContent = new Date().toTimeString().slice(0, 5);
  li.append(tm, document.createTextNode(t)); logEl.prepend(li);
  while (logEl.children.length > 100) logEl.lastChild.remove();
}

/* Everything said in the same moment is joined into one message, so a reply never cuts off the
   message before it, and nothing is read twice. One polite live region carries it all.
   opt.short:   what the banner shows, and what braille and speech get in brief mode.
   opt.noLive:  focus is about to land on this same text, so the live region stays out of it.
   opt.repeat:  a repeat of the last message; not added to Captions again.
   opt.bar:     text for the message bar only, when the full text is already on screen nearby. */
const live = { q: [], speak: [], focusSpeech: '', t: null, force: false };
let lastMsg = null;
function queue() { clearTimeout(live.t); live.t = setTimeout(flushLive, 60); }
function flushLive() {
  live.t = null;
  const text = live.q.join(' '), spoken = live.speak.join(' ');
  if (text) srP.textContent = text;
  const speech = [live.focusSpeech, spoken].filter(Boolean).join('. ');
  if (speech) say(speech, live.force);
  if (spoken) lastMsg = { spoken, shown: banner.textContent, level: banner.dataset.level };
  live.q = []; live.speak = []; live.focusSpeech = ''; live.force = false;
}
function announce(text, level = 'info', opt = {}) {
  const spoken = settings.brief && opt.short ? opt.short : text;
  if (!live.t) srP.textContent = '';  // cleared first, so the same words twice in a row are still read
  if (!opt.noLive) live.q.push(spoken);
  if (opt.speak !== false) live.speak.push(spoken);
  if (opt.forceSpeech) live.force = true;
  queue();
  banner.textContent = opt.bar || opt.short || text; banner.dataset.level = level;
  if (!opt.repeat) logAdd(text, level);
  chime(level);
  if (level === 'alert') { flash(); buzz(opt.haptic || PAT.check); }
  else if (level === 'error') buzz(opt.haptic || PAT.error);
  else if (level === 'success') buzz(opt.haptic || PAT.success);
  else if (opt.haptic) buzz(opt.haptic, opt.forceHaptic);
}
/* Square names while moving around: speech only (screen readers already read the focused square),
   and only the newest one, so holding an arrow key does not pile up. */
function speakFocus(text) { if (!settings.speech) return; live.focusSpeech = text; queue(); }
function repeatLast() {
  if (!lastMsg) announce('Nothing to repeat yet.', 'info', { repeat: true });
  else {
    const m = lastMsg;
    announce(m.spoken, m.level === 'alert' ? 'alert' : 'info', { repeat: true, short: m.shown });
  }
  tourEvent('repeat');
}

/* ---------- Questions, built into the page ---------- */
/* options: [{label, value, primary, html}]. Resolves with the chosen value, or null if cancelled with Esc.
   block: the board waits for an answer (used for promotion). */
let askFinish = null;
function ask({ title, body, options, grid, returnTo, block }) {
  if (askFinish) askFinish(null, false);
  const box = $('ask'), holder = $('askOptions');
  $('askTitle').textContent = title; $('askBody').textContent = body || ''; $('askBody').hidden = !body;
  holder.innerHTML = ''; holder.className = 'ask-options' + (grid ? ' grid' : '');
  box.hidden = false; S.askBlocks = !!block;
  return new Promise(resolve => {
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null, true); } };
    const finish = (value, restore) => {
      askFinish = null; S.askBlocks = false;
      box.hidden = true; holder.innerHTML = ''; box.removeEventListener('keydown', onKey);
      resolve(value);
      const back = typeof returnTo === 'function' ? returnTo() : returnTo;
      if (restore && back && document.contains(back)) back.focus();
    };
    box.addEventListener('keydown', onKey);
    askFinish = finish;
    options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn' + (o.primary ? ' primary' : '') + (o.html ? ' piece-btn' : '');
      if (o.html) { b.innerHTML = o.html; b.setAttribute('aria-label', o.label); } else b.textContent = o.label;
      b.addEventListener('click', () => finish(o.value, true));
      holder.appendChild(b);
    });
    box.scrollIntoView({ block: 'nearest' });
    box.focus({ preventScroll: true });
  });
}
const cancelAsk = () => { if (askFinish) askFinish(null, false); };

/* ---------- Board ---------- */
const isLight = sq => (FILES.indexOf(sq[0]) + (+sq[1])) % 2 === 0;
function buildBoard() {
  boardEl.innerHTML = '';
  const order = S.flipped ? [...SQUARES].reverse() : SQUARES;
  for (let r = 0; r < 8; r++) {
    const row = document.createElement('div'); row.className = 'row'; row.setAttribute('role', 'row');
    for (let c = 0; c < 8; c++) {
      const sq = order[r * 8 + c], cell = document.createElement('div');
      cell.id = 'sq-' + sq; cell.className = 'sq ' + (isLight(sq) ? 'light' : 'dark');
      cell.setAttribute('role', 'gridcell'); cell.dataset.sq = sq;
      cell.addEventListener('click', () => {
        if (explore.dragged) { explore.dragged = false; return; }
        setFocus(sq, false, false); activate(sq);
      });
      row.appendChild(cell); cells[sq] = cell;
    }
    boardEl.appendChild(row);
  }
  const ranks = S.flipped ? '12345678' : '87654321', files = S.flipped ? 'hgfedcba' : FILES;
  $('ranks').innerHTML = [...ranks].map(x => `<span>${x}</span>`).join('');
  $('files').innerHTML = [...files].map(x => `<span>${x}</span>`).join('');
  render();
}
const pieceName = p => p ? `${COLOR[p.color].toLowerCase()} ${NAMES[p.type]}` : 'empty';
function render() {
  const g = S.game;
  const tg = (S.selected && settings.hints) ? g.moves({ square: S.selected, verbose: true }).map(m => m.to) : [];
  const inCheck = g.in_check(), turn = g.turn();
  for (const sq of SQUARES) {
    const cell = cells[sq], p = g.get(sq);
    const isT = tg.includes(sq), isLast = !!(S.last && (S.last.from === sq || S.last.to === sq)), chk = !!(inCheck && p && p.type === 'k' && p.color === turn);
    cell.classList.toggle('sel', S.selected === sq); cell.classList.toggle('last', isLast);
    cell.classList.toggle('check', chk); cell.classList.toggle('hint', S.hint === sq);
    cell.tabIndex = sq === S.focus ? 0 : -1;
    cell.setAttribute('aria-selected', S.selected === sq ? 'true' : 'false');
    let h = '';
    if (settings.coords) h += `<span class="co" aria-hidden="true">${sq}</span>`;
    if (p) h += settings.letters ? `<span class="pl ${p.color}" aria-hidden="true">${p.type === 'n' ? 'N' : p.type.toUpperCase()}</span>` : pieceSvg(p.type, p.color);
    if (isT) h += `<span class="dot${p ? ' cap' : ''}" aria-hidden="true"></span>`;
    cell.innerHTML = h;
    let l = `${sq}, ${pieceName(p)}`;
    if (S.selected === sq) l += ', picked up';
    if (isT) l += p ? ', you can capture here' : ', you can move here';
    if (chk) l += ', in check';
    if (isLast) l += ', part of last move';
    if (S.hint === sq) l += ', hint';
    cell.setAttribute('aria-label', l);
  }
  $('modePill').textContent = S.lesson ? (S.lesson.tour ? 'Tutorial' : 'Lesson') : (settings.opponent === 'cpu' ? 'You vs computer' : 'Two players');
  $('oppPanel').hidden = !!S.lesson;
  $('bNew').hidden = !!S.lesson;
  $('bUndoText').textContent = S.lesson ? 'Restart step' : 'Undo';
  document.body.classList.toggle('in-lesson', !!S.lesson);
  renderStatus();
}
function renderStatus() {
  const g = S.game, over = !S.lesson && g.game_over();
  $('turnChip').dataset.turn = g.turn();
  $('turnText').textContent = over ? 'Game over' : S.busy ? 'Computer is thinking' : `${COLOR[g.turn()]} to move`;
  $('readout').textContent = `${S.focus}: ${pieceName(g.get(S.focus))}`;
}
function setFocus(sq, moveFocus = true, feedback = true) {
  S.focus = sq;
  for (const s of SQUARES) cells[s].tabIndex = s === sq ? 0 : -1;
  if (moveFocus) cells[sq].focus();
  renderStatus();
  if (feedback) {
    const p = S.game.get(sq);
    buzz(p ? PAT[p.type] : PAT.empty); tone(sq, p);
    speakFocus(`${sq}, ${pieceName(p)}`);
    // In the tour, arriving on the square is enough: arrow keys alone can finish the step.
    if (S.lesson && S.lesson.tour && !S.awaitNext && curStep().type === 'find' && sq === curStep().target) findCheck(sq);
  }
}
function canControl(color) {
  const t = S.game.turn();
  if (S.lesson) return color === 'w';
  if (settings.opponent === 'cpu') return color === 'w' && t === 'w';
  return color === t;
}
/* Legal moves for a piece even when it is not that side's turn, so learners can ask about any piece. */
function movesFor(sq) {
  const g = S.game, p = g.get(sq);
  if (!p) return [];
  if (p.color === g.turn()) return g.moves({ square: sq, verbose: true });
  const parts = g.fen().split(' '); parts[1] = p.color; parts[3] = '-';
  const t = new Chess();
  if (!t.load(parts.join(' '))) return [];
  return t.moves({ square: sq, verbose: true }).filter(m => m.captured !== 'k');
}
function listTargets(sq) {
  const seen = new Set(), out = [];
  for (const m of movesFor(sq)) {
    if (seen.has(m.to)) continue;
    seen.add(m.to);
    out.push(m.to + (m.captured ? ` capturing ${NAMES[m.captured]}` : '') + (m.promotion ? ' and promoting' : ''));
  }
  return out.length ? out.join(', ') : null;
}
const targetCount = sq => new Set(movesFor(sq).map(m => m.to)).size;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function activate(sq) {
  if (S.busy) return announce('One moment, the computer is thinking.', 'info');
  if (S.askBlocks) return announce('First choose what your pawn becomes, or press Escape to cancel.', 'info');
  const g = S.game, p = g.get(sq);
  if (S.lesson) {
    if (S.awaitNext) return announce(`${sq}, ${pieceName(p)}. ${S.complete ? 'This lesson is finished.' : 'Choose Next step to carry on.'}`, 'info');
    const st = curStep();
    if (st.type === 'find') return findCheck(sq);
    if (st.type === 'choice') return announce(`${sq}, ${pieceName(p)}. Answer the question to carry on.`, 'info', { haptic: p ? PAT[p.type] : PAT.empty });
  } else if (g.game_over()) {
    return announce(`The game is over. ${gameState().text} Choose New game to play again.`, 'info');
  }
  if (S.selected) {
    if (S.selected === sq) { S.selected = null; render(); return announce(`Put the ${NAMES[p.type]} back on ${sq}.`, 'info'); }
    const legal = g.moves({ square: S.selected, verbose: true }).find(m => m.to === sq);
    if (legal) return makeMove(S.selected, sq);
    if (p && canControl(p.color)) return select(sq);
    const from = S.selected, fp = g.get(from), t = listTargets(from);
    return announce(`The ${NAMES[fp.type]} on ${from} cannot go to ${sq}. ${t ? 'It can go to ' + t + '.' : ''}`, 'error', { short: `The ${NAMES[fp.type]} cannot go to ${sq}. Try a marked square.` });
  }
  if (p && canControl(p.color)) return select(sq);
  if (p) return announce(`${sq}, ${pieceName(p)}. That is not your piece to move right now.`, 'info', { haptic: PAT[p.type] });
  announce(`${sq} is empty.`, 'info', { haptic: PAT.empty });
}
function select(sq) {
  S.selected = sq; render();
  const p = S.game.get(sq), t = listTargets(sq), n = targetCount(sq), name = cap(pieceName(p));
  announce(`Picked up ${pieceName(p)} on ${sq}. ${t ? 'It can go to ' + t + '.' : 'It has no legal moves right now.'}`, 'info',
    { haptic: PAT[p.type], short: n ? `${name} on ${sq}: ${plural(n, 'move')}${settings.hints ? ', marked on the board.' : '.'}` : `${name} on ${sq} has no legal moves.` });
  tourEvent('moves');
}
function describeMove(m) {
  const who = COLOR[m.color];
  if (m.flags.includes('k')) return `${who} castles on the king side.`;
  if (m.flags.includes('q')) return `${who} castles on the queen side.`;
  let t = `${who} ${NAMES[m.piece]} from ${m.from} to ${m.to}`;
  if (m.captured) t += `, captures ${m.color === 'w' ? 'black' : 'white'} ${NAMES[m.captured]}`;
  if (m.flags.includes('e')) t += ' en passant';
  if (m.promotion) t += `, becomes a ${NAMES[m.promotion]}`;
  return t + '.';
}
function gameState() {
  const g = S.game, t = g.turn();
  if (g.in_checkmate()) return { text: `Checkmate. ${COLOR[t === 'w' ? 'b' : 'w']} wins.`, level: 'alert', over: true };
  if (g.in_stalemate()) return { text: 'Stalemate. The game is a draw.', level: 'alert', over: true };
  if (g.in_threefold_repetition()) return { text: 'Draw by repetition.', level: 'alert', over: true };
  if (g.insufficient_material()) return { text: 'Draw. Neither side has enough pieces to checkmate.', level: 'alert', over: true };
  if (g.in_draw()) return { text: 'Draw by the fifty-move rule.', level: 'alert', over: true };
  if (g.in_check()) return { text: `${COLOR[t]} is in check.`, level: 'alert' };
  return { text: `${COLOR[t]} to move.`, level: 'info' };
}
function announceMove(m, byCpu) {
  const st = gameState(), lead = byCpu ? 'Computer: ' : '';
  announce(`${lead}${describeMove(m)} ${st.text}`, st.level, { haptic: st.level === 'info' ? PAT[m.piece] : null });
}
/* A moved piece slides from its old square (200ms). Never with reduced motion or Calm mode. */
const motionOK = () => !settings.calm && !matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateMove(m) {
  if (!m || !motionOK() || !cells[m.from] || !cells[m.to]) return;
  const cell = cells[m.to], el = cell.querySelector('.pc,.pl');
  if (!el || !el.animate) return;
  const a = cells[m.from].getBoundingClientRect(), b = cell.getBoundingClientRect(), base = getComputedStyle(el).transform;
  const end = base === 'none' ? 'none' : base;
  cell.classList.add('moving');
  el.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) ${end === 'none' ? '' : end}` }, { transform: end }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' })
    .finished.catch(() => {}).then(() => cell.classList.remove('moving'));
}
function clearPending() { clearTimeout(S.timer); S.timer = null; S.busy = false; }
function saveGame() {
  if (S.lesson) return;
  try { localStorage.setItem('tpc-game', S.game.pgn()); } catch (e) {}
}
function maybeCpu() {
  const g = S.game;
  if (S.lesson || g.game_over() || settings.opponent !== 'cpu' || g.turn() !== 'b') return;
  S.busy = true; renderStatus();
  S.timer = setTimeout(() => {
    const r = cpuPick();
    S.busy = false; S.timer = null;
    if (!r) return;
    S.last = g.move({ from: r.from, to: r.to, promotion: r.promotion });
    saveGame(); render(); animateMove(S.last); announceMove(S.last, true);
  }, settings.calm ? 1300 : 700);
}
function needsPromotion(from, to) {
  return S.game.moves({ square: from, verbose: true }).some(m => m.to === to && m.promotion);
}
async function makeMove(from, to, promo) {
  const g = S.game;
  let promotion = promo;
  if (!promotion && needsPromotion(from, to)) {
    if (S.lesson) promotion = 'q';
    else {
      const c = g.get(from).color;
      promotion = await ask({
        title: 'Promote your pawn', body: `The pawn reaches ${to}. What should it become? Press Escape to cancel.`, grid: true, block: true,
        returnTo: () => cells[S.focus],
        options: ['q', 'r', 'b', 'n'].map((t, i) => ({ value: t, label: cap(NAMES[t]), primary: i === 0, html: `<span class="swatch">${pieceSvg(t, c)}</span>${cap(NAMES[t])}` }))
          .concat({ value: null, label: 'Cancel' })
      });
      if (!promotion) { S.selected = null; render(); return announce('Promotion cancelled. The pawn stays where it was.', 'info'); }
    }
  }
  if (S.lesson) return lessonMove(from, to, promotion);
  const m = g.move({ from, to, promotion });
  if (!m) return announce(`${from} to ${to} is not a legal move.`, 'error');
  S.selected = null; S.last = m; S.hint = null; S.focus = to;
  saveGame(); render(); animateMove(m); announceMove(m, false);
  maybeCpu();
}
function tryMove(from, to, promo) {
  if (S.busy) return announce('One moment, the computer is thinking.', 'info');
  if (S.lesson && S.awaitNext) return announce(S.complete ? 'This lesson is finished.' : 'Choose Next step to carry on.', 'info');
  if (!S.lesson && S.game.game_over()) return announce(`The game is over. ${gameState().text} Type new to play again.`, 'info');
  if (S.lesson && curStep().type === 'choice') return announce('Answer the question to carry on.', 'info');
  if (S.lesson && curStep().type === 'find') return findCheck(to);
  const p = S.game.get(from);
  if (!p) return announce(`There is no piece on ${from}.`, 'error');
  if (!canControl(p.color)) return announce(`The ${pieceName(p)} on ${from} is not yours to move right now.`, 'error');
  const legal = S.game.moves({ square: from, verbose: true }).find(m => m.to === to);
  if (!legal) {
    const t = listTargets(from);
    return announce(`The ${NAMES[p.type]} on ${from} cannot go to ${to}. ${t ? 'It can go to ' + t + '.' : 'It has no legal moves.'}`, 'error', { short: `The ${NAMES[p.type]} on ${from} cannot go to ${to}.` });
  }
  setFocus(to, false, false); makeMove(from, to, promo);
}

/* ---------- Computer opponent ---------- */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function material(g) { let s = 0; for (const sq of SQUARES) { const p = g.get(sq); if (p) s += (p.color === 'b' ? 1 : -1) * VALUE[p.type]; } return s; }
function cpuPick() {
  const g = S.game, moves = shuffle(g.moves({ verbose: true }));
  if (!moves.length) return null;
  if (settings.cpu === 'gentle') {
    const caps = moves.filter(m => m.captured);
    return (caps.length && Math.random() < 0.6) ? caps.sort((a, b) => VALUE[b.captured] - VALUE[a.captured])[0] : moves[0];
  }
  let best = moves[0], bestS = -Infinity;
  for (const m of moves) {
    g.move(m);
    let s;
    if (g.in_checkmate()) s = 1e6;
    else if (g.in_draw()) s = 0;
    else {
      let worst = Infinity;
      for (const r of g.moves({ verbose: true })) { g.move(r); const v = g.in_checkmate() ? -1e6 : material(g); g.undo(); if (v < worst) worst = v; }
      s = worst === Infinity ? 0 : worst;
    }
    g.undo();
    if (s > bestS) { bestS = s; best = m; }
  }
  return best;
}

/* ---------- Lessons and the tutorial ---------- */
const curStep = () => S.lesson.steps[S.step];
const inTour = () => !!(S.lesson && S.lesson.tour);
/* Directions as the learner sees them, so they stay right on a flipped board. */
function dirText(from, to) {
  const flip = S.flipped ? -1 : 1;
  const df = (FILES.indexOf(to[0]) - FILES.indexOf(from[0])) * flip, dr = ((+to[1]) - (+from[1])) * flip, parts = [];
  if (df) parts.push(`${plural(Math.abs(df), 'file')} to the ${df > 0 ? 'right' : 'left'}`);
  if (dr) parts.push(`${plural(Math.abs(dr), 'rank')} ${dr > 0 ? 'up' : 'down'}`);
  return parts.join(' and ');
}
function focusLessonText(el = 'lcText') {
  // Focus lands on the goal text, so screen readers read it in full and the board is the very next stop.
  // After an answer it lands on the feedback alone, so nothing is read twice.
  $(el).focus({ preventScroll: true });
  $('lessonCard').scrollIntoView({ block: 'nearest' });
}
function enterCourse(course) {
  clearPending(); cancelAsk();
  if (!S.lesson) S.saved = { game: S.game, last: S.last, flipped: S.flipped };
  S.game = new Chess();
  S.lesson = course; S.step = 0;
  S.flipped = false; buildBoard();  // lesson wording assumes White is at the bottom
  show('play', false); loadStep(true);
}
const startLesson = id => enterCourse(LESSONS.find(l => l.id === id));
function startTour(returnTo) { S.tourReturn = returnTo || null; enterCourse(TOUR); }
const isLastStep = () => S.step === S.lesson.steps.length - 1;
const nextLabel = () => !isLastStep() ? 'Next step' : inTour() ? 'Finish tutorial' : 'Finish lesson';
function loadStep(first) {
  clearPending();
  const st = curStep(), tour = inTour(), info = st.type === 'info';
  S.game.load(st.fen); S.last = null;
  for (const m of st.pre || []) S.last = S.game.move(m);
  S.selected = null; S.hint = null; S.awaitNext = info; S.complete = false;
  S.focus = st.from || st.start || 'a1';
  $('lessonCard').hidden = false;
  $('lcNext').textContent = nextLabel(); $('lcNext').hidden = !info;
  $('lcHint').hidden = st.type === 'choice' || info;
  $('lcRepeat').hidden = false; $('lcRepeatText').textContent = tour ? 'Repeat step' : 'Repeat goal';
  $('lcExitText').textContent = tour ? 'Skip tutorial' : 'Leave lesson';
  setCard('goal'); $('lcBack').hidden = true; $('lessonActions').hidden = false;
  $('lcHelp').hidden = !tour;
  $('lcFeedback').hidden = true; $('lcFeedback').textContent = '';
  $('lcEyebrow').textContent = `${S.lesson.tag} · step ${S.step + 1} of ${S.lesson.steps.length}`;
  $('lcTitle').textContent = S.lesson.title;
  $('lcIntro').textContent = S.lesson.intro; $('lcIntro').hidden = !first;
  $('lcIntro').classList.remove('open'); $('lcMore').setAttribute('aria-expanded', 'false'); $('lcMore').textContent = 'Show introduction'; $('lcMore').hidden = true;
  // Only offer the toggle when the intro is actually cut short on screen (it always is on phones).
  if (first) requestAnimationFrame(() => { const i = $('lcIntro'); $('lcMore').hidden = i.hidden || i.scrollHeight <= i.clientHeight + 2; });
  $('lcGoal').textContent = st.goal; $('lcGoal').hidden = false;
  $('lcSteps').innerHTML = S.lesson.steps.map((_, i) => `<span class="${i <= S.step ? 'on' : ''}"></span>`).join('');
  renderChoices(st);
  render();
  announce((first ? `${S.lesson.title}. ${S.lesson.intro} ` : '') + st.goal, 'info', { noLive: true, short: st.goal, bar: `${S.lesson.title} · step ${S.step + 1} of ${S.lesson.steps.length}` });
  focusLessonText();
}
function renderChoices(st) {
  const box = $('lcChoices');
  box.innerHTML = '';
  box.hidden = !(st.type === 'choice' || st.presets || st.settings);
  // The main action comes first when the extras below it are optional.
  if (st.presets) box.before($('lcNext')); else box.after($('lcNext'));
  if (st.presets) {
    box.innerHTML = '<p class="label" id="lcPresetL">How do you want to play? (optional)</p>';
    const grp = document.createElement('div'); grp.className = 'modes presets'; grp.setAttribute('role', 'group'); grp.setAttribute('aria-labelledby', 'lcPresetL');
    PRESETS.forEach(p => grp.appendChild(presetButton(p)));
    box.appendChild(grp);
  }
  if (st.settings) renderTourSettings(box);
  if (st.type !== 'choice') return;
  st.choices.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = c.t;
    b.addEventListener('click', () => {
      if (S.awaitNext) return;
      if (c.ok) { b.classList.add('right'); stepPassed(`Correct. ${c.why.replace(/^Yes\.\s*/, '')}`); }
      else { b.classList.add('wrong'); setCard('error'); announce(`Not quite. ${c.why} Try again.`, 'error'); }
    });
    box.appendChild(b);
  });
}
/* Moves on only when the learner chooses Next, so nobody is rushed and screen readers finish reading first.
   In the tour, focus stays where the learner is (often the board), and the message comes through the live region. */
/* The card's look follows the step: goal, error (a wrong try), success, complete. Shape changes as well as colour. */
function setCard(state) { $('lessonCard').dataset.state = state; }
function stepPassed(text) {
  S.awaitNext = true; S.hint = null; S.selected = null;
  $('lcFeedback').textContent = text; $('lcFeedback').hidden = false; setCard('success');
  $('lcHint').hidden = true; $('lcIntro').hidden = true; $('lcMore').hidden = true;
  $('lcNext').textContent = nextLabel();
  $('lcNext').hidden = false;
  render();
  if (inTour()) return announce(`${text} Choose Next step, or press N on the board, to carry on.`, 'success', { short: text });
  announce(text, 'success', { noLive: true, bar: `Correct · ${S.lesson.title}, step ${S.step + 1} of ${S.lesson.steps.length} done` });
  focusLessonText('lcFeedback');
}
function findCheck(sq) {
  if (S.awaitNext) return;
  const st = curStep();
  if (sq === st.target) { S.focus = sq; stepPassed(`Correct, that is ${sq}. ${st.why}`); S.hint = sq; render(); }
  else setCard('error'), announce(`Not quite. That is ${sq}. ${st.target} is ${dirText(sq, st.target)} from here.`, 'error');
}
function tourEvent(kind) {
  if (!inTour() || S.awaitNext) return;
  const st = curStep();
  if (st.type === 'do' && st.expect === kind) stepPassed(`Correct. ${st.why}`);
}
function lessonMove(from, to, promotion) {
  const st = curStep(), g = S.game, m = g.move({ from, to, promotion });
  if (!m) return announce('That move is not legal here.', 'error');
  S.selected = null; S.hint = null;
  if (st.typed && !S.typed) {
    g.undo(); S.focus = from; render();
    return announce(`That works, but this step is about typing. The ${NAMES[m.piece]} went back to ${from}. ${st.goal}`, 'error', { short: `Good, but try typing it this time. The ${NAMES[m.piece]} is back on ${from}.` });
  }
  const mate = g.in_checkmate();
  const ok = st.type === 'mate' ? mate : st.type === 'check' ? g.in_check() : (from === st.from && to === st.to);
  if (ok) {
    S.last = m; S.focus = to;
    requestAnimationFrame(() => animateMove(m));
    stepPassed(`Correct. ${describeMove(m)} ${mate ? 'Checkmate! ' : ''}${st.why}`);
    return;
  }
  g.undo(); S.last = null; S.focus = from; render(); setCard('error');
  if (st.type === 'do') return announce(`The ${NAMES[m.piece]} went back to ${from}. This step is not about moving. ${st.goal}`, 'error', { short: `The ${NAMES[m.piece]} went back to ${from}. Try the step again.` });
  announce(`Not quite. ${describeMove(m)} That is a legal move, but not the goal, so the piece went back to ${from}. ${st.goal}`, 'error', { short: `Not quite. The piece is back on ${from}. Try again.` });
}
function nextStep() {
  if (!S.lesson || !S.awaitNext) return;
  if (inTour() && isLastStep()) return finishTour(true);
  if (S.complete) {
    const nxt = LESSONS[LESSONS.indexOf(S.lesson) + 1];
    return nxt ? startLesson(nxt.id) : exitLesson();
  }
  if (!isLastStep()) { S.step++; return loadStep(false); }
  done[S.lesson.id] = true; saveDone(); renderLessons();
  S.complete = true;
  const nxt = LESSONS[LESSONS.indexOf(S.lesson) + 1];
  $('lcEyebrow').textContent = 'Lesson complete';
  $('lcGoal').hidden = true; $('lcIntro').hidden = true;
  const count = LESSONS.filter(l => done[l.id]).length;
  $('lcFeedback').textContent = `Lesson complete: ${S.lesson.title}. That is ${count} of ${LESSONS.length} lessons. ${nxt ? `Next up: ${nxt.title}.` : 'You finished every lesson. Try a game against the computer.'}`;
  $('lcFeedback').hidden = false;
  $('lcSteps').innerHTML = S.lesson.steps.map(() => '<span class="on"></span>').join('');
  $('lcHint').hidden = true; $('lcRepeat').hidden = true; $('lcChoices').hidden = true; $('lessonActions').hidden = true;
  $('lcNext').textContent = nxt ? `Next lesson: ${nxt.title}` : 'Back to lessons';
  $('lcBack').hidden = !nxt; setCard('complete');
  announce($('lcFeedback').textContent, 'success', { noLive: true });
  focusLessonText('lcFeedback');
}
function hint() {
  if (!S.lesson) return announce('Hints are for lessons. In a game, pick up a piece to find out where it can go.', 'info');
  if (S.awaitNext) return announce('Choose Next step to carry on.', 'info');
  const st = curStep();
  if (st.type === 'choice') return announce(`Read the question again: ${st.goal}`, 'info');
  if (st.type === 'do') return announce(st.hint, 'info');
  if (st.type === 'find') {
    S.hint = st.target; render();
    const dir = dirText(S.focus, st.target);
    return announce(dir ? `${st.target} is ${dir} from ${S.focus}. It is now outlined on the board.` : `You are on ${st.target}. Select it.`, 'info');
  }
  if (st.typed) return announce(`Go to the box called Type a move or command, type ${st.from} ${st.to}, and press Enter.`, 'info');
  if (S.selected !== st.from) {
    S.hint = st.from; render();
    const dir = dirText(S.focus, st.from);
    return announce(`Start by picking up the piece on ${st.from}. You are on ${S.focus}${dir ? `; ${st.from} is ${dir}` : ', right there'}.`, 'info');
  }
  S.hint = st.to; render();
  announce(`Move it to ${st.to}, ${dirText(st.from, st.to)} from ${st.from}.`, 'info');
}
function leaveCourse() {
  clearPending(); cancelAsk();
  S.lesson = null; S.awaitNext = false; S.complete = false; S.hint = null; S.selected = null;
  $('lessonCard').hidden = true; $('lessonActions').hidden = true;
  if (S.saved) { S.game = S.saved.game; S.last = S.saved.last; S.flipped = S.saved.flipped; S.saved = null; }
  buildBoard();
}
function exitLesson() {
  if (inTour()) return finishTour(false);
  leaveCourse();
  show('learn', true);
  announce('Left the lesson. Your game is still on the Play tab.', 'info');
  maybeCpu();
}
function finishTour(completed) {
  settings.onboarded = true; save();
  leaveCourse();
  show('play', false);
  const back = S.tourReturn; S.tourReturn = null;
  (back && document.contains(back) ? back : cells[S.focus]).focus();
  announce(completed ? 'Tutorial finished. Your game is on the board. Open the tutorial again any time with the Help button.' : 'Tutorial closed. Open it again any time with the Help button at the top.', 'info');
  maybeCpu();
}

/* ---------- Commands ---------- */
function describeBoard() {
  const g = S.game, out = { w: {}, b: {} };
  for (const sq of SQUARES) { const p = g.get(sq); if (p) (out[p.color][p.type] = out[p.color][p.type] || []).push(sq); }
  const side = c => ['k', 'q', 'r', 'b', 'n', 'p'].filter(t => out[c][t]).map(t => { const l = out[c][t]; return `${l.length > 1 ? NAMES[t] + 's' : NAMES[t]} ${l.join(' ')}`; }).join('; ') || 'no pieces';
  announce(`White: ${side('w')}. Black: ${side('b')}. ${gameState().text}`, 'info', { short: 'Board described in Captions and read aloud.' });
  tourEvent('board');
}
function describeLine(squares, name) {
  const found = squares.map(sq => [sq, S.game.get(sq)]).filter(x => x[1]).map(([sq, p]) => `${sq} ${pieceName(p)}`);
  announce(found.length ? `${name}: ${found.join(', ')}.` : `${name} is empty.`, 'info');
}
const describeRank = r => describeLine([...FILES].map(f => f + r), `Rank ${r}`);
const describeFile = f => describeLine([1, 2, 3, 4, 5, 6, 7, 8].map(r => f + r), `File ${f}`);
function lastMove() {
  if (!S.last) return announce('No moves yet.', 'info');
  announce('Last move: ' + describeMove(S.last), 'info');
  tourEvent('last');
}
/* Which pieces of `color` bear on sq. Pins are ignored: a pinned piece still attacks. */
function attackersOf(sq, color) {
  const g = S.game, tf = FILES.indexOf(sq[0]), tr = +sq[1], res = [];
  const at = (f, r) => (f >= 0 && f < 8 && r >= 1 && r <= 8) ? g.get(FILES[f] + r) : undefined;
  const push = (p, f, r) => { res.push(`${COLOR[p.color].toLowerCase()} ${NAMES[p.type]} on ${FILES[f]}${r}`); };
  const pawnFrom = color === 'w' ? tr - 1 : tr + 1;
  for (const f of [tf - 1, tf + 1]) { const p = at(f, pawnFrom); if (p && p.type === 'p' && p.color === color) push(p, f, pawnFrom); }
  for (const [x, y] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const p = at(tf + x, tr + y); if (p && p.type === 'n' && p.color === color) push(p, tf + x, tr + y); }
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const straight = x === 0 || y === 0;
    for (let i = 1; i < 8; i++) {
      const f = tf + x * i, r = tr + y * i, p = at(f, r);
      if (p === undefined) break;
      if (!p) continue;
      if (p.color === color && (p.type === 'q' || p.type === (straight ? 'r' : 'b') || (p.type === 'k' && i === 1))) push(p, f, r);
      break;
    }
  }
  return res;
}
function attackers(sq) {
  const all = [...attackersOf(sq, 'w'), ...attackersOf(sq, 'b')];
  announce(all.length ? `${sq} is attacked by ${all.join(', ')}.` : `Nothing attacks ${sq}.`, 'info');
}
function listMoves(sq) {
  const p = S.game.get(sq);
  if (!p) return announce(`${sq} is empty. Go to a square with a piece on it to hear its moves.`, 'info');
  const t = listTargets(sq);
  announce(`${cap(pieceName(p))} on ${sq}: ${t ? 'can go to ' + t : 'no legal moves'}${p.color !== S.game.turn() ? ' when it is ' + COLOR[p.color] + '\'s turn' : ''}.`, 'info');
  tourEvent('moves');
}
function status() {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }, left = { w: {}, b: {} };
  for (const sq of SQUARES) { const p = S.game.get(sq); if (p) left[p.color][p.type] = (left[p.color][p.type] || 0) + 1; }
  const lost = c => Object.keys(start).filter(t => (left[c][t] || 0) < start[t]).map(t => plural(start[t] - (left[c][t] || 0), NAMES[t])).join(', ') || 'nothing';
  announce(`${gameState().text} ${S.lesson ? '' : `White has lost ${lost('w')}. Black has lost ${lost('b')}.`}`.trim(), 'info');
}
function aboutPiece(t) { const i = PIECE_INFO[t]; announce(`${cap(NAMES[t])}, ${i.points}. ${i.how} Vibration: ${i.buzz}.`, 'info', { haptic: PAT[t], forceHaptic: true }); }
function undo() {
  if (S.lesson) return loadStep(false);
  if (S.busy) return announce('One moment, the computer is thinking.', 'info');
  const g = S.game;
  if (!g.history().length) return announce('Nothing to undo.', 'info');
  g.undo();
  if (settings.opponent === 'cpu' && g.turn() === 'b' && g.history().length) g.undo();
  const h = g.history({ verbose: true });
  S.last = h[h.length - 1] || null; S.selected = null; S.hint = null;
  saveGame(); render();
  announce(`Move taken back. ${gameState().text}`, 'info');
}
function newGame() {
  clearPending();
  S.game.reset(); S.selected = null; S.last = null; S.hint = null; S.focus = 'e2';
  saveGame(); render();
  announce(settings.opponent === 'cpu' ? 'New game. You play White against the computer. Your move.' : 'New game for two players. White moves first.', 'info');
}
const gameInProgress = () => !S.lesson && S.game.history().length > 0 && !S.game.game_over();
async function confirmReplaceGame(title, returnTo) {
  if (!gameInProgress()) return true;
  const ok = await ask({ title, body: 'This ends the game you are playing. It cannot be brought back.', returnTo, options: [{ label: 'Keep playing', value: false, primary: true }, { label: 'Yes, start a new game', value: true }] });
  return ok === true;
}
async function requestNewGame() { if (await confirmReplaceGame('Start a new game?', $('bNew'))) newGame(); }
function flip() {
  S.flipped = !S.flipped; buildBoard();
  announce(S.flipped ? 'Board flipped. Black is now at the bottom.' : 'Board flipped. White is now at the bottom.', 'info');
}
const HELP = 'Type a move like e4, Nf3 or e2 e4. Other commands: board, last, status, moves g1, attacks e4, rank 4, file e, about knight, undo, flip, new, again, stop, speech on, speech off, tutorial. In lessons: hint, next, repeat, leave.';
function runCommand(raw) {
  const t = raw.trim(), low = t.toLowerCase();
  if (['board', 'describe', 'd', 'b'].includes(low)) return describeBoard();
  if (['last', 'l'].includes(low)) return lastMove();
  if (['status', 'turn', 's'].includes(low)) return status();
  if (low === 'undo') return undo();
  if (low === 'flip') return flip();
  if (['help', '?'].includes(low)) return announce(HELP, 'info', { short: 'Commands are listed in Captions and on the Access tab.' });
  if (['hint', 'h'].includes(low)) return hint();
  if (['again', 'say again', 'repeat last', 'p'].includes(low) || (low === 'repeat' && !S.lesson)) return repeatLast();
  if (['stop', 'quiet', 'x'].includes(low)) return stopSpeech();
  if (['speech on', 'speak'].includes(low)) return setSpeech(true);
  if (['speech off', 'silent'].includes(low)) return setSpeech(false);
  if (['tutorial', 'how to use', 'tour'].includes(low)) return startTour($('cmdInput'));
  if (['new', 'new game'].includes(low)) return S.lesson ? exitLesson() : requestNewGame();
  if (S.lesson) {
    if (['next', 'n'].includes(low)) return S.awaitNext ? nextStep() : announce('Finish this step first.', 'info');
    if (['repeat', 'goal'].includes(low)) return repeatGoal();
    if (['leave', 'exit', 'skip'].includes(low)) return exitLesson();
  }
  let mm = low.match(/^moves?\s+([a-h][1-8])$/); if (mm) return listMoves(mm[1]);
  mm = low.match(/^attacks?\s+([a-h][1-8])$/); if (mm) return attackers(mm[1]);
  mm = low.match(/^rank\s+([1-8])$/); if (mm) return describeRank(mm[1]);
  mm = low.match(/^file\s+([a-h])$/); if (mm) return describeFile(mm[1]);
  mm = low.match(/^about\s+(pawn|knight|bishop|rook|queen|king)$/); if (mm) return aboutPiece(Object.keys(NAMES).find(k => NAMES[k] === mm[1]));
  if (/^[a-h][1-8]$/.test(low) && S.lesson && curStep().type === 'find' && !S.awaitNext) { setFocus(low, false, true); return findCheck(low); }
  S.typed = true;
  try { return typedMove(t, low); } finally { S.typed = false; }
}
function typedMove(t, low) {
  let mm = low.match(/^([a-h][1-8])\s*(?:-|x|to|\s)?\s*([a-h][1-8])\s*=?([qrbn])?$/); if (mm) return tryMove(mm[1], mm[2], mm[3]);
  // Pawn moves in plain text ("e4", "exd5", "e8") and piece moves in any case ("nf3", "O-O").
  const tmp = new Chess(S.game.fen());
  let m = tmp.move(t, { sloppy: true });
  if (!m && /^[nbrqk]/i.test(t)) m = tmp.move(t[0].toUpperCase() + t.slice(1), { sloppy: true });
  if (!m && /^(o-o(-o)?|0-0(-0)?)$/i.test(t)) m = tmp.move(t.toUpperCase().replace(/0/g, 'O'), { sloppy: true });
  if (m) return tryMove(m.from, m.to, m.promotion);
  // "e8" with no piece named: a pawn reaching the far side, so the promotion question comes up.
  if (!/=/.test(t)) { m = tmp.move(t + '=Q', { sloppy: true }); if (m) return tryMove(m.from, m.to); }
  if (!S.lesson && S.game.game_over()) return announce(`The game is over. ${gameState().text} Type new to play again.`, 'info');
  if (/^[a-h][1-8]$/.test(low)) { setFocus(low, true, true); return announce(`${low}, ${pieceName(S.game.get(low))}.`, 'info'); }
  announce(`I did not understand "${t}". ${HELP}`, 'error', { short: `I did not understand "${t}". Type help for the list.` });
}
function repeatGoal() { const st = S.lesson && curStep(); if (st) announce(st.goal, 'info'); }

/* ---------- Views ---------- */
const VIEW_TITLES = { play: 'Play', learn: 'Learn', options: 'Access settings', welcome: 'Welcome' };
const VIEW_HEADS = { play: 'playH', learn: 'learnH', options: 'optH', welcome: 'welH' };
function show(v, moveFocus = true) {
  for (const id of ['play', 'learn', 'options', 'welcome']) $('view-' + id).hidden = id !== v;
  document.body.classList.toggle('welcoming', v === 'welcome');
  document.querySelectorAll('nav.tabs button').forEach(b => { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.title = `${VIEW_TITLES[v]} - Touchpoint Chess`;
  window.scrollTo(0, 0);
  if (moveFocus) $(VIEW_HEADS[v]).focus({ preventScroll: true });
}
document.querySelectorAll('nav.tabs button').forEach(b => {
  b.addEventListener('click', () => show(b.dataset.view));
  const g = b.querySelector('.g');
  g.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${PIECE_ART[g.dataset.piece]}</svg>`;
});

/* Lessons come in units, in order. Each lesson is one large row; status has its own shape and words, not just colour. */
const UNITS = [
  ['The board and the pieces', ['map', 'rook', 'bishop', 'queen', 'knight', 'pawn', 'king']],
  ['Attack and defence', ['values', 'check', 'mate', 'tactics']],
  ['Draws and special rules', ['draws', 'special']],
  ['Your first game', ['opening']]
];
function renderLessons() {
  const box = $('lessons'), next = LESSONS.find(l => !done[l.id]), finished = LESSONS.filter(l => done[l.id]).length, all = finished === LESSONS.length;
  $('progress').textContent = all ? `You finished all ${LESSONS.length} lessons.` : `${finished} of ${LESSONS.length} lessons finished.`;
  $('progressBar').value = finished; $('progressBar').max = LESSONS.length;
  const cont = $('bContinue');
  cont.textContent = all ? 'Play a game' : finished ? `Continue: ${next.title}` : `Start here: ${next.title}`;
  cont.onclick = () => all ? show('play') : startLesson(next.id);
  $('lessonsAll').hidden = !all;
  box.innerHTML = '';
  const used = new Set();
  const units = UNITS.map(([name, ids]) => [name, ids.filter(id => LESSONS.some(l => l.id === id))]);
  const rest = LESSONS.filter(l => !units.some(u => u[1].includes(l.id))).map(l => l.id);
  if (rest.length) units.push(['More lessons', rest]);
  units.forEach(([name, ids], u) => {
    const sec = document.createElement('section'); sec.className = 'unit'; sec.setAttribute('aria-labelledby', 'unit-' + u);
    const doneHere = ids.filter(id => done[id]).length;
    sec.innerHTML = `<div class="unit-head"><h3 id="unit-${u}">${name}</h3><span class="unit-count">${doneHere} of ${ids.length} done</span></div>`;
    const ol = document.createElement('ol'); ol.className = 'unit-list'; ol.start = LESSONS.findIndex(l => l.id === ids[0]) + 1;
    for (const id of ids) {
      const l = LESSONS.find(x => x.id === id), i = LESSONS.indexOf(l), isNext = next && l.id === next.id;
      used.add(id);
      const state = done[l.id] ? 'done' : isNext ? 'next' : 'todo', word = { done: 'Done', next: 'Up next', todo: 'Not started' }[state];
      const li = document.createElement('li'); li.className = 'lesson ' + state;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'row-btn';
      b.innerHTML = `<span class="row-num" aria-hidden="true">${i + 1}</span><span class="row-main"><span class="row-title">${l.title}</span><span class="row-sub">${plural(l.steps.length, 'step')} · ${word}</span></span><span class="row-status ${state}" aria-hidden="true">${iconSvg(state === 'done' ? 'check' : state === 'next' ? 'next' : 'todo')}</span>`;
      b.setAttribute('aria-label', `${i + 1}. ${l.title}. ${plural(l.steps.length, 'step')}. ${word}.`);
      b.addEventListener('click', () => startLesson(l.id));
      li.appendChild(b); ol.appendChild(li);
    }
    sec.appendChild(ol); box.appendChild(sec);
  });
}
function renderFeel() {
  const box = $('feel'); box.innerHTML = '';
  if (!CAN_VIBRATE) $('feelIntro').textContent = 'Select a piece to hear how it moves. This device cannot vibrate from a web page (iPhones do not allow it), but the patterns are shown for when you use one that can.';
  ['p', 'n', 'b', 'r', 'q', 'k'].forEach(t => {
    const i = PIECE_INFO[t], b = document.createElement('button');
    b.type = 'button'; b.className = 'tile';
    b.innerHTML = `<span class="swatch">${pieceSvg(t, 'w')}</span><span class="tile-name">${cap(NAMES[t])}</span><span class="tile-sub">${i.points}</span><span class="buzz" aria-hidden="true">${i.mark}</span>`;
    b.setAttribute('aria-label', `${cap(NAMES[t])}, ${i.points}. ${i.how} Vibration: ${i.buzz}.`);
    b.addEventListener('click', () => {
      announce(`${cap(NAMES[t])}, ${i.points}. ${i.how}${CAN_VIBRATE ? ` Vibration: ${i.buzz}.` : ''}`, 'info', { haptic: PAT[t], forceHaptic: true, short: `${cap(NAMES[t])}: ${i.points}, vibration ${i.buzz}.` });
    });
    box.appendChild(b);
  });
}
/* "How do you want to play?" Four main ways, plus two more specific ones. */
const PRESETS = [
  { id: 'voice', main: true, icon: 'ear', label: 'Listen', detail: 'The app reads everything aloud, with a tone for each square.', set: { speech: true, sound: true, haptics: true, explore: true, brief: false, flash: true, calm: false, contrast: false, letters: false } },
  { id: 'braille', main: true, icon: 'hand', label: 'Feel', detail: 'Vibration for each piece, and short messages for braille displays.', set: { speech: false, sound: false, haptics: true, explore: true, brief: true, flash: true, calm: false, contrast: false, letters: false } },
  { id: 'lowvision', main: true, icon: 'eye', label: 'See', detail: 'High contrast, larger text and bold letters for pieces.', set: { speech: false, sound: false, haptics: true, explore: false, brief: false, flash: true, calm: false, contrast: true, letters: true, coords: true, textSize: 'large' } },
  { id: 'calm', main: true, icon: 'moon', label: 'Calm', detail: 'Soft colours, no motion, flashes or tones, and more time.', set: { speech: false, sound: false, haptics: false, explore: false, brief: true, flash: false, calm: true, contrast: false, letters: false } },
  { id: 'reader', icon: 'reader', label: 'I use a screen reader', detail: 'VoiceOver, TalkBack, NVDA or JAWS reads everything. App speech stays off.', set: { speech: false, sound: false, haptics: true, explore: false, brief: false, flash: true, calm: false, contrast: false, letters: false } },
  { id: 'deaf', icon: 'deaf', label: 'I am Deaf or hard of hearing', detail: 'Captions always open and visual alerts, no sound.', set: { speech: false, sound: false, haptics: true, explore: false, brief: false, flash: true, calm: false, contrast: false, letters: false, captionsOpen: true } }
];
function applyPreset(p, quiet) {
  Object.assign(settings, p.set, { onboarded: true, mode: p.id }); save(); renderPresets();
  syncControls(); applySettings(); $('capBox').open = !!settings.captionsOpen;
  // On the first-visit screen focus moves to the confirmation, so the live region stays out of it.
  announce(`Set up: ${p.label}. You can change anything on the Access tab.`, 'success', { forceSpeech: p.id === 'voice', noLive: !!quiet });
}
function presetButton(p) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'mode-card' + (p.main ? '' : ' minor');
  const chosen = settings.mode === p.id;
  b.innerHTML = `<span class="mode-ic">${iconSvg(p.icon)}</span><span class="mode-text"><span class="mode-title">${p.label}${chosen ? ' <span class="mode-chosen">· your choice</span>' : ''}</span><span class="mode-sub">${p.detail}</span></span>`;
  b.addEventListener('click', () => applyPreset(p));
  return b;
}
function renderPresets() {
  document.querySelectorAll('.modes').forEach(box => {
    const had = box.contains(document.activeElement) ? [...box.children].indexOf(document.activeElement) : -1;
    box.innerHTML = ''; PRESETS.forEach(p => box.appendChild(presetButton(p)));
    if (had >= 0 && box.children[had]) box.children[had].focus();
  });
}
const GROUPS = [['hear', 'Speech and sound'], ['see', 'Seeing'], ['touch', 'Touch'], ['messages', 'Messages and comfort'], ['game', 'Game']];
const TEXT_SIZES = [['normal', 'Normal'], ['large', 'Large'], ['xlarge', 'Extra large'], ['huge', 'Largest']];
const OPTS = [
  { k: 'speech', g: 'hear', t: 'App speech', d: 'Reads every message aloud with your device\'s voice. It starts off each time you open the app, so nothing talks until you choose. Leave it off if you use VoiceOver, TalkBack, NVDA or JAWS, which already read everything. You can also use the Speech button at the top.', tags: ['Blind', 'Low vision', 'Reading support'] },
  { k: 'voice', g: 'hear', type: 'voice', t: 'Voice', d: 'Which of your device\'s voices reads aloud. Some devices have more voices in their own speech settings.', tags: ['Blind', 'Low vision'] },
  { k: 'rate', g: 'hear', type: 'range', min: 0.6, max: 1.8, step: 0.1, t: 'Voice speed', d: 'How fast the voice talks. 1 is normal.', vt: v => `${(+v).toFixed(1)} times normal speed`, show: v => `${(+v).toFixed(1)}×`, tags: ['Blind', 'Processing'] },
  { k: 'volume', g: 'hear', type: 'range', min: 0.1, max: 1, step: 0.1, t: 'Voice volume', d: 'How loud the voice is, compared with your device volume.', vt: v => `${Math.round(v * 100)} percent`, show: v => `${Math.round(v * 100)}%`, tags: ['Blind', 'Hard of hearing'] },
  { k: 'sound', g: 'hear', t: 'Square tones and alert sounds', d: 'Each rank plays a higher note, from rank 1 low to rank 8 high. Files pan from your left ear (a) to your right ear (h). Squares with a piece sound brighter. Calm mode turns these off.', tags: ['Blind'] },
  { k: 'textSize', g: 'see', type: 'select', t: 'Text size', d: 'Makes all the text in the app larger. Your browser zoom works too.', tags: ['Low vision'], choices: TEXT_SIZES },
  { k: 'contrast', g: 'see', t: 'High contrast', d: 'Pure black and white everywhere, thick borders, and yellow and deep blue squares. Follows your light or dark choice.', tags: ['Low vision'] },
  { k: 'theme', g: 'see', type: 'select', t: 'Light or dark', d: 'Device setting follows your phone or computer.', tags: ['Low vision', 'Sensory sensitivity'], choices: [['auto', 'Device setting'], ['light', 'Light'], ['dark', 'Dark']] },
  { k: 'letters', g: 'see', t: 'Letters instead of piece shapes', d: 'Shows K, Q, R, B, N and P in bold circles. White pieces are white circles, black pieces are black circles.', tags: ['Low vision', 'Learning'] },
  { k: 'coords', g: 'see', t: 'Square names on every square', d: 'Prints e4, f5 and so on in the corner of every square, so you never have to count. When it is off, rank numbers and file letters still run along the edges of the board.', tags: ['Learning', 'Low vision'] },
  { k: 'hints', g: 'see', t: 'Show where a piece can go', d: 'After you pick up a piece, its legal squares get a dot, and captures get a dashed ring.', tags: ['Learning'] },
  { k: 'haptics', g: 'touch', t: 'Vibration patterns', d: 'Feel each piece: pawn 1 short, knight 2 short, bishop 3 short, rook 1 long, queen 2 long, king 3 long. Check is a strong double buzz.' + (CAN_VIBRATE ? '' : ' This device cannot vibrate from a web page, so this has no effect here.'), tags: ['Deafblind', 'Blind'] },
  { k: 'explore', g: 'touch', t: 'Explore by dragging a finger', d: 'Slide a finger over the board to feel, hear and read each square without picking anything up. Tap to select. The page will not scroll while your finger is on the board. Not needed with VoiceOver or TalkBack, which do this already.', tags: ['Deafblind', 'Blind', 'Low vision'] },
  { k: 'brief', g: 'messages', t: 'Short messages', d: 'Keeps spoken and braille messages to the point. Everything in full is still in Captions.', tags: ['Braille', 'Processing'] },
  { k: 'flash', g: 'messages', t: 'Visual alerts', d: 'Check and checkmate light up the board edge. The message bar at the top changes for every alert, and every sound is written in Captions.', tags: ['Deaf', 'Hard of hearing'] },
  { k: 'calm', g: 'messages', t: 'Calm mode', d: 'Softer colours, no flashing, no tones, slower voice and a slower computer opponent.', tags: ['Sensory sensitivity', 'Autism', 'ADHD'] },
  { k: 'cpu', g: 'game', type: 'select', t: 'Computer strength', d: 'Gentle mostly plays at random. Thinking looks two moves ahead and keeps its pieces safe.', tags: ['Everyone'], choices: [['gentle', 'Gentle'], ['think', 'Thinking']] }
];
function control(o, id) {
  const v = settings[o.k];
  if (o.type === 'range') return `<span class="range"><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}" aria-describedby="${id}-d" aria-valuetext="${o.vt(v)}"><output for="${id}" id="${id}-o" aria-hidden="true">${o.show(v)}</output></span>`;
  if (o.type === 'select') return `<select id="${id}" aria-describedby="${id}-d">${o.choices.map(([cv, l]) => `<option value="${cv}"${v === cv ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  if (o.type === 'voice') return `<select id="${id}" aria-describedby="${id}-d" data-voice></select>`;
  return `<span class="switch"><input type="checkbox" role="switch" id="${id}" aria-describedby="${id}-d"${v ? ' checked' : ''}><span></span></span>`;
}
function wireControl(o, el) {
  el.addEventListener(o.type === 'range' ? 'input' : 'change', () => {
    const v = o.type === 'range' ? +el.value : (o.type === 'select' || o.type === 'voice') ? el.value : el.checked;
    setOpt(o.k, v);
    if (o.k === 'haptics' && v) buzz(PAT.n);
    if (o.k === 'sound' && v) tone('e4', true);
    if (o.k === 'rate' || o.k === 'volume' || o.k === 'voice') { clearTimeout(wireControl.t); wireControl.t = setTimeout(() => say('This is how the voice sounds.', true), 250); }
  });
}
function renderOpts() {
  const box = $('opts'); box.innerHTML = '';
  for (const [gid, gname] of GROUPS) {
    const sec = document.createElement('section'); sec.className = 'opt-group card'; sec.setAttribute('aria-labelledby', 'grp-' + gid);
    sec.innerHTML = `<h3 id="grp-${gid}">${gname}</h3>`;
    const list = document.createElement('div'); list.className = 'opt-list';
    for (const o of OPTS.filter(x => x.g === gid)) {
      const id = 'opt-' + o.k, d = document.createElement('div'); d.className = 'opt';
      d.innerHTML = `<div class="opt-head"><label for="${id}">${o.t}</label>${control(o, id)}</div><p id="${id}-d">${o.d}</p><p class="tags">Helps with: ${o.tags.join(', ')}</p>`;
      list.appendChild(d);
      wireControl(o, d.querySelector('#' + id));
    }
    sec.appendChild(list);
    if (gid === 'hear') {
      const tests = document.createElement('div'); tests.className = 'test-row';
      tests.innerHTML = '<button class="chip-btn" type="button" id="tVoice"><span class="ic" data-icon="speaker" aria-hidden="true"></span>Test voice</button><button class="chip-btn" type="button" id="tTone"><span class="ic" data-icon="ear" aria-hidden="true"></span>Test tones</button><button class="chip-btn" type="button" id="tVib"><span class="ic" data-icon="hand" aria-hidden="true"></span>Test vibration</button>';
      sec.appendChild(tests);
    }
    box.appendChild(sec);
  }
  fillVoices(); paintIcons(box);
  $('tVib').onclick = () => {
    if (!CAN_VIBRATE) return announce('This device or browser cannot vibrate from a web page.', 'error');
    buzz(PAT.check, true); announce('Vibration sent. You should feel a strong double buzz.', 'info');
  };
  $('tVoice').onclick = () => {
    if (!HAS_SPEECH) return announce('This browser has no voice available. See "If the app\'s speech does not work" below.', 'error');
    say('Knight from g1 to f3. Black to move.', true); banner.textContent = 'Voice test: Knight from g1 to f3. Black to move.'; banner.dataset.level = 'info';
  };
  $('tTone').onclick = () => {
    ['a1', 'c3', 'e5', 'h8'].forEach((s, i) => setTimeout(() => tone(s, i % 2, true), i * 260));
    banner.textContent = 'Tone test: a1, c3, e5, h8. The notes climb and move from left to right.'; banner.dataset.level = 'info';
  };
}
function fillVoices() {
  document.querySelectorAll('select[data-voice]').forEach(sel => {
    const lang = (document.documentElement.lang || 'en').slice(0, 2);
    const mine = voices.filter(v => (v.lang || '').toLowerCase().startsWith(lang));
    const list = mine.length ? mine : voices;
    sel.innerHTML = '<option value="">Device default</option>' + list.map(v => `<option value="${v.voiceURI.replace(/"/g, '&quot;')}">${v.name.replace(/</g, '&lt;')} (${v.lang})</option>`).join('');
    sel.value = list.some(v => v.voiceURI === settings.voice) ? settings.voice : '';
    sel.disabled = !HAS_SPEECH;
  });
}
/* The tour's own small settings panel. Changes are confirmed in the message bar, Captions and speech. */
function renderTourSettings(box) {
  const wrap = document.createElement('div'); wrap.className = 'tour-settings';
  wrap.innerHTML =
    `<div class="opt-head"><label for="ts-speech">App speech</label>${control({ k: 'speech' }, 'ts-speech')}</div>` +
    `<div class="opt-head"><label for="ts-textSize">Text size</label>${control(OPTS.find(o => o.k === 'textSize'), 'ts-textSize')}</div>` +
    `<div class="opt-head"><label for="ts-contrast">High contrast</label>${control({ k: 'contrast' }, 'ts-contrast')}</div>` +
    `<div class="opt-head"><label for="ts-rate">Voice speed</label>${control(OPTS.find(o => o.k === 'rate'), 'ts-rate')}</div>`;
  wrap.querySelectorAll('[aria-describedby]').forEach(el => el.removeAttribute('aria-describedby'));
  box.appendChild(wrap);
  const confirm = { textSize: v => `Text size is now ${TEXT_SIZES.find(x => x[0] === v)[1]}.`, contrast: v => `High contrast is ${v ? 'on' : 'off'}.`, rate: v => `Voice speed is ${(+v).toFixed(1)}.` };
  for (const k of ['speech', 'textSize', 'contrast', 'rate']) {
    const el = $('ts-' + k), o = OPTS.find(x => x.k === k);
    el.addEventListener(o.type === 'range' ? 'change' : 'change', () => {
      const v = o.type === 'range' ? +el.value : o.type === 'select' ? el.value : el.checked;
      setOpt(k, v);
      if (confirm[k]) announce(`${confirm[k](v)} Choose Next step when you are happy.`, 'success', { noLive: true, short: confirm[k](v) });
      if (k === 'rate') say('This is how the voice sounds.', true);
    });
  }
}
function setOpt(k, v) {
  if (k === 'speech') return setSpeech(v);
  settings[k] = v; save(); applySettings(); syncControls();
}
/* Keeps every copy of a setting (Access tab, tour, header) showing the same value. */
function syncControls() {
  for (const o of OPTS) for (const id of ['opt-' + o.k, 'ts-' + o.k]) {
    const el = $(id); if (!el) continue;
    const v = settings[o.k];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.dataset.voice !== undefined) el.value = voices.some(x => x.voiceURI === v) ? v : '';
    else if (String(el.value) !== String(v)) el.value = v;
    if (o.type === 'range') { el.setAttribute('aria-valuetext', o.vt(v)); const out = $(id + '-o'); if (out) out.textContent = o.show(v); }
  }
  const b = $('bSpeech');
  b.setAttribute('aria-pressed', settings.speech ? 'true' : 'false');
  $('bSpeechState').textContent = settings.speech ? 'on' : 'off';
  b.querySelector('.ic').dataset.icon = settings.speech ? 'speaker' : 'speakerOff'; paintIcons(b);
  $('bStop').hidden = !settings.speech;
}
function setSpeech(on) {
  settings.speech = !!on; save(); syncControls();
  if (on) announce('App speech is on. Press X to stop it talking, or the Speech button to turn it off.', 'info', { noLive: true, forceSpeech: true, short: 'App speech is on.' });
  else { stopSpeech(true); announce('App speech is off. Screen readers keep working as normal.', 'info', { noLive: true, speak: false, short: 'App speech is off.' }); }
}
function applySettings() {
  document.body.classList.toggle('contrast', settings.contrast);
  document.body.classList.toggle('letters', settings.letters);
  document.body.classList.toggle('calm', settings.calm);
  document.body.classList.toggle('explore', settings.explore);
  document.body.classList.toggle('coords-on', settings.coords);
  const root = document.documentElement;
  if (settings.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = settings.theme;
  if (settings.textSize === 'normal') root.removeAttribute('data-text'); else root.dataset.text = settings.textSize;
  $('oppCpu').checked = settings.opponent === 'cpu'; $('oppHuman').checked = settings.opponent === 'human';
  render();
}

/* ---------- Explore by finger ---------- */
const explore = { active: false, dragged: false, off: false };
boardEl.addEventListener('pointerdown', e => {
  if (!settings.explore || e.pointerType === 'mouse') return;
  explore.active = true; explore.dragged = false; explore.start = e.target.closest('.sq'); explore.off = false;
});
boardEl.addEventListener('pointermove', e => {
  if (!explore.active) return;
  const el = document.elementFromPoint(e.clientX, e.clientY), cell = el && el.closest('.sq');
  if (!cell) { if (!explore.off) { explore.off = true; buzz(PAT.edge); } return; }
  explore.off = false;
  if (cell !== explore.start) explore.dragged = true;
  if (cell.dataset.sq !== S.focus) setFocus(cell.dataset.sq, false, true);
});
const endExplore = () => { explore.active = false; setTimeout(() => { explore.dragged = false; }, 0); };
boardEl.addEventListener('pointerup', endExplore);
boardEl.addEventListener('pointercancel', endExplore);

/* ---------- Wire up ---------- */
boardEl.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  let f = FILES.indexOf(S.focus[0]), r = +S.focus[1];
  const d = S.flipped ? -1 : 1;
  if (k === 'ArrowUp') r += d; else if (k === 'ArrowDown') r -= d; else if (k === 'ArrowRight') f += d; else if (k === 'ArrowLeft') f -= d;
  else if (k === 'Home') f = S.flipped ? 7 : 0; else if (k === 'End') f = S.flipped ? 0 : 7;
  else if (k === 'Enter' || k === ' ') { e.preventDefault(); return activate(S.focus); }
  else if (k === 'Escape') {
    stopSpeech(true);
    if (askFinish) return askFinish(null, true);
    if (S.selected) { S.selected = null; render(); announce('Piece put back.', 'info'); }
    return;
  } else {
    const fn = { m: () => listMoves(S.focus), a: () => attackers(S.focus), b: describeBoard, d: describeBoard, l: lastMove, h: hint, r: () => describeRank(S.focus[1]), f: () => describeFile(S.focus[0]), s: status, n: nextStep, p: repeatLast, x: () => stopSpeech() }[k.toLowerCase()];
    if (fn) { e.preventDefault(); fn(); }
    return;
  }
  e.preventDefault();
  if (f < 0 || f > 7 || r < 1 || r > 8) { buzz(PAT.edge); return announce('Edge of the board.', 'info'); }
  setFocus(FILES[f] + r, true, true);
});
$('skipBoard').addEventListener('click', e => { e.preventDefault(); if (!settings.onboarded) { settings.onboarded = true; save(); } show('play', false); cells[S.focus].focus(); });
$('skipMain').addEventListener('click', e => { e.preventDefault(); $('main').focus(); });
$('cmdForm').addEventListener('submit', e => { e.preventDefault(); const v = $('cmdInput').value; if (!v.trim()) return; $('cmdInput').value = ''; runCommand(v); });
$('bDescribe').onclick = describeBoard; $('bLast').onclick = lastMove; $('bUndo').onclick = undo;
$('bFlip').onclick = flip;
$('bNew').onclick = requestNewGame;
$('bRepeat').onclick = repeatLast;
$('bStop').onclick = () => stopSpeech();
$('bSpeech').onclick = () => setSpeech(!settings.speech);
$('bTour').onclick = () => startTour($('bTour'));
document.querySelectorAll('input[name=opp]').forEach(r => r.addEventListener('change', async () => {
  const value = r.value;
  applySettings();  // keep the old choice showing until the switch is confirmed
  if (!await confirmReplaceGame('Change opponent?', r)) return;
  settings.opponent = value; save(); applySettings(); newGame();
}));
$('lcHint').onclick = hint; $('lcRepeat').onclick = repeatGoal;
$('lcExit').onclick = exitLesson; $('lcNext').onclick = nextStep; $('lcBack').onclick = exitLesson;
$('lcMore').onclick = () => {
  const open = $('lcIntro').classList.toggle('open');
  $('lcMore').setAttribute('aria-expanded', open ? 'true' : 'false'); $('lcMore').textContent = open ? 'Hide introduction' : 'Show introduction';
};
/* More options: a tray that opens in place. Esc or Close shuts it and puts focus back on More. */
function setMore(open, restore) {
  $('moreOpts').hidden = !open; $('bMore').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { $('moreOpts').focus({ preventScroll: true }); $('moreOpts').scrollIntoView({ block: 'nearest' }); }
  else if (restore) $('bMore').focus();
}
$('bMore').onclick = () => setMore($('moreOpts').hidden);
$('bMoreClose').onclick = () => setMore(false, true);
$('moreOpts').addEventListener('keydown', e => { if (e.key === 'Escape' && !askFinish) { e.preventDefault(); setMore(false, true); } });
$('capBox').open = !!settings.captionsOpen;
$('capBox').addEventListener('toggle', () => { if (settings.captionsOpen !== $('capBox').open) { settings.captionsOpen = $('capBox').open; save(); } });
$('lcHelpBody').innerHTML = $('speechHelpBody').innerHTML;

function restoreGame() {
  let pgn = null;
  try { pgn = localStorage.getItem('tpc-game'); } catch (e) {}
  if (!pgn) return false;
  const g = new Chess();
  if (!g.load_pgn(pgn) || !g.history().length) return false;
  const h = g.history({ verbose: true });
  S.game = g; S.last = h[h.length - 1];
  return true;
}

/* The message bar sticks to the top, so anything scrolled into view keeps clear of it. */
if ('ResizeObserver' in window) new ResizeObserver(([e]) => document.documentElement.style.setProperty('--bar-h', Math.ceil(e.contentRect.height) + 'px')).observe(document.querySelector('.banner-bar'));

const resumed = restoreGame();
buildBoard(); renderLessons(); renderFeel(); renderPresets(); renderOpts(); applySettings(); paintIcons(); syncControls();
if (HAS_SPEECH) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) {} }
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
if (resumed) {
  const st = gameState();
  banner.textContent = `Welcome back. ${st.text}`;
  logAdd(`Welcome back. Your game was saved. ${describeMove(S.last)} ${st.text}`, 'info');
  maybeCpu();
} else logAdd('Welcome. You play White. Tap a piece, use the arrow keys, or type a move like e4.', 'info');
/* First visit: one question, then an offer of the tour. Nothing here is a pop-up, and Skip is always there. */
function startWelcome() {
  $('welPick').hidden = false; $('welDone').hidden = true;
  const box = $('welModes'); box.innerHTML = '';
  PRESETS.forEach(p => { const b = presetButton(p); b.onclick = () => chooseWelcome(p); box.appendChild(b); });
  show('welcome');
  banner.textContent = 'Welcome to Touchpoint Chess. One question first.'; banner.dataset.level = 'info';
}
function chooseWelcome(p) {
  applyPreset(p, true);
  $('welPick').hidden = true; $('welDone').hidden = false;
  $('welDoneH').textContent = `You're set: ${p.label}`;
  $('welDoneText').textContent = `${p.detail} Change anything on the Access tab. The tour shows how to move around the board, pick up pieces and hear the position.`;
  $('welDoneH').focus();
}
function leaveWelcome(tour) {
  settings.onboarded = true; save();
  if (tour) return startTour(null);
  show('play', false); cells[S.focus].focus();
  announce('Your move. You play White against the computer. Press Help at the top any time.', 'info', { short: 'Your move. You play White.' });
}
$('welSkip').onclick = () => leaveWelcome(false);
$('welTour').onclick = () => leaveWelcome(true);
$('welPlay').onclick = () => leaveWelcome(false);
if (!settings.onboarded) startWelcome();
})();
