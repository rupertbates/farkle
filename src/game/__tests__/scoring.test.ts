import { describe, expect, it } from 'vitest';
import { scoreGroup, findBestSelection, hasAnyScore, generateSelectionCandidates } from '../scoring';
import type { DieValue } from '../types';

describe('scoreGroup', () => {
  it('scores a single 1 as 100', () => {
    expect(scoreGroup([1])).toMatchObject({ valid: true, score: 100 });
  });

  it('scores a single 5 as 50', () => {
    expect(scoreGroup([5])).toMatchObject({ valid: true, score: 50 });
  });

  it('scores three 1s as 1000', () => {
    expect(scoreGroup([1, 1, 1])).toMatchObject({ valid: true, score: 1000 });
  });

  it('scores three 4s as 400', () => {
    expect(scoreGroup([4, 4, 4])).toMatchObject({ valid: true, score: 400 });
  });

  it('doubles for four of a kind', () => {
    expect(scoreGroup([4, 4, 4, 4])).toMatchObject({ valid: true, score: 800 });
  });

  it('quadruples for five of a kind', () => {
    expect(scoreGroup([2, 2, 2, 2, 2])).toMatchObject({ valid: true, score: 800 });
  });

  it('octuples for six of a kind', () => {
    expect(scoreGroup([3, 3, 3, 3, 3, 3])).toMatchObject({ valid: true, score: 2400 });
  });

  it('scores six of a kind 1s as 8000', () => {
    expect(scoreGroup([1, 1, 1, 1, 1, 1])).toMatchObject({ valid: true, score: 8000 });
  });

  it('scores a straight as 1500', () => {
    expect(scoreGroup([1, 2, 3, 4, 5, 6])).toMatchObject({ valid: true, score: 1500 });
  });

  it('scores three pairs as 1500', () => {
    expect(scoreGroup([2, 2, 4, 4, 6, 6])).toMatchObject({ valid: true, score: 1500 });
  });

  it('marks a selection with a non-scoring die as invalid', () => {
    expect(scoreGroup([1, 2])).toMatchObject({ valid: false });
  });

  it('marks a lone pair (not three pairs) as invalid', () => {
    expect(scoreGroup([2, 2])).toMatchObject({ valid: false });
  });

  it('combines multiple scoring groups within a selection', () => {
    // three 2s (200) + a single 1 (100) + a single 5 (50)
    expect(scoreGroup([2, 2, 2, 1, 5])).toMatchObject({ valid: true, score: 350 });
  });
});

describe('hasAnyScore', () => {
  it('is false for a classic Farkle roll', () => {
    expect(hasAnyScore([2, 3, 4, 6, 2, 3])).toBe(false);
  });

  it('is true when a 1 or 5 is present', () => {
    expect(hasAnyScore([2, 3, 4, 6, 1, 3])).toBe(true);
  });
});

describe('findBestSelection', () => {
  it('selects only the scoring dice and leaves the rest for reroll', () => {
    const dice: DieValue[] = [1, 2, 2, 3, 4, 6];
    const { selectedIndices, remainingIndices, result } = findBestSelection(dice);
    expect(result.score).toBe(100); // single 1 only; the pair of 2s doesn't score
    expect(selectedIndices).toEqual([0]);
    expect(remainingIndices.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('takes a full straight when present', () => {
    const dice: DieValue[] = [1, 2, 3, 4, 5, 6];
    const { result, remainingIndices } = findBestSelection(dice);
    expect(result.score).toBe(1500);
    expect(remainingIndices).toEqual([]);
  });
});

describe('generateSelectionCandidates', () => {
  it('returns no candidates for a Farkle roll', () => {
    expect(generateSelectionCandidates([2, 3, 4, 6, 2, 3])).toEqual([]);
  });

  it('offers a trimmed alternative that keeps only the mandatory dice', () => {
    const dice: DieValue[] = [1, 1, 1, 5, 2, 3];
    const candidates = generateSelectionCandidates(dice);
    const labels = candidates.map((c) => c.label);
    expect(labels).toContain('Take all scoring dice (1, 1, 1, 5) for 1,050 pts');
    expect(labels).toContain('Keep three 1s, reroll the rest');
  });

  it('offers a partial-take alternative when there are two lone 5s and nothing else scores', () => {
    // Only the two 5s score here - taking just one and rerolling the other 5 dice
    // (rather than both and rerolling only 4) must also be a candidate.
    const dice: DieValue[] = [5, 5, 2, 3, 4, 6];
    const candidates = generateSelectionCandidates(dice);
    expect(candidates).toHaveLength(2);

    const takeAll = candidates.find((c) => c.label === 'Take all scoring dice (5, 5) for 100 pts');
    expect(takeAll).toMatchObject({ result: { score: 100 } });
    expect(takeAll?.indices).toHaveLength(2);

    const takeOne = candidates.find((c) => c.indices.length === 1);
    expect(takeOne).toMatchObject({ result: { score: 50 }, label: 'Keep one of two 5s, reroll the rest' });
  });

  it('does not split a 3+ of a kind group into partial sub-selections', () => {
    // Six 1s should only ever offer "take all six" (8,000 pts) - breaking the group
    // into smaller matching subsets is a legal but not useful strategy we don't surface.
    const dice: DieValue[] = [1, 1, 1, 1, 1, 1];
    const candidates = generateSelectionCandidates(dice);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ label: 'Take all scoring dice (1, 1, 1, 1, 1, 1) for 8,000 pts', result: { score: 8000 } });
  });
});
