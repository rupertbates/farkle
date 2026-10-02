import type { DieValue } from './types';
import { findBestSelection, generateSelectionCandidates } from './scoring';

export interface RollDistributionStats {
  diceCount: number;
  /** Exact probability (0-1) that this many freshly rolled dice produce zero scoring dice (a Farkle). */
  farkleProbability: number;
  /** Exact expected value of the best-scoring subset, averaged over every possible outcome (including busts, which contribute 0). */
  expectedBestScore: number;
  /** Expected best score conditioned on the roll NOT being a Farkle. */
  expectedBestScoreGivenNotFarkle: number;
}

const cache = new Map<number, RollDistributionStats>();

/**
 * Exhaustively enumerates every 6^n outcome for n dice (n <= 6, so at most 46656
 * outcomes) to compute exact Farkle probability and expected best-selection score.
 * Results are cached since there are only 6 possible dice counts.
 */
export function getRollDistributionStats(diceCount: number): RollDistributionStats {
  if (diceCount <= 0 || diceCount > 6) {
    throw new Error(`diceCount must be between 1 and 6, got ${diceCount}`);
  }
  const cached = cache.get(diceCount);
  if (cached) return cached;

  let farkleOutcomes = 0;
  let totalScore = 0;
  const totalOutcomes = 6 ** diceCount;

  const dice: DieValue[] = new Array(diceCount).fill(1) as DieValue[];

  for (let outcome = 0; outcome < totalOutcomes; outcome++) {
    let rem = outcome;
    for (let i = 0; i < diceCount; i++) {
      dice[i] = ((rem % 6) + 1) as DieValue;
      rem = Math.floor(rem / 6);
    }
    const { result } = findBestSelection(dice);
    if (result.score === 0) farkleOutcomes++;
    totalScore += result.score;
  }

  const farkleProbability = farkleOutcomes / totalOutcomes;
  const expectedBestScore = totalScore / totalOutcomes;
  const notFarkleOutcomes = totalOutcomes - farkleOutcomes;
  const expectedBestScoreGivenNotFarkle = notFarkleOutcomes > 0 ? totalScore / notFarkleOutcomes : 0;

  const stats: RollDistributionStats = {
    diceCount,
    farkleProbability,
    expectedBestScore,
    expectedBestScoreGivenNotFarkle,
  };
  cache.set(diceCount, stats);
  return stats;
}

/** Precomputes and returns stats for all dice counts 1-6. */
export function getAllRollDistributionStats(): RollDistributionStats[] {
  return [1, 2, 3, 4, 5, 6].map(getRollDistributionStats);
}

interface WeightedRoll {
  dice: DieValue[];
  /** Number of raw 6^n permutations this sorted combination represents. */
  weight: number;
}

const uniqueRollCache = new Map<number, WeightedRoll[]>();

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * Enumerates every distinct sorted dice combination for `diceCount` dice (order doesn't
 * affect scoring or Farkle status), each tagged with how many of the 6^n raw outcomes it
 * represents. This is a huge reduction vs. raw permutations (e.g. 462 vs 46,656 for 6
 * dice) and is exact (weights are proper multinomial coefficients), which makes the
 * recursive multi-roll lookahead below tractable.
 */
function enumerateUniqueRolls(diceCount: number): WeightedRoll[] {
  const cached = uniqueRollCache.get(diceCount);
  if (cached) return cached;

  const results: WeightedRoll[] = [];
  const current: DieValue[] = [];

  function recurse(start: number) {
    if (current.length === diceCount) {
      const counts = new Map<DieValue, number>();
      for (const v of current) counts.set(v, (counts.get(v) ?? 0) + 1);
      let denominator = 1;
      for (const count of counts.values()) denominator *= factorial(count);
      results.push({ dice: [...current], weight: factorial(diceCount) / denominator });
      return;
    }
    for (let v = start; v <= 6; v++) {
      current.push(v as DieValue);
      recurse(v);
      current.pop();
    }
  }

  recurse(1);
  uniqueRollCache.set(diceCount, results);
  return results;
}

/** Default number of additional voluntary "continue" decisions the deep continuation
 *  value looks ahead through, beyond the roll actually being evaluated. 0 reproduces the
 *  classic single-roll lookahead; higher values better capture compounding chains like
 *  repeated Hot Dice, at a (quickly diminishing) extra computation cost. */
export const DEFAULT_LOOKAHEAD_DEPTH = 2;

const continuationCache = new Map<string, number>();
const stateValueCache = new Map<string, number>();

