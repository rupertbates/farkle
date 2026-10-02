const ROWS: { combo: string; points: string }[] = [
  { combo: 'Single 1', points: '100' },
  { combo: 'Single 5', points: '50' },
  { combo: 'Three 1s', points: '1,000' },
  { combo: 'Three 2s', points: '200' },
  { combo: 'Three 3s', points: '300' },
  { combo: 'Three 4s', points: '400' },
  { combo: 'Three 5s', points: '500' },
  { combo: 'Three 6s', points: '600' },
  { combo: 'Four of a kind', points: '2 x three-of-a-kind' },
  { combo: 'Five of a kind', points: '4 x three-of-a-kind' },
  { combo: 'Six of a kind', points: '8 x three-of-a-kind' },
  { combo: 'Straight (1-6)', points: '1,500' },
  { combo: 'Three pairs', points: '1,500' },
];

/** Static reference panel listing every scoring combination and its value. */
export function ScoringChart() {
  return (
    <div className="scoring-chart">
      <h4>Scoring guide</h4>
      <table className="scoring-chart__table">
        <thead>
          <tr>
            <th>Combination</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.combo}>
              <td>{row.combo}</td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="scoring-chart__note">
        Each extra die beyond three-of-a-kind doubles that combo&rsquo;s score. Farkle (no scoring dice) loses all
        unbanked points for the turn.
      </p>
    </div>
  );
}
