# Farkle

A TypeScript + React (Vite) web app for playing the dice game Farkle against a
computer opponent. After every roll, an **Advisor** panel shows the best dice
to keep, the probability of Farkling if you keep rolling, and the expected
value of banking vs. continuing - with a plain-English explanation for each.
The computer opponent uses the same advisor engine to play and explain its
own decisions.

**Live demo:** https://rupertbates.github.io/farkle/ (deployed automatically
from `main` via GitHub Actions - see [Deployment](#deployment)).

## Rules implemented

- First to **10,000** points wins.
- Scoring:
  - Single `1` = 100, single `5` = 50
  - Three of a kind: `1`s = 1000, others = face value × 100
  - Four/five/six of a kind: doubles again for each extra die (e.g. four 4s = 800)
  - Straight (1-2-3-4-5-6) = 1500
  - Three pairs = 1500
  - **Hot dice**: scoring with all 6 dice lets you roll all 6 again, keeping
    your turn score - called out explicitly in the UI/turn log when it happens.
- A roll with no scoring dice (Farkle) wipes out the turn's unbanked points.

## Gameplay / UI

- **Board layout**: a large, fixed-size square board that stays in place for
  the whole turn. Dice get a 3D-styled roll/throw animation and land in
  randomized positions on the board, as if actually thrown.
- **Hold mechanism**: click a die to hold it (moves it to a side tray showing
  its score contribution); click it again in the tray to return it to the
  board. No separate "lock in" step - the action button becomes "Roll again"
  once at least one die is held.
- **Scoring reference chart** alongside the board showing the value of every
  combination.
- **Turn log** showing a readable history of rolls, holds, and bank/Farkle
  outcomes for both players, including the computer's reasoning (see below).
- **Paced computer turns**: the computer's moves are revealed with a
  configurable delay between roll → decision → lock-in, so its choices are
  easy to follow instead of resolving instantly.

## Advisor logic

For each roll, the advisor (`src/game/advisor.ts`):

1. Enumerates every sensible dice-selection strategy for the roll
   (`src/game/scoring.ts`) - e.g. "take everything" vs. "skip lone 5s to keep
   more dice live for a reroll" - fully enumerating subsets of droppable lone
   1s/5s while treating 3-or-more-of-a-kind groups as atomic.
2. For each strategy, computes the **exact** probability of Farkling on the
   very next roll by exhaustively enumerating every possible outcome for the
   remaining dice (`src/game/probability.ts`) - not simulated, not
   approximated.
3. Computes the expected value of **continuing** using a recursive,
   depth-limited lookahead (`getContinuationValue`) that plays out several
   further optimal rolls - not just the next one - so it properly credits the
   compounding value of chaining into repeated Hot Dice. (At lookahead depth
   0 this reduces exactly to a classic one-roll EV formula, which is kept as
   a regression check.)
4. Compares that continuation value against banking now and recommends the
   higher-EV action, with a plain-English explanation of the probabilities
   behind it.
5. Optionally (`riskAwareness`, off by default) nudges the bank-vs-continue
   boundary based on the race to the target score - favoring higher-variance
   "push on" play when significantly behind the opponent, and favoring a safe
   bank when close to a winning score even if continuing has a marginally
   better raw expected value.

See `docs/settings.md` for a running list of behavior that's already
implemented as configurable parameters internally (computer play speed,
risk-aware advice) but not yet exposed in a settings UI, plus ideas for
future settings.

## Development

```bash
pnpm install
pnpm dev      # start the dev server
pnpm test     # run the vitest suite (unit + integration tests)
pnpm build    # typecheck + production build
pnpm lint     # oxlint
```

## Deployment

The app is a static single-page build with no backend, so it's hosted for
free on **GitHub Pages**. `.github/workflows/deploy-pages.yml` builds and
deploys the `main` branch automatically on every push (and can be triggered
manually via `workflow_dispatch`), publishing to
https://rupertbates.github.io/farkle/.

Because GitHub Pages serves a project site from a `/<repo-name>/` subpath
rather than the domain root, `vite.config.ts` sets `base: '/farkle/'` only
when the `GITHUB_PAGES=true` env var is set (as the workflow does) - a plain
local `pnpm build` still serves from `/`, so this doesn't affect normal
development.

## Project structure

- `src/game/` - pure game logic (dice, scoring, probability, advisor, AI, turn
  engine) with no UI dependencies; fully unit tested.
  - `scoring.ts` - scoring rules and dice-selection candidate generation.
  - `probability.ts` - exact roll-outcome statistics and the recursive
    multi-roll continuation-value solver.
  - `advisor.ts` - builds the bank-vs-continue recommendation report.
  - `ai.ts` - computer opponent decision-making (reuses the advisor).
- `src/hooks/useFarkleGame.ts` - React hook wiring the game engine to UI state,
  including automatic, paced computer turns.
- `src/components/` - presentational React components (board, dice, hold
  tray, scoreboard, advisor panel, turn log).
- `docs/settings.md` - tracks game behavior already built as configurable
  parameters, pending a settings UI.
