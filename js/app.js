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

const DEFAULTS = {
  speech: false, rate: 1, sound: false, haptics: true, explore: false, flash: true, brief: false,
  contrast: false, letters: false, coords: true, hints: true, calm: false,
  theme: 'auto', textSize: 'normal', cpu: 'gentle', opponent: 'cpu', onboarded: false
};
const settings = Object.assign({}, DEFAULTS);
function readJson(key) { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
Object.assign(settings, readJson('tpc-settings'));
function save() { try { localStorage.setItem('tpc-settings', JSON.stringify(settings)); } catch (e) {} }
const done = readJson('tpc-done');
function saveDone() { try { localStorage.setItem('tpc-done', JSON.stringify(done)); } catch (e) {} }

const S = {
  game: new Chess(), selected: null, focus: 'e2', flipped: false, last: null, hint: null, busy: false, timer: null,
  lesson: null, step: 0, awaitNext: false, complete: false, saved: null
};
const $ = id => document.getElementById(id);
const boardEl = $('board'), srP = $('sr-polite'), srA = $('sr-alert'), banner = $('banner'), logEl = $('log');
const cells = {};
const cap = s => s[0].toUpperCase() + s.slice(1);

/* ---------- Feedback channels ---------- */
let audioCtx = null;
function ctx() {
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
function buzz(p, force) { if ((!settings.haptics && !force) || !p || !CAN_VIBRATE) return; try { navigator.vibrate(p); } catch (e) {} }
function say(t, force) {
  if ((!settings.speech && !force) || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.rate = settings.calm ? Math.min(settings.rate, 0.9) : settings.rate;
    speechSynthesis.speak(u);
  } catch (e) {}
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
let liveTimer = null;
/* opt.short: what the banner shows, and what braille and speech get in brief mode.
   opt.noLive: focus is about to land on this same text, so a live region would read it twice. */
function announce(text, level = 'info', opt = {}) {
  const spoken = settings.brief && opt.short ? opt.short : text;
  if (!opt.noLive) {
    const region = level === 'alert' ? srA : srP, other = level === 'alert' ? srP : srA;
    other.textContent = ''; region.textContent = '';
    clearTimeout(liveTimer); liveTimer = setTimeout(() => { region.textContent = spoken; }, 60);
  }
  banner.textContent = opt.short || text; banner.dataset.level = level; logAdd(text, level);
  if (opt.speak !== false) say(spoken, opt.forceSpeech);
  chime(level);
  if (level === 'alert') { flash(); buzz(opt.haptic || PAT.check); }
  else if (level === 'error') buzz(opt.haptic || PAT.error);
  else if (level === 'success') buzz(opt.haptic || PAT.success);
  else if (opt.haptic) buzz(opt.haptic, opt.forceHaptic);
}

/* ---------- Dialog ---------- */
/* options: [{label, value, primary, html}]. Resolves with the chosen value, or null if dismissed with Esc. */
function ask({ title, body, options, grid }) {
  const dlg = $('dlg'), box = $('dlgOptions');
  $('dlgTitle').textContent = title; $('dlgBody').textContent = body || ''; $('dlgBody').hidden = !body;
  box.innerHTML = '';
  const holder = grid ? box.appendChild(Object.assign(document.createElement('div'), { className: 'row-4' })) : box;
  return new Promise(resolve => {
    options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn' + (o.primary ? ' primary' : '') + (o.html ? ' piece-btn' : '');
      if (o.html) { b.innerHTML = o.html; b.setAttribute('aria-label', o.label); } else b.textContent = o.label;
      if (o.detail) { const s = document.createElement('small'); s.textContent = o.detail; b.appendChild(s); }
      b.addEventListener('click', () => dlg.close(String(options.indexOf(o))));
      holder.appendChild(b);
    });
    dlg.returnValue = '';
    dlg.addEventListener('close', () => {
      const o = options[+dlg.returnValue];
      resolve(dlg.returnValue !== '' && o ? o.value : null);
    }, { once: true });
    dlg.showModal();
  });
}

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
  $('modePill').textContent = S.lesson ? 'Lesson' : (settings.opponent === 'cpu' ? 'vs computer' : 'Two players');
  $('oppPanel').hidden = !!S.lesson;
  $('lessonActions').hidden = !S.lesson;
  $('bNew').hidden = !!S.lesson;
  $('bUndo').textContent = S.lesson ? 'Restart step' : 'Undo';
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
    if (settings.speech) say(`${sq}, ${pieceName(p)}`);
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
    saveGame(); render(); announceMove(S.last, true);
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
        title: 'Promote your pawn', body: `The pawn reaches ${to}. What should it become?`, grid: true,
        options: ['q', 'r', 'b', 'n'].map((t, i) => ({ value: t, label: cap(NAMES[t]), primary: i === 0, html: `<span class="swatch">${pieceSvg(t, c)}</span>${cap(NAMES[t])}` }))
      });
      if (!promotion) { S.selected = null; render(); cells[S.focus].focus(); return announce('Promotion cancelled. The pawn stays where it was.', 'info'); }
    }
  }
  if (S.lesson) return lessonMove(from, to, promotion);
  const m = g.move({ from, to, promotion });
  if (!m) return announce(`${from} to ${to} is not a legal move.`, 'error');
  S.selected = null; S.last = m; S.hint = null; S.focus = to;
  saveGame(); render(); announceMove(m, false);
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

