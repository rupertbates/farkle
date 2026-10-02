import type { GameState } from '../game';

export interface ScoreBoardProps {
  game: GameState;
}

export function ScoreBoard({ game }: ScoreBoardProps) {
  const { players, currentPlayerId, targetScore, turn } = game;
  return (
    <div className="scoreboard">
      <div className={`scoreboard__player${currentPlayerId === 'human' ? ' scoreboard__player--active' : ''}`}>
        <h3>{players.human.name}</h3>
        <p className="scoreboard__total">{players.human.totalScore.toLocaleString()}</p>
      </div>
      <div className="scoreboard__middle">
        <p className="scoreboard__target">Target: {targetScore.toLocaleString()}</p>
        {currentPlayerId === 'human' && turn.phase !== 'game-over' && (
          <p className="scoreboard__turn-score">Turn score: {turn.turnScore.toLocaleString()}</p>
        )}
      </div>
      <div className={`scoreboard__player${currentPlayerId === 'computer' ? ' scoreboard__player--active' : ''}`}>
        <h3>{players.computer.name}</h3>
        <p className="scoreboard__total">{players.computer.totalScore.toLocaleString()}</p>
        {currentPlayerId === 'computer' && turn.phase !== 'game-over' && (
          <p className="scoreboard__turn-score">Turn score: {turn.turnScore.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}
