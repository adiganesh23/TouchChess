"""End-to-end tests. They drive the real app in Chrome and write what they measured to docs/test-report.md.

    python3 -m venv .venv && .venv/bin/pip install playwright
    .venv/bin/python tests/test_app.py [axe.min.js]

Pass a path to axe-core's axe.min.js to include the automated accessibility audit.
"""
import http.server, json, os, re, socketserver, sys, threading
from functools import partial
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 5198
URL = f'http://127.0.0.1:{PORT}/index.html'
AXE = sys.argv[1] if len(sys.argv) > 1 else None
results = []
report = {}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def check(name, ok, detail=''):
    ok = bool(ok)
    results.append(ok)
    print(('ok   ' if ok else 'FAIL ') + name + (f'  -> {detail}' if detail and not ok else ''))


# Records speech, sound and any use of alert/confirm/prompt, so tests can see what the app tried to do.
STUBS = r"""
window.__spoken = []; window.__cancels = 0; window.__audio = 0; window.__dialogs = [];
const fakeVoices = [{ name: 'Test Voice A', lang: 'en-US', voiceURI: 'test-a', default: true }, { name: 'Test Voice B', lang: 'en-GB', voiceURI: 'test-b', default: false }];
window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.volume = 1; this.voice = null; } };
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
  speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, volume: u.volume, voice: u.voice && u.voice.voiceURI }); },
  cancel() { window.__cancels++; }, getVoices() { return fakeVoices; }, addEventListener() {} } });
window.AudioContext = window.webkitAudioContext = class {
  constructor() { window.__audio++; this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  createOscillator() { return { frequency: {}, connect() {}, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createStereoPanner() { return { pan: {}, connect() {} }; }
  resume() { return Promise.resolve(); } };
for (const k of ['alert', 'confirm', 'prompt']) window[k] = (...a) => { window.__dialogs.push(k); return null; };
"""


def open_page(browser, w=390, h=844, onboarded=True, settings=None, block_sw=True, game=None, session=None, **ctx):
    c = browser.new_context(viewport={'width': w, 'height': h}, has_touch=w < 500,
                            service_workers='block' if block_sw else 'allow', **ctx)
    s = dict(settings or {})
    s.setdefault('onboarded', onboarded)
    c.add_init_script(STUBS)
    c.add_init_script("if(!localStorage.getItem('tpc-settings'))localStorage.setItem('tpc-settings',%s)" % json.dumps(json.dumps(s)))
    if game:
        c.add_init_script("if(!localStorage.getItem('tpc-game'))localStorage.setItem('tpc-game',%s)" % json.dumps(game))
    if session:
        c.add_init_script("sessionStorage.setItem('tpc-speech',%s)" % json.dumps(session))
    p = c.new_page()
    p.errors = []
    p.on('pageerror', lambda e: p.errors.append(str(e)))
    p.goto(URL)
    return p


def cmd(p, text):
    p.fill('#cmdInput', text)
    p.press('#cmdInput', 'Enter')


def banner(p):
    return p.inner_text('#banner')


def label(p, sq):
    return p.get_attribute(f'#sq-{sq}', 'aria-label')


def tab(p, view):
    p.click(f'nav button[data-view={view}]')


def start_lesson(p, index):
    tab(p, 'learn')
    p.click(f'#lessons > li:nth-child({index + 1}) button')


def open_more(p):
    if not p.evaluate("document.getElementById('moreOpts').open"):
        p.click('#moreOpts > summary')


def active(p):
    return p.evaluate("(() => { const a = document.activeElement; return a ? (a.dataset.sq || a.id || a.tagName) : null; })()")


def from_top(p):
    """Put the browser's Tab starting point back at the very top of the page, as on a fresh load."""
    p.evaluate("(() => { const t = document.createElement('span'); t.tabIndex = -1; document.body.prepend(t); t.focus(); t.blur(); t.remove(); window.scrollTo(0, 0); })()")


def tab_to(p, want, limit=60):
    """Press Tab until the focused element matches; proves it is reachable by keyboard."""
    for _ in range(limit):
        p.keyboard.press('Tab')
        a = active(p)
        if (want(a) if callable(want) else a == want):
            return True
    return False


LESSON_AUDIT = r"""() => {
  const bad = [];
  const inCheck = (fen, side) => { const parts = fen.split(' '); parts[1] = side; parts[3] = '-'; const g = new Chess(); return g.load(parts.join(' ')) && g.in_check(); };
  for (const l of [TPC_TOUR, ...TPC_LESSONS]) for (const [i, st] of l.steps.entries()) {
    const id = `${l.id}#${i + 1}`, g = new Chess();
    if (!g.load(st.fen)) { bad.push(id + ' bad fen'); continue; }
    if (inCheck(st.fen, g.turn() === 'w' ? 'b' : 'w')) bad.push(id + ' side not to move is in check');
    if (!st.goal) bad.push(id + ' no goal');
    if (st.type === 'info') continue;
    if (st.type === 'do') { if (!['board', 'last', 'moves', 'repeat'].includes(st.expect)) bad.push(id + ' bad expect'); if (!st.why || !st.hint) bad.push(id + ' no why or hint'); for (const m of st.pre || []) if (!g.move(m)) bad.push(id + ' bad pre ' + m); continue; }
    if (st.type === 'find') { if (!/^[a-h][1-8]$/.test(st.target)) bad.push(id + ' bad target'); if (!st.why) bad.push(id + ' no why'); continue; }
    if (st.type === 'choice') {
      if (st.choices.filter(c => c.ok).length !== 1) bad.push(id + ' needs one right answer');
      if (st.choices.some(c => !c.why)) bad.push(id + ' choice without why');
      if (st.state === 'stalemate' && !g.in_stalemate()) bad.push(id + ' not stalemate');
      if (st.state === 'checkmate' && !g.in_checkmate()) bad.push(id + ' not checkmate');
      continue;
    }
    if (!st.why) bad.push(id + ' no why');
    const m = g.move({ from: st.from, to: st.to, promotion: 'q' });
    if (!m) { bad.push(id + ` ${st.from}-${st.to} illegal`); continue; }
    if (st.type === 'mate' && !g.in_checkmate()) bad.push(id + ' not mate');
    if (st.type === 'check' && !g.in_check()) bad.push(id + ' not check');
  }
  return bad;
}"""

