import { generateSelectionCandidates } from './scoring';
import { DEFAULT_LOOKAHEAD_DEPTH, getContinuationValue, getRollDistributionStats } from './probability';
import { numberWord } from './textUtils';
import type { DieValue, SelectionCandidate } from './types';

export interface ActionEvaluation {
  action: 'bank' | 'continue';
  expectedValue: number;
  explanation: string;
}

export interface AdvisorRecommendation {
  /** The selection of dice this recommendation is built around. */
  candidate: SelectionCandidate;
  /** Evaluation of banking the turn score right after taking this selection. */
  bank: ActionEvaluation;
  /** Evaluation of continuing to roll the remaining dice after taking this selection. */
  continue: ActionEvaluation;
  /** Overall best action for this candidate, after any risk-awareness adjustment (see
   *  `riskAdjustmentExplanation`). Equal to the pure-EV comparison when risk-awareness
   *  is disabled or no opponent score is supplied. */
  recommendedAction: 'bank' | 'continue';
  /** `continue.expectedValue` after any risk-awareness bias has been added - this is
   *  what `recommendedAction` is actually decided from. */
  adjustedContinueExpectedValue: number;
  /** Plain-English reason a risk-awareness bias was applied, or '' if none was. */
  riskAdjustmentExplanation: string;
  /** Number of dice that would be rerolled if continuing (6 if hot dice). */
  diceRemainingIfContinuing: number;
  /** True if this selection uses every rolled die, earning a fresh set of 6 ("hot dice"). */
  isHotDice: boolean;
  /** Exact probability of Farkling on the next roll if continuing. */
  farkleProbabilityIfContinuing: number;
}

export interface AdvisorReport {
  /** All recommendations, one per viable dice-selection strategy, best first. */
  options: AdvisorRecommendation[];
  /** The single best option overall (selection + action) by expected value. */
  best: AdvisorRecommendation;
  /** True if banking now would reach or exceed the target score (instant win opportunity). */
  wouldWinByBanking: boolean;
}

export interface AdvisorInput {
  /** Dice values from the most recent roll that are still available to choose from. */
  dice: DieValue[];
  /** Points already accumulated this turn, before this roll's selection is added. */
  turnScoreBeforeRoll: number;
  /** The player's total banked score before this turn. */
  playerTotalScore: number;
  /** Score required to win the game. */
  targetScore: number;
  /**
   * The opponent's current total banked score. Only used when `riskAwareness` is
   * enabled, to bias advice toward higher-variance "push on" plays when significantly
   * behind, or toward safer banking when close to a winning score. Ignored otherwise.
   */
  opponentTotalScore?: number;
  /**
   * When true, nudges the bank-vs-continue recommendation using the race to
   * `targetScore` rather than pure expected value alone (requires
   * `opponentTotalScore` to have any effect). Defaults to false. This is a precursor
   * to a future user-configurable "risk profile" setting - see docs/settings.md.
   */
  riskAwareness?: boolean;
  /**
   * Overrides how many further voluntary rolls the continuation-EV solver plays out
   * (see `getContinuationValue`). Defaults to `DEFAULT_LOOKAHEAD_DEPTH`. Only intended
   * for giving the computer opponent a deliberately shallower (weaker) lookahead at
   * lower `ComputerSkill` levels - the human-facing advisor always uses the default.
   */
  lookaheadDepth?: number;
}

/**
 * Heuristic v1: nudges the continue-EV used for the bank-vs-continue decision based on
 * how the race to `targetScore` is going. This does not change the underlying expected
 * value math (which remains exact) - it only shifts the decision boundary, and is fully
 * opt-in via `riskAwareness` so it never affects callers that don't ask for it.
 */
function applyRiskAwareness(params: {
  riskAwareness: boolean | undefined;
  continueEV: number;
  projectedTotal: number;
  opponentTotalScore: number | undefined;
  targetScore: number;
}): { adjustedContinueEV: number; riskAdjustmentExplanation: string } {
  const { riskAwareness, continueEV, projectedTotal, opponentTotalScore, targetScore } = params;
  if (!riskAwareness || opponentTotalScore === undefined) {
    return { adjustedContinueEV: continueEV, riskAdjustmentExplanation: '' };
  }

  const deficit = opponentTotalScore - projectedTotal; // positive => behind the opponent
  const remainingToWin = targetScore - projectedTotal;

  let bias = 0;
  const notes: string[] = [];

  // Catch-up: the further behind, the more we favor pushing on, capped so a huge
  // deficit can't force a recommendation to continue through near-certain Farkles.
  if (deficit > 0) {
    const catchUpBonus = Math.min(deficit * 0.25, targetScore * 0.1);
    if (catchUpBonus > 0) {
      bias += catchUpBonus;
      notes.push(`you're behind by ${Math.round(deficit).toLocaleString()} points, so pushing on is weighted more favorably`);
    }
  }

  // Protect a near-certain win: close to the target score, so prefer the safe bank
  // even if continuing has a slightly better raw expected value.
  const closeToWinThreshold = targetScore * 0.05;
  if (remainingToWin > 0 && remainingToWin <= closeToWinThreshold) {
    bias -= targetScore * 0.08;
    notes.push("you're close to the winning score, so banking is weighted more favorably to protect that lead");
  }

  return {
    adjustedContinueEV: continueEV + bias,
    riskAdjustmentExplanation: notes.join('; '),
  };
}

