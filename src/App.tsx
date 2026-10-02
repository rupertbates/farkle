import { useState } from 'react';
import { DEFAULT_TARGET_SCORE } from './game';
import { useFarkleGame } from './hooks/useFarkleGame';
import { GameBoard } from './components/GameBoard';
import { HeldDiceRail } from './components/HeldDiceRail';
import { ScoringChart } from './components/ScoringChart';
import { ScoreBoard } from './components/ScoreBoard';
import { AdvisorPanel } from './components/AdvisorPanel';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { TurnLog } from './components/TurnLog';
import './App.css';

const PAUSE_AFTER_COMPUTER_TURN_KEY = 'farkle:setting:pause-after-computer-turn';

function readStoredBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? defaultValue : stored === 'true';
  } catch {
    // localStorage can throw in some privacy modes/environments - just fall back silently.
    return defaultValue;
  }
}

export default function App() {
  const [targetScore] = useState(DEFAULT_TARGET_SCORE);
  const [pauseAfterComputerTurn, setPauseAfterComputerTurn] = useState(() =>
    readStoredBoolean(PAUSE_AFTER_COMPUTER_TURN_KEY, true),
  );
  // Tracks whether any dice have ever been rolled in this game (across every turn), so
  // the board's "Roll to throw the dice" placeholder can be shown only once, at the
  // very start of a new game, rather than reappearing at the start of every turn.
  const [hasRolledOnce, setHasRolledOnce] = useState(false);

  const togglePauseAfterComputerTurn = () => {
    setPauseAfterComputerTurn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(PAUSE_AFTER_COMPUTER_TURN_KEY, String(next));
      } catch {
        // Ignore storage failures - the toggle still works for the rest of this session.
      }
      return next;
    });
  };

  const { game, isHumanTurn, advisorReport, computerDecision, selectionValidity, actions, canBank } = useFarkleGame(
    targetScore,
    undefined,
    undefined,
    pauseAfterComputerTurn,
  );

  const { turn, players, winnerId } = game;

  // Derived during render (not an effect) so the flag flips in the same render the first
  // roll's dice arrive, instead of one render later.
  if (turn.dice.length > 0 && !hasRolledOnce) {
    setHasRolledOnce(true);
  }

  const handleNewGame = () => {
    setHasRolledOnce(false);
    actions.newGame();
  };
  const isGameOver = turn.phase === 'game-over';

  const diceLeftIfRolled = turn.dice.length - turn.selectedIndices.length;
  const nextRollCount = diceLeftIfRolled === 0 ? 6 : diceLeftIfRolled;
  const nextRollLabel = diceLeftIfRolled === 0 ? `🔥 Roll ${nextRollCount} dice (Hot Dice!)` : `Roll ${nextRollCount} dice`;
  const nextRollShortLabel = diceLeftIfRolled === 0 ? '🔥 Roll' : 'Roll';

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
        <h1>
          <span aria-hidden="true">🎲</span> <span className="app__header-wordmark">Farkle</span>
        </h1>
        <div className="app__header-underline" />
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
          <button type="button" className="btn btn--primary" onClick={handleNewGame}>
            Play again
          </button>
        </div>
      )}

      {!isGameOver && (
        <main className="app__main">
          <section className="panel panel--table">
            <h2>{isHumanTurn ? 'Your turn' : "Computer's turn"}</h2>

            <div className="board-row">
              <GameBoard
                dice={turn.dice}
                selectedIndices={turn.selectedIndices}
                committedIndices={turn.committedIndices}
                rollId={turn.rollId}
                interactive={isHumanTurn && turn.phase === 'awaiting-selection'}
                onToggle={actions.toggleDie}
                showInitialPlaceholder={!hasRolledOnce}
              />
              <HeldDiceRail
                dice={turn.dice}
                selectedIndices={turn.selectedIndices}
                heldGroups={turn.heldGroups}
                rollId={turn.rollId}
                interactive={isHumanTurn && turn.phase === 'awaiting-selection'}
                onToggle={actions.toggleDie}
                turnScore={turn.turnScore}
              />
            </div>

            {turn.isHotDice && turn.phase !== 'farkled' && (
              <div className="hot-dice-banner">
                <p>🔥 Hot dice! All 6 dice scored, so you get a fresh set of 6 to roll - your turn score is safe.</p>
              </div>
            )}

            {turn.phase === 'farkled' && (
              <div className="farkle-banner">
                <p>
                  💥 Farkle! No scoring dice -{' '}
                  {turn.playerId === 'human'
                    ? `you lose the ${turn.turnScore} points banked this turn.`
                    : `${players.computer.name} loses the ${turn.turnScore} points banked this turn.`}
                </p>
                {(isHumanTurn || pauseAfterComputerTurn) && (
                  <button type="button" className="btn" onClick={actions.continueTurn}>
                    Continue
                  </button>
                )}
              </div>
            )}

            {turn.phase === 'turn-banked' && (
              <div className="turn-banked-banner">
                <p>
                  🏦 {players[turn.playerId].name} banked {turn.turnScore} points this turn (total:{' '}
                  {players[turn.playerId].totalScore.toLocaleString()}).
                </p>
                {(isHumanTurn || pauseAfterComputerTurn) && (
                  <button type="button" className="btn" onClick={actions.continueTurn}>
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
                    {/* The valid case ("Held dice score N pts") is redundant now that the
                     * held rail's footer and the button labels below both already show the
                     * score, so only the invalid case has real text. The paragraph still
                     * always renders (just visually hidden) so its line of space stays
                     * reserved - otherwise the buttons below jump up/down as this message
                     * appears and disappears while toggling dice. */}
                    <p
                      className="selection-status"
                      aria-hidden={selectionValidity.valid}
                      style={selectionValidity.valid ? { visibility: 'hidden' } : undefined}
                    >
                      {selectionValidity.valid ? '\u00A0' : selectionValidity.reason}
                    </p>
                    <div className="controls__row">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!selectionValidity.valid}
                        onClick={actions.roll}
                      >
                        <span className="btn__roll-full">{nextRollLabel}</span>
                        <span className="btn__roll-short">{nextRollShortLabel}</span>
                      </button>
                      <button type="button" className="btn btn--bank" disabled={!canBank} onClick={actions.bank}>
                        <span className="btn__bank-full">
                          Bank {turn.turnScore + (selectionValidity.valid ? selectionValidity.score : 0)} pts & end
                          turn
                        </span>
                        <span className="btn__bank-short">Bank & end turn</span>
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

            {!isHumanTurn && !isGameOver && turn.phase !== 'farkled' && turn.phase !== 'turn-banked' && (
              <p className="computer-status">{computerStatus}</p>
            )}
          </section>

          <aside className="app__sidebar">
            <section className="panel panel--advisor">
              <CollapsiblePanel
                title={isHumanTurn ? '🧭 Advisor' : "🤖 Computer's analysis"}
                storageKey="farkle:panel:advisor-open"
                defaultOpen={true}
              >
                {turn.phase === 'awaiting-selection' ? (
                  <AdvisorPanel
                    report={advisorReport}
                    onApplySelection={actions.applyAdvisorSelection}
                    mode={isHumanTurn ? 'human' : 'computer'}
                    computerDecision={computerDecision}
                  />
                ) : (
                  <div className="advisor advisor--empty">
                    <p>Advice appears here after a roll, showing the best dice to keep and win probabilities.</p>
                  </div>
                )}
              </CollapsiblePanel>
            </section>

            <section className="panel panel--turnlog">
              <CollapsiblePanel title="📜 This turn" storageKey="farkle:panel:turnlog-open" defaultOpen={true}>
                <TurnLog log={turn.log} />
              </CollapsiblePanel>
            </section>

            <section className="panel panel--scoring">
              <CollapsiblePanel title="📖 Scoring guide" storageKey="farkle:panel:scoring-open" defaultOpen={false}>
                <ScoringChart />
              </CollapsiblePanel>
            </section>

            <section className="panel panel--settings">
              <CollapsiblePanel title="⚙️ Settings" storageKey="farkle:panel:settings-open" defaultOpen={false}>
                <label className="settings__toggle">
                  <input
                    type="checkbox"
                    checked={pauseAfterComputerTurn}
                    onChange={togglePauseAfterComputerTurn}
                  />
                  <span>
                    Pause after computer's turn
                    <span className="settings__toggle-hint">
                      Show a "Continue" button after the computer banks or Farkles, so you can review its move
                      before play passes back. Turn off to let the computer's turns advance automatically.
                    </span>
                  </span>
                </label>
              </CollapsiblePanel>
            </section>
          </aside>
        </main>
      )}
    </div>
  );
}