# ---------------------------------------------------------------- lessons and chess rules

def test_lessons(browser):
    p = open_page(browser)
    bad = p.evaluate(LESSON_AUDIT)
    check('every lesson and tutorial position and answer is valid', not bad, bad)
    count = p.evaluate('TPC_LESSONS.length')
    order = p.evaluate('TPC_LESSONS.map(l => l.id)')
    want = ['map', 'rook', 'bishop', 'queen', 'knight', 'pawn', 'king', 'values', 'check', 'mate', 'tactics']
    check('lessons run in order: board, pieces, captures, check, checkmate, tactics', order[:len(want)] == want, order)

    p = open_page(browser)
    steps = p.evaluate("TPC_LESSONS.map(l => l.steps.map(s => ({type: s.type, from: s.from, to: s.to, target: s.target, right: s.choices ? s.choices.findIndex(c => c.ok) : -1})))")
    for i, lesson in enumerate(steps):
        start_lesson(p, i)
        for n, st in enumerate(lesson):
            if st['type'] == 'find':
                cmd(p, st['target'])
            elif st['type'] == 'choice':
                p.click(f"#lcChoices button:nth-child({st['right'] + 1})")
            else:
                cmd(p, f"{st['from']} {st['to']}")
            fb = p.inner_text('#lcFeedback') if p.is_visible('#lcFeedback') else ''
            if not (p.is_visible('#lcNext') and fb.startswith(('Correct', 'Yes'))):
                check(f'lesson {i} step {n} passes with "Correct"', False, fb or banner(p))
            p.click('#lcNext')
        if 'complete' not in p.inner_text('#lcEyebrow').lower():
            check(f'lesson {i} completes', False, p.inner_text('#lcEyebrow'))
    check('all lessons complete and are recorded', p.evaluate("Object.keys(JSON.parse(localStorage.getItem('tpc-done'))).length") == count)
    check('progress is shown in words', p.evaluate("document.getElementById('progress').textContent") == f'You finished all {count} lessons.')
    check('course raised no errors', not p.errors, p.errors)

    p = open_page(browser)
    start_lesson(p, 1)
    cmd(p, 'a1 a3')
    check('a wrong but legal move goes straight back', 'white rook' in label(p, 'a1') and 'empty' in label(p, 'a3') and p.get_attribute('#banner', 'data-level') == 'error')
    check('wrong answers can be retried', not p.is_visible('#lcNext'))
    p.click('#lcHint')
    check('hint is available', 'a1' in banner(p) and 'hint' in label(p, 'a1'))
    p.wait_for_timeout(2200)
    check('nothing advances on a timer', 'step 1 of' in p.inner_text('#lcEyebrow'))
    cmd(p, 'a1 a7')
    check('right answer says Correct and explains why', p.inner_text('#lcFeedback').startswith('Correct.') and 'Rooks' in p.inner_text('#lcFeedback'))
    check('focus lands on the feedback, not the whole card again', active(p) == 'lcFeedback')
    p.click('#sq-a7')
    check('board waits for Next', 'picked up' not in label(p, 'a7'))
    cmd(p, 'next')
    check('typed next advances', 'step 2 of' in p.inner_text('#lcEyebrow'))
    p = open_page(browser)
    start_lesson(p, 7)
    p.click('#lcChoices button:nth-child(2)')
    check('wrong choice says Not quite, not by colour alone', banner(p).startswith('Not quite') and '(not this one)' in p.evaluate("getComputedStyle(document.querySelector('#lcChoices .wrong'), '::after').content"))
    p = open_page(browser)
    start_lesson(p, 3)
    cmd(p, 'Qxh8')
    check('the king can never be captured', 'black king' in label(p, 'h7'))


def test_chess(browser):
    p = open_page(browser, settings={'opponent': 'human'})
    p.click('#sq-e2')
    dots = p.evaluate("[...document.querySelectorAll('.sq')].filter(c => /you can move here/.test(c.getAttribute('aria-label'))).map(c => c.dataset.sq).sort()")
    check('legal moves: pawn on e2 can go to e3 and e4 only', dots == ['e3', 'e4'], dots)
    p.keyboard.press('Escape')
    cmd(p, 'e2 e5')
    check('illegal move is refused and explained', 'cannot go to e5' in banner(p) and 'white pawn' in label(p, 'e2'))
    for m in ['f3', 'e5', 'g4', 'Qh4']:
        cmd(p, m)
    check('checkmate is detected and announced', 'Checkmate. Black wins.' in banner(p), banner(p))
    cmd(p, 'e4')
    check('no moves after checkmate', 'game is over' in banner(p).lower(), banner(p))
    cmd(p, 'undo')
    check('undo takes back the mating move', 'black queen' in label(p, 'd8') and 'Checkmate' not in banner(p))

    p = open_page(browser, settings={'opponent': 'human'})
    for m in ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']:
        cmd(p, m)
    check('castling king side', 'white king' in label(p, 'g1') and 'white rook' in label(p, 'f1') and 'castles' in banner(p))
    for m in ['d6', 'd3', 'Bg4', 'Nc3', 'Qd7', 'Be3', 'O-O-O']:
        cmd(p, m)
    check('castling queen side', 'black king' in label(p, 'c8') and 'black rook' in label(p, 'd8'))

    p = open_page(browser, settings={'opponent': 'human'})
    for m in ['e4', 'a6', 'e5', 'd5', 'exd6']:
        cmd(p, m)
    check('en passant', 'empty' in label(p, 'd5') and 'white pawn' in label(p, 'd6') and 'en passant' in banner(p))

    p = open_page(browser, settings={'opponent': 'human'})
    for m in ['e4', 'd5', 'exd5', 'Qxd5', 'nc3', 'qe5+']:
        cmd(p, m)
    check('check is announced and marked on the king', p.get_attribute('#banner', 'data-level') == 'alert' and 'in check' in label(p, 'e1'))
    cmd(p, 'moves g8')
    check('legal moves of an off-turn piece', 'f6' in banner(p) and 'h6' in banner(p), banner(p))
    cmd(p, 'attacks e1')
    check('attackers are listed', 'black queen on e5' in banner(p), banner(p))

    p = open_page(browser, settings={'opponent': 'human'})
    for m in ['a4', 'b5', 'axb5', 'a6', 'bxa6', 'Bb7', 'axb7', 'Nc6']:
        cmd(p, m)
    p.click('#sq-b7')
    p.click('#sq-a8')
    check('promotion asks which piece, in the page', p.is_visible('#ask') and active(p) == 'ask')
    p.keyboard.press('Escape')
    p.wait_for_timeout(100)
    check('cancelling promotion leaves the pawn', 'white pawn' in label(p, 'b7'))
    cmd(p, 'b7 a8 n')
    check('typed promotion to a knight', 'white knight' in label(p, 'a8'))
    cmd(p, 'undo')
    p.click('#sq-b7')
    p.click('#sq-a8')
    p.click('#askOptions button[aria-label=Rook]')
    p.wait_for_timeout(100)
    check('promotion to a chosen piece', 'white rook' in label(p, 'a8'))

    for strength in ['gentle', 'think']:
        p = open_page(browser, settings={'cpu': strength})
        cmd(p, 'e4')
        p.wait_for_function("document.getElementById('banner').textContent.startsWith('Computer:')", timeout=8000)
        cmd(p, 'undo')
        check(f'{strength} computer replies, and undo takes back both moves', 'white pawn' in label(p, 'e2') and not p.errors, p.errors)

    p = open_page(browser)
    cmd(p, 'e4')
    open_more(p)
    p.click('#bNew')
    p.click('#askOptions button:nth-child(2)')
    p.wait_for_timeout(1000)
    check('new game cancels a pending computer move', 'New game' in banner(p) and 'white pawn' in label(p, 'e2'))
    p = open_page(browser, settings={'opponent': 'human'})
    cmd(p, 'e4')
    start_lesson(p, 0)
    p.click('#lcExit')
    tab(p, 'play')
    check('the game survives a lesson', 'white pawn' in label(p, 'e4'))
    p.reload()
    check('the game survives a reload', 'white pawn' in label(p, 'e4'))


