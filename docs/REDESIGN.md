# Redesign: before and after

November 2026, branch `redesign-ui`. The goal was to make the app look and feel like a polished phone app, with the board as the hero, while keeping every accessibility feature.

## The design system

- **Colour.** One accent colour (blue in light, light blue in dark, deep blue or yellow in high contrast, sage in calm), deliberate neutrals and tinted surfaces for the goal, success and error states. Every colour is a CSS custom property, and every pair is measured by the tests in all six themes.
- **Type.** Atkinson Hyperlegible at 16, 18, 20, 24 and 32 px, scaled by the four text sizes.
- **Space and shape.** A 4/8 px spacing scale and 8, 12 and 20 px corner radii. Controls are 48 px tall, primary actions 56 px, toolbar buttons 72 px.
- **Motion.** 150–250 ms ease-out. A piece lifts when picked up and slides when it moves, and screens fade in. All of it is switched off with reduced motion or Calm mode. Haptics, captions and the live region still describe every move.

## Play

| Before | After |
|---|---|
| A two-row header and a three-line message bar pushed the board down to about y=205 on a phone. On a 375 px iPhone the board was cut off and scrolled sideways. | A compact top bar (Speech, Help) and a one-line message strip with an icon-only Repeat button. The board runs edge to edge, and squares are 45 px at 360 px wide and 47 px at 375 px. |
| Small square names (about 9 px) on every square. | Rank numbers and file letters sit in the edge squares. Names on every square are still available as a setting. |
| Seven equal-weight outlined buttons, plus a panel and an open captions list. | One move box with a primary Go, and a toolbar of four large labelled icons: Describe board, Last move, Undo, More. More opens a tray in place with Flip, New game and Opponent. |
| Captions always open. | Captions in a card that folds away. It opens by default with the Deaf setup and remembers your choice. |
| On desktop, the tabs were squeezed beside the title. | On desktop, the tabs are a segmented control in the top bar, with the board on the left and a rail on the right. |

## Lessons

| Before | After |
|---|---|
| The lesson card sat above the board, so on a phone the goal and the board weren't on screen together. | A compact card: step bar, title, and the goal in its own tinted box. On phones the intro is tucked behind "Show introduction", but screen readers still read it. Hint and Repeat sit under the board. |
| Success was green text, and "Lesson complete" was one sentence. | Each state has its own shape as well as colour: goal (solid border), wrong try (dashed border), correct (a check badge on a tinted box), complete (a thick border, "That is 3 of 14 lessons", "Next lesson" as the primary button and "Back to lessons" beside it). |

## Learn

| Before | After |
|---|---|
| About 6,400 px of full cards, with progress as one line of text. | About 2,700 px. A progress card with a bar and one Continue button. Lessons sit in four units, one 64 px row each, with a status shown as a shape and a word: ✓ Done, → Up next, ○ Not started. |
| Six big piece cards. | Six compact piece tiles. Glossary and How it works fold away. |
| No designed "all done" state. | An all-done line and a "Play a game" button. |

## Access

| Before | After |
|---|---|
| Six wordy quick-setup buttons. | "How do you want to play?" cards: Listen, Feel, See and Calm, plus "I use a screen reader" and "I am Deaf or hard of hearing". The one you chose is marked. |
| 17 setting cards, each with a paragraph and tag chips. | Grouped list rows: label and control on one line, a short description and one "Helps with" line. The test buttons are chips, and the shortcuts table folds away. |

## First visit

| Before | After |
|---|---|
| Dropped straight into the 10-step tour. | One in-page question, "How do you want to play?", then "You're set" with Take the tour or Start playing. Skip is always there. |

## Left unchanged on purpose

- **Board labels, live region, arrow-key grid, typed commands and shortcuts.** These are the core accessibility features. The tests check them, and they still pass.
- **The chess rules engine (chess.js 0.10.3) and the computer opponent.**
- **The SVG piece drawings.** They're already high contrast, and they work offline and in forced colours.
- **The lesson and tutorial content**, apart from "Help button" wording and removing the setup step that first visit now covers.
- **The six quick setups' settings.** They were relabelled into the four ways to play, but each still switches on the same things.
- **No new frameworks and no build step.** It's plain HTML, CSS and JS, and it still works offline.
