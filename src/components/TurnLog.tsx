export interface TurnLogProps {
  log: string[];
}

export function TurnLog({ log }: TurnLogProps) {
  if (log.length === 0) {
    return <p className="turn-log__placeholder">Events from this turn (rolls, holds, banking) will appear here.</p>;
  }
  return (
    <ul className="turn-log">
      {log.map((entry, i) => (
        <li key={i}>{entry}</li>
      ))}
    </ul>
  );
}