# ---------------------------------------------------------------- tutorial

def test_tutorial(browser):
    p = open_page(browser, onboarded=False)
    check('tutorial opens on the first visit, in the page', p.is_visible('#lessonCard') and 'How to use' in p.inner_text('#lcEyebrow') and not p.is_visible('#ask'))
    check('focus starts on the tutorial text', active(p) == 'lcText')
    check('tutorial offers quick setups and a speech help section', p.locator('#lcChoices .presets button').count() == 6 and p.is_visible('#lcHelp'))
    on_board = lambda a: a and re.fullmatch(r'[a-h][1-8]', a or '')
    ok = tab_to(p, 'lcNext'); p.keyboard.press('Enter')
    check('tutorial 1: Next by keyboard', ok and 'step 2 of 10' in p.inner_text('#lcEyebrow'))

    # Every step, keyboard only
    ok = tab_to(p, on_board)
    p.keyboard.press('ArrowUp'); p.keyboard.press('ArrowUp'); p.wait_for_timeout(100)
    check('tutorial 2: arrow keys to e4 are confirmed', ok and p.is_visible('#lcNext') and 'Correct, that is e4' in banner(p), banner(p))
    check('tutorial keeps focus on the board after a step', active(p) == 'e4')
    p.keyboard.press('n')
    ok = tab_to(p, on_board)
    for k in ['Enter', 'ArrowUp', 'ArrowUp', 'Enter']:
        p.keyboard.press(k)
    check('tutorial 3: pick up and drop is confirmed', ok and p.is_visible('#lcNext') and 'from e2 to e4' in banner(p) and 'Correct' in banner(p), banner(p))
    p.keyboard.press('n')
    p.evaluate("document.getElementById('sq-g1').focus()")
    for k in ['Enter', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'Enter']:
        p.keyboard.press(k)
    check('tutorial 4: a board move is not accepted for the typing step', not p.is_visible('#lcNext') and 'typing' in banner(p) and 'white knight' in label(p, 'g1'), banner(p))
    ok = tab_to(p, 'cmdInput')
    p.keyboard.type('Nf3'); p.keyboard.press('Enter')
    check('tutorial 4: typing a move is confirmed', ok and p.is_visible('#lcNext') and 'Correct' in banner(p), banner(p))
    p.keyboard.type('next'); p.keyboard.press('Enter')
    tab_to(p, on_board); p.keyboard.press('b'); p.wait_for_timeout(100)
    live = p.inner_text('#sr-polite')
    check('tutorial 5: B reads the board, confirmed in the same message', 'White: king e1' in live and 'Correct' in live, live)
    p.keyboard.press('n')
    tab_to(p, on_board); p.keyboard.press('l')
    check('tutorial 6: L reads the last move', 'Last move: Black knight from b8 to c6' in p.evaluate("document.getElementById('log').textContent") and 'Correct' in banner(p), banner(p))
    p.keyboard.press('n')
    tab_to(p, on_board); p.keyboard.press('m')
    check('tutorial 7: M lists legal moves', 'can go to' in p.evaluate("document.getElementById('log').textContent") and 'Correct' in banner(p), banner(p))
    p.keyboard.press('n')
    tab_to(p, on_board); p.keyboard.press('p')
    check('tutorial 8: P repeats the last message', 'Correct' in banner(p) and p.is_visible('#lcNext'), banner(p))
    p.keyboard.press('n')
    ok = tab_to(p, 'ts-speech'); p.keyboard.press('Space')
    check('tutorial 9: app speech can be turned on from the tutorial', ok and p.get_attribute('#bSpeech', 'aria-pressed') == 'true')
    ok = tab_to(p, 'ts-textSize'); p.keyboard.press('l')  # type-ahead picks "Large" without opening the list
    check('tutorial 9: text size by keyboard, confirmed', ok and p.evaluate("document.documentElement.dataset.text") == 'large' and 'Text size is now Large' in banner(p), banner(p))
    ok = tab_to(p, 'ts-contrast'); p.keyboard.press('Space')
    check('tutorial 9: high contrast by keyboard, confirmed', ok and p.evaluate("document.body.classList.contains('contrast')") and 'High contrast is on' in banner(p))
    ok = tab_to(p, 'ts-rate'); p.keyboard.press('ArrowRight')
    check('tutorial 9: voice speed by keyboard', ok and p.evaluate("JSON.parse(localStorage.getItem('tpc-settings')).rate") == 1.1)
    check('tutorial 9: speech help is there', 'speech does not work' in p.inner_text('#lcHelp'))
    tab_to(p, 'lcNext'); p.keyboard.press('Enter')
    check('tutorial 10: last step', 'step 10 of 10' in p.inner_text('#lcEyebrow') and p.inner_text('#lcNext') == 'Finish tutorial')
    tab_to(p, 'lcNext'); p.keyboard.press('Enter')
    check('tutorial finishes back on the game', not p.is_visible('#lessonCard') and p.is_visible('#view-play') and 'Tutorial finished' in banner(p))
    check('tutorial done is remembered', p.evaluate("JSON.parse(localStorage.getItem('tpc-settings')).onboarded") is True)
    check('tutorial run raised no errors', not p.errors, p.errors)

    p = open_page(browser, onboarded=False)
    ok = tab_to(p, 'lcExit')
    p.keyboard.press('Enter')
    check('tutorial can be skipped by keyboard at any step', ok and not p.is_visible('#lessonCard') and p.is_visible('#view-play'))
    p.reload()
    check('tutorial is not forced again', not p.is_visible('#lessonCard'))
    p.click('#bTour')
    check('How to use reopens it', p.is_visible('#lessonCard') and 'step 1 of' in p.inner_text('#lcEyebrow'))
    p.click('#lcExit')
    check('closing it returns focus to How to use', active(p) == 'bTour')
    cmd(p, 'tutorial')
    cmd(p, 'skip')
    check('typed tutorial and skip work', not p.is_visible('#lessonCard'))
    p = open_page(browser, settings={'opponent': 'human'})
    cmd(p, 'e4')
    p.click('#bTour'); p.click('#lcExit')
    check('the game survives the tutorial', 'white pawn' in label(p, 'e4'))