/* ---------- Lessons ---------- */
const curStep = () => S.lesson.steps[S.step];
/* Directions as the learner sees them, so they stay right on a flipped board. */
function dirText(from, to) {
  const flip = S.flipped ? -1 : 1;
  const df = (FILES.indexOf(to[0]) - FILES.indexOf(from[0])) * flip, dr = ((+to[1]) - (+from[1])) * flip, parts = [];
  if (df) parts.push(`${plural(Math.abs(df), 'file')} to the ${df > 0 ? 'right' : 'left'}`);
  if (dr) parts.push(`${plural(Math.abs(dr), 'rank')} ${dr > 0 ? 'up' : 'down'}`);
  return parts.join(' and ');
}
function focusLessonText() {
  // Focus lands on the goal text, so screen readers read it in full and the board is the very next stop.
  $('lcText').focus({ preventScroll: true });
  $('lessonCard').scrollIntoView({ block: 'nearest' });
}
function startLesson(id) {
  clearPending();
  if (!S.lesson) S.saved = { game: S.game, last: S.last, flipped: S.flipped };
  S.game = new Chess();
  S.lesson = LESSONS.find(l => l.id === id); S.step = 0;
  S.flipped = false; buildBoard();  // lesson wording assumes White is at the bottom
  show('play', false); loadStep(true);
}
function loadStep(first) {
  clearPending();
  const st = curStep();
  S.game.load(st.fen); S.selected = null; S.last = null; S.hint = null; S.awaitNext = false; S.complete = false;
  S.focus = st.type === 'find' || st.type === 'choice' ? 'a1' : st.from;
  $('lessonCard').hidden = false; $('lcNext').hidden = true; $('lcHint').hidden = st.type === 'choice'; $('lcRepeat').hidden = false;
  $('lcFeedback').hidden = true; $('lcFeedback').textContent = '';
  $('lcEyebrow').textContent = `${S.lesson.tag} · step ${S.step + 1} of ${S.lesson.steps.length}`;
  $('lcTitle').textContent = S.lesson.title;
  $('lcIntro').textContent = S.lesson.intro; $('lcIntro').hidden = !first;
  $('lcGoal').textContent = st.goal; $('lcGoal').hidden = false;
  $('lcSteps').innerHTML = S.lesson.steps.map((_, i) => `<span class="${i <= S.step ? 'on' : ''}"></span>`).join('');
  renderChoices(st);
  render();
  announce((first ? `${S.lesson.title}. ${S.lesson.intro} ` : '') + st.goal, 'info', { noLive: true, short: st.goal });
  focusLessonText();
}
function renderChoices(st) {
  const box = $('lcChoices');
  box.innerHTML = ''; box.hidden = st.type !== 'choice';
  if (st.type !== 'choice') return;
  st.choices.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = c.t;
    b.addEventListener('click', () => {
      if (S.awaitNext) return;
      if (c.ok) { b.classList.add('right'); stepPassed(c.why); }
      else { b.classList.add('wrong'); announce(`${c.why} Try again.`, 'error'); }
    });
    box.appendChild(b);
  });
}
/* Moves on only when the learner chooses Next, so nobody is rushed and screen readers finish reading first. */
function stepPassed(text) {
  S.awaitNext = true; S.hint = null; S.selected = null;
  $('lcFeedback').textContent = text; $('lcFeedback').hidden = false;
  $('lcHint').hidden = true; $('lcIntro').hidden = true;
  $('lcNext').textContent = S.step < S.lesson.steps.length - 1 ? 'Next step' : 'Finish lesson';
  $('lcNext').hidden = false;
  render();
  announce(text, 'success', { noLive: true });
  focusLessonText();
}
function findCheck(sq) {
  const st = curStep();
  if (sq === st.target) { S.hint = sq; S.focus = sq; stepPassed(`Yes, that is ${sq}. ${st.why}`); S.hint = sq; render(); }
  else announce(`That is ${sq}. ${st.target} is ${dirText(sq, st.target)} from here.`, 'error');
}
function lessonMove(from, to, promotion) {
  const st = curStep(), g = S.game, m = g.move({ from, to, promotion });
  if (!m) return announce('That move is not legal here.', 'error');
  const mate = g.in_checkmate();
  const ok = st.type === 'mate' ? mate : st.type === 'check' ? g.in_check() : (from === st.from && to === st.to);
  S.selected = null; S.hint = null;
  if (ok) {
    S.last = m; S.focus = to;
    stepPassed(`${describeMove(m)} ${mate ? 'Checkmate! ' : ''}${st.why}`);
    return;
  }
  g.undo(); S.last = null; S.focus = from; render();
  announce(`${describeMove(m)} That is a legal move, but not the goal, so the piece went back to ${from}. ${st.goal}`, 'error', { short: `Not quite. The piece is back on ${from}. Try again.` });
}
function nextStep() {
  if (!S.lesson || !S.awaitNext) return;
  if (S.complete) {
    const nxt = LESSONS[LESSONS.indexOf(S.lesson) + 1];
    return nxt ? startLesson(nxt.id) : exitLesson();
  }
  if (S.step < S.lesson.steps.length - 1) { S.step++; return loadStep(false); }
  done[S.lesson.id] = true; saveDone(); renderLessons();
  S.complete = true;
  const nxt = LESSONS[LESSONS.indexOf(S.lesson) + 1];
  $('lcEyebrow').textContent = 'Lesson complete';
  $('lcGoal').hidden = true; $('lcIntro').hidden = true;
  $('lcFeedback').textContent = nxt ? `Well done. Next up: ${nxt.title}.` : 'You finished every lesson. Try a game against the computer.';
  $('lcFeedback').hidden = false;
  $('lcSteps').innerHTML = S.lesson.steps.map(() => '<span class="on"></span>').join('');
  $('lcHint').hidden = true; $('lcRepeat').hidden = true; $('lcChoices').hidden = true;
  $('lcNext').textContent = nxt ? `Start: ${nxt.title}` : 'Back to lessons';
  announce(`Lesson complete: ${S.lesson.title}. ${nxt ? 'Next up: ' + nxt.title + '.' : 'You finished every lesson.'}`, 'success', { noLive: true });
  focusLessonText();
}
function hint() {
  if (!S.lesson) return announce('Hints are for lessons. In a game, pick up a piece to find out where it can go.', 'info');
  if (S.awaitNext) return announce('Choose Next to carry on.', 'info');
  const st = curStep();
  if (st.type === 'choice') return announce(`Read the question again: ${st.goal}`, 'info');
  if (st.type === 'find') {
    S.hint = st.target; render();
    const dir = dirText(S.focus, st.target);
    return announce(dir ? `${st.target} is ${dir} from ${S.focus}. It is now outlined on the board.` : `You are on ${st.target}. Select it.`, 'info');
  }
  if (S.selected !== st.from) {
    S.hint = st.from; render();
    const dir = dirText(S.focus, st.from);
    return announce(`Start by picking up the piece on ${st.from}. You are on ${S.focus}${dir ? `; ${st.from} is ${dir}` : ', right there'}.`, 'info');
  }
  S.hint = st.to; render();
  announce(`Move it to ${st.to}, ${dirText(st.from, st.to)} from ${st.from}.`, 'info');
}
function exitLesson() {
  clearPending();
  S.lesson = null; S.awaitNext = false; S.complete = false; S.hint = null; S.selected = null;
  $('lessonCard').hidden = true;
  if (S.saved) { S.game = S.saved.game; S.last = S.saved.last; S.flipped = S.saved.flipped; S.saved = null; }
  buildBoard();
  show('learn', true);
  announce('Left the lesson. Your game is still on the Play tab.', 'info');
  maybeCpu();
}

