"""End-to-end tests. They drive the real app in Chrome.

    python3 -m venv .venv && .venv/bin/pip install playwright
    .venv/bin/python tests/test_app.py [axe.min.js]

Pass a path to axe-core's axe.min.js to include an automated accessibility audit.
"""
import http.server, json, os, socketserver, sys, threading
from functools import partial
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 5198
URL = f'http://127.0.0.1:{PORT}/index.html'
AXE = sys.argv[1] if len(sys.argv) > 1 else None
results = []


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def check(name, ok, detail=''):
    results.append(ok)
    print(('ok   ' if ok else 'FAIL ') + name + (f'  -> {detail}' if detail and not ok else ''))


def open_page(browser, w=390, h=844, onboarded=True, settings=None, block_sw=True, **ctx):
    c = browser.new_context(viewport={'width': w, 'height': h}, has_touch=w < 500,
                            service_workers='block' if block_sw else 'allow', **ctx)
    s = dict(settings or {})
    s.setdefault('onboarded', onboarded)
    c.add_init_script("if(!localStorage.getItem('tpc-settings'))localStorage.setItem('tpc-settings',%s)" % json.dumps(json.dumps(s)))
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
    p.click(f'#lessons article:nth-child({index + 1}) button')


LESSON_AUDIT = r"""() => {
  const bad = [];
  const inCheck = (fen, side) => { const parts = fen.split(' '); parts[1] = side; parts[3] = '-'; const g = new Chess(); return g.load(parts.join(' ')) && g.in_check(); };
  for (const l of TPC_LESSONS) for (const [i, st] of l.steps.entries()) {
    const id = `${l.id}#${i + 1}`, g = new Chess();
    if (!g.load(st.fen)) { bad.push(id + ' bad fen'); continue; }
    if (inCheck(st.fen, g.turn() === 'w' ? 'b' : 'w')) bad.push(id + ' side not to move is in check');
    if (!st.goal) bad.push(id + ' no goal');
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


def run_all(browser):
    # --- content
    p = open_page(browser)
    check('every lesson position and answer is valid', not p.evaluate(LESSON_AUDIT), p.evaluate(LESSON_AUDIT))
    count = p.evaluate('TPC_LESSONS.length')

    # --- full course, played the way a keyboard or braille user would
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
            ok = p.is_visible('#lcNext') and banner(p) and p.get_attribute('#banner', 'data-level') == 'success'
            if not ok:
                check(f'lesson {i} step {n} passes', False, banner(p))
            p.click('#lcNext')
        if not p.is_visible('#lcNext') or 'complete' not in p.inner_text('#lcEyebrow').lower():
            check(f'lesson {i} completes', False, p.inner_text('#lcEyebrow'))
    check('all lessons complete and are recorded', p.evaluate("Object.keys(JSON.parse(localStorage.getItem('tpc-done'))).length") == count)
    check('course raised no errors', not p.errors, p.errors)
    p.click('#lcNext')  # last lesson's button returns to the list
    check('last lesson returns to the lesson list', p.is_visible('#view-learn'))

    # --- timers cannot leak between game states
    p = open_page(browser)
    cmd(p, 'e4')
    p.click('#bNew')
    p.click('#dlgOptions button:nth-child(2)')
    p.wait_for_timeout(1000)
    check('new game cancels the computer move', p.evaluate("[...document.querySelectorAll('.sq')].filter(c => /white pawn/.test(c.getAttribute('aria-label')) && c.dataset.sq[1] === '2').length") == 8 and 'New game' in banner(p), banner(p))
    p = open_page(browser)
    cmd(p, 'e4')
    start_lesson(p, 1)
    p.wait_for_timeout(1000)
    check('starting a lesson cancels the computer move', 'white rook' in label(p, 'a1') and p.is_visible('#lcGoal') and 'Computer' not in banner(p), banner(p))
    p = open_page(browser)
    start_lesson(p, 0)
    cmd(p, 'e4')
    p.click('#lcExit')
    p.wait_for_timeout(300)
    check('leaving a lesson after a right answer is safe', not p.errors, p.errors)

    # --- lessons
    p = open_page(browser)
    start_lesson(p, 3)
    cmd(p, 'Qxh8')
    check('the king can never be captured in the queen lesson', 'black king' in label(p, 'h7') and 'white queen' in label(p, 'd4'))
    p = open_page(browser)
    start_lesson(p, 1)
    cmd(p, 'a1 a3')
    check('a wrong but legal move goes straight back', 'white rook' in label(p, 'a1') and 'empty' in label(p, 'a3') and p.get_attribute('#banner', 'data-level') == 'error')
    check('the lesson intro is on screen', p.is_visible('#lcIntro') and 'straight lines' in p.inner_text('#lcIntro'))
    p.wait_for_timeout(2200)
    check('nothing advances on a timer', 'step 1 of' in p.inner_text('#lcEyebrow'))
    cmd(p, 'a1 a7')
    p.wait_for_timeout(2200)
    check('a right answer waits for Next', 'step 1 of' in p.inner_text('#lcEyebrow') and p.is_visible('#lcNext'))
    check('focus lands on the lesson text', p.evaluate("document.activeElement.id") == 'lcText')
    p.click('#sq-a7')
    check('board is inert while waiting for Next', 'white rook' in label(p, 'a7') and 'picked up' not in label(p, 'a7'))
    cmd(p, 'next')
    check('typed next advances', 'step 2 of' in p.inner_text('#lcEyebrow'))
    p = open_page(browser)
    p.click('#bFlip')
    start_lesson(p, 0)
    check('lessons start with White at the bottom', p.evaluate("document.querySelector('.sq').dataset.sq") == 'a8')
    p.click('#bFlip')
    p.click('#sq-a1')
    check('directions follow a flipped board', 'to the left' in banner(p) and 'down' in banner(p), banner(p))
    p = open_page(browser)
    start_lesson(p, 0)
    p.click('#lcHint')
    check('find hint gives a direction and marks the square', 'e4 is' in banner(p) and 'hint' in label(p, 'e4'))

    # --- a free game survives a lesson and a reload
    p = open_page(browser, settings={'opponent': 'human'})
    cmd(p, 'e4')
    start_lesson(p, 0)
    p.click('#lcExit')
    check('leaving a lesson goes back to the list', p.is_visible('#view-learn'))
    tab(p, 'play')
    check('the game survives a lesson', 'white pawn' in label(p, 'e4'))
    p.reload()
    check('the game survives a reload', 'white pawn' in label(p, 'e4') and 'Welcome back' in banner(p))

    # --- chess rules through the UI
    p = open_page(browser, settings={'opponent': 'human'})
    for m in ['e4', 'd5', 'exd5', 'Qxd5', 'nc3', 'qe5+']:
        cmd(p, m)
    check('typed moves in any case', 'black queen' in label(p, 'e5') and 'white knight' in label(p, 'c3'), banner(p))
    check('check is announced and marked', p.get_attribute('#banner', 'data-level') == 'alert' and 'in check' in label(p, 'e1'))
    cmd(p, 'moves g8')
    check('asks about a piece off-turn', 'f6' in banner(p) and 'h6' in banner(p), banner(p))
    cmd(p, 'attacks e4')
    check('attackers are listed', 'black queen on e5' in banner(p), banner(p))
    cmd(p, 'attacks e1')
    check('attackers of a king', 'black queen on e5' in banner(p), banner(p))
    cmd(p, 'rank 1')
    check('rank reading', 'a1 white rook' in banner(p), banner(p))
    cmd(p, 'file e')
    check('file reading', 'e8 black king' in banner(p), banner(p))

    # --- promotion
    p = open_page(browser, settings={'opponent': 'human'})
    for m in ['a4', 'b5', 'axb5', 'a6', 'bxa6', 'Bb7', 'axb7', 'Nc6']:
        cmd(p, m)
    p.click('#sq-b7')
    check('promotion target is listed once', banner(p).count('move') >= 1 and p.evaluate("document.getElementById('log').firstChild.textContent").count('a8') == 1, p.evaluate("document.getElementById('log').firstChild.textContent"))
    p.click('#sq-a8')
    check('promotion asks which piece', p.is_visible('#dlg'))
    p.keyboard.press('Escape')
    p.wait_for_timeout(100)
    check('cancelling promotion leaves the pawn', 'white pawn' in label(p, 'b7'))
    cmd(p, 'b7 a8 n')
    check('typed under-promotion', 'white knight' in label(p, 'a8'), label(p, 'a8'))
    cmd(p, 'undo')
    p.click('#sq-b7')
    p.click('#sq-a8')
    p.click('#dlgOptions button[aria-label=Rook]')
    p.wait_for_timeout(100)
    check('tapped promotion to a chosen piece', 'white rook' in label(p, 'a8'), label(p, 'a8'))

    # --- computer
    for strength in ['gentle', 'think']:
        p = open_page(browser, settings={'cpu': strength})
        cmd(p, 'e4')
        check(f'{strength} computer shows it is thinking', 'thinking' in p.inner_text('#turnText'))
        p.wait_for_function("document.getElementById('banner').textContent.startsWith('Computer:')", timeout=8000)
        check(f'{strength} computer replies with Black', 'Black' in banner(p), banner(p))
        cmd(p, 'undo')
        check(f'{strength} undo takes back both moves', 'white pawn' in label(p, 'e2'))
        check(f'{strength} raised no errors', not p.errors, p.errors)

    # --- keyboard
    p = open_page(browser)
    p.click('#sq-e2')
    p.keyboard.press('Escape')
    p.keyboard.press('ArrowUp')
    check('arrow keys move focus', p.evaluate("document.activeElement.dataset.sq") == 'e3')
    log_before = p.evaluate("document.getElementById('log').children.length")
    p.keyboard.press('Control+l')
    p.keyboard.press('Meta+d')
    check('browser shortcuts are left alone', p.evaluate("document.getElementById('log').children.length") == log_before)
    p.keyboard.press('Home')
    check('Home jumps along the rank', p.evaluate("document.activeElement.dataset.sq") == 'a3')
    p.keyboard.press('ArrowLeft')
    check('edge of the board is announced', 'Edge' in banner(p))
    p.keyboard.press('r')
    check('R reads the rank', 'Rank 3' in banner(p))
    for key in ['ArrowDown', 'Enter', 'ArrowUp', 'Enter']:
        p.keyboard.press(key)
    check('keyboard plays a move', 'white pawn' in label(p, 'a3'), banner(p))

    # --- confirmations
    p = open_page(browser)
    cmd(p, 'e4')
    p.wait_for_timeout(900)
    p.click('#bNew')
    check('new game asks first', p.is_visible('#dlg'))
    p.click('#dlgOptions button:nth-child(1)')
    check('keeping the game keeps it', 'white pawn' in label(p, 'e4'))
    p.click('input#oppHuman', force=True)
    check('switching opponent asks first', p.is_visible('#dlg'))
    p.click('#dlgOptions button:nth-child(1)')
    check('declining keeps the old opponent', p.is_checked('#oppCpu') and 'white pawn' in label(p, 'e4'))

    # --- first run and presets
    p = open_page(browser, onboarded=False)
    check('first run asks how you want to play', p.is_visible('#dlg') and p.locator('#dlgOptions button').count() == 7)
    p.click('#dlgOptions button:has-text("low vision")')
    p.wait_for_timeout(100)
    check('preset applies', p.evaluate("document.body.classList.contains('contrast') && document.documentElement.dataset.text === 'large'"))
    p.reload()
    check('first run shows only once', not p.is_visible('#dlg'))

    # --- feedback never hidden
    p = open_page(browser)
    tab(p, 'learn')
    p.click('#feel button >> nth=0')
    check('piece buttons give visible feedback on Learn', p.is_visible('#banner') and 'Pawn' in banner(p), banner(p))
    tab(p, 'options')
    p.click('#tVoice')
    check('tests give visible feedback on Access', p.is_visible('#banner') and 'Voice test' in banner(p))
    tab(p, 'learn')
    check('moving tabs moves focus to the heading', p.evaluate("document.activeElement.id") == 'learnH')

    # --- explore by finger
    p = open_page(browser, settings={'explore': True, 'opponent': 'human'})
    box = p.locator('#sq-e2').bounding_box()
    box2 = p.locator('#sq-e4').bounding_box()
    x, y = box['x'] + 10, box['y'] + 10
    p.evaluate("""([x,y,x2,y2]) => { const b = document.getElementById('board');
      const ev = (t,cx,cy) => b.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerType:'touch',clientX:cx,clientY:cy}));
      document.getElementById('sq-e2').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:x,clientY:y}));
      ev('pointermove',x2,y2); ev('pointerup',x2,y2); }""", [x, y, box2['x'] + 10, box2['y'] + 10])
    check('dragging a finger explores without selecting', 'e4: empty' in p.inner_text('#readout') and 'picked up' not in label(p, 'e2'), p.inner_text('#readout'))

    # --- a lesson keeps the goal and the board on screen together on a laptop
    p = open_page(browser, 1280, 720)
    start_lesson(p, 1)
    b = p.locator('#board').bounding_box()
    g = p.locator('#lcGoal').bounding_box()
    check('lesson goal and whole board are both on screen', b['y'] + b['height'] <= 720 and g['y'] + g['height'] <= 720, f'{b} {g}')

    # --- layout
    for name, w, h in [('phone', 360, 640), ('small phone', 320, 568), ('tablet', 820, 1180), ('laptop', 1280, 720), ('short laptop', 1024, 600), ('landscape phone', 844, 390)]:
        p = open_page(browser, w, h)
        over = p.evaluate("document.documentElement.scrollWidth > innerWidth")
        b = p.locator('#board').bounding_box()
        nav = p.locator('nav.tabs').bounding_box()
        fits = b['y'] + b['height'] <= (nav['y'] if nav['y'] > 100 else h)
        size_ok = b['width'] / 8 >= 33  # WCAG 2.5.8 asks for at least 24
        check(f'{name} {w}x{h}: no sideways scroll', not over)
        check(f'{name}: whole board visible', fits or name in ('phone', 'small phone', 'landscape phone'), f"{b} nav {nav}")
        check(f'{name}: squares big enough', size_ok, b['width'] / 8)
    for size in ['large', 'xlarge']:
        p = open_page(browser, 360, 740, settings={'textSize': size})
        tab(p, 'options')
        check(f'{size} text has no sideways scroll', not p.evaluate("document.documentElement.scrollWidth > innerWidth"))

    # --- offline
    p = open_page(browser, block_sw=False)
    p.evaluate("navigator.serviceWorker.ready.then(() => 1)")
    p.wait_for_function("navigator.serviceWorker.controller !== null", timeout=8000)
    p.wait_for_timeout(300)
    p.context.set_offline(True)
    p.reload()
    check('works offline after the first visit', p.locator('#board .sq').count() == 64 and p.evaluate("document.fonts.check('16px \"Atkinson Hyperlegible\"')"))
    p.context.set_offline(False)
    check('no requests leave the site', p.evaluate("performance.getEntriesByType('resource').every(r => r.name.startsWith(location.origin))"))

    # --- automated accessibility audit
    if AXE:
        themes = [('light', {}), ('dark', {'theme': 'dark'}), ('contrast', {'contrast': True}), ('calm', {'calm': True}), ('calm dark', {'calm': True, 'theme': 'dark'})]
        for name, s in themes:
            p = open_page(browser, 1280, 900, settings=s)
            p.add_script_tag(path=AXE)
            for view in ['play', 'learn', 'options']:
                tab(p, view)
                vs = p.evaluate("axe.run({runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r => r.violations.map(v => v.id + ': ' + v.nodes.slice(0,3).map(n => n.target.join(' ') + ' ' + (n.any[0] ? n.any[0].message : '')).join(' | ')))")
                check(f'axe {name}/{view}', not vs, vs)
            start_lesson(p, 7)
            vs = p.evaluate("axe.run({runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}).then(r => r.violations.map(v => v.id + ': ' + v.nodes.slice(0,3).map(n => n.target.join(' ')).join(' | ')))")
            check(f'axe {name}/lesson', not vs, vs)


def main():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chrome', headless=True)
            run_all(browser)
            browser.close()
    finally:
        srv.shutdown()
    print(f'\n{sum(results)} of {len(results)} checks passed')
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
