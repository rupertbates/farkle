import { rollDice } from './dice';
import { hasAnyScore, scoreGroup } from './scoring';
import type { PlayerId, PlayerState, TurnState } from './types';

export const DEFAULT_TARGET_SCORE = 10000;

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  currentPlayerId: PlayerId;
  turn: TurnState;
  targetScore: number;
  winnerId: PlayerId | null;
}

function emptyTurn(playerId: PlayerId): TurnState {
  return {
    playerId,
    dice: [],
    selectedIndices: [],
    committedIndices: [],
    turnScore: 0,
    diceToRoll: 6,
    isHotDice: false,
    heldGroups: [],
    rollId: 0,
    phase: 'awaiting-roll',
    log: [],
  };
}

export function createInitialGameState(targetScore: number = DEFAULT_TARGET_SCORE): GameState {
  return {
    players: {
      human: { id: 'human', name: 'You', totalScore: 0 },
      computer: { id: 'computer', name: 'Computer', totalScore: 0 },
    },
    currentPlayerId: 'human',
    turn: emptyTurn('human'),
    targetScore,
    winnerId: null,
  };
}

/** Rolls the dice for the current turn (using `turn.diceToRoll`) and checks for a Farkle. */
export function rollForTurn(turn: TurnState, rng?: () => number): TurnState {
  const dice = rollDice(turn.diceToRoll, rng);
  const rollLabel = turn.isHotDice ? `Hot dice! Rolling a fresh set of ${turn.diceToRoll} dice` : `Rolled ${turn.diceToRoll} dice`;
  const log = [...turn.log, `${rollLabel}: ${dice.join(', ')}`];
  const rollId = turn.rollId + 1;

  if (!hasAnyScore(dice)) {
    return {
      ...turn,
      dice,
      selectedIndices: [],
      committedIndices: [],
      rollId,
      isHotDice: false,
      phase: 'farkled',
      log: [...log, 'Farkle! No scoring dice. Turn points are lost.'],
    };
  }

  // The hot-dice bonus applies only to the roll it triggered; once that roll has
  // happened, clear the flag so it doesn't get mistaken for a claim about this new
  // roll's results (whether *this* fresh roll is itself hot dice is instead read
  // live off the advisor's recommendation for the board's headline banner - see
  // `App.tsx`).
  return {
    ...turn,
    dice,
    selectedIndices: [],
    committedIndices: [],
    rollId,
    isHotDice: false,
    phase: 'awaiting-selection',
    log,
  };
}

/** Toggles whether a rolled die (by index) is part of the current selection. */
export function toggleDieSelection(turn: TurnState, index: number): TurnState {
  if (turn.phase !== 'awaiting-selection') return turn;
  const selectedIndices = turn.selectedIndices.includes(index)
    ? turn.selectedIndices.filter((i) => i !== index)
    : [...turn.selectedIndices, index];
  return { ...turn, selectedIndices };
}

/** Sets the current selection directly to the given indices (e.g. from the advisor's recommendation). */
export function setSelection(turn: TurnState, indices: number[]): TurnState {
  if (turn.phase !== 'awaiting-selection') return turn;
  return { ...turn, selectedIndices: indices };
}

export interface SelectionValidity {
  valid: boolean;
  score: number;
  reason?: string;
}

/** Validates the current selection without mutating state. */
export function validateCurrentSelection(turn: TurnState): SelectionValidity {
  if (turn.selectedIndices.length === 0) {
    return { valid: false, score: 0, reason: 'Select at least one scoring die.' };
  }
  const values = turn.selectedIndices.map((i) => turn.dice[i]);
  const result = scoreGroup(values);
  if (!result.valid) {
    return { valid: false, score: 0, reason: 'That combination of dice does not score. Every selected die must contribute to a scoring combo.' };
  }
  return { valid: true, score: result.score };
}

/**
 * Locks in the current selection: adds its score to the turn total and determines
 * how many dice are available for the next roll (6 again on hot dice).
 */
