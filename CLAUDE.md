# CLAUDE.md — WinGames

Authoritative instruction set for this project. Read at the start of every session; keep it accurate when architecture, commands, or conventions change.

---

## 1. Purpose

A browser-based solitaire collection that runs locally on Windows: **Klondike**, **Spider**, and **FreeCell**, behind a shared game switcher. No backend, no accounts, no network calls.

---

## 2. Architecture

Vite + TypeScript, no UI framework, no runtime dependencies. The build ships ~25 kB of JS.

```
src/
  engine/          Pure game rules. No DOM, no side effects.
    types.ts       Card / Pile / GameState / Move + the Game interface every game implements
    cards.ts       Deck building, seeded RNG, shuffle, pile helpers, state cloning
    klondike.ts    Klondike rules
    spider.ts      Spider rules
    freecell.ts    FreeCell rules
    index.ts       Game registry (GAMES, getGame, defaultOptions)
    testing.ts     Test-only fixture helpers (card/cards shorthand, board builders)
  ui/
    render.ts      Board layout maths and DOM construction
    court.ts       Inline-SVG court figures for J/Q/K
    pips.ts        Inline-SVG pip layouts for A-10
    sound.ts       Web Audio effects, synthesised; mute persisted
    records.ts     Personal bests per game variant, in localStorage
    app.ts         Controller: sessions, pointer input, undo, timer, stats, test hooks
  main.ts          Entry point; publishes window.wingames for the Playwright suite
  styles.css
e2e/               Playwright specs + helpers
```

**The engine/UI boundary is the important one.** The renderer knows nothing about any specific game: each game assigns grid coordinates and a fan direction to its own piles, and `renderBoard` draws whatever the state describes. Adding a fourth game means implementing the `Game` interface and adding it to `GAMES` — no renderer changes.

### Engine conventions

- **Immutability.** `apply()` clones and returns new state; it never mutates its argument. Undo is a stack of prior states, which only works because of this.
- **`canMove` is the single source of truth for legality.** The UI never re-implements a rule; drag, click-to-move, and autoplay all funnel through it.
- **`apply()` assumes the move is legal.** Callers check `canMove` first.
- **Determinism.** Deals come from `rng(seed)` (mulberry32), so a seed always reproduces a board. Restart Deal replays the same seed.
- **Card ids are unique per game**, including two-deck Spider (`S13#01` = King of Spades, deck 0, suit slot 1).

### UI conventions

- Full re-render on every state change. Board sizes are small enough that diffing is not worth the complexity.
- Dragged cards live in a `.drag-layer` element. `render()` re-attaches that layer after `replaceChildren()` — without this, a re-render mid-drag detaches the layer and every drop silently fails.
- Drop targets are chosen by greatest rectangle overlap among *legal* piles, not by which element is under the cursor. This is forgiving and matches how players actually aim.
- Each game keeps its own session (state, history, timer) in memory, so switching tabs does not lose a game in progress.
- Card sizing lives entirely in `computeMetrics`: cards scale to fill the board, bounded by `game.heightUnits` (the top row plus a typical fanned column). Piles deeper than that budget compress their fan — face-down cards first, since they carry no information — down to a readability floor, and only then overflow into a scroll.
- Court figures (`court.ts`) are drawn once per rank and repeated rotated 180°, the traditional construction. Number cards (`pips.ts`) use the standard French pip arrangement, pips below the midline rotated. Both are pure vector, so they stay crisp at any card size, and `pointer-events: none` keeps clicks on the card rather than on a path inside the art.
- Card movement uses FLIP: `tryMove` captures every card's screen rect, applies the move, re-renders, then offsets the cards that moved back to where they were and releases them. Because the capture includes drag-layer clones, a dropped card glides from the pointer rather than from its old pile. `prefers-reduced-motion` skips it entirely.
- Sounds are synthesised in `sound.ts` — no audio files. The AudioContext is created on the first sound, since browsers refuse audio outside a user gesture.
- Anything that reads card positions after a move must wait for `window.wingames.animating()` to go false, or it will sample a card mid-glide.

---

## 3. Commands

