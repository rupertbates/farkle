import { describe, expect, it } from 'vitest';
import {
  createInitialGameState,
  rollForTurn,
  setSelection,
  applySelection,
  bankTurn,
  canBankTurn,
  endFarkledTurn,
} from '../gameEngine';

function withFixedDice(values: number[]) {
  let i = 0;
  return () => {
    // rollDice does Math.floor(rng() * 6) + 1, so to get `values[i]` we need
    // rng() to return (values[i]-1)/6 .. use midpoint of the bucket.
    const target = values[i % values.length];
    i++;
    return (target - 1 + 0.5) / 6;
  };
}

describe('gameEngine turn flow', () => {
  it('starts a new game with both players at 0', () => {
    const game = createInitialGameState(10000);
    expect(game.players.human.totalScore).toBe(0);
    expect(game.turn.diceToRoll).toBe(6);
    expect(game.turn.phase).toBe('awaiting-roll');
  });

  it('detects a Farkle roll and ends the ability to score', () => {
    const rng = withFixedDice([2, 3, 4, 6, 2, 3]);
    const turn = rollForTurn(createInitialGameState().turn, rng);
    expect(turn.phase).toBe('farkled');
  });

  it('allows selecting scoring dice and locking them in, then rolling remaining dice', () => {
    const rng = withFixedDice([1, 1, 1, 2, 3, 4]);
    let turn = rollForTurn(createInitialGameState().turn, rng);
    expect(turn.phase).toBe('awaiting-selection');

    turn = setSelection(turn, [0, 1, 2]); // the three 1s
    turn = applySelection(turn);
    expect(turn.turnScore).toBe(1000);
    expect(turn.diceToRoll).toBe(3);
    expect(turn.phase).toBe('awaiting-roll');
    expect(turn.isHotDice).toBe(false);
  });

  it('flags hot dice when every rolled die scores, and messages it explicitly', () => {
    const rng = withFixedDice([1, 1, 1, 5, 5, 5]); // three 1s + three 5s: every die scores
    let turn = rollForTurn(createInitialGameState().turn, rng);
    turn = setSelection(turn, [0, 1, 2, 3, 4, 5]);
    turn = applySelection(turn);

    expect(turn.isHotDice).toBe(true);
    expect(turn.diceToRoll).toBe(6);
    expect(turn.log.at(-1)).toMatch(/HOT DICE/i);

    // Rolling again should explicitly call out that it's a hot-dice roll.
    const rng2 = withFixedDice([1, 2, 3, 4, 6, 2]); // contains a scoring 1, so it's not a Farkle
    turn = rollForTurn(turn, rng2);
    expect(turn.log.at(-1)).toMatch(/Hot dice! Rolling a fresh set of 6 dice/i);
  });

  it('clears the hot dice flag once a non-hot-dice selection is applied', () => {
    let turn = createInitialGameState().turn;
    turn = { ...turn, dice: [1, 1, 1, 5, 5, 5], isHotDice: true, selectedIndices: [], phase: 'awaiting-selection' };
    turn = setSelection(turn, [0, 1, 2, 3, 4, 5]);
    turn = applySelection(turn);
    expect(turn.isHotDice).toBe(true);

    turn = { ...turn, dice: [1, 2, 3, 4, 6, 2], selectedIndices: [], phase: 'awaiting-selection' };
    turn = setSelection(turn, [0]); // only the single 1 scores
    turn = applySelection(turn);
    expect(turn.isHotDice).toBe(false);
  });

  it('increments rollId on every roll, including farkled rolls', () => {
    const rng1 = withFixedDice([1, 2, 3, 4, 6, 2]);
    let turn = createInitialGameState().turn;
    expect(turn.rollId).toBe(0);

    turn = rollForTurn(turn, rng1);
    expect(turn.rollId).toBe(1);

    turn = setSelection(turn, [0]);
    turn = applySelection(turn);

    const rngFarkle = withFixedDice([2, 3, 4, 6, 2, 3]);
    turn = { ...turn, dice: [], phase: 'awaiting-roll' };
    turn = rollForTurn(turn, rngFarkle);
    expect(turn.rollId).toBe(2);
    expect(turn.phase).toBe('farkled');
  });

  it('accumulates locked-in dice into heldGroups across multiple rolls in a turn', () => {
    const rng1 = withFixedDice([1, 1, 1, 2, 3, 4]);
    let turn = rollForTurn(createInitialGameState().turn, rng1);
    turn = setSelection(turn, [0, 1, 2]); // three 1s
    turn = applySelection(turn);
    expect(turn.heldGroups).toEqual([[1, 1, 1]]);

    const rng2 = withFixedDice([5, 2, 3]);
    turn = rollForTurn(turn, rng2);
    turn = setSelection(turn, [0]); // the single 5
    turn = applySelection(turn);
    expect(turn.heldGroups).toEqual([
      [1, 1, 1],
      [5],
    ]);
  });

  it('resets heldGroups and rollId for the next player when a turn ends', () => {
    let game = createInitialGameState();
    const rng = withFixedDice([1, 1, 1, 2, 3, 4]);
    game = { ...game, turn: rollForTurn(game.turn, rng) };
    game = { ...game, turn: applySelection(setSelection(game.turn, [0, 1, 2])) };
    expect(game.turn.heldGroups.length).toBeGreaterThan(0);

    game = bankTurn(game);
    expect(game.turn.heldGroups).toEqual([]);
    expect(game.turn.rollId).toBe(0);
  });

  it('allows banking any positive turn score (no minimum entry threshold)', () => {
    let game = createInitialGameState();
    const rng = withFixedDice([1, 2, 3, 4, 6, 2]);
    game = { ...game, turn: rollForTurn(game.turn, rng) };
    game = { ...game, turn: setSelection(game.turn, [0]) };
    game = { ...game, turn: applySelection(game.turn) };
    expect(game.turn.turnScore).toBe(100);
    expect(canBankTurn(game)).toBe(true);
  });

  it('banks points and switches players when allowed', () => {
    let game = createInitialGameState();
    game = { ...game, turn: { ...game.turn, turnScore: 600, phase: 'awaiting-roll' } };
    expect(canBankTurn(game)).toBe(true);
    game = bankTurn(game);
    expect(game.players.human.totalScore).toBe(600);
    expect(game.currentPlayerId).toBe('computer');
  });

  it('ends a Farkled turn with no points banked and switches players', () => {
    let game = createInitialGameState();
    game = { ...game, turn: { ...game.turn, turnScore: 800, phase: 'farkled' } };
    game = endFarkledTurn(game);
    expect(game.players.human.totalScore).toBe(0);
    expect(game.currentPlayerId).toBe('computer');
  });

  it('declares a winner once target score is reached while banking', () => {
    let game = createInitialGameState(1000);
    game = {
      ...game,
      players: { ...game.players, human: { ...game.players.human, totalScore: 500 } },
      turn: { ...game.turn, turnScore: 600, phase: 'awaiting-roll' },
    };
    game = bankTurn(game);
    expect(game.winnerId).toBe('human');
    expect(game.turn.phase).toBe('game-over');
  });
});
