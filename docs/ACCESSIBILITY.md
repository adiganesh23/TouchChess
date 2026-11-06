# Accessibility statement: Touchpoint Chess

Last reviewed: 4 November 2026

## Our goal

Touchpoint Chess is a practice tool for chess students who are blind or have low vision, and for their teachers. We want it to work well with the tools students already use: screen readers, braille displays, keyboards, zoom, high contrast and large text.

## The standard we aim for

We aim to meet the **Web Content Accessibility Guidelines (WCAG) 2.2, level AA**. We have not had the app independently audited, and we do not claim it complies with the ADA or any other law. This statement says what we tested and what we know is still missing.

## What works today

- **Screen readers.** The board is a grid with one stop in the Tab order. Each square says its name and what is on it, such as "e4, white knight". Moves, check and lesson results are spoken through one polite live region, and nothing is meant to be read twice.
- **Keyboard.** Everything works from the keyboard. There are two skip links, a strong two-colour focus ring, and no keyboard traps. Board shortcuts: B hears the board, L the last move, M legal moves, P repeats the last message, X stops the app's speech.
- **The app's own voice.** It is optional and starts off at every visit. It never makes a sound before you press a key or tap. You can choose the voice, speed and volume. Turning it off does not affect your screen reader.
- **Seeing.** Light, dark and high-contrast themes, plus a calm theme, follow your device setting. Four text sizes are available. Nothing is shown by colour alone.
- **Zoom and small screens.** The page reflows at 200% and 400% zoom with no sideways scrolling. The only exception is the board on screens under 352 pixels wide, which scrolls sideways so its squares stay at least 44 pixels.
- **Touch.** Every button and every square is at least 44 by 44 pixels.
- **No pop-ups.** Confirmations and the promotion choice appear in the page itself. The app never uses alert, confirm or prompt boxes.
- **First visit.** One question in the page, "How do you want to play?" (Listen, Feel, See, Calm, screen reader or Deaf), switches on the right settings. Skip is always there.
- **Tutorial.** A "How to use" tour is offered after that question and can be reopened at any time from the Help button. You try each action yourself, and it tells you when you got it right.
- **Motion.** Pieces lift and slide in 200 ms. Nothing moves with reduced motion turned on, or in Calm mode.

## What we tested

All of these were run in Google Chrome with automated tests (`tests/test_app.py`). The full measured results are in [test-report.md](test-report.md).

| Test | Result |
|---|---|
| axe-core 4.10.2, WCAG 2.0, 2.1 and 2.2 A and AA rules plus best practices, run on 107 page states across 6 themes and phone width | 0 violations |
| Keyboard only: Tab order, focus always visible, no traps, focus never hidden under the message bar or tabs, every feature used from the keyboard, including the full tutorial | Pass |
| Accessibility tree: landmarks, heading levels, grid roles, square names, pressed states | Pass |
| Reflow at 200% and 400% zoom, at 400, 390 and 360 px wide, and with the WCAG text-spacing override | Pass |
| Contrast of every colour pair, measured from the page in 6 themes | All pass. Lowest text pair is 5.32:1 (needs 4.5:1); lowest non-text pair is 3.34:1 (needs 3:1) |
| Chess rules: legal moves, check, checkmate, castling both ways, en passant, promotion, undo | Pass |
| Speech: off before any action, voice, speed and volume used, repeat, stop, screen reader still gets everything with speech off | Pass, using a stand-in speech engine |

## Known limitations

- **Not yet tested with real assistive technology.** We have not yet tried VoiceOver, NVDA, JAWS, TalkBack or a braille display with a real user. A checklist for doing this is in [screen-reader-test-checklist.md](screen-reader-test-checklist.md). Automated tests cannot tell us whether the app is pleasant or easy to use.
- **Chrome only.** We have not run the tests in Safari, Firefox or Edge.
- **Real voices not tested.** The tests replace the device's speech engine with a stand-in. Real voices vary from device to device, and some devices have none.
- **Double speech.** If the app's speech and a screen reader are both on, you will hear things twice. The app recommends leaving its speech off when you use a screen reader.
- **Small screens.** On phones the board runs edge to edge, so squares are 45 pixels at 360 pixels wide. Below 352 pixels (for example 400% zoom) the board scrolls sideways so the squares can stay 44 pixels.
- **Edge labels.** On phones the rank numbers and file letters are printed inside the edge squares at 12 to 13 pixels. They are extra: every square's name is also in its label and in the readout under the board.
- **Square names over pieces.** axe could not measure the contrast of square names printed over a piece picture. We measured those colour pairs separately, and they pass.
- **The ✓ on the Speech button.** In older versions of Firefox, a screen reader may read the ✓ mark as part of the button name.
- **Vibration.** iPhones do not allow web pages to vibrate, so vibration patterns only work on Android.
- **Live announcements.** How quickly and reliably screen readers read polite announcements differs between products, especially while you are typing.

## Feedback

If something does not work for you, please tell your teacher or the person who shared the app with you. Tell us what device, browser and assistive technology you use. We will fix it, or we will add it to the limitations above.
