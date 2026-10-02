import { describe, expect, it } from 'vitest';
import { createDebugRng } from '../debugRng';
import { rollDice } from '../dice';

describe('createDebugRng', () => {
  it('returns undefined when there is no `dice` query param', () => {
    expect(createDebugRng('')).toBeUndefined();
    expect(createDebugRng('?other=1')).toBeUndefined();
  });

  it('returns undefined when the `dice` param has no valid faces', () => {
    expect(createDebugRng('?dice=')).toBeUndefined();
    expect(createDebugRng('?dice=0,7,abc')).toBeUndefined();
  });

  it('forces rollDice to produce the exact faces given, in order', () => {
    const rng = createDebugRng('?dice=1,1,1,2,2,2');
    expect(rng).toBeDefined();
    expect(rollDice(6, rng)).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('cycles back to the start of the sequence once exhausted', () => {
    const rng = createDebugRng('?dice=6,3');
    expect(rng).toBeDefined();
    expect(rollDice(5, rng)).toEqual([6, 3, 6, 3, 6]);
  });

  it('ignores out-of-range or non-numeric entries but keeps the valid ones', () => {
    const rng = createDebugRng('?dice=4, 0, 9, five, 2');
    expect(rng).toBeDefined();
    expect(rollDice(4, rng)).toEqual([4, 2, 4, 2]);
  });
});
