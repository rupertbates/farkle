export interface TurnLogProps {
  log: string[];
}

export function TurnLog({ log }: TurnLogProps) {
  if (log.length === 0) return null;
  return (
    <div className="turn-log">
      <h4>This turn</h4>
      <ul>
        {log.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}