# ---------------------------------------------------------------- speech and announcements

def test_speech(browser):
    # A game is waiting for the computer and sound and voice were on: nothing may play until the person acts.
    game = '1. e4'
    p = open_page(browser, settings={'sound': True}, game=game, session='1')
    p.wait_for_timeout(1500)
    check('computer moved on load', 'Computer' in banner(p) or 'Black' in p.evaluate("document.getElementById('log').textContent"))
    check('no speech before the person acts', p.evaluate('window.__spoken.length') == 0, p.evaluate('window.__spoken'))
    check('no sound before the person acts', p.evaluate('window.__audio') == 0)
    p.click('#sq-e2'); p.wait_for_timeout(120)
    check('speech starts after the person acts', p.evaluate('window.__spoken.length') > 0)

    p = open_page(browser)
    check('app voice starts off', p.get_attribute('#bSpeech', 'aria-pressed') == 'false')
    p.click('#bSpeech'); p.wait_for_timeout(120)
    check('voice on', p.get_attribute('#bSpeech', 'aria-pressed') == 'true' and p.evaluate('window.__spoken.at(-1).text').startswith('App speech is on'))
    p.reload()
    check('voice stays on when the same tab reloads', p.get_attribute('#bSpeech', 'aria-pressed') == 'true')
    p2 = p.context.new_page()
    p2.add_init_script(STUBS)
    p2.goto(URL)
    check('voice is off again in a new visit', p2.get_attribute('#bSpeech', 'aria-pressed') == 'false')
    check('the voice choice is not saved for next time', 'speech' not in p.evaluate("JSON.parse(localStorage.getItem('tpc-settings'))"))

    p = open_page(browser, settings={'voice': 'test-b', 'volume': 0.5, 'rate': 1.3}, session='1')
    p.click('#sq-e2'); p.wait_for_timeout(120)
    cmd(p, 'board'); p.wait_for_timeout(120)
    u = p.evaluate('window.__spoken.at(-1)')
    check('chosen voice, volume and speed are used', u['voice'] == 'test-b' and u['volume'] == 0.5 and u['rate'] == 1.3, u)
    n = p.evaluate('window.__spoken.length')
    cmd(p, 'repeat'); p.wait_for_timeout(120)
    check('repeat says the last message again', p.evaluate('window.__spoken.length') == n + 1 and p.evaluate('window.__spoken.at(-1).text').startswith('White: king e1'))
    c = p.evaluate('window.__cancels'); n = p.evaluate('window.__spoken.length')
    cmd(p, 'stop')
    check('stop cancels speech and says nothing new', p.evaluate('window.__cancels') > c and p.evaluate('window.__spoken.length') == n)
    p.click('#sq-d2'); p.wait_for_timeout(120); p.keyboard.press('Escape'); p.wait_for_timeout(120); p.keyboard.press('p'); p.wait_for_timeout(120)
    check('P key repeats', p.evaluate('window.__spoken.at(-1).text') == 'Piece put back.', p.evaluate('window.__spoken.at(-1).text'))
    p.keyboard.press('x')
    check('X key stops', 'stopped' in banner(p))
    p.click('#bRepeat'); p.wait_for_timeout(120)
    check('Repeat button repeats', p.evaluate('window.__spoken.at(-1).text') == 'Piece put back.')
    check('Stop voice button shows while the voice is on', p.is_visible('#bStop'))
    tab(p, 'options')
    voices = p.evaluate("[...document.querySelectorAll('#opt-voice option')].map(o => o.textContent)")
    check('voice list comes from the device', voices == ['Device default', 'Test Voice A (en-US)', 'Test Voice B (en-GB)'], voices)

    p = open_page(browser)
    p.click('#sq-e2')
    n = p.evaluate('window.__spoken.length')
    cmd(p, 'board')
    p.wait_for_timeout(120)
    check('with the voice off, the screen reader still gets everything', p.evaluate('window.__spoken.length') == n and 'White: king e1' in p.inner_text('#sr-polite'))
    check('there is one live region and it is polite', p.evaluate("[...document.querySelectorAll('[aria-live]')].map(e => e.getAttribute('aria-live'))") == ['polite'])
    cmd(p, 'e4'); p.wait_for_timeout(1200)
    open_more(p); p.click('#bNew')
    check('no alert, confirm or prompt dialogs are used', p.evaluate('window.__dialogs') == [] and not re.search(r'\b(alert|confirm|prompt)\(', open(os.path.join(ROOT, 'js/app.js')).read()))
    check('no mailto links', 'mailto:' not in open(os.path.join(ROOT, 'index.html')).read())
    check('no dialog element or modal is used', p.evaluate("document.querySelectorAll('dialog,[aria-modal]').length") == 0 and p.is_visible('#ask'))

    # Never the same thing twice: count what reaches the live region for one action
    p = open_page(browser)
    p.evaluate("window.__live = []; new MutationObserver(() => { const t = document.getElementById('sr-polite').textContent; if (t) window.__live.push(t); }).observe(document.getElementById('sr-polite'), { childList: true, characterData: true, subtree: true })")
    cmd(p, 'board'); p.wait_for_timeout(150)
    check('one action, one announcement', p.evaluate('window.__live.length') == 1, p.evaluate('window.__live'))
    p.evaluate('window.__live = []')
    start_lesson(p, 1); p.wait_for_timeout(150)
    check('a lesson step is read by focus, not also by the live region', p.evaluate('window.__live.length') == 0 and active(p) == 'lcText', p.evaluate('window.__live'))
    cmd(p, 'a1 a7'); p.wait_for_timeout(150)
    check('a right answer is read once', p.evaluate('window.__live.length') == 0 and active(p) == 'lcFeedback', p.evaluate('window.__live'))
    p.evaluate('window.__live = []')
    p.evaluate("document.getElementById('sq-a7').focus()")
    for k in ['ArrowDown', 'ArrowDown', 'ArrowDown']:
        p.keyboard.press(k)
    p.wait_for_timeout(150)
    check('moving around the board adds nothing to the live region (the screen reader reads the square)', p.evaluate('window.__live.length') == 0, p.evaluate('window.__live'))
    p = open_page(browser, onboarded=False)
    p.evaluate("window.__live = []; new MutationObserver(() => { const t = document.getElementById('sr-polite').textContent; if (t) window.__live.push(t); }).observe(document.getElementById('sr-polite'), { childList: true, characterData: true, subtree: true })")
    for _ in range(4):
        p.click('#lcNext') if p.is_visible('#lcNext') else None
        cmd(p, ['', 'e4', 'e2 e4', 'Nf3'][_]) if _ else None
    cmd(p, 'next')
    p.evaluate("window.__live = []")
    p.evaluate("document.getElementById('sq-f1').focus()")
    p.keyboard.press('b')
    p.wait_for_timeout(150)
    live = p.evaluate('window.__live')
    check('tutorial confirmation is part of the same announcement', len(live) == 1 and 'White: king e1' in live[0] and 'Correct' in live[0], live)


