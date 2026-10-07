import { useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_TARGET_SCORE } from './game';
import type { AdvisorReport, ComputerDecision } from './game';
import { useFarkleGame } from './hooks/useFarkleGame';
import { GameBoard } from './components/GameBoard';
import { HeldDiceRail } from './components/HeldDiceRail';
import { ScoringChart } from './components/ScoringChart';
import { ScoreBoard } from './components/ScoreBoard';
import { AdvisorPanel } from './components/AdvisorPanel';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { TurnLog } from './components/TurnLog';
import { HelpOverlay } from './components/HelpOverlay';
import { SettingsOverlay } from './components/SettingsOverlay';
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
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Keeps the computer's last revealed decision/reasoning visible in the "Computer's
  // analysis" panel through the farkled/turn-banked review pause at the end of its
  // turn (when `advisorReport`/`computerDecision` have already gone back to null)
  // instead of swapping to the "Advice appears here…" placeholder. Derived during
  // render (like `hasRolledOnce` above) rather than via an effect, so it updates in
  // the same render the decision/turn change arrives instead of one render later.
  // It's only cleared once the human's own turn actually starts rolling, at which
  // point the panel switches over to the live advisor for their roll anyway.
  const [frozenComputerView, setFrozenComputerView] = useState<{
    report: AdvisorReport;
    decision: ComputerDecision;
  } | null>(null);
  if (
    !isHumanTurn &&
    turn.phase === 'awaiting-selection' &&
    advisorReport &&
    computerDecision &&
    frozenComputerView?.decision !== computerDecision
  ) {
    setFrozenComputerView({ report: advisorReport, decision: computerDecision });
  } else if (isHumanTurn && frozenComputerView) {
    setFrozenComputerView(null);
  }

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

  // The farkled/turn-banked review banners' button both advances past the finished
  // turn and - when that hands play to the human - immediately rolls for them (see
  // `continueTurn`). Label and style it as the "Roll" action it now performs in that
  // case, rather than a plain "Continue", so it's clear a roll is about to happen.
  const nextTurnIsHuman = turn.playerId === 'computer';
  const continueBtnLabel = nextTurnIsHuman ? 'Roll 6 dice' : 'Continue';
  const continueBtnClassName = nextTurnIsHuman ? 'btn btn--primary' : 'btn';

  let computerStatus: { icon: string; text: string } = { icon: '🤖', text: 'Computer is playing…' };
  if (!isHumanTurn && !isGameOver) {
    if (turn.phase === 'awaiting-roll') {
      computerStatus = { icon: '🎲', text: 'Computer is about to roll…' };
    } else if (turn.phase === 'awaiting-selection') {
      computerStatus =
        turn.selectedIndices.length > 0
          ? { icon: '🔒', text: 'Computer is locking in its dice…' }
          : { icon: '🤔', text: 'Computer is deciding…' };
    }
  }

  // The Roll/Bank buttons live as an overlay pinned to the bottom of the board itself
  // (rather than below it) so the action is right where the dice are. Built here as a
  // variable (instead of inline conditionals) so `GameBoard` can tell whether to reserve
  // space for it - and so it's `null` (not just empty) outside the human's own turn.
  let controlsOverlay: ReactNode = null;
  if (isHumanTurn && turn.phase === 'awaiting-roll') {
    controlsOverlay = (
      <div className="controls">
        <div className="controls__row">
          <button type="button" className="btn btn--primary" onClick={actions.roll}>
            <span className="btn__roll-full">
              {turn.isHotDice ? `🔥 Roll ${turn.diceToRoll} dice (Hot Dice!)` : `Roll ${turn.diceToRoll} dice`}
            </span>
            <span className="btn__roll-short">{turn.isHotDice ? '🔥 Roll' : 'Roll'}</span>
          </button>
          {turn.turnScore > 0 && (
            <button type="button" className="btn btn--bank" disabled={!canBank} onClick={actions.bank}>
              <span className="btn__bank-full">Bank {turn.turnScore} pts & end turn</span>
              <span className="btn__bank-short">Bank & end turn</span>
              <span className="btn__bank-xs">Bank</span>
            </button>
          )}
        </div>
      </div>
    );
  } else if (isHumanTurn && turn.phase === 'awaiting-selection') {
    controlsOverlay = (
      <div className="controls">
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
          <button type="button" className="btn btn--primary" disabled={!selectionValidity.valid} onClick={actions.roll}>
            <span className="btn__roll-full">{nextRollLabel}</span>
            <span className="btn__roll-short">{nextRollShortLabel}</span>
          </button>
          <button type="button" className="btn btn--bank" disabled={!canBank} onClick={actions.bank}>
            <span className="btn__bank-full">
              Bank {turn.turnScore + (selectionValidity.valid ? selectionValidity.score : 0)} pts & end turn
            </span>
            <span className="btn__bank-short">Bank & end turn</span>
            <span className="btn__bank-xs">Bank</span>
          </button>
        </div>
      </div>
    );
  }

  // The computer's end-of-turn message (Farkle or what it banked) is shown as a
  // popover centered on the board itself, rather than a separate block below it - it's
  // fine for this to cover any dice still visible underneath since the turn's done.
  let popoverContent: ReactNode = null;
  if (turn.phase === 'farkled') {
    popoverContent = (
      <div className="farkle-banner board__popover-card">
        <p>
          💥 Farkle! No scoring dice -{' '}
          {turn.playerId === 'human'
            ? `you lose the ${turn.turnScore} points banked this turn.`
            : `${players.computer.name} loses the ${turn.turnScore} points banked this turn.`}
        </p>
        {(isHumanTurn || pauseAfterComputerTurn) && (
          <button type="button" className={continueBtnClassName} onClick={actions.continueTurn}>
            {continueBtnLabel}
          </button>
        )}
      </div>
    );
  } else if (turn.phase === 'turn-banked') {
    popoverContent = (
      <div className="turn-banked-banner board__popover-card">
        <p>
          🏦 {players[turn.playerId].name} banked {turn.turnScore} points this turn (total:{' '}
          {players[turn.playerId].totalScore.toLocaleString()}).
        </p>
        {(isHumanTurn || pauseAfterComputerTurn) && (
          <button type="button" className={continueBtnClassName} onClick={actions.continueTurn}>
            {continueBtnLabel}
          </button>
        )}
      </div>
    );
  }

  // Dice the player has moved to the held rail but not yet locked in by rolling/banking
  // still count towards the turn score as soon as they're held, rather than only once
  // the next roll (or bank) formally commits them.
  const displayedTurnScore = turn.turnScore + (selectionValidity.valid ? selectionValidity.score : 0);

  // A persistent one-line banner pinned to the top of the board felt (mirroring the
  // Roll/Bank controls pinned to the bottom). During the human's turn it's the
  // advisor's live headline recommendation; during the computer's turn it's swapped
  // for the plain status line (e.g. "Computer is deciding…") - the human doesn't get
  // the computer's advisor reasoning surfaced as if it were their own recommendation,
  // and this replaces the separate status paragraph that used to sit under the board.
  let overlayContent: { icon: string; text: string; isHotDice: boolean; reasoning: string } | null = null;
  if (isHumanTurn && turn.phase === 'awaiting-selection' && advisorReport) {
    const { best } = advisorReport;
    // Skip the "then bank/keep rolling" suffix for a "keep some, reroll the rest"
    // candidate - its label already states that it's continuing, so appending the
    // action again would just repeat it (same condition the sidebar advisor uses).
    const showActionSuffix = !(best.recommendedAction === 'continue' && best.candidate.label.includes('reroll the rest'));
    const actionSuffix = showActionSuffix ? ` - then ${best.recommendedAction === 'bank' ? 'bank' : 'keep rolling'}` : '';
    const reasoning = best.recommendedAction === 'bank' ? best.bank.explanation : best.continue.explanation;
    const actionIcon = best.recommendedAction === 'bank' ? '🏦' : '🎲';
    const text = best.isHotDice ? `Hot dice! ${best.candidate.label}${actionSuffix}` : `${best.candidate.label}${actionSuffix}`;
    overlayContent = { icon: best.isHotDice ? '🔥' : actionIcon, text, isHotDice: best.isHotDice, reasoning };
  } else if (!isHumanTurn && !isGameOver && turn.phase !== 'farkled' && turn.phase !== 'turn-banked') {
    overlayContent = { icon: computerStatus.icon, text: computerStatus.text, isHotDice: false, reasoning: '' };
  }

  // Keeps the headline's last content (and, critically, the board space reserved for
  // it - see `useOverlayReservePct`) in place through the farkled/turn-banked review
  // pause, rather than collapsing to nothing the instant the turn ends. Otherwise the
  // reserved top space shrinks to zero as soon as `overlayContent` goes null, and the
  // dice still visible beneath the end-of-turn popover visibly jump upward to fill it.
  // Same derived-during-render approach as `frozenComputerView` above.
  const [frozenOverlayContent, setFrozenOverlayContent] = useState<{
    icon: string;
    text: string;
    isHotDice: boolean;
    reasoning: string;
  } | null>(null);
  if (overlayContent && overlayContent.text !== frozenOverlayContent?.text) {
    setFrozenOverlayContent(overlayContent);
  }

  // The "why?" popover explaining the headline's reasoning should start closed on
  // every new roll/selection rather than staying open from a prior headline.
  const [showHeadlineReasoning, setShowHeadlineReasoning] = useState(false);
  if (overlayContent && overlayContent.text !== frozenOverlayContent?.text && showHeadlineReasoning) {
    setShowHeadlineReasoning(false);
  }

  // Covers every phase where dice from this turn are still (or again) sitting on the
  // felt without a live overlay of their own - not just the farkled/turn-banked review,
  // but also the brief `awaiting-roll` gap between committing a selection and the
  // computer's next roll actually landing (e.g. mid-turn "continue" decisions, or the
  // pause before a hot-dice reroll) - any dice still visible then would otherwise jump
  // the instant the reserved space collapses. Once a turn actually ends and the next
  // one starts fresh, `turn.dice` is cleared back to empty, so this naturally stops
  // applying until the new turn's own live overlay content takes over.
  const shownOverlayContent =
    overlayContent ?? (turn.dice.length > 0 && turn.phase !== 'awaiting-selection' ? frozenOverlayContent : null);

  let topOverlay: ReactNode = null;
  if (shownOverlayContent) {
    const { icon, text, isHotDice, reasoning } = shownOverlayContent;
    topOverlay = (
      <div className={`board__headline${isHotDice ? ' board__headline--hot' : ''}`}>
        <div className="board__headline-row">
          <span className="board__headline-icon" aria-hidden="true">
            {icon}
          </span>
          <p className="board__headline-text">{text}</p>
          {/* The computer-turn status line has no reasoning to show, so it gets no
           * "why?" button at all - only the human's advisor recommendation does. */}
          {reasoning ? (
            <button
              type="button"
              className="board__headline-info-btn"
              aria-label="Why?"
              aria-expanded={showHeadlineReasoning}
              onClick={() => setShowHeadlineReasoning((prev) => !prev)}
            >
              ⓘ
            </button>
          ) : (
            <span className="board__headline-info-btn-spacer" aria-hidden="true" />
          )}
        </div>
        {reasoning && showHeadlineReasoning && (
          <div className="board__headline-reasoning-popover" role="tooltip">
            <p>{reasoning}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-actions">
          <button
            type="button"
            className="app__header-icon-btn app__header-icon-btn--help"
            aria-label="How to play"
            onClick={() => setShowHelp(true)}
          >
            ?
          </button>
          <button
            type="button"
            className="app__header-icon-btn"
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙️
          </button>
        </div>
        <h1>
          <span aria-hidden="true">🎲</span> <span className="app__header-wordmark">Farkle</span>
        </h1>
        <div className="app__header-underline" />
        <p className="app__subtitle">Play to {targetScore.toLocaleString()} points against the computer</p>
      </header>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      {showSettings && (
        <SettingsOverlay
          pauseAfterComputerTurn={pauseAfterComputerTurn}
          onTogglePauseAfterComputerTurn={togglePauseAfterComputerTurn}
          onClose={() => setShowSettings(false)}
        />
      )}

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
            <h2 className="panel-table__heading">{isHumanTurn ? 'Your turn' : "Computer's turn"}</h2>

            <div className="board-row">
              <GameBoard
                dice={turn.dice}
                selectedIndices={turn.selectedIndices}
                committedIndices={turn.committedIndices}
                rollId={turn.rollId}
                interactive={isHumanTurn && turn.phase === 'awaiting-selection'}
                onToggle={actions.toggleDie}
                showInitialPlaceholder={!hasRolledOnce}
                controlsOverlay={controlsOverlay}
                topOverlay={topOverlay}
                popover={popoverContent}
              />
              <HeldDiceRail
                dice={turn.dice}
                selectedIndices={turn.selectedIndices}
                heldGroups={turn.heldGroups}
                rollId={turn.rollId}
                interactive={isHumanTurn && turn.phase === 'awaiting-selection'}
                onToggle={actions.toggleDie}
                turnScore={displayedTurnScore}
              />
            </div>
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
                ) : !isHumanTurn && frozenComputerView ? (
                  <AdvisorPanel
                    report={frozenComputerView.report}
                    onApplySelection={actions.applyAdvisorSelection}
                    mode="computer"
                    computerDecision={frozenComputerView.decision}
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
          </aside>
        </main>
      )}
    </div>
  );
}