export function applySelection(turn: TurnState): TurnState {
  const validity = validateCurrentSelection(turn);
  if (!validity.valid) return turn;

  const selectedValues = turn.selectedIndices.map((i) => turn.dice[i]);
  const diceUsed = turn.selectedIndices.length;
  const diceLeft = turn.dice.length - diceUsed;
  const isHotDice = diceLeft === 0;
  const diceToRoll = isHotDice ? 6 : diceLeft;
  const hotDiceNote = isHotDice ? ' 🔥 HOT DICE! You scored with all 6 dice - roll all 6 again with your turn score intact.' : '';

  return {
    ...turn,
    turnScore: turn.turnScore + validity.score,
    // `dice` itself is left untouched here (not cleared) - any die not part of this
    // selection should keep showing on the board rather than vanishing. The board
    // hides committed indices instead (see `committedIndices` below); the next real
    // roll (or a fresh turn) replaces `dice` wholesale and clears this list.
    selectedIndices: [],
    committedIndices: [...turn.committedIndices, ...turn.selectedIndices],
    diceToRoll,
    isHotDice,
    heldGroups: [...turn.heldGroups, selectedValues],
    phase: 'awaiting-roll',
    log: [...turn.log, `Banked ${validity.score} points this roll (turn total: ${turn.turnScore + validity.score}).${hotDiceNote}`],
  };
}

/** Whether the player is currently allowed to end their turn and bank their points. */
export function canBankTurn(game: GameState): boolean {
  if (game.turn.phase !== 'awaiting-roll') return false;
  if (game.turn.turnScore <= 0) return false;
  return true;
}

/**
 * Ends the current turn, banking points (if allowed). For the human, this switches
 * straight to the other player (they were already present for every step of their
 * own turn). For the computer, it instead pauses in the `turn-banked` phase - still
 * the computer's turn, points already applied - so the human can review what just
 * happened before clicking Continue (via `endFarkledTurn`, despite the name a
 * generic "advance past this turn" step) to actually move on.
 */
export function bankTurn(game: GameState): GameState {
  if (!canBankTurn(game)) return game;

  const player = game.players[game.turn.playerId];
  const newTotal = player.totalScore + game.turn.turnScore;
  const updatedPlayer: PlayerState = { ...player, totalScore: newTotal };
  const winnerId = newTotal >= game.targetScore ? player.id : null;

  if (winnerId) {
    return {
      ...game,
      players: { ...game.players, [player.id]: updatedPlayer },
      currentPlayerId: player.id,
      turn: { ...game.turn, phase: 'game-over', log: [...game.turn.log, `${player.name} reached ${newTotal} points and wins!`] },
      winnerId,
    };
  }

  if (player.id === 'computer') {
    return {
      ...game,
      players: { ...game.players, [player.id]: updatedPlayer },
      turn: { ...game.turn, phase: 'turn-banked' },
    };
  }

  const nextPlayerId: PlayerId = 'computer';
  return {
    ...game,
    players: { ...game.players, [player.id]: updatedPlayer },
    currentPlayerId: nextPlayerId,
    turn: emptyTurn(nextPlayerId),
    winnerId,
  };
}

/**
 * Advances past the current turn (no points banked, if it was a Farkle - the
 * `turn-banked` phase already applied its points in `bankTurn`), switching to the
 * other player. Used both for the human's Farkle "Continue" click and to move on
 * after reviewing the computer's completed turn (banked or Farkled).
 */
export function endFarkledTurn(game: GameState): GameState {
  const nextPlayerId: PlayerId = game.turn.playerId === 'human' ? 'computer' : 'human';
  return { ...game, currentPlayerId: nextPlayerId, turn: emptyTurn(nextPlayerId) };
}

export function resetGame(targetScore: number = DEFAULT_TARGET_SCORE): GameState {
  return createInitialGameState(targetScore);
}