# ---------------------------------------------------------------- keyboard, focus, structure

FOCUS_DESC = """() => { const a = document.activeElement; if (!a || a === document.body) return null;
  const cs = getComputedStyle(a);
  const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow && cs.boxShadow !== 'none')
    || (a.matches('input[type=radio],input[type=checkbox]') && getComputedStyle(a.nextElementSibling).outlineStyle !== 'none');
  const name = a.getAttribute('aria-label') || (a.labels && a.labels[0] && a.labels[0].textContent.trim()) || a.textContent.trim().slice(0, 40) || a.id;
  return { id: a.id || a.dataset.sq || '', tag: a.tagName.toLowerCase(), role: a.getAttribute('role') || '', name: name.replace(/\\s+/g, ' '), visible }; }"""


def walk(p, limit=90):
    seen = []
    for _ in range(limit):
        p.keyboard.press('Tab')
        d = p.evaluate(FOCUS_DESC)
        if d is None:
            continue
        if seen and d['id'] and d['id'] == seen[0]['id'] and d['name'] == seen[0]['name']:
            return seen, True
        seen.append(d)
    return seen, False


def test_keyboard(browser):
    orders = {}
    for view in ['play', 'learn', 'options']:
        p = open_page(browser, 1280, 900)
        if view != 'play':
            tab(p, view)
        from_top(p)
        order, cycled = walk(p, 160)
        orders[view] = order
        invisible = [o for o in order if not o['visible']]
        check(f'{view}: Tab goes all the way round with no trap', cycled, len(order))
        check(f'{view}: every focused control shows a focus indicator', not invisible, invisible[:5])
        check(f'{view}: skip links come first', order[0]['name'] == 'Skip to main content' and order[1]['name'] == 'Skip to the chessboard', order[:2])
        board_stops = [o for o in order if o['role'] == 'gridcell']
        check(f'{view}: the board is a single Tab stop', len(board_stops) == (1 if view == 'play' else 0), len(board_stops))
    report['focus'] = orders

    # WCAG 2.4.11: the sticky message bar and the bottom tabs never hide the focused control.
    for view in ['play', 'learn', 'options', 'tutorial']:
        p = open_page(browser, 390, 844)
        if view == 'tutorial':
            p.click('#bTour')
        elif view != 'play':
            tab(p, view)
        from_top(p)
        hidden = []
        for _ in range(70):
            p.keyboard.press('Tab')
            r = p.evaluate("""() => { const a = document.activeElement; if (!a || a === document.body || a.closest('.skips')) return null;
              const b = a.getBoundingClientRect(), top = Math.max(b.top, 0) + 4, bot = Math.min(b.bottom, innerHeight) - 4;
              const pts = [0, .25, .5, .75, 1].map(f => [b.left + Math.min(b.width / 2, 24), top + (bot - top) * f]);
              const seen = pts.some(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (a === e || a.contains(e) || e.contains(a)); });
              return seen ? null : (a.id || a.dataset.sq || a.textContent.trim().slice(0, 25)); }""")
            if r:
                hidden.append(r)
        check(f'phone / {view}: focused controls are never hidden by the message bar or tabs', not hidden, hidden[:6])

    p = open_page(browser, 1280, 900)
    p.keyboard.press('Tab'); p.keyboard.press('Enter')
    check('skip to main content works', active(p) == 'main')
    from_top(p)
    p.keyboard.press('Tab'); p.keyboard.press('Tab'); p.keyboard.press('Enter')
    check('skip to the board works', re.fullmatch(r'[a-h][1-8]', active(p) or ''))
    p.keyboard.press('Escape'); p.keyboard.press('ArrowUp')
    check('arrow keys move focus on the board', active(p) == 'e3')
    p.keyboard.press('Home')
    check('Home jumps along the rank', active(p) == 'a3')
    p.keyboard.press('ArrowLeft')
    check('edge of the board is announced', 'Edge' in banner(p))
    n = p.evaluate("document.getElementById('log').children.length")
    p.keyboard.press('Control+l'); p.keyboard.press('Meta+b')
    check('browser shortcuts are left alone', p.evaluate("document.getElementById('log').children.length") == n)
    for key in ['ArrowDown', 'Enter', 'ArrowUp', 'Enter']:
        p.keyboard.press(key)
    check('keyboard plays a move', 'white pawn' in label(p, 'a3'))
    p.wait_for_timeout(900)
    p.keyboard.press('Shift+Tab')
    check('Shift+Tab leaves the board backwards', not re.fullmatch(r'[a-h][1-8]', active(p) or ''))
    for k in ['b', 'l', 'm', 'a', 'r', 'f', 's']:
        p.evaluate("document.getElementById('sq-e2').focus()")
        before = p.evaluate("document.getElementById('log').children.length")
        p.keyboard.press(k)
        if p.evaluate("document.getElementById('log').children.length") <= before:
            check(f'shortcut {k} works', False)
    # Keyboard-only: More options, history, confirmation dialog
    ok = tab_to(p, lambda a: p.evaluate("document.activeElement.parentElement.id") == 'moreOpts')
    p.keyboard.press('Enter')
    check('Game options opens by keyboard', ok and p.evaluate("document.getElementById('moreOpts').open"))
    tab_to(p, 'bNew'); p.keyboard.press('Enter')
    check('confirmation appears in the page with focus on it', p.is_visible('#ask') and active(p) == 'ask')
    p.keyboard.press('Tab')
    check('Tab moves to its first button', active(p) == 'askOptions' or p.evaluate("document.getElementById('askOptions').contains(document.activeElement)"))
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    check('Escape closes it and returns focus', not p.is_visible('#ask') and active(p) == 'bNew' and 'white pawn' in label(p, 'a3'))
    tab_to(p, 'bNew'); p.keyboard.press('Enter')
    for _ in range(4):
        p.keyboard.press('Tab')
    check('the confirmation never traps focus', not p.evaluate("document.getElementById('ask').contains(document.activeElement)"))
    p.evaluate("document.getElementById('askOptions').firstChild.focus()"); p.keyboard.press('Enter')
    tab_to(p, lambda a: a in ('oppCpu', 'oppHuman'))
    p.keyboard.press('ArrowRight'); p.wait_for_timeout(100)
    check('changing opponent mid-game asks first', p.is_visible('#ask'))
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    check('declining keeps the opponent', p.is_checked('#oppCpu'))
    ok = tab_to(p, 'log')
    check('captions are reachable by keyboard', ok)
    ok = tab_to(p, lambda a: p.evaluate("document.activeElement.dataset.view") == 'options')
    p.keyboard.press('Enter')
    check('tabs work by keyboard and move focus to the heading', ok and active(p) == 'optH')
    ok = tab_to(p, 'opt-contrast'); p.keyboard.press('Space')
    check('settings work by keyboard', ok and p.evaluate("document.body.classList.contains('contrast')"))
    ok = tab_to(p, lambda a: p.evaluate("document.activeElement.textContent").startswith('I have low vision'))
    p.keyboard.press('Enter')
    check('quick setups work by keyboard', ok and p.evaluate("document.documentElement.dataset.text") == 'large')
    check('keyboard run raised no errors', not p.errors, p.errors)