/**
 * The value of *being at* a decision point with `diceCount` dice available to roll and
 * `turnScoreSoFar` already accumulated this turn, with `depthRemaining` further
 * voluntary rolls allowed after whichever one is taken next: the greater of banking now
 * (certain `turnScoreSoFar`) or rolling (see `getContinuationValue`).
 */
function getStateValue(diceCount: number, turnScoreSoFar: number, depthRemaining: number): number {
  const key = `${diceCount}:${turnScoreSoFar}:${depthRemaining}`;
  const cached = stateValueCache.get(key);
  if (cached !== undefined) return cached;

  const value = Math.max(turnScoreSoFar, getContinuationValue(diceCount, turnScoreSoFar, depthRemaining));
  stateValueCache.set(key, value);
  return value;
}

interface PrecomputedRollOutcome {
  /** Dice count after taking this candidate (6 if it was a Hot Dice selection). */
  nextDiceCount: number;
  /** Points this candidate selection adds. */
  score: number;
}

interface PrecomputedRoll {
  weight: number;
  /** Every viable selection candidate for this dice combination; empty means Farkle. */
  outcomes: PrecomputedRollOutcome[];
}

const precomputedRollCache = new Map<number, PrecomputedRoll[]>();

/**
 * Precomputes, once per dice count, each unique roll's weight and the (dice-count,
 * score) pair for every selection candidate it offers. Candidate generation (subset
 * enumeration + scoring) depends only on the dice values, never on `turnScoreSoFar` or
 * `depthRemaining`, so doing this once up front - rather than inside the recursive,
 * per-(score, depth) hot loop - is what keeps the recursive lookahead fast.
 */
function getPrecomputedRolls(diceCount: number): PrecomputedRoll[] {
  const cached = precomputedRollCache.get(diceCount);
  if (cached) return cached;

  const rolls = enumerateUniqueRolls(diceCount).map(({ dice, weight }) => {
    const outcomes = generateSelectionCandidates(dice).map((candidate) => {
      const isHotDice = candidate.indices.length === dice.length;
      return { nextDiceCount: isHotDice ? 6 : dice.length - candidate.indices.length, score: candidate.result.score };
    });
    return { weight, outcomes };
  });

  precomputedRollCache.set(diceCount, rolls);
  return rolls;
}

/**
 * Exact expected value of actually rolling `diceCount` dice right now with
 * `turnScoreSoFar` already banked this turn, playing optimally (choosing the best
 * scoring selection, then optimally banking or continuing again) for up to
 * `depthRemaining` further rolls beyond this one. Farkle outcomes contribute 0, exactly
 * as a real Farkle would wipe out `turnScoreSoFar` for the turn.
 *
 * `depthRemaining = 0` collapses to the classic one-roll lookahead (always take the
 * single highest-scoring selection, then stop) - equivalent to the original formula:
 * `(1 - farkleProbability) * (turnScoreSoFar + expectedBestScoreGivenNotFarkle)`.
 *
 * Dice counts are deduplicated to unique sorted combinations (`enumerateUniqueRolls`),
 * their candidate selections are precomputed once per dice count (`getPrecomputedRolls`),
 * and every (diceCount, turnScoreSoFar, depthRemaining) result is memoized - so even
 * though this recurses through further rolls (including repeated Hot Dice resets to 6
 * dice), real-world calls resolve in well under a millisecond after the first warm-up.
 */
export function getContinuationValue(diceCount: number, turnScoreSoFar: number, depthRemaining: number): number {
  if (diceCount <= 0 || diceCount > 6) {
    throw new Error(`diceCount must be between 1 and 6, got ${diceCount}`);
  }

  const key = `${diceCount}:${turnScoreSoFar}:${depthRemaining}`;
  const cached = continuationCache.get(key);
  if (cached !== undefined) return cached;

  const rolls = getPrecomputedRolls(diceCount);
  const totalWeight = 6 ** diceCount;
  let expected = 0;

  for (const { weight, outcomes } of rolls) {
    if (outcomes.length === 0) continue; // Farkle: contributes 0, as omitted from the sum.

    let bestOutcomeValue = -Infinity;
    for (const { nextDiceCount, score } of outcomes) {
      const newScore = turnScoreSoFar + score;
      const outcomeValue = depthRemaining > 0 ? getStateValue(nextDiceCount, newScore, depthRemaining - 1) : newScore;
      if (outcomeValue > bestOutcomeValue) bestOutcomeValue = outcomeValue;
    }

    expected += (weight / totalWeight) * bestOutcomeValue;
  }

  continuationCache.set(key, expected);
  return expected;
}
