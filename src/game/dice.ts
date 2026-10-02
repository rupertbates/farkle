import type { DieValue } from './types';

/**
 * Rolls `count` six-sided dice using a supplied RNG (defaults to Math.random),
 * so tests can inject a deterministic/stubbed generator.
 */
export function rollDice(count: number, rng: () => number = Math.random): DieValue[] {
  const dice: DieValue[] = [];
  for (let i = 0; i < count; i++) {
    dice.push((Math.floor(rng() * 6) + 1) as DieValue);
  }
  return dice;
}

/** Tallies how many of each face value (1-6) appear in `values`. */
export function tally(values: DieValue[]): Record<DieValue, number> {
  const counts: Record<DieValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const v of values) counts[v]++;
  return counts;
}
