import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { DieValue } from '../game';
import { findBestSelection } from '../game';
import { Die } from './Die';

export interface GameBoardProps {
  /** Dice from the current roll. */
  dice: DieValue[];
  /** Indices within `dice` the player has held (set aside) this roll. */
  selectedIndices: number[];
  /** Increments per roll; used to key/animate a fresh throw and to link up with the held rail. */
  rollId: number;
  interactive: boolean;
  onToggle: (index: number) => void;
}

interface DieLayout {
  /** Resting position as a percentage of the board, from its center. */
  leftPct: number;
  topPct: number;
  /** Resting rotation, in degrees, so settled dice look genuinely thrown. */
  rotate: number;
  /** Lateral offset (px) the die flies in from before settling. */
  throwX: number;
}

/** Divides the board into a jittered grid so dice land scattered but without heavy overlap. */
function layoutDice(count: number): DieLayout[] {
  if (count === 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const cells = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return Array.from({ length: count }, (_, i) => {
    const cell = cells[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    const jitterX = (Math.random() - 0.5) * cellW * 0.5;
    const jitterY = (Math.random() - 0.5) * cellH * 0.5;
    return {
      leftPct: col * cellW + cellW / 2 + jitterX,
      topPct: row * cellH + cellH / 2 + jitterY,
      rotate: Math.random() * 70 - 35,
      throwX: (Math.random() - 0.5) * 160,
    };
  });
}

/**
 * The felt playing surface. It stays mounted for the whole turn - only the dice inside
 * it change - so rolling again just throws fresh dice onto the same board rather than
 * replacing the board itself. Dice that are "held" share a layoutId with their twin in
 * the HeldDiceRail, so framer-motion slides them across to the side when toggled.
 */
export function GameBoard({ dice, selectedIndices, rollId, interactive, onToggle }: GameBoardProps) {
  // Scattered resting positions/rotations per die, computed once per roll (keyed by
  // rollId) so re-renders (e.g. toggling a hold) don't recompute/replay the throw.
  const layout = useMemo(
    () => layoutDice(dice.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollId, dice.length],
  );

  const liveDice = dice
    .map((value, index) => ({ value, index }))
    .filter(({ index }) => !selectedIndices.includes(index));

  // Dice that can't contribute to any valid combo this roll (e.g. a lone 2, 3, 4 or 6)
  // should be inert - clicking them can never produce a valid selection, so there's no
  // point letting the player "hold" one only to find out later it doesn't score.
  const nonScoringIndices = useMemo(() => new Set(findBestSelection(dice).remainingIndices), [dice]);

  return (
    <div className="board">
      <div className="board__felt">
        {dice.length === 0 && <p className="board__placeholder">🎲 Roll to throw the dice onto the board</p>}

        {dice.length > 0 && liveDice.length === 0 && (
          <p className="board__placeholder">All dice held - lock them in or bank your turn</p>
        )}

        {liveDice.map(({ value, index }) => {
          const pos = layout[index] ?? { leftPct: 50, topPct: 50, rotate: 0, throwX: 0 };
          return (
            <motion.div
              key={`die-${rollId}-${index}`}
              layoutId={`die-${rollId}-${index}`}
              className="board__die-slot"
              style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%`, translate: '-50% -50%' }}
              initial={{ y: -220, x: pos.throwX, rotate: pos.rotate * 3, opacity: 0, scale: 0.5 }}
              animate={{ y: 0, x: 0, rotate: pos.rotate, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: index * 0.05 }}
            >
              <Die
                value={value}
                selected={false}
                disabled={!interactive || nonScoringIndices.has(index)}
                onClick={() => onToggle(index)}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
