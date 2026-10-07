import { tally } from './dice';
import { numberWord } from './textUtils';
import type { DieValue, ScoreBreakdownItem, ScoreResult, SelectionCandidate } from './types';

/** Base point value for three-of-a-kind of a given face. */
function tripleBaseScore(value: DieValue): number {
  return value === 1 ? 1000 : value * 100;
}

/** Score for `count` (3-6) matching dice of the same face, using the standard doubling rule. */
function nOfAKindScore(value: DieValue, count: number): number {
  const base = tripleBaseScore(value);
  const multiplier = 2 ** (count - 3);
  return base * multiplier;
}

/**
 * Checks the two "use all 6 dice at once" special combos (straight, three pairs),
 * shared by `scoreGroup` and `findBestSelection` - both worth 1500 regardless of face
 * values, and not expressible as the usual per-value rules below. Returns `null` if
 * `values` isn't one of these (the normal per-value scoring then applies instead).
 */
function scoreSixDiceSpecial(values: DieValue[]): ScoreResult | null {
  if (values.length !== 6) return null;

  const sorted = [...values].sort();
  if (sorted.join(',') === '1,2,3,4,5,6') {
    return {
      valid: true,
      score: 1500,
      breakdown: [{ description: 'Straight (1-2-3-4-5-6)', values: sorted, points: 1500 }],
    };
  }

  const counts = tally(values);
  const pairValues = (Object.entries(counts) as [string, number][]).filter(([, c]) => c === 2);
  if (pairValues.length === 3) {
    return {
      valid: true,
      score: 1500,
      breakdown: [{ description: 'Three pairs', values: sorted, points: 1500 }],
    };
  }

  return null;
}

interface ScoredValueGroup {
  value: DieValue;
  /** How many of this face are taken by this group (always matches `counts[value]` -
   *  there's no partial-taking at this level, that's handled by the caller). */
  count: number;
  points: number;
  description: string;
}

/**
 * Scores every individually-scoring run of same-face dice (3+ of a kind, lone 1s, lone
 * 5s) - the per-value rules shared by `scoreGroup` (does this exact set of dice fully
 * score?) and `findBestSelection` (which dice should be greedily taken from a roll?).
 */
function scoreValueGroups(counts: Record<DieValue, number>): ScoredValueGroup[] {
  const groups: ScoredValueGroup[] = [];

  for (const key of Object.keys(counts)) {
    const value = Number(key) as DieValue;
    const count = counts[value];
    if (count === 0) continue;

    if (count >= 3) {
      groups.push({ value, count, points: nOfAKindScore(value, count), description: `${count} of a kind (${value}s)` });
    } else if (value === 1 || value === 5) {
      const points = value === 1 ? count * 100 : count * 50;
      groups.push({ value, count, points, description: count === 1 ? `Single ${value}` : `${count} x single ${value}` });
    }
    // other values with count < 3 do not score and are left out of the groups
  }

  return groups;
}

/**
 * Scores an exact group of dice (e.g. the dice a player wants to bank this roll).
 * `valid` is false if any die in the group does not contribute to the score -
 * a legal selection must use every die it contains.
 */
export function scoreGroup(values: DieValue[]): ScoreResult {
  const special = scoreSixDiceSpecial(values);
  if (special) return special;

  const groups = scoreValueGroups(tally(values));
  const breakdown: ScoreBreakdownItem[] = groups.map((g) => ({
    description: g.description,
    values: Array(g.count).fill(g.value) as DieValue[],
    points: g.points,
  }));
  const score = groups.reduce((sum, g) => sum + g.points, 0);
  const usedCount = groups.reduce((sum, g) => sum + g.count, 0);

  return { valid: usedCount === values.length, score, breakdown };
}

/** True if there is at least one scoring die/combo anywhere in `values` (used to detect a Farkle). */
export function hasAnyScore(values: DieValue[]): boolean {
  return findBestSelection(values).result.score > 0;
}

/**
 * Finds the maximum-scoring subset of a roll. Returns the indices selected, the
 * remaining (non-scoring) indices, and the score breakdown. This greedily takes every
 * scoring die, which always maximizes the single-roll score given the doubling rule.
 */
