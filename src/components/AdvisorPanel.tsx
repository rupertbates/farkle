import type { AdvisorReport, ComputerDecision } from '../game';
import { numberWord } from '../game';

export interface AdvisorPanelProps {
  report: AdvisorReport | null;
  onApplySelection: (indices: number[]) => void;
  /**
   * 'human' (default): interactive advisor the player can act on.
   * 'computer': read-only explanation of the computer opponent's actual move this roll.
   */
  mode?: 'human' | 'computer';
  /** The computer's actual chosen move, once revealed - may differ from the raw EV
   *  recommendation when an instant-win-by-banking override applies. */
  computerDecision?: ComputerDecision | null;
}

/** Shows the advisor's recommended dice selection(s) with expected-value reasoning and probabilities. */
export function AdvisorPanel({ report, onApplySelection, mode = 'human', computerDecision }: AdvisorPanelProps) {
  const isComputerMode = mode === 'computer';

  if (!report) {
    return (
      <div className="advisor advisor--empty">
        <h3>Advisor</h3>
        <p>
          {isComputerMode
            ? "Waiting for the computer to roll…"
            : 'Roll the dice to get advice on your next move.'}
        </p>
      </div>
    );
  }

  const { options, best, wouldWinByBanking } = report;
  // `best` is already shown in full above; re-listing it in the comparison list below
  // would just duplicate the same title/breakdown/explanation a second time.
  const otherOptions = options.filter((opt) => opt !== best);

  return (
    <div className="advisor">
      <h3>{isComputerMode ? "Computer's reasoning" : 'Advisor'}</h3>
      {isComputerMode && !computerDecision && (
        <p className="advisor__computer-status">🤔 Computer is weighing its options…</p>
      )}
      {isComputerMode && computerDecision && (
        <div className="advisor__computer-decision">
          <p className="advisor__computer-decision-label">
            💻 Computer {computerDecision.action === 'bank' ? 'will bank' : 'will keep rolling'}
          </p>
          <details className="advisor__reasoning">
            <summary>Show reasoning</summary>
            <p className="advisor__explanation">{computerDecision.reasoning}</p>
          </details>
        </div>
      )}
      {wouldWinByBanking && (
        <p className="advisor__win-callout">🏆 Banking now would reach the target score - take the win!</p>
      )}
      <div className="advisor__best">
        <p className="advisor__best-label">{isComputerMode ? 'Best option on average: ' : 'Recommended: '}{best.candidate.label}</p>
        {best.isHotDice && <p className="advisor__hot-dice-tag">🔥 This selection uses all six dice - Hot Dice! You'll get a fresh six to roll.</p>}
        {!(best.recommendedAction === 'continue' && best.candidate.label.includes('reroll the rest')) && (
          <p className="advisor__best-action">
            Then <strong>{best.recommendedAction === 'bank' ? 'bank' : 'keep rolling'}</strong>
          </p>
        )}
        <div className="advisor__ev-row">
          <span className={best.recommendedAction === 'bank' ? 'advisor__ev--chosen' : ''}>
            Bank now: {Math.round(best.bank.expectedValue).toLocaleString()} pts (certain)
          </span>
          <span className={best.recommendedAction === 'continue' ? 'advisor__ev--chosen' : ''}>
            Keep rolling ({numberWord(best.diceRemainingIfContinuing)} dice): ~{Math.round(best.continue.expectedValue).toLocaleString()} pts on average
          </span>
        </div>
        <p className="advisor__farkle-prob">
          Farkle risk if continuing: {(best.farkleProbabilityIfContinuing * 100).toFixed(1)}%
        </p>
        <details className="advisor__reasoning">
          <summary>Show reasoning</summary>
          <p className="advisor__explanation">
            {best.recommendedAction === 'bank' ? best.bank.explanation : best.continue.explanation}
          </p>
          {best.riskAdjustmentExplanation && (
            <p className="advisor__risk-note">⚖️ Adjusted for game state: {best.riskAdjustmentExplanation}.</p>
          )}
        </details>
        {!isComputerMode && (
          <button type="button" className="advisor__apply-btn" onClick={() => onApplySelection(best.candidate.indices)}>
            Select recommended dice
          </button>
        )}
      </div>

      {otherOptions.length > 0 && (
        <details className="advisor__other-options">
          <summary>
            {otherOptions.length === 1 ? '1 other option considered' : `${otherOptions.length} other options considered`}
          </summary>
          <ul className="advisor__other-options-list">
            {otherOptions.map((opt, i) => (
              <li key={i} className="advisor__option-compact">
                <div className="advisor__option-compact-row">
                  <span className="advisor__option-compact-label">
                    {/* The "take all" label already states its own dice and score, unlike the
                     * "keep some, reroll the rest" labels which don't repeat the score. */}
                    {opt.candidate.label}
                    {!opt.candidate.label.includes(' pts') && ` - ${opt.candidate.result.score} pts`}
                    {' '}
                    {opt.isHotDice && <span className="advisor__hot-dice-badge">🔥</span>}
                  </span>
                  {!isComputerMode && (
                    <button
                      type="button"
                      className="advisor__apply-btn advisor__apply-btn--secondary"
                      onClick={() => onApplySelection(opt.candidate.indices)}
                    >
                      Select instead
                    </button>
                  )}
                </div>
                <p className="advisor__option-compact-stats">
                  <span className={opt.recommendedAction === 'bank' ? 'advisor__ev--chosen' : ''}>
                    Bank: {Math.round(opt.bank.expectedValue).toLocaleString()} pts
                  </span>
                  {' · '}
                  <span className={opt.recommendedAction === 'continue' ? 'advisor__ev--chosen' : ''}>
                    Keep rolling ({numberWord(opt.diceRemainingIfContinuing)} dice): ~{Math.round(opt.continue.expectedValue).toLocaleString()} pts avg
                  </span>
                  {' · '}
                  <span className="advisor__farkle-prob advisor__farkle-prob--inline">
                    Farkle risk {(opt.farkleProbabilityIfContinuing * 100).toFixed(1)}%
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

