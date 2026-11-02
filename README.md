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
    js/app.js             Everything else: board, speech, haptics, tones, lessons, computer opponent
    js/vendor/chess.js    Chess rules engine (chess.js 0.10.3, BSD licence)
    sw.js                 Offline cache
    manifest.webmanifest  Lets phones install it as an app

## Where to change things in js/app.js

| What | Look for |
|---|---|
| Lessons (positions, goals) | `const LESSONS` |
| Vibration patterns per piece | `const PAT` |
| Settings and their default values | `const DEFAULTS` and `const OPTS` |
| What the screen reader says on each square | `function render` (the `aria-label`) |
| Typed commands | `function runCommand` |
| Computer opponent | `function cpuPick` |
| Tones (pitch per rank, pan per file) | `function tone` |

## Testing accessibility

- **iPhone:** Settings → Accessibility → VoiceOver. Swipe across the board; double-tap to pick up and place.
- **Android:** Settings → Accessibility → TalkBack. Vibration patterns only work on Android.
- **Computer:** Windows NVDA (free) or Mac VoiceOver (Cmd + F5). Click the board, then use the arrow keys.