export function findBestSelection(values: DieValue[]): {
  selectedIndices: number[];
  remainingIndices: number[];
  result: ScoreResult;
} {
  const special = scoreSixDiceSpecial(values);
  if (special) {
    return { selectedIndices: values.map((_, i) => i), remainingIndices: [], result: special };
  }

  const groups = scoreValueGroups(tally(values));
  const breakdown: ScoreBreakdownItem[] = groups.map((g) => ({
    description: g.description,
    values: Array(g.count).fill(g.value) as DieValue[],
    points: g.points,
  }));
  const score = groups.reduce((sum, g) => sum + g.points, 0);

  const takenPerValue: Record<DieValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const g of groups) takenPerValue[g.value] = g.count;

  const selectedIndices: number[] = [];
  const remainingIndices: number[] = [];
  values.forEach((v, i) => {
    if (takenPerValue[v] > 0) {
      takenPerValue[v]--;
      selectedIndices.push(i);
    } else {
      remainingIndices.push(i);
    }
  });

  return { selectedIndices, remainingIndices, result: { valid: remainingIndices.length === 0, score, breakdown } };
}

/**
 * Describes, in plain English, the dice this candidate actually keeps - phrased only in
 * terms of what's kept (never what's skipped, so advice always reads as a positive
 * instruction). Any die that doesn't contribute to a score is never part of
 * `bestIndices` in the first place (the greedy `findBestSelection` already captures
 * every scoring die), so every valid subset is necessarily a subset of `bestIndices`.
 *
 * Unlike the partial-keep case below (which already names the dice by value and count,
 * e.g. "three 1s"), "take everything" doesn't otherwise say *which* dice that means - so
 * it's spelled out explicitly here, along with the score, rather than leaving that only
 * in the apply button's text.
 */
function describeSelection(values: DieValue[], bestIndices: number[], indices: number[], subsetValues: DieValue[], score: number): string {
  if (indices.length === bestIndices.length) {
    return `Take all scoring dice (${subsetValues.join(', ')}) for ${score.toLocaleString()} pts`;
  }

  const countInBest = (value: DieValue) => bestIndices.filter((i) => values[i] === value).length;
  const countKept = (value: DieValue) => indices.filter((i) => values[i] === value).length;

  const distinctBestValues = Array.from(new Set(bestIndices.map((i) => values[i])));
  const parts: string[] = [];

  for (const value of distinctBestValues) {
    const total = countInBest(value);
    const kept = countKept(value);
    if (kept === 0) continue; // Nothing of this value is kept - say nothing about it.
    if (kept === total) {
      parts.push(`${numberWord(total)} ${value}${total > 1 ? 's' : ''}`);
    } else {
      parts.push(`${numberWord(kept)} of ${numberWord(total)} ${value}s`);
    }
  }

  return `Keep ${parts.join(' and ')}, reroll the rest`;
}

/**
 * Generates every legal dice-selection strategy for a roll, so the advisor can compare
 * "take everything" against every way of leaving some lone scoring dice behind to reroll
 * for a bigger combo (e.g. banking only one of two lone 5s). Dice that are part of a 3+
 * of a kind are always taken together as one atomic group - splitting a triple/quad apart
 * is a legal but rarely-useful corner case we don't surface here. Only "lone" 1s and 5s
 * (scoring individually because there are fewer than three of that face) are genuinely
 * optional, and since a roll has at most two lone 1s and two lone 5s, there are at most
 * 2^4 = 16 combinations to check - trivial cost.
 */
export function generateSelectionCandidates(values: DieValue[]): SelectionCandidate[] {
  const best = findBestSelection(values);
  if (best.result.score === 0) return [];

  const bestIndices = best.selectedIndices;
  const counts = tally(values);
  const isLoneSingle = (i: number) => {
    const v = values[i];
    return (v === 1 || v === 5) && counts[v] < 3;
  };

  const mandatoryIndices = bestIndices.filter((i) => !isLoneSingle(i));
  const optionalIndices = bestIndices.filter((i) => isLoneSingle(i));

  const seen = new Map<string, SelectionCandidate>();

  for (let mask = 0; mask < 1 << optionalIndices.length; mask++) {
    const chosenOptional = optionalIndices.filter((_, bit) => mask & (1 << bit));
    const indices = [...mandatoryIndices, ...chosenOptional].sort((a, b) => a - b);
    if (indices.length === 0) continue; // must take at least one scoring die

    const subsetValues = indices.map((i) => values[i]);
    const result = scoreGroup(subsetValues);
    if (!result.valid || result.score <= 0) continue;

    // Dedupe by (dice used, score): these fully determine the expected value of this
    // strategy, so interchangeable subsets (e.g. "either lone 5" of a pair) collapse
    // into a single representative candidate.
    const key = `${indices.length}:${result.score}`;
    if (seen.has(key)) continue;

    seen.set(key, {
      indices,
      values: subsetValues,
      result,
      label: describeSelection(values, bestIndices, indices, subsetValues, result.score),
    });
  }

  return Array.from(seen.values()).sort((a, b) => b.indices.length - a.indices.length);
}
