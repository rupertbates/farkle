import { describe, expect, it } from 'vitest';
import { getContinuationValue, getRollDistributionStats } from '../probability';

describe('getRollDistributionStats', () => {
  it('computes the exact Farkle probability for a single die (4 of 6 faces bust)', () => {
    const stats = getRollDistributionStats(1);
    expect(stats.farkleProbability).toBeCloseTo(4 / 6, 10);
  });

  it('computes the exact Farkle probability for two dice', () => {
    // Bust only if neither die is a 1 or 5 and they don't form... (no pair/triple possible with 2 dice)
    // Non-scoring faces per die: {2,3,4,6} = 4 faces. Bust = 4*4/36 = 16/36
    const stats = getRollDistributionStats(2);
    expect(stats.farkleProbability).toBeCloseTo(16 / 36, 10);
  });

  it('gives six dice a low Farkle probability (more combos possible)', () => {
    const stats = getRollDistributionStats(6);
    expect(stats.farkleProbability).toBeLessThan(0.05);
  });

  it('expected best score is positive and less than max possible for 6 dice', () => {
    const stats = getRollDistributionStats(6);
    expect(stats.expectedBestScore).toBeGreaterThan(0);
    expect(stats.expectedBestScore).toBeLessThan(8000);
  });

  it('caches results (same object reference on repeat calls)', () => {
    const a = getRollDistributionStats(3);
    const b = getRollDistributionStats(3);
    expect(a).toBe(b);
  });

  it('throws for an out-of-range dice count', () => {
    expect(() => getRollDistributionStats(0)).toThrow();
    expect(() => getRollDistributionStats(7)).toThrow();
  });
});

describe('getContinuationValue', () => {
  it('depth 0 reduces exactly to the classic one-roll lookahead formula', () => {
    for (let n = 1; n <= 6; n++) {
      const stats = getRollDistributionStats(n);
      const classic = (1 - stats.farkleProbability) * (0 + stats.expectedBestScoreGivenNotFarkle);
      expect(getContinuationValue(n, 0, 0)).toBeCloseTo(classic, 6);
    }
  });

  it('adds turnScoreSoFar as a flat offset at depth 0 (bust contributes 0, not turnScoreSoFar)', () => {
    const stats = getRollDistributionStats(3);
    const classic = (1 - stats.farkleProbability) * (500 + stats.expectedBestScoreGivenNotFarkle);
    expect(getContinuationValue(3, 500, 0)).toBeCloseTo(classic, 6);
  });

  it('deeper lookahead is never worth less than shallower lookahead (more options can only help)', () => {
    for (const depth of [0, 1, 2]) {
      const shallow = getContinuationValue(1, 200, depth);
      const deeper = getContinuationValue(1, 200, depth + 1);
      expect(deeper).toBeGreaterThanOrEqual(shallow - 1e-9);
    }
  });

  it('with 1 die remaining, recommends continuing at low turn scores and banking at high turn scores', () => {
    // Confirms the Hot Dice undervaluation the depth-0 model suffered from is fixed:
    // at a low turn score, the recursive model's extra credit for chaining into a
    // fresh 6 dice via Hot Dice pushes continue's value comfortably above bank's.
    expect(getContinuationValue(1, 50, 2)).toBeGreaterThan(50);
    // At a high turn score, the farkle risk on a lone die outweighs that upside and
    // banking is correctly favored again.
    expect(getContinuationValue(1, 350, 2)).toBeLessThan(350);
  });

  it('throws for an out-of-range dice count', () => {
    expect(() => getContinuationValue(0, 0, 2)).toThrow();
    expect(() => getContinuationValue(7, 0, 2)).toThrow();
  });
});
