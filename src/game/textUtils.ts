const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** Spells out small counts (0-6, the only range ever needed for a dice count) in
 *  words, since advisor copy reads more naturally as "two dice" than "2 dice". Falls
 *  back to the numeral for anything outside that range. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
