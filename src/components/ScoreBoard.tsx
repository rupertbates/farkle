import type { GameState } from '../game';

export interface ScoreBoardProps {
  game: GameState;
}

export function ScoreBoard({ game }: ScoreBoardProps) {
  const { players, currentPlayerId, targetScore } = game;
  return (
    <div className="scoreboard">
      <div className={`scoreboard__player${currentPlayerId === 'human' ? ' scoreboard__player--active' : ''}`}>
        <h3>{players.human.name}</h3>
        <p className="scoreboard__total">{players.human.totalScore.toLocaleString()}</p>
      </div>
      <div className="scoreboard__middle">
        <p className="scoreboard__target">Target: {targetScore.toLocaleString()}</p>
      </div>
      <div className={`scoreboard__player${currentPlayerId === 'computer' ? ' scoreboard__player--active' : ''}`}>
        <h3>{players.computer.name}</h3>
        <p className="scoreboard__total">{players.computer.totalScore.toLocaleString()}</p>
      </div>
    </div>
  );
}