/* ---------- Commands ---------- */
function describeBoard() {
  const g = S.game, out = { w: {}, b: {} };
  for (const sq of SQUARES) { const p = g.get(sq); if (p) (out[p.color][p.type] = out[p.color][p.type] || []).push(sq); }
  const side = c => ['k', 'q', 'r', 'b', 'n', 'p'].filter(t => out[c][t]).map(t => { const l = out[c][t]; return `${l.length > 1 ? NAMES[t] + 's' : NAMES[t]} ${l.join(' ')}`; }).join('; ') || 'no pieces';
  announce(`White: ${side('w')}. Black: ${side('b')}. ${gameState().text}`, 'info', { short: 'Board described in Captions and read aloud.' });
}
function describeLine(squares, name) {
  const found = squares.map(sq => [sq, S.game.get(sq)]).filter(x => x[1]).map(([sq, p]) => `${sq} ${pieceName(p)}`);
  announce(found.length ? `${name}: ${found.join(', ')}.` : `${name} is empty.`, 'info');
}
const describeRank = r => describeLine([...FILES].map(f => f + r), `Rank ${r}`);
const describeFile = f => describeLine([1, 2, 3, 4, 5, 6, 7, 8].map(r => f + r), `File ${f}`);
function lastMove() { if (!S.last) return announce('No moves yet.', 'info'); announce('Last move: ' + describeMove(S.last), 'info'); }
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
  if (!p) return announce(`${sq} is empty.`, 'info');
  const t = listTargets(sq);
  announce(`${cap(pieceName(p))} on ${sq}: ${t ? 'can go to ' + t : 'no legal moves'}${p.color !== S.game.turn() ? ' when it is ' + COLOR[p.color] + '\'s turn' : ''}.`, 'info');
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
async function confirmReplaceGame(title) {
  if (!gameInProgress()) return true;
  const ok = await ask({ title, body: 'This ends the game you are playing. It cannot be brought back.', options: [{ label: 'Keep playing', value: false, primary: true }, { label: 'Yes, start a new game', value: true }] });
  return ok === true;
}
async function requestNewGame() { if (await confirmReplaceGame('Start a new game?')) newGame(); }
function flip() {
  S.flipped = !S.flipped; buildBoard();
  announce(S.flipped ? 'Board flipped. Black is now at the bottom.' : 'Board flipped. White is now at the bottom.', 'info');
}
const HELP = 'Type a move like e4, Nf3 or e2 e4. Other commands: board, last, status, moves g1, attacks e4, rank 4, file e, about knight, undo, flip, new. In lessons: hint, next, repeat, leave.';
function runCommand(raw) {
  const t = raw.trim(), low = t.toLowerCase();
  if (['board', 'describe', 'd'].includes(low)) return describeBoard();
  if (['last', 'l'].includes(low)) return lastMove();
  if (['status', 'turn', 's'].includes(low)) return status();
  if (low === 'undo') return undo();
  if (low === 'flip') return flip();
  if (['help', '?'].includes(low)) return announce(HELP, 'info', { short: 'Commands are listed in Captions and on the Access tab.' });
  if (['hint', 'h'].includes(low)) return hint();
  if (['new', 'new game'].includes(low)) return S.lesson ? exitLesson() : requestNewGame();
  if (S.lesson) {
    if (['next', 'n'].includes(low)) return S.awaitNext ? nextStep() : announce('Finish this step first.', 'info');
    if (['repeat', 'goal'].includes(low)) return repeatGoal();
    if (['leave', 'exit'].includes(low)) return exitLesson();
  }
  let mm = low.match(/^moves?\s+([a-h][1-8])$/); if (mm) return listMoves(mm[1]);
  mm = low.match(/^attacks?\s+([a-h][1-8])$/); if (mm) return attackers(mm[1]);
  mm = low.match(/^rank\s+([1-8])$/); if (mm) return describeRank(mm[1]);
  mm = low.match(/^file\s+([a-h])$/); if (mm) return describeFile(mm[1]);
  mm = low.match(/^about\s+(pawn|knight|bishop|rook|queen|king)$/); if (mm) return aboutPiece(Object.keys(NAMES).find(k => NAMES[k] === mm[1]));
  if (/^[a-h][1-8]$/.test(low) && S.lesson && curStep().type === 'find' && !S.awaitNext) { setFocus(low, false, true); return findCheck(low); }
  mm = low.match(/^([a-h][1-8])\s*(?:-|x|to|\s)?\s*([a-h][1-8])\s*=?([qrbn])?$/); if (mm) return tryMove(mm[1], mm[2], mm[3]);
  // Pawn moves in plain text ("e4", "exd5", "e8") and piece moves in any case ("nf3", "O-O").
  const tmp = new Chess(S.game.fen());
  let m = tmp.move(t, { sloppy: true });
  if (!m && /^[nbrqk]/i.test(t)) m = tmp.move(t[0].toUpperCase() + t.slice(1), { sloppy: true });
  if (!m && /^(o-o(-o)?|0-0(-0)?)$/i.test(t)) m = tmp.move(t.toUpperCase().replace(/0/g, 'O'), { sloppy: true });
  if (m) return tryMove(m.from, m.to, m.promotion);
  // "e8" with no piece named: a pawn reaching the far side, so the promotion question comes up.
  if (!/=/.test(t)) { m = tmp.move(t + '=Q', { sloppy: true }); if (m) return tryMove(m.from, m.to); }
  if (/^[a-h][1-8]$/.test(low)) { setFocus(low, true, true); return announce(`${low}, ${pieceName(S.game.get(low))}.`, 'info'); }
  if (!S.lesson && S.game.game_over()) return announce(`The game is over. ${gameState().text} Type new to play again.`, 'info');
  announce(`I did not understand "${t}". ${HELP}`, 'error', { short: `I did not understand "${t}". Type help for the list.` });
}
function repeatGoal() { const st = S.lesson && curStep(); if (st) announce(st.goal, 'info'); }

