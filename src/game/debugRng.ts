/**
 * Optional QA override: reading a `?dice=1,1,1,2,2,2` query param from the URL lets
 * every dice roll be forced to cycle through a fixed sequence of faces instead of
 * using real randomness - handy for reliably reproducing a specific scenario (e.g.
 * hot dice, a Farkle, a particular combo) to check it by hand, without waiting on
 * luck. Remove the query param (or reload without it) to go back to normal play.
 */
export function createDebugRng(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): (() => number) | undefined {
  const raw = new URLSearchParams(search).get('dice');
  if (!raw) return undefined;

  const faces = raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 6);
  if (faces.length === 0) return undefined;

  let i = 0;
  return () => {
    const face = faces[i % faces.length];
    i += 1;
    // rollDice computes `Math.floor(rng() * 6) + 1` per die, so this inverts that
    // back to land exactly on `face`.
    return (face - 1) / 6;
  };
}
