# What changed: accessibility, tutorial and lessons update

November 2026. Every feature that worked before still works: the board, typed moves, the computer opponent, lessons, captions, vibration, tones, explore-by-finger, quick setups, offline mode and saved games and progress. Saved games, lesson progress and settings carry over.

## New

- **"How to use" tutorial.** It has ten steps on the real board, and you do each one yourself:
  - move around and find e4
  - pick up a piece and drop it
  - type a move
  - hear the board (B), the last move (L) and the legal moves (M)
  - repeat a message (P)
  - change speech, text size and contrast

  It opens on your first visit and comes back from the **How to use** button or by typing `tutorial`. You can skip it at any step. It uses a separate practice board, so your own game is untouched. It includes a short "If the app's speech does not work" guide.
- **Speech controls.** A **Speech** on/off button sits at the top. The Access tab adds voice choice and volume next to speed. **Repeat** (P, or type `again`) says the last message again, and **Stop** (X, the Stop button, or Esc on the board) stops talking. App speech now starts **off at every visit**, and no sound of any kind plays before you press a key or tap.
- **Simple tactics lesson**, after checkmate: a hanging piece, a fork, a pin, a skewer, then a quick question. The glossary adds hanging piece, fork and skewer.
- **Clearer feedback.** Every right answer starts with "Correct.", and every wrong one with "Not quite.". Right and wrong choices also say so in words, not just colour. The Learn tab shows progress as words and a progress bar, and marks the next lesson "Up next".
- **Largest text size**, a fourth step after Extra large.
- **Documents:** [ACCESSIBILITY.md](ACCESSIBILITY.md), [screen-reader-test-checklist.md](screen-reader-test-checklist.md), and a test report written on every test run, [test-report.md](test-report.md).

## Changed

- **Questions are part of the page, not a pop-up.** Starting a new game, changing opponent and choosing a promotion piece now ask in a panel beside the board. Focus moves to the panel, Escape cancels, and focus returns to where you were. You are never trapped in it.
- **The first-visit setup question is now part of the tutorial.** Its first step offers the same quick setups, and they are still on the Access tab.
- **One polite live region.** Check and checkmate used to interrupt the screen reader. Now everything is polite, and things said at the same moment are joined into one message, so nothing is cut off or read twice.
- **After a right answer in a lesson**, focus moves to the feedback line only, so the screen reader doesn't reread the whole lesson card.
- **Calmer layout.**
  - Bigger text and more space.
  - Undo sits with Describe board and Last move.
  - Flip board, New game and Opponent are under **Game options**.
  - Settings are grouped: Speech and sound, Seeing, Touch, Messages and comfort, Game.
- **High contrast** now covers the whole app in pure black and white, with thick borders. It has a light and a dark version.
- **Board squares are always at least 44 × 44 pixels.** On phones narrower than about 380 pixels, the board scrolls sideways instead of shrinking.
- **Zoom and short screens.** At 400% zoom, or on a phone held sideways, the message bar and tabs stop sticking to the screen, so they don't cover the content. Focus is never hidden behind them.
- **Skip links.** "Skip to main content" was added before "Skip to the chessboard".
- Typing a move after checkmate now says the game is over.

## Removed

Nothing was removed. The pop-up `<dialog>` was replaced by the in-page panel described above.

## For developers

- The tutorial steps are `TPC_TOUR` in `js/lessons.js`. Its step types (`info`, `do`, plus `typed` moves) are described in the comment above it.
- `tests/test_app.py` now covers lessons, chess rules, the tutorial, speech, keyboard, structure, zoom, contrast, offline use and axe. It writes `docs/test-report.md`.
- The offline cache is now `touchpoint-v3`.
