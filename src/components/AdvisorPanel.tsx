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
          <p className="advisor__explanation">{computerDecision.reasoning}</p>
        </div>
      )}
      {wouldWinByBanking && (
        <p className="advisor__win-callout">🏆 Banking now would reach the target score - take the win!</p>
      )}
      <div className="advisor__best">
        <p className="advisor__best-label">{isComputerMode ? 'Best EV option: ' : 'Recommended: '}{best.candidate.label}</p>
        {best.isHotDice && <p className="advisor__hot-dice-tag">🔥 This selection uses all six dice - Hot Dice! You'll get a fresh six to roll.</p>}
        {!(best.recommendedAction === 'continue' && best.candidate.label.includes('reroll the rest')) && (
          <p className="advisor__best-action">
            Then <strong>{best.recommendedAction === 'bank' ? 'bank' : 'keep rolling'}</strong>
          </p>
        )}
        {best.riskAdjustmentExplanation && (
          <p className="advisor__risk-note">⚖️ Adjusted for game state: {best.riskAdjustmentExplanation}.</p>
        )}
        {!isComputerMode && (
          <button type="button" className="advisor__apply-btn" onClick={() => onApplySelection(best.candidate.indices)}>
            Select these dice ({best.candidate.values.join(', ')}) for {best.candidate.result.score} pts
          </button>
        )}
      </div>

      {options.map((opt, i) => (
        <div key={i} className="advisor__option">
          <p className="advisor__option-title">
            {opt.candidate.label} - {opt.candidate.result.score} pts {opt.isHotDice && <span className="advisor__hot-dice-badge">🔥 Hot Dice</span>}
          </p>
          <ul className="advisor__breakdown">
            {opt.candidate.result.breakdown.map((b, j) => (
              <li key={j}>
                {b.description}: {b.points} pts
              </li>
            ))}
          </ul>
          <div className="advisor__ev-row">
            <span className={opt.recommendedAction === 'bank' ? 'advisor__ev--chosen' : ''}>
              Bank: EV {Math.round(opt.bank.expectedValue).toLocaleString()}
            </span>
            <span className={opt.recommendedAction === 'continue' ? 'advisor__ev--chosen' : ''}>
              Continue ({numberWord(opt.diceRemainingIfContinuing)} dice): EV {Math.round(opt.continue.expectedValue).toLocaleString()}
            </span>
          </div>
          <p className="advisor__farkle-prob">
            Farkle risk if continuing: {(opt.farkleProbabilityIfContinuing * 100).toFixed(1)}%
          </p>
          <p className="advisor__explanation">
            {opt.recommendedAction === 'bank' ? opt.bank.explanation : opt.continue.explanation}
          </p>
          {opt.riskAdjustmentExplanation && (
            <p className="advisor__risk-note">⚖️ Adjusted for game state: {opt.riskAdjustmentExplanation}.</p>
          )}
          {!isComputerMode && opt !== best && (
            <button type="button" className="advisor__apply-btn advisor__apply-btn--secondary" onClick={() => onApplySelection(opt.candidate.indices)}>
              Select these dice instead
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
