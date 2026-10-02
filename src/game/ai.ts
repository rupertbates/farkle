import { getAdvisorReport } from './advisor';
import type { DieValue, PlayerState } from './types';

export interface ComputerDecision {
  /** Indices (into the rolled dice) the computer chooses to keep this roll. */
  selectedIndices: number[];
  /** What the computer will do after locking in that selection. */
  action: 'bank' | 'continue';
  /** Short explanation for the turn log / UI, so the computer's play is transparent. */
  reasoning: string;
}

/**
 * Decides the computer opponent's move for the current roll by reusing the same
 * advisor logic shown to the human player: pick the best-EV dice selection, then
 * bank or continue based on expected value (with instant-win opportunities
 * overriding pure EV where relevant).
 */
export function computerDecideMove(
  dice: DieValue[],
  turnScoreBeforeRoll: number,
  computerPlayer: PlayerState,
  targetScore: number,
  opponentTotalScore?: number,
  riskAwareness = false,
): ComputerDecision {
  const report = getAdvisorReport({
    dice,
    turnScoreBeforeRoll,
    playerTotalScore: computerPlayer.totalScore,
    targetScore,
    opponentTotalScore,
    riskAwareness,
  });
  const { best } = report;

  const turnScoreAfter = turnScoreBeforeRoll + best.candidate.result.score;

  if (report.wouldWinByBanking) {
    return {
      selectedIndices: best.candidate.indices,
      action: 'bank',
      reasoning: `Banking ${turnScoreAfter} points reaches the target score of ${targetScore} - instant win.`,
    };
  }

  const riskNote = best.riskAdjustmentExplanation ? ` (${best.riskAdjustmentExplanation})` : '';

  return {
    selectedIndices: best.candidate.indices,
    action: best.recommendedAction,
    reasoning:
      best.recommendedAction === 'bank'
        ? `Banking: expected value of continuing (${Math.round(best.continue.expectedValue)}) does not beat banking ${turnScoreAfter} now${riskNote}.`
        : `Continuing: expected value of rolling again (${Math.round(best.continue.expectedValue)}) beats banking ${turnScoreAfter} now${riskNote}.`,
  };
}

