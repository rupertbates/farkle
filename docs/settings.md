# Future settings

There's no settings UI yet except where noted below. This tracks game behavior that's
already been built as a parameterized/opt-in hook or function argument, specifically so
it can be wired up to a settings panel later without further refactoring of the game
logic itself.

## Implemented & exposed

- **Pause after computer's turn** - `useFarkleGame(targetScore, computerMoveDelayMs, riskAwareness, pauseAfterComputerTurn)`
  (boolean, defaults to `true`). When enabled, the computer's turn stops in the
  `farkled`/`turn-banked` phase and waits for the player to click "Continue" before play
  passes back, so they have a chance to review the computer's move/reasoning. When
  disabled, the computer's turn advances automatically (after `computerMoveDelayMs`)
  without requiring a click, for players who'd rather play faster.
  - Exposed via the "⚙️ Settings" panel in `App.tsx` (a checkbox), persisted to
    `localStorage` under `farkle:setting:pause-after-computer-turn` the same way the
    collapsible panels remember their open/closed state.

## Ready to expose

These are fully implemented and threaded through `useFarkleGame`, just not yet exposed
to the player via any UI control. `App.tsx` currently hardcodes their defaults.

- **Computer play speed** - `useFarkleGame(targetScore, computerMoveDelayMs)`
  (`src/hooks/useFarkleGame.ts`). Controls the base delay (ms) between each stage of the
  computer's turn (roll → reveal its decision → lock it in). Defaults to
  `DEFAULT_COMPUTER_MOVE_DELAY_MS` (1100ms); the "reveal" stage uses `1.4x` this value so
  there's time to read the advisor's explanation of the computer's reasoning.
  - Suggested UI: a slider or preset buttons (e.g. "Slow / Normal / Fast / Instant").
  - Note: "Instant" (delay ≈ 0) should still work since it's just a `setTimeout` value,
    but hasn't been explicitly tested at 0ms.

- **Risk-aware advice** - `useFarkleGame(targetScore, computerMoveDelayMs, riskAwareness)`
  (boolean, defaults to `false`). When enabled, both the human advisor panel and the
  computer's own decision-making nudge the bank-vs-continue recommendation based on the
  race to `targetScore`:
  - Pushes harder (favors continuing) when significantly behind the opponent's score.
  - Plays it safer (favors banking) when close to the winning score, even if continuing
    has a slightly better raw expected value.
  - Implementation: `applyRiskAwareness()` in `src/game/advisor.ts`. Pure EV math is
    unchanged - this only shifts the bank/continue decision boundary and is fully opt-in,
    so existing pure-EV behavior is untouched when the flag is off.
  - Current heuristic constants (catch-up bonus capped at 10% of target score, safety
    penalty of 8% of target score within the last 5% of target remaining) are a first
    pass and may need tuning once this is player-facing.
  - Suggested UI: a simple toggle, e.g. "Risk-aware advice" or "Consider game state", off
    by default to preserve the original pure-EV behavior.

## Not yet implemented (ideas only)

- **Lookahead depth for the advisor's EV math** - `getAdvisorReport`'s "continue" value
  now comes from `getContinuationValue()` (`src/game/probability.ts`), a recursive,
  depth-limited solver that plays out several further optimal rolls (not just the very
  next one), so it properly credits chaining through repeated Hot Dice. The depth is
  currently a fixed internal constant, `DEFAULT_LOOKAHEAD_DEPTH = 2` - not exposed as a
  setting, since it's an engine accuracy/performance tuning knob rather than a player
  preference (depth 2 averages well under 2ms per call even across varied game states,
  so there's little practical reason for a player to want it lower). Flagging here only
  in case a future "computer difficulty" setting wants to intentionally give the computer
  a shallower (weaker) lookahead than the human-facing advisor.
- **Target score** - `App.tsx` currently sets `targetScore` once via
  `useState(DEFAULT_TARGET_SCORE)` with no setter exposed. Making this configurable
  (e.g. 5,000 / 10,000 / 15,000) just needs a UI control wired to that existing state -
  the game engine already takes `targetScore` as a parameter everywhere.
- **Risk-aware advice strength** - if the toggle above proves too blunt, consider a
  3-way setting (Cautious / Balanced / Aggressive) that scales the catch-up/safety bias
  magnitudes in `applyRiskAwareness()` instead of a plain on/off.
- **Computer difficulty** - the computer currently always plays optimally (best-EV, with
  the same `riskAwareness` option as the human). A "difficulty" setting could make the
  computer deliberately suboptimal (e.g. occasionally bank earlier/later than advised, or
  use a shallower lookahead depth - see above) to give newer players an easier opponent.
- **Sound effects / animation speed** - independent of computer move pacing, could allow
  turning off the dice-throw animation or muting sound (no sound currently implemented).