def test_structure(browser):
    p = open_page(browser, 1280, 900)
    snaps = {}
    for view in ['play', 'learn', 'options']:
        tab(p, view)
        snaps[view] = p.locator('body').aria_snapshot()
    start_lesson(p, 1)
    snaps['lesson'] = p.locator('body').aria_snapshot()
    report['aria'] = snaps
    s = snaps['play']
    check('landmarks: banner, main and navigation', all(x in s for x in ['- banner:', '- main:', '- navigation "Sections":']), s[:300])
    check('one h1, then h2 for each view', p.evaluate("document.querySelectorAll('h1').length") == 1 and 'heading "Play" [level=2]' in s and 'heading "Learn" [level=2]' in snaps['learn'] and 'heading "Access settings" [level=2]' in snaps['options'])
    heads = p.evaluate("""() => { const bad = []; let prev = 1;
      for (const h of document.querySelectorAll('h1,h2,h3,h4')) { if (h.closest('[hidden]')) continue; const l = +h.tagName[1]; if (l > prev + 1) bad.push(h.textContent); prev = l; } return bad; }""")
    check('headings do not skip levels', not heads, heads)
    check('board is a grid of rows and cells', 'grid "Chessboard' in s and '- gridcell "a8, black rook"' in s and '- gridcell "e2, white pawn"' in s)
    check('square names and contents', 'gridcell "g1, white knight"' in s)
    hs = p.locator('header.top').aria_snapshot()
    check('toggle buttons expose their state', 'button "Speech"' in hs and '[pressed]' not in hs, hs)
    p.click('#bSpeech')
    check('pressed state updates, and the name stays the same', 'button "Speech" [pressed]' in p.locator('header.top').aria_snapshot(), p.locator('header.top').aria_snapshot())
    check('message bar is a labelled region', '- region "Messages"' in p.locator('body').aria_snapshot())
    content = p.evaluate("""() => [...document.body.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() && !e.closest('header,main,nav,section[aria-label],[aria-hidden=true],.sr,script,style,.skip')).map(e => e.textContent.trim().slice(0,30))""")
    check('all visible content is inside a landmark', not content, content[:5])


# ---------------------------------------------------------------- zoom, reflow, spacing, targets

SPACING = "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}"
CLIPPED = """() => [...document.querySelectorAll('body *')].filter(e => { if (e.closest('[hidden],.sr,.board,details:not([open]) > :not(summary)')) return false;
  const cs = getComputedStyle(e); if (!['hidden','clip'].includes(cs.overflowX) && !['hidden','clip'].includes(cs.overflowY)) return false;
  if (!e.textContent.trim() || e.getClientRects().length === 0) return false;
  return e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2; }).map(e => e.id || e.className || e.tagName)"""
TARGETS = """() => [...document.querySelectorAll('button,a[href],input,select,summary,[role=gridcell],[tabindex="0"]')].filter(e => {
  if (e.closest('[hidden],details:not([open]) > :not(summary)') || e.classList.contains('skip')) return false;
  const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
  if (e.matches('ol.log,.table-scroll')) return false;
  return r.width < 43.5 || r.height < 43.5; }).map(e => `${e.id || e.dataset.sq || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)"""