| Command | Purpose |
| --- | --- |
| `node start.js` / `npm start` | Start the game and open it in the browser (the manual entry point). Uses port 3000, sliding to the next free port if taken |
| `npm run dev` | Dev server on a fixed http://localhost:5173 (what the Playwright suite drives) |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build (port 4173) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest engine suite (run once) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run e2e` | Playwright suite (starts the dev server itself) |
| `npm run e2e:headed` | Same, with a visible browser |

---

## 4. Testing workflow

Two layers, each with a distinct job:

**Vitest (`src/engine/*.test.ts`)** — rules only. Deal shapes, every legality rule, scoring, flipping, sweeping completed suits, win detection, autoplay safety, and card-conservation checks over long randomised games. Fast; run it constantly.

Build exact positions with the helpers in `engine/testing.ts`:

```ts
const state = clearAnd(fresh(), { t0: cards('9S 8H 7S'), t1: cards('10H') });
```

> **Fixture pitfall, learned the hard way:** `clearAnd` empties *every* pile. In FreeCell that hands the position free empty columns, which inflates supermove capacity; in Spider it leaves the stock empty so a deal throws. Block the columns a test does not care about (see `board()` in `freecell.test.ts`), and never assert against a position you did not fully specify.

**Playwright (`e2e/`)** — the parts unit tests cannot see: real pointer drags, click-to-move, illegal drops snapping back, undo, the clock, the win overlay, tab switching, and console errors. `window.wingames` (from `main.ts`) exposes `setState` so a spec can build a deterministic position, plus `cardPoint`/`dropPoint` for synthetic drags.

Card ids in fixtures carry a copy index: `cards('9H 4S')` makes `4S` copy **1**, so refer to it as `cardId('4S', 1)`.

---

## 5. Autonomous execution

Work autonomously from start to finish. Routine development actions are **pre-authorized** — do not ask permission to run PowerShell, npm/npx, Node, dev servers, builds, tests, Playwright, git, curl, or to create, modify, or inspect files.

When a command fails, diagnose and fix it rather than reporting and stopping.

Stop and ask only for: genuinely destructive actions outside the project, missing credentials that no amount of investigation can avoid, a material change of scope, or a product decision the requirements cannot settle. Normal project file creation, editing, refactoring, and deletion are not exceptional.

If the *environment* blocks a tool (sandbox, auth, restriction), try alternatives — PowerShell instead of Bash, an installed tool, existing dependencies — before reporting a blocker. Do not re-ask the user for permission for the same routine action.

---

## 6. Validation standards

Do not report completion because TypeScript compiles, unit tests pass, or the page renders. Actually run the app and interact with it.

Browser validation must cover: startup, the game menu, new game, dealing, card selection, drag-and-drop, click-to-move, legal *and* illegal moves, card flipping, foundations, stock/waste behaviour, undo, timer, scoring, win detection, and reset.

**Play the games, do not just assert on them.** The one defect that survived 100 passing unit tests and 50 passing e2e tests — click-to-move pulling a card back *off* a foundation, so a stray click undid progress — was caught by scripting real click-play across a real deal and looking at the screenshot. Automated scripts that "make legal moves" can ping-pong forever and still report success; check that the *game state actually progresses* (foundations filling, columns emptying, score climbing), not just that moves were accepted.

When a test fails, find the root cause and fix the implementation. Never weaken or delete a test to make the suite green. When a fixture turns out to be unrealistic, fix the fixture and say so.

---

## 7. Scope

In scope: the three games, shared game infrastructure, the switcher/menu, testing, and dev tooling.

Out of scope — do not add: accounts, multiplayer, monetization, ads, social features, achievements, leaderboards, other games, or backend services. Do not build a feature because it might be useful later.

Prefer simple, maintainable, production-quality code with minimal dependencies, deterministic rules, and a clear rules/UI split. Avoid speculative abstractions, placeholders, and dead code.

---

## 8. Acceptance criteria

- [x] Klondike, Spider, and FreeCell are all genuinely playable
- [x] Correct deals, legality rules, and win detection for each game
- [x] Drag-and-drop and click-to-move both work; illegal moves are refused and snap back
- [x] Undo (button and Ctrl+Z), timer, move count, and scoring
- [x] Game switcher preserving each game in progress; New Game and Restart Deal
- [x] Draw-1/draw-3 for Klondike; 1/2/4 suits for Spider
- [x] Engine unit tests and browser-level e2e tests, all passing
- [x] No console errors during play
