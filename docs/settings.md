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

- **Show advice** - `App.tsx`'s `showAdvice` state (boolean, defaults to `true`), gates
  whether the human-turn advisor banner at the top of the board is shown at all.
  Persisted to `localStorage` under `farkle:setting:show-advice`. Exposed via a checkbox
  in the "⚙️ Settings" overlay.

- **Computer skill/difficulty** - `useFarkleGame(targetScore, computerMoveDelayMs,
  riskAwareness, pauseAfterComputerTurn, computerSkill)` (`ComputerSkill`, one of
  `'easy' | 'normal' | 'hard'`, defaults to `'hard'`). Threaded into
  `computerDecideMove()` (`src/game/ai.ts`), which looks up a `SKILL_SETTINGS` preset per
  skill:
  - `lookaheadDepth` - how many further voluntary rolls the computer's own EV lookahead
    plays out when deciding bank-vs-continue (passed through to `getAdvisorReport` via
    the new `AdvisorInput.lookaheadDepth` override). `hard` uses the full
    `DEFAULT_LOOKAHEAD_DEPTH` (2); `normal` uses 1; `easy` uses 0 (next-roll-only EV).
  - `mistakeRate` - probability (0-1) the computer deliberately flips its own
    bank-vs-continue call for the same dice selection, simulating a misjudgment.
    `hard` is 0 (never), `normal` is 0.1, `easy` is 0.3. An instant-win move is never
    overridden by a mistake regardless of skill.
  - The human-facing advisor (`advisorReport` in `useFarkleGame.ts`, shown as read-only
    reference/comparison) always computes at full strength and is never subject to
    mistakes - only the computer's own internal decision-making is skill-adjusted, so
    the UI can show "what the optimal play would have been" alongside what the computer
    actually chose.
  - `hard` is deliberately byte-identical to the original always-optimal behavior, so it
    remains the default and no prior behavior changed for existing players.
  - Exposed via a 3-way segmented control ("Easy / Normal / Hard") in the "⚙️ Settings"
    overlay, persisted to `localStorage` under `farkle:setting:computer-skill`.

- **Take game state into account (risk-aware advice)** - `useFarkleGame(targetScore,
  computerMoveDelayMs, riskAwareness)` (boolean, defaults to `false`). When enabled, both
  the human advisor panel and the computer's own decision-making nudge the
  bank-vs-continue recommendation based on the race to `targetScore`:
  - Pushes harder (favors continuing) when significantly behind the opponent's score.
  - Plays it safer (favors banking) when close to the winning score, even if continuing
    has a slightly better raw expected value.
  - Implementation: `applyRiskAwareness()` in `src/game/advisor.ts`. Pure EV math is
    unchanged - this only shifts the bank/continue decision boundary and is fully opt-in,
    so existing pure-EV behavior is untouched when the flag is off.
  - Current heuristic constants (catch-up bonus capped at 10% of target score, safety
    penalty of 8% of target score within the last 5% of target remaining) are a first
    pass and may need tuning.
  - Exposed via a "🎯 Take game state into account" checkbox in the "⚙️ Settings" overlay,
    persisted to `localStorage` under `farkle:setting:risk-awareness`, off by default to
    preserve the original pure-EV behavior.

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

## Not yet implemented (ideas only)

- **Target score** - `App.tsx` currently sets `targetScore` once via
  `useState(DEFAULT_TARGET_SCORE)` with no setter exposed. Making this configurable
  (e.g. 5,000 / 10,000 / 15,000) just needs a UI control wired to that existing state -
  the game engine already takes `targetScore` as a parameter everywhere.
- **Risk-aware advice strength** - if the toggle above proves too blunt, consider a
  3-way setting (Cautious / Balanced / Aggressive) that scales the catch-up/safety bias
  magnitudes in `applyRiskAwareness()` instead of a plain on/off.
- **Sound effects / animation speed** - independent of computer move pacing, could allow
  turning off the dice-throw animation or muting sound (no sound currently implemented).

