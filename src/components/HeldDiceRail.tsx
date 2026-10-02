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
  /** Running total banked-so-far this turn (not yet on the scoreboard until the turn ends). */
  turnScore: number;
}

/**
 * Sits at the side of the board. Dice the player holds slide here from the board
 * (sharing a layoutId for the animated move) and stay visible for the rest of the
 * turn, grouped by which roll they were locked in on. A running turn-score footer is
 * pinned at the bottom - previously this lived in the scoreboard header above, but
 * its position flipped between the human's and computer's columns depending on
 * whose turn it was, making the whole page jump height between turns.
 */
export function HeldDiceRail({
  dice,
  selectedIndices,
  heldGroups,
  rollId,
  interactive,
  onToggle,
  turnScore,
}: HeldDiceRailProps) {
  const hasAny = selectedIndices.length > 0 || heldGroups.length > 0;
  const pendingResult = scoreGroup(selectedIndices.map((index) => dice[index]));

  return (
    <div className="held-rail">
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
          <div className="held-rail__group held-rail__group--pending">
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
            <span className="held-rail__points-pending">
              {pendingResult.valid ? `+${pendingResult.score} pts` : 'not scoring'}
            </span>
          </div>
        )}
      </div>

      <div className="held-rail__turn-score">
        <span>Turn score</span>
        <span className="held-rail__turn-score-value">{turnScore.toLocaleString()} pts</span>
      </div>
    </div>
  );
}
