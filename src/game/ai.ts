import { getAdvisorReport } from './advisor';
import { DEFAULT_LOOKAHEAD_DEPTH } from './probability';
import type { ComputerSkill, DieValue, PlayerState } from './types';

export interface ComputerDecision {
  /** Indices (into the rolled dice) the computer chooses to keep this roll. */
  selectedIndices: number[];
  /** What the computer will do after locking in that selection. */
  action: 'bank' | 'continue';
  /** Short explanation for the turn log / UI, so the computer's play is transparent. */
  reasoning: string;
}

interface SkillSettings {
  /** How many further voluntary rolls the computer's own EV lookahead plays out -
   *  see `lookaheadDepth` on `AdvisorInput`. Lower = more short-sighted. */
  lookaheadDepth: number;
  /** Probability (0-1) the computer deliberately overrides its own best bank/continue
   *  call for the same dice selection, simulating a misjudgment. Never applied when
   *  the optimal move is an instant win (see `computerDecideMove`). */
  mistakeRate: number;
}

/**
 * Three presets rather than a continuous slider, for a simpler player-facing control
 * and more tractable testing. 'hard' is deliberately identical to the original
 * always-optimal behavior (full lookahead depth, zero mistakes) so it stays the
 * default and every pre-existing test/behavior is unaffected.
 */
const SKILL_SETTINGS: Record<ComputerSkill, SkillSettings> = {
  easy: { lookaheadDepth: 0, mistakeRate: 0.3 },
  normal: { lookaheadDepth: 1, mistakeRate: 0.1 },
  hard: { lookaheadDepth: DEFAULT_LOOKAHEAD_DEPTH, mistakeRate: 0 },
};

/** How close (as a fraction of the larger of the two expected values) banking and
 *  continuing need to be for a "mistake" to be eligible to flip the decision - keeps
 *  mistakes looking like plausible misjudgments of a genuinely borderline call, rather
 *  than ignoring a lopsided EV difference. */
const CLOSE_CALL_MARGIN = 0.25;

/**
 * Decides the computer opponent's move for the current roll by reusing the same
 * advisor logic shown to the human player: pick the best-EV dice selection, then
 * bank or continue based on expected value (with instant-win opportunities
 * overriding pure EV where relevant).
 *
 * `skill` (defaults to `'hard'`, i.e. the original always-optimal behavior) lets the
 * computer play deliberately weaker: a shallower EV lookahead (see `lookaheadDepth`
 * on `AdvisorInput`), and a chance (`mistakeRate`) of second-guessing its own
 * bank-vs-continue call for the same dice selection. This never affects the
 * human-facing advisor, which always computes at full strength separately.
 *
 * `rng` (defaults to `Math.random`) is only consulted for the mistake coin-flip, and
 * is injectable so tests can force/forbid a mistake deterministically - it's entirely
 * independent of the dice-roll RNG.
 */
export function computerDecideMove(
  dice: DieValue[],
  turnScoreBeforeRoll: number,
  computerPlayer: PlayerState,
  targetScore: number,
  opponentTotalScore?: number,
  riskAwareness = false,
  skill: ComputerSkill = 'hard',
  rng: () => number = Math.random,
): ComputerDecision {
  const { lookaheadDepth, mistakeRate } = SKILL_SETTINGS[skill];
  const report = getAdvisorReport({
    dice,
    turnScoreBeforeRoll,
    playerTotalScore: computerPlayer.totalScore,
    targetScore,
    opponentTotalScore,
    riskAwareness,
    lookaheadDepth,
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

  // Deliberately second-guess the EV-optimal action for lower skill levels: same dice
  // selection, but the opposite bank/continue call - e.g. banking too cautiously when
  // continuing was actually better, or pushing on when it should have banked. Only
  // applied when the two options are genuinely close in value (within CLOSE_CALL_MARGIN
  // of each other) - a lower skill should occasionally misjudge a borderline decision,
  // not blunder away an obviously-correct one (e.g. banking 100 points instead of
  // continuing with a 400-point expected value), which would just look broken rather
  // than "weaker".
  const evMargin = Math.abs(best.bank.expectedValue - best.adjustedContinueExpectedValue);
  const evScale = Math.max(best.bank.expectedValue, best.adjustedContinueExpectedValue, 1);
  const isCloseCall = evMargin <= CLOSE_CALL_MARGIN * evScale;
  if (isCloseCall && mistakeRate > 0 && rng() < mistakeRate) {
    const mistakenAction = best.recommendedAction === 'bank' ? 'continue' : 'bank';
    return {
      selectedIndices: best.candidate.indices,
      action: mistakenAction,
      reasoning:
        mistakenAction === 'bank'
          ? `Banking ${turnScoreAfter} points now rather than risk it - playing it a little too safe here.`
          : `Pushing on instead of banking ${turnScoreAfter} points - misjudged the odds of continuing.`,
    };
  }

  return {
    selectedIndices: best.candidate.indices,
    action: best.recommendedAction,
    reasoning:
      best.recommendedAction === 'bank'
        ? `Banking: expected value of continuing (${Math.round(best.continue.expectedValue)}) does not beat banking ${turnScoreAfter} now${riskNote}.`
        : `Continuing: expected value of rolling again (${Math.round(best.continue.expectedValue)}) beats banking ${turnScoreAfter} now${riskNote}.`,
  };
}

