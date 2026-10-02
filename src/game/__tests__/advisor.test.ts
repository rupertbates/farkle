import { describe, expect, it } from 'vitest';
import { getAdvisorReport } from '../advisor';
import type { DieValue } from '../types';

describe('getAdvisorReport', () => {
  it('recommends banking when very close to the win target', () => {
    const dice: DieValue[] = [1, 5, 2, 3, 4, 6];
    const report = getAdvisorReport({
      dice,
      turnScoreBeforeRoll: 0,
      playerTotalScore: 9850,
      targetScore: 10000,
    });
    expect(report.wouldWinByBanking).toBe(true);
  });

  it('produces a report with at least one option for a scoring roll', () => {
    const dice: DieValue[] = [1, 1, 1, 2, 3, 4];
    const report = getAdvisorReport({
      dice,
      turnScoreBeforeRoll: 0,
      playerTotalScore: 0,
      targetScore: 10000,
    });
    expect(report.options.length).toBeGreaterThan(0);
    expect(report.best.candidate.result.score).toBeGreaterThan(0);
  });

  it('recommends continuing when only 1 die remains to score and turn score is low (high upside, low downside)', () => {
    const dice: DieValue[] = [1, 2, 3, 4, 5, 6]; // straight, uses all dice -> hot dice, 6 to reroll
    const report = getAdvisorReport({
      dice,
      turnScoreBeforeRoll: 0,
      playerTotalScore: 0,
      targetScore: 10000,
    });
    expect(report.best.diceRemainingIfContinuing).toBe(6);
    // With hot dice, farkle probability is low, so continuing should be favored.
    expect(report.best.recommendedAction).toBe('continue');
    expect(report.best.isHotDice).toBe(true);
    expect(report.best.continue.explanation).toMatch(/hot dice/i);
  });

  it('recommends banking when continuing has high Farkle risk relative to the small expected upside', () => {
    const dice: DieValue[] = [1, 1, 1, 1, 1, 2]; // five 1s scores big, leaving only 1 die (high bust risk) to reroll
    const report = getAdvisorReport({
      dice,
      turnScoreBeforeRoll: 0,
      playerTotalScore: 0,
      targetScore: 10000,
    });
    expect(report.best.diceRemainingIfContinuing).toBe(1);
    expect(report.best.recommendedAction).toBe('bank');
    expect(report.best.isHotDice).toBe(false);
  });

  describe('riskAwareness', () => {
    // A single lone 5 with only 1 die left to reroll, after already banking a decent
    // turn score: pure EV favors banking (350 vs ~306.9 under the depth-2 recursive
    // continuation model), a margin small enough for a catch-up bias to flip.
    const closeCallDice: DieValue[] = [5, 2];
    const closeCallTurnScoreBeforeRoll = 300;

    it('has no effect when disabled, even with an opponent score supplied', () => {
      const report = getAdvisorReport({
        dice: closeCallDice,
        turnScoreBeforeRoll: closeCallTurnScoreBeforeRoll,
        playerTotalScore: 0,
        targetScore: 10000,
        opponentTotalScore: 9000,
        riskAwareness: false,
      });
      expect(report.best.recommendedAction).toBe('bank');
      expect(report.best.riskAdjustmentExplanation).toBe('');
      expect(report.best.adjustedContinueExpectedValue).toBe(report.best.continue.expectedValue);
    });

    it('has no effect when enabled but no opponent score is supplied', () => {
      const report = getAdvisorReport({
        dice: closeCallDice,
        turnScoreBeforeRoll: closeCallTurnScoreBeforeRoll,
        playerTotalScore: 0,
        targetScore: 10000,
        riskAwareness: true,
      });
      expect(report.best.recommendedAction).toBe('bank');
      expect(report.best.riskAdjustmentExplanation).toBe('');
    });

    it('biases toward continuing when significantly behind the opponent', () => {
      const report = getAdvisorReport({
        dice: closeCallDice,
        turnScoreBeforeRoll: closeCallTurnScoreBeforeRoll,
        playerTotalScore: 0,
        targetScore: 10000,
        opponentTotalScore: 1000,
        riskAwareness: true,
      });
      expect(report.best.recommendedAction).toBe('continue');
      expect(report.best.riskAdjustmentExplanation).toMatch(/behind/i);
    });

    it('biases toward banking when close to the winning score, even if continuing has a slightly better raw EV', () => {
      // Lone 5 with 4 dice left to reroll: pure EV narrowly favors continuing,
      // but banking would leave the player only 100 points from winning - safety
      // should be preferred.
      const dice: DieValue[] = [5, 2, 3, 4, 6];
      const pureReport = getAdvisorReport({
        dice,
        turnScoreBeforeRoll: 850,
        playerTotalScore: 9000,
        targetScore: 10000,
      });
      expect(pureReport.best.recommendedAction).toBe('continue');

      const riskAwareReport = getAdvisorReport({
        dice,
        turnScoreBeforeRoll: 850,
        playerTotalScore: 9000,
        targetScore: 10000,
        opponentTotalScore: 0,
        riskAwareness: true,
      });
      expect(riskAwareReport.best.recommendedAction).toBe('bank');
      expect(riskAwareReport.best.riskAdjustmentExplanation).toMatch(/close to the winning score/i);
    });
  });
});
