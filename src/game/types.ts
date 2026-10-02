/** A single die face value, 1 through 6. */
export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** One entry in a score breakdown explanation. */
export interface ScoreBreakdownItem {
  /** Human readable description, e.g. "Three 4s" or "Single 1". */
  description: string;
  /** The die values that make up this part of the score. */
  values: DieValue[];
  /** Points contributed by this part. */
  points: number;
}

/** Result of scoring a group of dice. */
export interface ScoreResult {
  /** True if every die in the group contributes to the score (no leftovers). */
  valid: boolean;
  /** Total points for the group (0 if invalid). */
  score: number;
  /** Explanation of how the score was built up. */
  breakdown: ScoreBreakdownItem[];
}

/** A candidate way of selecting scoring dice out of a roll. */
export interface SelectionCandidate {
  /** Indices (into the rolled dice array) that this candidate selects. */
  indices: number[];
  /** The die values selected. */
  values: DieValue[];
  /** Score for this selection. */
  result: ScoreResult;
  /** Short label describing the strategy, e.g. "Take everything" or "Keep rolling, skip the lone 5". */
  label: string;
}

/** Players in the game. */
export type PlayerId = 'human' | 'computer';

export interface PlayerState {
  id: PlayerId;
  name: string;
  totalScore: number;
}

/** Phase of the current turn. */
export type TurnPhase =
  | 'awaiting-roll'
  | 'awaiting-selection'
  | 'farkled'
  | 'turn-banked'
  | 'game-over';

export interface TurnState {
  playerId: PlayerId;
  /** Dice currently showing, for the dice that are still "in play" (not yet banked this turn). */
  dice: DieValue[];
  /** Indices within `dice` that the player has selected/locked this roll. */
  selectedIndices: number[];
  /** Indices within `dice` already locked in earlier this same roll (moved into
   *  `heldGroups`). Kept so any dice the player chose *not* to hold stay visible on
   *  the board for the rest of the roll (e.g. during the computer's end-of-turn
   *  review pause) instead of vanishing the instant a selection is locked in. Reset
   *  whenever a fresh roll actually replaces `dice`. */
  committedIndices: number[];
  /** Points banked so far this turn (not yet added to total score). */
  turnScore: number;
  /** Number of dice that must be rerolled next (6 when starting a turn or on hot dice). */
  diceToRoll: number;
  /** True if the player just scored with every die and earns a fresh set of 6 ("hot dice"). */
  isHotDice: boolean;
  /** True for the one roll immediately after a hot-dice reroll - i.e. the fresh set of
   *  dice that resulted from scoring with every die last time. Used to show the "Hot
   *  dice!" banner once those dice actually land on the board (rather than earlier,
   *  while the prior roll's scoring dice are still being moved into the held rail).
   *  Cleared by the next roll, whatever its outcome. */
  hotDiceReroll: boolean;
  /** Groups of dice already locked in this turn (one entry per roll that was locked), shown set aside at the board's edge. */
  heldGroups: DieValue[][];
  /** Increments on every roll so the UI can key/animate a fresh throw. */
  rollId: number;
  phase: TurnPhase;
  /** Log of human readable events for this turn. */
  log: string[];
}
