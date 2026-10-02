import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applySelection,
  bankTurn,
  canBankTurn,
  computerDecideMove,
  createDebugRng,
  createInitialGameState,
  endFarkledTurn,
  getAdvisorReport,
  resetGame,
  rollForTurn,
  setSelection,
  toggleDieSelection,
  validateCurrentSelection,
  type AdvisorReport,
  type ComputerDecision,
  type GameState,
} from '../game';

/**
 * Base delay (ms) between each step of the computer's turn (rolling, revealing its
 * chosen dice, then locking them in / banking). A single knob so it can later be
 * wired up to a user-facing "play speed" setting without touching the turn logic.
 */
export const DEFAULT_COMPUTER_MOVE_DELAY_MS = 1100;

/**
 * Drives the full Farkle game: human turns are controlled via the returned actions,
 * computer turns play out automatically in distinct, delayed steps - roll, then
 * reveal its chosen dice (with reasoning, shown in the advisor panel) as they slide
 * to the held rail, then lock them in and bank or roll again - so the whole decision
 * is easy to follow rather than resolving instantly.
 */
export function useFarkleGame(
  targetScore: number,
  computerMoveDelayMs: number = DEFAULT_COMPUTER_MOVE_DELAY_MS,
  /**
   * When true, advice (for both the human and the computer) is nudged by the race to
   * `targetScore` - pushing harder when behind, playing safer when close to winning -
   * rather than pure expected-value maximization. Defaults to false. A precursor to a
   * future user-configurable setting; see docs/settings.md.
   */
  riskAwareness = false,
  /**
   * When true (the default), the computer's turn stops in the `farkled`/`turn-banked`
   * phase and waits for the human to click "Continue" before play passes back, giving
   * them a chance to read the computer's reasoning/result. When false, the computer's
   * turn advances automatically (after `computerMoveDelayMs`) without requiring a click,
   * for players who'd rather play faster without reviewing every computer turn.
   */
  pauseAfterComputerTurn = true,
) {
  const [game, setGame] = useState<GameState>(() => createInitialGameState(targetScore));
  const [computerDecision, setComputerDecision] = useState<ComputerDecision | null>(null);
  // QA override: see `createDebugRng` - lets `?dice=1,1,1,2,2,2` in the URL force
  // every roll's faces instead of real randomness, to reliably check a scenario by
  // hand. `undefined` (the normal case) falls through to `rollForTurn`'s own default
  // (real `Math.random`). Read once per mount - the URL isn't expected to change
  // without a full reload anyway.
  const debugRng = useMemo(() => createDebugRng(), []);

  const isHumanTurn = game.turn.playerId === 'human' && game.turn.phase !== 'game-over';
  const isComputerThinking = game.currentPlayerId === 'computer' && game.turn.phase !== 'game-over';

  // Computed for whichever player is currently deciding (human or computer), so the
  // advisor panel can explain the computer's reasoning using the exact same model.
  const advisorReport: AdvisorReport | null = useMemo(() => {
    if (game.turn.phase !== 'awaiting-selection' || game.turn.dice.length === 0) {
      return null;
    }
    const opponentId = game.turn.playerId === 'human' ? 'computer' : 'human';
    return getAdvisorReport({
      dice: game.turn.dice,
      turnScoreBeforeRoll: game.turn.turnScore,
      playerTotalScore: game.players[game.turn.playerId].totalScore,
      targetScore: game.targetScore,
      opponentTotalScore: game.players[opponentId].totalScore,
      riskAwareness,
    });
  }, [game.turn, game.players, game.targetScore, riskAwareness]);

  const roll = useCallback(() => {
    setGame((g) => {
      if (g.turn.phase === 'awaiting-roll') {
        return { ...g, turn: rollForTurn(g.turn, debugRng) };
      }
      if (g.turn.phase === 'awaiting-selection') {
        const validity = validateCurrentSelection(g.turn);
        if (!validity.valid) return g;
        const turn = applySelection(g.turn);
        // On hot dice, stop at `awaiting-roll` instead of immediately rolling the
        // fresh 6, so the "Hot dice!" banner is visible before that reroll (the
        // player then clicks Roll again to actually throw the fresh dice).
        if (turn.isHotDice) {
          return { ...g, turn };
        }
        return { ...g, turn: rollForTurn(turn, debugRng) };
      }
      return g;
    });
  }, [debugRng]);

  const toggleDie = useCallback((index: number) => {
    setGame((g) => ({ ...g, turn: toggleDieSelection(g.turn, index) }));
  }, []);

  const applyAdvisorSelection = useCallback((indices: number[]) => {
    setGame((g) => ({ ...g, turn: setSelection(g.turn, indices) }));
  }, []);

  const selectionValidity = useMemo(() => validateCurrentSelection(game.turn), [game.turn]);

  const canBank = useMemo(() => {
    if (game.turn.phase === 'awaiting-roll') return canBankTurn(game);
    if (game.turn.phase === 'awaiting-selection') return selectionValidity.valid;
    return false;
  }, [game, selectionValidity.valid]);

  const bank = useCallback(() => {
    setGame((g) => {
      if (g.turn.phase === 'awaiting-selection') {
        const validity = validateCurrentSelection(g.turn);
        if (!validity.valid) return g;
        const turn = applySelection(g.turn);
        return bankTurn({ ...g, turn });
      }
      return bankTurn(g);
    });
  }, []);

  // Advances past the current turn (Farkled, or - for the computer - already
  // banked and paused in `turn-banked`) once the human has reviewed it. When that
  // hands the turn to the human, their first roll happens immediately too - no need
  // for a separate click on "Roll" straight after "Continue". The computer's turn
  // still rolls itself on its own delayed schedule (see the effect below), so this
  // only fires the roll early for the human's side.
  const continueTurn = useCallback(() => {
    setGame((g) => {
      const next = endFarkledTurn(g);
      if (next.turn.playerId === 'human') {
        return { ...next, turn: rollForTurn(next.turn, debugRng) };
      }
      return next;
    });
  }, [debugRng]);

  const newGame = useCallback(() => {
    setGame(resetGame(targetScore));
  }, [targetScore]);

  // After the human locks in a selection that scores with all 6 dice ("hot dice"),
  // the turn pauses briefly at `awaiting-roll` just long enough to flash the "Hot
  // dice!" banner (same `rollForTurn` always clears `isHotDice` the instant it
  // actually re-rolls, so this pause is the only moment it's visible) before
  // automatically throwing the fresh 6 dice - the player shouldn't have to click
  // "Roll" a second time just to continue a turn they already chose to keep rolling.
  useEffect(() => {
    if (game.turn.playerId !== 'human' || game.turn.phase !== 'awaiting-roll' || !game.turn.isHotDice) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setGame((g) => {
        if (g.turn.playerId !== 'human' || g.turn.phase !== 'awaiting-roll' || !g.turn.isHotDice) return g;
        return { ...g, turn: rollForTurn(g.turn, debugRng) };
      });
    }, computerMoveDelayMs);
    return () => clearTimeout(timer);
  }, [game.turn.playerId, game.turn.phase, game.turn.isHotDice, computerMoveDelayMs, debugRng]);

  // Automatically steps the computer's turn forward in distinct, delayed stages so
  // each part of its decision can be followed rather than resolving instantly:
  //   1. roll the dice (after `computerMoveDelayMs`)
  //   2. decide its selection and reveal it - dice slide to the held rail, and the
  //      reasoning is shown in the advisor panel (after a slightly longer pause, so
  //      there's time to read it)
  //   3. lock the selection in and bank or roll again (after `computerMoveDelayMs`)
  useEffect(() => {
    if (game.currentPlayerId !== 'computer' || game.turn.phase === 'game-over') {
      return;
    }

    const { turn, players, targetScore: target } = game;

    if (turn.phase === 'awaiting-roll') {
      const timer = setTimeout(() => {
        setGame((g) => {
          if (g.currentPlayerId !== 'computer' || g.turn.phase !== 'awaiting-roll') return g;
          // On a Farkle, stop here (phase becomes 'farkled') instead of immediately
          // advancing, so the human can see the banner and click Continue - same as
          // the end-of-turn review after the computer banks.
          return { ...g, turn: rollForTurn(g.turn, debugRng) };
        });
      }, computerMoveDelayMs);
      return () => clearTimeout(timer);
    }

    if (turn.phase === 'awaiting-selection' && turn.selectedIndices.length === 0) {
      // Stage 2a: decide and reveal the pick - held dice slide to the rail - without
      // locking it in yet, so the advisor panel has time to show the reasoning.
      const timer = setTimeout(() => {
        const decision = computerDecideMove(
          turn.dice,
          turn.turnScore,
          players.computer,
          target,
          players.human.totalScore,
          riskAwareness,
        );
        setComputerDecision(decision);
        setGame((g) => {
          if (g.currentPlayerId !== 'computer' || g.turn.phase !== 'awaiting-selection' || g.turn.selectedIndices.length > 0) {
            return g;
          }
          return { ...g, turn: setSelection(g.turn, decision.selectedIndices) };
        });
      }, Math.round(computerMoveDelayMs * 1.4));
      return () => clearTimeout(timer);
    }

    if (turn.phase === 'awaiting-selection' && turn.selectedIndices.length > 0 && computerDecision) {
      // Stage 2b: lock in the already-revealed selection, then bank or roll again.
      const decision = computerDecision;
      const timer = setTimeout(() => {
        setGame((g) => {
          if (g.currentPlayerId !== 'computer' || g.turn.phase !== 'awaiting-selection') return g;
          let nextTurn = applySelection(g.turn);
          nextTurn = { ...nextTurn, log: [...nextTurn.log, `Computer: ${decision.reasoning}`] };
          const afterSelection: GameState = { ...g, turn: nextTurn };
          return decision.action === 'bank' ? bankTurn(afterSelection) : afterSelection;
        });
        setComputerDecision(null);
      }, computerMoveDelayMs);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [game, computerMoveDelayMs, computerDecision, riskAwareness, debugRng]);

  // When the computer's turn has ended (Farkled, or banked and paused in
  // `turn-banked`) and pausing for review is disabled, automatically advance past it
  // after a short delay instead of waiting for the human to click "Continue".
  useEffect(() => {
    if (pauseAfterComputerTurn) return undefined;
    if (game.turn.playerId !== 'computer') return undefined;
    if (game.turn.phase !== 'farkled' && game.turn.phase !== 'turn-banked') return undefined;

    const timer = setTimeout(() => {
      setGame((g) => {
        if (g.turn.playerId !== 'computer' || (g.turn.phase !== 'farkled' && g.turn.phase !== 'turn-banked')) {
          return g;
        }
        return endFarkledTurn(g);
      });
    }, computerMoveDelayMs);
    return () => clearTimeout(timer);
  }, [game.turn.playerId, game.turn.phase, pauseAfterComputerTurn, computerMoveDelayMs]);

  return {
    game,
    isHumanTurn,
    isComputerThinking,
    advisorReport,
    computerDecision,
    selectionValidity,
    actions: {
      roll,
      toggleDie,
      applyAdvisorSelection,
      bank,
      continueTurn,
      newGame,
    },
    canBank,
  };
}
