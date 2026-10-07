import { motion } from 'framer-motion';
import { scoreGroup } from '../game';
import type { DieValue } from '../game';
import { Die } from './Die';

export interface HeldDiceRailProps {
  /** Dice from the current roll. */
  dice: DieValue[];
  /** Indices within `dice` the player has held (set aside) this roll, pending lock-in. */
  selectedIndices: number[];
  /** Groups of dice already locked in earlier rolls this turn. */
  heldGroups: DieValue[][];
  rollId: number;
  interactive: boolean;
  onToggle: (index: number) => void;
  /** The running turn-score total, including any dice held but not yet locked in by
   *  rolling/banking. Shown pinned at the top of this rail (above the held-dice
   *  list) rather than in the panel header next to "Your turn"/"Computer's turn" -
   *  it reads more naturally right above the dice it's the running total of. */
  turnScore: number;
  /** Why the currently-held (pending) selection can't be rolled/banked yet, or
   *  `undefined` when it's valid (or nothing's held). Shown as a tooltip on the
   *  pending group's "Not scoring" badge - deliberately not as its own paragraph,
   *  so an invalid selection never reserves/varies vertical space on the board. */
  invalidReason?: string;
}

/**
 * Sits at the side of the board. Dice the player holds slide here from the board
 * (sharing a layoutId for the animated move) and stay visible for the rest of the
 * turn, grouped by which roll they were locked in on. A "Total" readout pinned at
 * the top of the rail shows the running turn-score total just above them.
 */
export function HeldDiceRail({
  dice,
  selectedIndices,
  heldGroups,
  rollId,
  interactive,
  onToggle,
  turnScore,
  invalidReason,
}: HeldDiceRailProps) {
  const hasAny = selectedIndices.length > 0 || heldGroups.length > 0;
  const pendingResult = scoreGroup(selectedIndices.map((index) => dice[index]));

  return (
    <div className="held-rail">
      <div className="held-rail__total">
        <span>Total</span>
        <span className="held-rail__total-value">{turnScore.toLocaleString()} pts</span>
      </div>
      <div className="held-rail__scroll">
        <h4>Held this turn</h4>
        {!hasAny && <p className="held-rail__empty">Dice you hold will appear here.</p>}

        {heldGroups.map((group, gi) => {
          const points = scoreGroup(group).score;
          return (
            <div className="held-rail__group held-rail__group--locked" key={`group-${gi}`}>
              <div className="held-rail__dice">
                {group.map((value, vi) => (
                  <Die key={`locked-${gi}-${vi}`} value={value} size="sm" selected disabled />
                ))}
              </div>
              <span className="held-rail__points">+{points} pts</span>
            </div>
          );
        })}

        {selectedIndices.length > 0 && (
          <div className={`held-rail__group held-rail__group--pending${pendingResult.valid ? '' : ' held-rail__group--invalid'}`}>
            <div className="held-rail__dice">
              {selectedIndices.map((index) => (
                <motion.div
                  key={`die-${rollId}-${index}`}
                  layoutId={`die-${rollId}-${index}`}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                >
                  <Die value={dice[index]} size="sm" selected disabled={!interactive} onClick={() => onToggle(index)} />
                </motion.div>
              ))}
            </div>
            {pendingResult.valid ? (
              <span className="held-rail__points-pending">+{pendingResult.score} pts</span>
            ) : (
              <span className="held-rail__points-pending held-rail__points-pending--invalid" title={invalidReason}>
                ⚠️ No score
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