/* ---------- Views ---------- */
const VIEW_TITLES = { play: 'Play', learn: 'Learn', options: 'Access settings' };
const VIEW_HEADS = { play: 'playH', learn: 'learnH', options: 'optH' };
function show(v, moveFocus = true) {
  for (const id of ['play', 'learn', 'options']) $('view-' + id).hidden = id !== v;
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

function renderLessons() {
  const box = $('lessons'), nextId = (LESSONS.find(l => !done[l.id]) || {}).id, finished = LESSONS.filter(l => done[l.id]).length;
  $('progress').textContent = finished === LESSONS.length ? `You finished all ${LESSONS.length} lessons.` : `${finished} of ${LESSONS.length} lessons finished.`;
  box.innerHTML = '';
  LESSONS.forEach((l, i) => {
    const d = document.createElement('article'), isNext = l.id === nextId;
    d.className = 'lesson' + (isNext ? ' next' : '');
    const top = document.createElement('div'); top.className = 'top';
    const h = document.createElement('h3'); h.textContent = `${i + 1}. ${l.title}`;
    const badge = document.createElement('span'); badge.className = 'badge' + (done[l.id] ? ' done' : ''); badge.textContent = done[l.id] ? 'Done' : plural(l.steps.length, 'step');
    top.append(h, badge);
    const p = document.createElement('p'); p.textContent = l.intro;
    const b = document.createElement('button');
    b.className = 'btn' + (isNext ? ' primary' : ''); b.type = 'button';
    b.textContent = done[l.id] ? 'Practise again' : isNext ? 'Start here' : 'Start lesson';
    b.setAttribute('aria-label', `${b.textContent}: ${l.title}`);
    b.addEventListener('click', () => startLesson(l.id));
    d.append(top, p, b); box.appendChild(d);
  });
}
function renderFeel() {
  const box = $('feel'); box.innerHTML = '';
  if (!CAN_VIBRATE) $('feelIntro').textContent = 'Select a piece to hear how it moves. This device cannot vibrate from a web page (iPhones do not allow it), but the patterns are shown for when you use one that can.';
  ['p', 'n', 'b', 'r', 'q', 'k'].forEach(t => {
    const i = PIECE_INFO[t], b = document.createElement('button');
    b.type = 'button'; b.className = 'btn';
    b.innerHTML = `<span class="swatch">${pieceSvg(t, 'w')}</span><strong><span>${cap(NAMES[t])}</span><span class="buzz" aria-hidden="true">${i.mark}</span></strong><small>${i.points}. ${i.how}</small>`;
    b.setAttribute('aria-label', `${NAMES[t]}, ${i.points}. ${i.how} Vibration: ${i.buzz}.`);
    b.addEventListener('click', () => {
      announce(`${cap(NAMES[t])}, ${i.points}. ${i.how}${CAN_VIBRATE ? ` Vibration: ${i.buzz}.` : ''}`, 'info', { haptic: PAT[t], forceHaptic: true, forceSpeech: true, short: `${cap(NAMES[t])}: ${i.points}, vibration ${i.buzz}.` });
    });
    box.appendChild(b);
  });
}
const PRESETS = [
  { id: 'reader', label: 'I use a screen reader', detail: 'VoiceOver, TalkBack, NVDA or JAWS reads everything.', set: { speech: false, sound: false, haptics: true, explore: false, brief: false, flash: true, calm: false, contrast: false, letters: false } },
  { id: 'voice', label: 'Speak to me', detail: 'This app reads aloud, with tones that show where you are.', set: { speech: true, sound: true, haptics: true, explore: true, brief: false, flash: true, calm: false, contrast: false, letters: false } },
  { id: 'braille', label: 'I use braille or touch', detail: 'Short messages for braille displays, vibration, no sound.', set: { speech: false, sound: false, haptics: true, explore: true, brief: true, flash: true, calm: false, contrast: false, letters: false } },
  { id: 'deaf', label: 'I am Deaf or hard of hearing', detail: 'Captions and visual alerts, no sound.', set: { speech: false, sound: false, haptics: true, explore: false, brief: false, flash: true, calm: false, contrast: false, letters: false } },
  { id: 'lowvision', label: 'I have low vision', detail: 'High contrast, letters for pieces, larger text.', set: { speech: false, sound: false, haptics: true, explore: false, brief: false, flash: true, calm: false, contrast: true, letters: true, coords: true, textSize: 'large' } },
  { id: 'calm', label: 'I prefer things calm', detail: 'Soft colours, no flashes or tones, more time.', set: { speech: false, sound: false, haptics: false, explore: false, brief: true, flash: false, calm: true, contrast: false, letters: false } }
];
function applyPreset(p) {
  Object.assign(settings, p.set, { onboarded: true }); save();
  renderOpts(); applySettings();
  announce(`Set up: ${p.label}. You can change anything on the Access tab.`, 'success', { forceSpeech: p.id === 'voice' });
}
function renderPresets() {
  const box = $('presets'); box.innerHTML = '';
  PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = p.label;
    const s = document.createElement('small'); s.textContent = p.detail; b.appendChild(s);
    b.addEventListener('click', () => applyPreset(p));
    box.appendChild(b);
  });
}
const OPTS = [
  { k: 'speech', t: 'Speak announcements aloud', d: 'Uses your device\'s own voice. Leave this off if you already use VoiceOver or TalkBack, which read everything for you.', tags: ['Blind', 'Low vision', 'Reading support'] },
  { k: 'rate', type: 'range', t: 'Voice speed', d: 'How fast the voice talks.', tags: ['Blind', 'Processing'] },
  { k: 'sound', t: 'Square tones and alert sounds', d: 'Each rank plays a higher note, from rank 1 low to rank 8 high. Files pan from your left ear (a) to your right ear (h). Squares with a piece sound brighter. Calm mode turns these off.', tags: ['Blind'] },
  { k: 'haptics', t: 'Vibration patterns', d: 'Feel each piece: pawn 1 short, knight 2 short, bishop 3 short, rook 1 long, queen 2 long, king 3 long. Check is a strong double buzz.' + (CAN_VIBRATE ? '' : ' This device cannot vibrate from a web page, so this has no effect here.'), tags: ['Deafblind', 'Blind'] },
  { k: 'explore', t: 'Explore by dragging a finger', d: 'Slide a finger over the board to feel, hear and read each square without picking anything up. Tap to select. The page will not scroll while your finger is on the board. Not needed with VoiceOver or TalkBack, which do this already.', tags: ['Deafblind', 'Blind', 'Low vision'] },
  { k: 'brief', t: 'Short messages', d: 'Keeps spoken and braille messages to the point. Everything in full is still in Captions.', tags: ['Braille', 'Processing'] },
  { k: 'flash', t: 'Visual alerts', d: 'Check and checkmate light up the board edge. The banner at the top changes for every alert, and every sound is written in Captions.', tags: ['Deaf', 'Hard of hearing'] },
  { k: 'contrast', t: 'High contrast', d: 'Yellow and deep blue squares, with stronger borders and text everywhere.', tags: ['Low vision'] },
  { k: 'letters', t: 'Letters instead of piece shapes', d: 'Shows K, Q, R, B, N and P in bold circles. White pieces are white circles, black pieces are black circles.', tags: ['Low vision', 'Learning'] },
  { k: 'coords', t: 'Square names on every square', d: 'Prints e4, f5 and so on in the corner of each square, so you never have to count.', tags: ['Learning', 'Low vision'] },
  { k: 'hints', t: 'Show where a piece can go', d: 'After you pick up a piece, its legal squares get a dot, and captures get a dashed ring.', tags: ['Learning'] },
  { k: 'calm', t: 'Calm mode', d: 'Softer colours, no flashing, no tones, slower voice and a slower computer opponent.', tags: ['Sensory sensitivity', 'Autism', 'ADHD'] },
  { k: 'textSize', type: 'select', t: 'Text size', d: 'Makes all the text in the app larger.', tags: ['Low vision'], choices: [['normal', 'Normal'], ['large', 'Large'], ['xlarge', 'Extra large']] },
  { k: 'theme', type: 'select', t: 'Light or dark', d: 'Device setting follows your phone or computer.', tags: ['Low vision', 'Sensory sensitivity'], choices: [['auto', 'Device setting'], ['light', 'Light'], ['dark', 'Dark']] },
  { k: 'cpu', type: 'select', t: 'Computer strength', d: 'Gentle mostly plays at random. Thinking looks two moves ahead and keeps its pieces safe.', tags: ['Everyone'], choices: [['gentle', 'Gentle'], ['think', 'Thinking']] }
];
function renderOpts() {
  const box = $('opts'); box.innerHTML = '';
  OPTS.forEach(o => {
    const d = document.createElement('div'); d.className = 'opt';
    const id = 'opt-' + o.k; let ctl;
    if (o.type === 'range') ctl = `<input type="range" id="${id}" min="0.6" max="1.6" step="0.1" value="${settings.rate}" aria-describedby="${id}-d" aria-valuetext="${settings.rate} times normal speed">`;
    else if (o.type === 'select') ctl = `<select id="${id}" aria-describedby="${id}-d">${o.choices.map(([v, l]) => `<option value="${v}"${settings[o.k] === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    else ctl = `<span class="switch"><input type="checkbox" role="switch" id="${id}" aria-describedby="${id}-d"${settings[o.k] ? ' checked' : ''}><span></span></span>`;
    d.innerHTML = `<h3><label for="${id}">${o.t}</label></h3>${ctl}<p id="${id}-d">${o.d}</p><ul class="tags" aria-label="Helps with">${o.tags.map(t => `<li class="tag">${t}</li>`).join('')}</ul>`;
    box.appendChild(d);
    const el = $(id);
    el.addEventListener(o.type === 'range' ? 'input' : 'change', () => {
      settings[o.k] = o.type === 'range' ? +el.value : o.type === 'select' ? el.value : el.checked;
      save(); applySettings();
      if (o.type === 'range') el.setAttribute('aria-valuetext', `${el.value} times normal speed`);
      if (o.k === 'haptics' && el.checked) buzz(PAT.n);
      if (o.k === 'sound' && el.checked) tone('e4', true);
      if (o.k === 'speech' && el.checked) say('Speech is on.', true);
      if (o.k === 'rate') say('This is the voice speed.', true);
    });
  });
  const tests = document.createElement('div'); tests.className = 'actions';
  tests.innerHTML = '<button class="btn" type="button" id="tVib">Test vibration</button><button class="btn" type="button" id="tVoice">Test voice</button><button class="btn" type="button" id="tTone">Test tones</button>';
  box.appendChild(tests);
  $('tVib').onclick = () => {
    if (!CAN_VIBRATE) return announce('This device or browser cannot vibrate from a web page.', 'error');
    buzz(PAT.check, true); announce('Vibration sent. You should feel a strong double buzz.', 'info');
  };
  $('tVoice').onclick = () => {
    if (!('speechSynthesis' in window)) return announce('This browser has no voice available.', 'error');
    say('Knight from g1 to f3. Black to move.', true); banner.textContent = 'Voice test: Knight from g1 to f3. Black to move.'; banner.dataset.level = 'info';
  };
  $('tTone').onclick = () => {
    ['a1', 'c3', 'e5', 'h8'].forEach((s, i) => setTimeout(() => tone(s, i % 2, true), i * 260));
    banner.textContent = 'Tone test: a1, c3, e5, h8. The notes climb and move from left to right.'; banner.dataset.level = 'info';
  };
}
function applySettings() {
  document.body.classList.toggle('contrast', settings.contrast);
  document.body.classList.toggle('letters', settings.letters);
  document.body.classList.toggle('calm', settings.calm);
  document.body.classList.toggle('explore', settings.explore);
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
  else if (k === 'Escape') { if (S.selected) { S.selected = null; render(); announce('Piece put back.', 'info'); } return; }
  else {
    const fn = { m: () => listMoves(S.focus), a: () => attackers(S.focus), d: describeBoard, l: lastMove, h: hint, r: () => describeRank(S.focus[1]), f: () => describeFile(S.focus[0]), s: status, n: nextStep }[k.toLowerCase()];
    if (fn) { e.preventDefault(); fn(); }
    return;
  }
  e.preventDefault();
  if (f < 0 || f > 7 || r < 1 || r > 8) { buzz(PAT.edge); return announce('Edge of the board.', 'info'); }
  setFocus(FILES[f] + r, true, true);
});
$('skipBoard').addEventListener('click', e => { e.preventDefault(); show('play', false); cells[S.focus].focus(); });
$('cmdForm').addEventListener('submit', e => { e.preventDefault(); const v = $('cmdInput').value; if (!v.trim()) return; $('cmdInput').value = ''; runCommand(v); });
$('bDescribe').onclick = describeBoard; $('bLast').onclick = lastMove; $('bUndo').onclick = undo;
$('bFlip').onclick = flip;
$('bNew').onclick = requestNewGame;
document.querySelectorAll('input[name=opp]').forEach(r => r.addEventListener('change', async () => {
  const value = r.value;
  applySettings();  // keep the old choice showing until the switch is confirmed
  if (!await confirmReplaceGame('Change opponent?')) return;
  settings.opponent = value; save(); applySettings(); newGame();
}));
$('lcHint').onclick = hint; $('lcRepeat').onclick = repeatGoal;
$('lcExit').onclick = exitLesson; $('lcNext').onclick = nextStep;

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
async function firstRun() {
  const choice = await ask({
    title: 'Welcome. How would you like to play?',
    body: 'Pick the closest match. You can change anything later on the Access tab.',
    options: PRESETS.map(p => ({ label: p.label, detail: p.detail, value: p })).concat({ label: 'Just show me the board', value: 'none' })
  });
  if (choice && choice !== 'none') return applyPreset(choice);
  settings.onboarded = true; save();
  banner.textContent = 'You play White. Tap a piece, or type a move like e4.';
}

const resumed = restoreGame();
buildBoard(); renderLessons(); renderFeel(); renderPresets(); renderOpts(); applySettings();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
if (resumed) {
  const st = gameState();
  banner.textContent = `Welcome back. ${st.text}`;
  logAdd(`Welcome back. Your game was saved. ${describeMove(S.last)} ${st.text}`, 'info');
  maybeCpu();
} else logAdd('Welcome. You play White. Tap a piece, use the arrow keys, or type a move like e4.', 'info');
if (!settings.onboarded) firstRun();
})();
