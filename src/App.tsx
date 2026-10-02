import { useState } from 'react';
import { DEFAULT_TARGET_SCORE } from './game';
import { useFarkleGame } from './hooks/useFarkleGame';
import { GameBoard } from './components/GameBoard';
import { HeldDiceRail } from './components/HeldDiceRail';
import { ScoringChart } from './components/ScoringChart';
import { ScoreBoard } from './components/ScoreBoard';
import { AdvisorPanel } from './components/AdvisorPanel';
import { TurnLog } from './components/TurnLog';
import './App.css';

export default function App() {
  const [targetScore] = useState(DEFAULT_TARGET_SCORE);
  const { game, isHumanTurn, advisorReport, computerDecision, selectionValidity, actions, canBank } =
    useFarkleGame(targetScore);

  const { turn, players, winnerId } = game;
  const isGameOver = turn.phase === 'game-over';

  const diceLeftIfRolled = turn.dice.length - turn.selectedIndices.length;
  const nextRollCount = diceLeftIfRolled === 0 ? 6 : diceLeftIfRolled;
  const nextRollLabel = diceLeftIfRolled === 0 ? `🔥 Roll ${nextRollCount} dice (Hot Dice!)` : `Roll ${nextRollCount} dice`;

  let computerStatus = 'Computer is playing…';
  if (!isHumanTurn && !isGameOver) {
    if (turn.phase === 'awaiting-roll') {
      computerStatus = 'Computer is about to roll…';
    } else if (turn.phase === 'awaiting-selection') {
      computerStatus = turn.selectedIndices.length > 0 ? 'Computer is locking in its dice…' : 'Computer is deciding…';
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>🎲 Farkle</h1>
        <p className="app__subtitle">Play to {targetScore.toLocaleString()} points against the computer</p>
      </header>

      <ScoreBoard game={game} />

      {isGameOver && (
        <div className="game-over">
          <h2>{winnerId === 'human' ? 'You win! 🎉' : 'Computer wins!'}</h2>
          <p>
            Final score - You: {players.human.totalScore.toLocaleString()}, Computer:{' '}
            {players.computer.totalScore.toLocaleString()}
          </p>
          <button type="button" className="btn btn--primary" onClick={actions.newGame}>
            Play again
          </button>
        </div>
      )}

      {!isGameOver && (
        <main className="app__main">
          <section className="panel panel--scoring">
            <ScoringChart />
          </section>

          <section className="panel panel--table">
            <h2>{isHumanTurn ? 'Your turn' : "Computer's turn"}</h2>

            <div className="board-row">
              <GameBoard
                dice={turn.dice}
                selectedIndices={turn.selectedIndices}
                rollId={turn.rollId}
                interactive={isHumanTurn && turn.phase === 'awaiting-selection'}
                onToggle={actions.toggleDie}
              />
              <HeldDiceRail
                dice={turn.dice}
                selectedIndices={turn.selectedIndices}
                heldGroups={turn.heldGroups}
                rollId={turn.rollId}
                interactive={isHumanTurn && turn.phase === 'awaiting-selection'}
                onToggle={actions.toggleDie}
              />
            </div>

            {turn.isHotDice && turn.phase !== 'farkled' && (
              <div className="hot-dice-banner">
                <p>🔥 Hot dice! All 6 dice scored, so you get a fresh set of 6 to roll - your turn score is safe.</p>
              </div>
            )}

            {turn.phase === 'farkled' && (
              <div className="farkle-banner">
                <p>💥 Farkle! No scoring dice - you lose the {turn.turnScore} points banked this turn.</p>
                {isHumanTurn && (
                  <button type="button" className="btn" onClick={actions.farkleAcknowledged}>
                    Continue
                  </button>
                )}
              </div>
            )}

            {isHumanTurn && (
              <div className="controls">
                {turn.phase === 'awaiting-roll' && (
                  <button type="button" className="btn btn--primary" onClick={actions.roll}>
                    {turn.isHotDice ? `🔥 Roll ${turn.diceToRoll} dice (Hot Dice!)` : `Roll ${turn.diceToRoll} dice`}
                  </button>
                )}

                {turn.phase === 'awaiting-selection' && (
                  <>
                    <p className="selection-status">
                      {selectionValidity.valid
                        ? `Held dice score ${selectionValidity.score} pts - roll again or bank`
                        : selectionValidity.reason}
                    </p>
                    <div className="controls__row">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!selectionValidity.valid}
                        onClick={actions.roll}
                      >
                        {nextRollLabel}
                      </button>
                      <button type="button" className="btn btn--bank" disabled={!canBank} onClick={actions.bank}>
                        Bank {turn.turnScore + (selectionValidity.valid ? selectionValidity.score : 0)} pts & end turn
                      </button>
                    </div>
                  </>
                )}

                {turn.phase === 'awaiting-roll' && turn.turnScore > 0 && (
                  <button type="button" className="btn btn--bank" disabled={!canBank} onClick={actions.bank}>
                    Bank {turn.turnScore} pts & end turn
                  </button>
                )}
              </div>
            )}

            {!isHumanTurn && !isGameOver && (
              <p className="computer-status">{computerStatus}</p>
            )}

            <TurnLog log={turn.log} />
          </section>

          <section className="panel panel--advisor">
            {turn.phase === 'awaiting-selection' ? (
              <AdvisorPanel
                report={advisorReport}
                onApplySelection={actions.applyAdvisorSelection}
                mode={isHumanTurn ? 'human' : 'computer'}
                computerDecision={computerDecision}
              />
            ) : (
              <div className="advisor advisor--empty">
                <h3>Advisor</h3>
                <p>Advice appears here after a roll, showing the best dice to keep and win probabilities.</p>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