/**
 * Builds advice for the current roll: for every sensible dice-selection strategy,
 * compares the expected value of banking now vs. rolling the remaining dice again.
 *
 * The "continue" expected value is a recursive, depth-limited lookahead
 * (`getContinuationValue`, depth = `lookaheadDepth` input, defaulting to
 * `DEFAULT_LOOKAHEAD_DEPTH`): it plays out several
 * further optimal rolls (including the chance of chaining through repeated Hot Dice),
 * not just the very next one, so it properly credits the compounding value of getting
 * down to few dice and refreshing to 6. At depth 0 it is exactly the classic one-roll
 * formula `(1 - pFarkle) * (turnScoreAfter + E[best score | not farkle])`; each extra
 * depth level only adds further (optimal) rolls beyond that.
 *
 * Optionally (via `riskAwareness`), the bank-vs-continue decision boundary is nudged
 * based on the race to `targetScore` - see `applyRiskAwareness` for the heuristic.
 */
export function getAdvisorReport(input: AdvisorInput): AdvisorReport {
  const { dice, turnScoreBeforeRoll, playerTotalScore, targetScore, opponentTotalScore, riskAwareness } = input;
  const lookaheadDepth = input.lookaheadDepth ?? DEFAULT_LOOKAHEAD_DEPTH;
  const candidates = generateSelectionCandidates(dice);

  const options: AdvisorRecommendation[] = candidates.map((candidate) => {
    const turnScoreAfter = turnScoreBeforeRoll + candidate.result.score;
    const isHotDice = candidate.indices.length === dice.length;
    const diceRemainingIfContinuing = isHotDice ? 6 : dice.length - candidate.indices.length;
    const stats = getRollDistributionStats(diceRemainingIfContinuing);

    const bankEV = turnScoreAfter;
    const continueEV = getContinuationValue(diceRemainingIfContinuing, turnScoreAfter, lookaheadDepth);

    const { adjustedContinueEV, riskAdjustmentExplanation } = applyRiskAwareness({
      riskAwareness,
      continueEV,
      projectedTotal: playerTotalScore + turnScoreAfter,
      opponentTotalScore,
      targetScore,
    });

    const bank: ActionEvaluation = {
      action: 'bank',
      expectedValue: bankEV,
      explanation:
        `Banking locks in ${turnScoreAfter.toLocaleString()} points this turn for certain, ` +
        `which is higher than ~${Math.round(continueEV).toLocaleString()} points, the expected value of continuing ` +
        `(Farkle risk ${(stats.farkleProbability * 100).toFixed(1)}%).`,
    };
    const continueEval: ActionEvaluation = {
      action: 'continue',
      expectedValue: continueEV,
      explanation:
        (isHotDice ? `🔥 Hot dice! You get a fresh set of six dice. Rolling them` : `Rolling ${numberWord(diceRemainingIfContinuing)} dice`) +
        ` has a ${(stats.farkleProbability * 100).toFixed(1)}% ` +
        `chance of Farkling on this very next roll (losing all ${turnScoreAfter.toLocaleString()} points this turn). ` +
        `Factoring in the next few rolls played optimally - including the chance of chaining into further Hot Dice - ` +
        `continuing is worth about ${Math.round(continueEV).toLocaleString()} points on average.`,
    };

    return {
      candidate,
      bank,
      continue: continueEval,
      recommendedAction: adjustedContinueEV > bankEV ? 'continue' : 'bank',
      adjustedContinueExpectedValue: adjustedContinueEV,
      riskAdjustmentExplanation,
      diceRemainingIfContinuing,
      isHotDice,
      farkleProbabilityIfContinuing: stats.farkleProbability,
    };
  });

  options.sort((a, b) => {
    const bestA = Math.max(a.bank.expectedValue, a.adjustedContinueExpectedValue);
    const bestB = Math.max(b.bank.expectedValue, b.adjustedContinueExpectedValue);
    return bestB - bestA;
  });

  const best = options[0];
  const wouldWinByBanking =
    best !== undefined && playerTotalScore + turnScoreBeforeRoll + best.candidate.result.score >= targetScore;

  return { options, best, wouldWinByBanking };
}