def overflow(p):
    return p.evaluate("document.documentElement.scrollWidth > innerWidth + 1")


def test_zoom(browser):
    rows = []
    # 200% and 400% zoom on a 1280x1024 screen lay out like a 640x512 and a 320x256 window.
    sizes = [('200% zoom (1280x1024)', 640, 512), ('400% zoom (1280x1024)', 320, 256), ('400 px wide phone', 400, 800),
             ('360 px phone', 360, 760), ('390 px phone', 390, 844), ('laptop', 1280, 720), ('short laptop', 1024, 600),
             ('tablet', 820, 1180), ('phone on its side', 844, 390)]
    for name, w, h in sizes:
        for view in ['play', 'learn', 'options', 'lesson', 'tutorial']:
            p = open_page(browser, w, h)
            if view == 'lesson':
                start_lesson(p, 7)
            elif view == 'tutorial':
                p.click('#bTour')
            elif view != 'play':
                tab(p, view)
            sideways = overflow(p)
            p.add_style_tag(content=SPACING)
            p.wait_for_timeout(50)
            spaced = overflow(p)
            clipped = p.evaluate(CLIPPED)
            small = p.evaluate(TARGETS)
            sq = p.locator('#sq-a1').bounding_box()
            board_scrolls = p.evaluate("(() => { const s = document.querySelector('.board-scroll'); return s.scrollWidth > s.clientWidth + 1; })()")
            rows.append((name, view, sideways, spaced, clipped, small, round(sq['width']) if sq else None, board_scrolls))
            check(f'{name} / {view}: no sideways page scroll', not sideways)
            check(f'{name} / {view}: text spacing override does not break layout', not spaced and not clipped, clipped)
            check(f'{name} / {view}: every target at least 44x44', not small, small)
    report['zoom'] = rows
    for size in ['large', 'xlarge']:
        for view in ['play', 'options']:
            p = open_page(browser, 360, 740, settings={'textSize': size})
            if view != 'play':
                tab(p, view)
            check(f'{size} text / {view}: no sideways scroll', not overflow(p))
    p = open_page(browser, 1280, 720)
    start_lesson(p, 1)
    b = p.locator('#board').bounding_box(); g = p.locator('#lcGoal').bounding_box()
    check('laptop: lesson goal and whole board on screen together', b['y'] + b['height'] <= 720 and g['y'] + g['height'] <= 720)


# ---------------------------------------------------------------- contrast

CONTRAST = r"""(pairs) => {
  const st = getComputedStyle(document.body);
  const val = v => v.startsWith('#') ? v : st.getPropertyValue(v).trim();
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  const lum = c => { const [r, g, b] = hex(c).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  return pairs.map(([what, f, b, min]) => ({ what, fg: val(f), bg: val(b), min, ratio: Math.round(ratio(val(f), val(b)) * 100) / 100 }));
}"""
PAIRS = [
    ('Body text on page', '--fg', '--bg', 4.5), ('Body text on cards', '--fg', '--surface', 4.5),
    ('Secondary text on page', '--muted', '--bg', 4.5), ('Secondary text on cards', '--muted', '--surface', 4.5),
    ('Primary button text', '--accent-fg', '--accent', 4.5), ('Alert banner text', '--alert-fg', '--alert-bg', 4.5),
    ('Success banner text', '--ok-fg', '--ok-bg', 4.5), ('Correct feedback text', '--ok', '--surface', 4.5),
    ('Error banner border', '--warn', '--surface', 3), ('Square name on light square', '--sq-light-fg', '--sq-light', 4.5),
    ('Square name on dark square', '--sq-dark-fg', '--sq-dark', 4.5), ('Rank and file labels', '--frame-fg', '--frame', 4.5),
    ('Button and input borders on cards', '--line', '--surface', 3), ('Input border on page', '--line', '--bg', 3),
    ('Selected and primary controls on cards', '--accent', '--surface', 3), ('Focus outline on page', '--fg', '--bg', 3),
    ('Focus outline on cards', '--fg', '--surface', 3), ('Black edge of white pieces on light square', '#000000', '--sq-light', 3),
    ('White edge of black pieces on dark square', '#FFFFFF', '--sq-dark', 3), ('Light square against dark square', '--sq-light', '--sq-dark', 3),
    ('Move dot ring on dark square', '#FFFFFF', '--sq-dark', 3), ('Move dot ring on light square', '#000000', '--sq-light', 3),
    ('Board edge (outline) against page', '--line', '--bg', 3),
]
THEMES = [('Light', {}, 'light'), ('Dark', {}, 'dark'), ('High contrast (light)', {'contrast': True}, 'light'),
          ('High contrast (dark)', {'contrast': True}, 'dark'), ('Calm (light)', {'calm': True}, 'light'), ('Calm (dark)', {'calm': True}, 'dark')]


def test_contrast(browser):
    tables = {}
    for name, s, scheme in THEMES:
        p = open_page(browser, 1280, 900, settings=s, color_scheme=scheme)
        rows = p.evaluate(CONTRAST, [list(x) for x in PAIRS])
        tables[name] = rows
        bad = [r for r in rows if r['ratio'] < r['min']]
        check(f'contrast {name}: every pair passes', not bad, bad)
    report['contrast'] = tables


# ---------------------------------------------------------------- axe

