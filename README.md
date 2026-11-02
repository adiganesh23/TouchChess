# TouchChess

**Touchpoint Chess** — 
Accessible chess for blind, deaf, deafblind and sensory-sensitive learners.
Speech, vibration patterns, spatial tones, captions, high contrast and guided lessons.

## Open in VS Code

1. Clone this repo and open the folder in VS Code:
   **Source Control → Clone Repository**, paste `https://github.com/adiganesh23/TouchChess`,
   then open it (or run `git clone https://github.com/adiganesh23/TouchChess.git` and **File → Open Folder…**).
2. Accept the prompt to install the recommended extensions:
   - **Live Server** – runs the app and reloads it when you save.
   - **axe Accessibility Linter** – flags accessibility problems in the HTML as you type.
3. Right-click `index.html` → **Open with Live Server**.
   The app opens at http://localhost:5173.

No Live Server? Run this in the VS Code terminal instead (needs Node.js):

    npm start

## Try it on your phone

1. Connect your phone and computer to the same Wi-Fi.
2. Find your computer's local IP address (Windows: `ipconfig`, Mac: System Settings → Wi-Fi → Details).
3. On the phone, open `http://<that-ip>:5173`.
4. To install it like an app: Android Chrome → menu → **Add to Home screen**;
   iPhone Safari → Share → **Add to Home Screen**.
   (Installing and offline mode need HTTPS or localhost, so they work fully once it is hosted,
   for example on GitHub Pages or Netlify.)

## Project layout

    index.html            Page structure and all labelled controls
    css/styles.css        Colours, board, high-contrast and calm themes
    js/app.js             Board, speech, haptics, tones, commands, computer opponent
    js/lessons.js         The course: every lesson, position and answer
    js/vendor/chess.js    Chess rules engine (chess.js 0.10.3, BSD licence)
    fonts/                Atkinson Hyperlegible, self-hosted so it works offline (OFL licence)
    sw.js                 Offline cache
    manifest.webmanifest  Lets phones install it as an app
    tests/test_app.py     End-to-end tests that drive the app in Chrome

## Where to change things

| What | Look for |
|---|---|
| Lessons (positions, goals, explanations) | `js/lessons.js`; the step types are explained at the top |
| Piece drawings | `const PIECE_ART` in `js/app.js` |
| Vibration patterns per piece | `const PAT` in `js/app.js` |
| What each piece does, its points and pattern | `const PIECE_INFO` in `js/app.js` |
| Quick setups on the welcome screen | `const PRESETS` in `js/app.js` |
| Settings and their default values | `const DEFAULTS` and `const OPTS` in `js/app.js` |
| What the screen reader says on each square | `function render` (the `aria-label`) |
| Typed commands | `function runCommand` |
| Computer opponent | `function cpuPick` |
| Tones (pitch per rank, pan per file) | `function tone` |

If you change a cached file list, or add a file, update `FILES` in `sw.js`.

## Running the tests

Needs Python and Google Chrome:

    python3 -m venv .venv
    .venv/bin/pip install playwright
    .venv/bin/python tests/test_app.py

To add an automated accessibility audit, download
[axe-core's `axe.min.js`](https://cdn.jsdelivr.net/npm/axe-core/axe.min.js) and pass its path as an argument.

Automated checks cannot tell you whether the app is pleasant to use with a screen reader or a braille
display. Test with real assistive technology, and ideally with the people it is for:

- **iPhone:** Settings → Accessibility → VoiceOver. Swipe across the board; double-tap to pick up and place.
  iPhones do not allow vibration from web apps.
- **Android:** Settings → Accessibility → TalkBack. Vibration patterns only work on Android.
- **Computer:** Windows NVDA (free) or Mac VoiceOver (Cmd + F5). Move to the board, then use the arrow keys.
