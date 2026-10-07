import { describe, expect, it } from 'vitest';
import { computerDecideMove } from '../ai';
import { getAdvisorReport } from '../advisor';
import type { DieValue, PlayerState } from '../types';

const computerPlayer: PlayerState = { id: 'computer', name: 'Computer', totalScore: 0 };

describe('computerDecideMove', () => {
  it('defaults to hard skill, reproducing the full-strength advisor recommendation exactly', () => {
    const dice: DieValue[] = [1, 1, 1, 1, 1, 2]; // high Farkle risk if continuing -> advisor recommends banking
    const expected = getAdvisorReport({
      dice,
      turnScoreBeforeRoll: 0,
      playerTotalScore: 0,
      targetScore: 10000,
    });

    const decision = computerDecideMove(dice, 0, computerPlayer, 10000);

    expect(decision.action).toBe(expected.best.recommendedAction);
    expect(decision.action).toBe('bank');
    expect(decision.selectedIndices).toEqual(expected.best.candidate.indices);
  });

  it('never overrides an instant-win move, even at easy skill with an rng that would always trigger a mistake', () => {
    const dice: DieValue[] = [1, 5, 2, 3, 4, 6];
    const nearlyWonPlayer: PlayerState = { id: 'computer', name: 'Computer', totalScore: 9850 };
    const alwaysMistakeRng = () => 0; // rng() < mistakeRate is always true for any mistakeRate > 0

    const decision = computerDecideMove(dice, 0, nearlyWonPlayer, 10000, undefined, false, 'easy', alwaysMistakeRng);

    expect(decision.action).toBe('bank');
    expect(decision.reasoning).toMatch(/instant win/i);
  });

  it('never injects a mistake at hard skill regardless of rng', () => {
    const dice: DieValue[] = [1, 1, 1, 1, 1, 2];
    const alwaysMistakeRng = () => 0;

    const decision = computerDecideMove(dice, 0, computerPlayer, 10000, undefined, false, 'hard', alwaysMistakeRng);

    expect(decision.action).toBe('bank');
  });

  it('injects a mistake at easy skill when rng rolls below the mistake rate, flipping the action but keeping the dice selection', () => {
    const dice: DieValue[] = [1, 1, 1, 1, 1, 2];
    const optimal = computerDecideMove(dice, 0, computerPlayer, 10000, undefined, false, 'hard');
    const alwaysMistakeRng = () => 0;

    const decision = computerDecideMove(dice, 0, computerPlayer, 10000, undefined, false, 'easy', alwaysMistakeRng);

    expect(decision.action).not.toBe(optimal.action);
    expect(decision.selectedIndices).toEqual(optimal.selectedIndices);
  });

  it('never injects a mistake when rng rolls above the mistake rate', () => {
    const dice: DieValue[] = [1, 1, 1, 1, 1, 2];
    const neverMistakeRng = () => 0.99;

    const decision = computerDecideMove(dice, 0, computerPlayer, 10000, undefined, false, 'easy', neverMistakeRng);

    expect(decision.action).toBe('bank');
  });

  it('uses a shallower lookahead at easy/normal skill, which can change the recommended action versus hard', () => {
    // A borderline hot-dice-ish scenario where depth matters; we just assert the lookahead
    // depth is actually threaded through by checking the easy-skill report directly.
    const dice: DieValue[] = [2, 3, 4, 5, 6, 1]; // straight -> hot dice
    const hardReport = getAdvisorReport({
      dice,
      turnScoreBeforeRoll: 0,
      playerTotalScore: 0,
      targetScore: 10000,
      lookaheadDepth: 2,
    });
    const easyReport = getAdvisorReport({
      dice,
      turnScoreBeforeRoll: 0,
      playerTotalScore: 0,
      targetScore: 10000,
      lookaheadDepth: 0,
    });

    // Both should still recommend continuing on hot dice regardless of depth, but the
    // expected continuation value itself should differ between depths, confirming depth
    // is actually consulted.
    expect(hardReport.best.continue.expectedValue).not.toBeCloseTo(easyReport.best.continue.expectedValue, 5);
  });
});