STATES = {
    'Play': lambda p: None,
    'Play, piece picked up': lambda p: p.click('#sq-g1'),
    'Play, game options open': lambda p: open_more(p),
    'Play, check': lambda p: [cmd(p, m) for m in ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qe5+']],
    'Confirmation': lambda p: (cmd(p, 'e4'), p.wait_for_timeout(900), open_more(p), p.click('#bNew')),
    'Promotion choice': lambda p: ([cmd(p, m) for m in ['a4', 'b5', 'axb5', 'a6', 'bxa6', 'Bb7', 'axb7', 'Nc6']], p.click('#sq-b7'), p.click('#sq-a8')),
    'Lesson, find a square': lambda p: start_lesson(p, 0),
    'Lesson, wrong move': lambda p: (start_lesson(p, 1), cmd(p, 'a1 a3')),
    'Lesson, correct': lambda p: (start_lesson(p, 1), cmd(p, 'a1 a7')),
    'Lesson, question': lambda p: (start_lesson(p, 7), p.click('#lcChoices button:nth-child(2)')),
    'Lesson complete': lambda p: (start_lesson(p, 4), cmd(p, 'b1 a3'), p.click('#lcNext'), cmd(p, 'e4 f6'), p.click('#lcNext')),
    'Tutorial, first step': lambda p: p.click('#bTour'),
    'Tutorial, settings and speech help': lambda p: (p.click('#bTour'), jump_to_step(p, 8), p.click('#lcHelp summary')),
    'Learn': lambda p: tab(p, 'learn'),
    'Access': lambda p: (tab(p, 'options'), p.click('#speechHelp summary')),
}


def jump_to_step(p, n):
    # Walk the tutorial with its own actions until step n (0-based).
    acts = [lambda: None, lambda: p.click('#sq-e4'), lambda: (p.click('#sq-e2'), p.click('#sq-e4')),
            lambda: cmd(p, 'Nf3'), lambda: cmd(p, 'board'), lambda: cmd(p, 'last'), lambda: cmd(p, 'moves f1'), lambda: cmd(p, 'again')]
    for i in range(n):
        acts[i]()
        p.click('#lcNext')


def test_axe(browser):
    found = {}
    for theme, s, scheme in THEMES:
        for state, setup in STATES.items():
            p = open_page(browser, 1280, 900, settings=s, color_scheme=scheme)
            setup(p)
            p.wait_for_timeout(80)
            p.add_script_tag(path=AXE)
            vs = p.evaluate("""axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']})
              .then(r => r.violations.map(v => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' '))})))""")
            found[f'{theme} / {state}'] = vs
            check(f'axe {theme} / {state}', not vs, vs)
    # Phone width as well, in the default theme
    for state in ['Play', 'Tutorial, first step', 'Access']:
        p = open_page(browser, 390, 844)
        STATES[state](p)
        p.add_script_tag(path=AXE)
        vs = p.evaluate("axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r => r.violations.map(v => ({id: v.id, nodes: v.nodes.slice(0,3).map(n => n.target.join(' '))})))")
        found[f'Phone / {state}'] = vs
        check(f'axe phone / {state}', not vs, vs)
    report['axe'] = found


# ---------------------------------------------------------------- offline

def test_offline(browser):
    p = open_page(browser, block_sw=False)
    p.wait_for_function("navigator.serviceWorker.controller !== null", timeout=8000)
    p.wait_for_timeout(300)
    p.context.set_offline(True)
    p.reload()
    check('works offline after the first visit', p.locator('#board .sq').count() == 64)
    p.context.set_offline(False)
    check('no requests leave the site', p.evaluate("performance.getEntriesByType('resource').every(r => r.name.startsWith(location.origin))"))


# ---------------------------------------------------------------- report

def write_report():
    out = ['# Test report', '', 'Written by `tests/test_app.py`. Run it again after any change.', '',
           f'**{sum(results)} of {len(results)} checks passed.**', '']
    if 'axe' in report:
        total = sum(len(v) for v in report['axe'].values())
        out += ['## axe-core', '', f'{len(report["axe"])} page states checked against WCAG 2.0, 2.1 and 2.2 A and AA rules plus axe best practices. Violations found: **{total}**.', '']
        for k, v in report['axe'].items():
            if v:
                out.append(f'- {k}: ' + '; '.join(f"{x['id']} ({', '.join(x['nodes'])})" for x in v))
        out.append('')
    if 'contrast' in report:
        out += ['## Contrast', '', 'Ratios measured from the colours the page actually uses. Text needs 4.5:1, borders, controls and the board need 3:1.', '']
        for theme, rows in report['contrast'].items():
            out += [f'### {theme}', '', '| What | Colours | Ratio | Needs | Result |', '|---|---|---|---|---|']
            out += [f"| {r['what']} | `{r['fg']}` on `{r['bg']}` | {r['ratio']:.2f}:1 | {r['min']}:1 | {'Pass' if r['ratio'] >= r['min'] else 'FAIL'} |" for r in rows]
            out.append('')
    if 'zoom' in report:
        out += ['## Zoom, reflow, text spacing and target size', '',
                '200% and 400% zoom are tested as the window sizes they produce on a 1280x1024 screen (640x512 and 320x256), which is how WCAG 1.4.10 defines reflow.', '',
                '| Size | View | Page scrolls sideways | Breaks with text spacing | Targets under 44px | Board square | Board scrolls sideways |', '|---|---|---|---|---|---|---|']
        for name, view, side, spaced, clipped, small, sq, bs in report['zoom']:
            out.append(f"| {name} | {view} | {'yes' if side else 'no'} | {'yes: ' + ', '.join(clipped) if (spaced or clipped) else 'no'} | {', '.join(small) or 'none'} | {f'{sq}px' if sq else 'no board on this view'} | {'yes' if bs else 'no'} |")
        out.append('')
    if 'focus' in report:
        out += ['## Keyboard focus order', '']
        for view, order in report['focus'].items():
            out += [f'### {view}', '']
            out += [f"{i + 1}. {o['name']}" + (f" ({o['role']})" if o['role'] else '') for i, o in enumerate(order)]
            out.append('')
    if 'aria' in report:
        out += ['## Accessibility tree', '', 'As Chrome exposes it to screen readers (Playwright ARIA snapshot). The board rows are cut to the first two.', '']
        for view, snap in report['aria'].items():
            lines, rows = [], 0
            for ln in snap.split('\n'):
                if ln.strip().startswith('- row'):
                    rows += 1
                if rows > 2 and ('gridcell' in ln or ln.strip().startswith('- row')):
                    continue
                lines.append(ln)
            out += [f'### {view}', '', '```yaml', *lines, '```', '']
    os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
    with open(os.path.join(ROOT, 'docs', 'test-report.md'), 'w') as f:
        f.write('\n'.join(out) + '\n')


def main():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    only = os.environ.get('ONLY')
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chrome', headless=True)
            for t in [test_lessons, test_chess, test_tutorial, test_speech, test_keyboard, test_structure, test_zoom, test_contrast, test_offline] + ([test_axe] if AXE else []):
                if only and only not in t.__name__:
                    continue
                print(f'\n== {t.__name__[5:]}')
                t(browser)
            browser.close()
    finally:
        srv.shutdown()
    if not only:
        write_report()
    print(f'\n{sum(results)} of {len(results)} checks passed')
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
