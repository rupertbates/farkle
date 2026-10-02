import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { DieValue } from '../game';
import { findBestSelection } from '../game';
import { Die } from './Die';

export interface GameBoardProps {
  /** Dice from the current roll. */
  dice: DieValue[];
  /** Indices within `dice` the player has held (set aside) this roll. */
  selectedIndices: number[];
  /** Indices within `dice` already locked in earlier this same roll - kept out of
   *  view here since they're shown as a locked group in the held rail instead, but
   *  distinct from dice that were simply never selected (which stay visible). */
  committedIndices: number[];
  /** Increments per roll; used to key/animate a fresh throw and to link up with the held rail. */
  rollId: number;
  interactive: boolean;
  onToggle: (index: number) => void;
  /** Shows the "Roll to throw the dice onto the board" hint when the board is empty.
   *  Only true before the very first roll of a new game - every other empty board
   *  (the start of each subsequent turn) stays blank instead of repeating the hint. */
  showInitialPlaceholder: boolean;
  /** Roll/Bank action buttons, pinned to the bottom of the felt as an overlay bar.
   *  When present, dice are scattered only in the remaining space above it (see
   *  `useOverlayReservePct`) so live dice never land underneath the buttons. */
  controlsOverlay?: ReactNode;
  /** A small status banner (e.g. "Hot dice!") pinned to the top of the felt, mirroring
   *  `controlsOverlay` at the bottom. Dice are scattered only below it so none land
   *  underneath. */
  topOverlay?: ReactNode;
  /** The end-of-turn (Farkle / banked) message, shown as a centered popover on top of
   *  the felt instead of a separate block below the board. It's fine for this to cover
   *  any dice still showing underneath - the turn's already over. */
  popover?: ReactNode;
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

/** Fallback percentage of the felt's height kept clear for an overlay before its real
 *  height has been measured (see `useOverlayReservePct`) - content varies by phase and
 *  viewport (e.g. a single button vs. a button row plus a status line), so a fixed
 *  guess alone would under- or over-reserve space depending on which is showing. */
const CONTROLS_RESERVED_PCT_FALLBACK = 24;
const TOP_OVERLAY_RESERVED_PCT_FALLBACK = 12;

/** Extra padding (percentage points) added on top of an overlay's measured height, so
 *  dice never land flush against its edge. */
const OVERLAY_RESERVE_BUFFER_PCT = 4;

/** Measures `overlayRef`'s rendered height as a percentage of `feltRef`'s height,
 *  live, so the dice-reserved area always matches the actual overlay - which varies in
 *  content by turn phase and viewport width - instead of relying on one fixed guess
 *  for every case. Used for both the bottom controls bar and the top status banner. */
function useOverlayReservePct(
  feltRef: React.RefObject<HTMLDivElement | null>,
  overlayRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  fallbackPct: number,
): number {
  const [pct, setPct] = useState(fallbackPct);

  useEffect(() => {
    if (!active) return;
    const felt = feltRef.current;
    const overlay = overlayRef.current;
    if (!felt || !overlay) return;

    const measure = () => {
      const feltHeight = felt.getBoundingClientRect().height;
      const overlayHeight = overlay.getBoundingClientRect().height;
      if (feltHeight === 0) return;
      const measured = (overlayHeight / feltHeight) * 100 + OVERLAY_RESERVE_BUFFER_PCT;
      setPct(Math.min(70, Math.max(fallbackPct, measured)));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(felt);
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [active, feltRef, overlayRef, fallbackPct]);

  return active ? pct : 0;
}

/** Divides the board into a jittered grid so dice land scattered but without heavy
 *  overlap. `reserveTopPct`/`reserveBottomPct` compress the grid into the remaining
 *  vertical space between them, leaving room clear at the top and/or bottom for any
 *  overlaid banner/controls. */
function layoutDice(count: number, reserveTopPct: number, reserveBottomPct: number): DieLayout[] {
  if (count === 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const usableHeightPct = 100 - reserveTopPct - reserveBottomPct;

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
      topPct: reserveTopPct + (row * cellH + cellH / 2 + jitterY) * (usableHeightPct / 100),
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
export function GameBoard({
  dice,
  selectedIndices,
  committedIndices,
  rollId,
  interactive,
  onToggle,
  showInitialPlaceholder,
  controlsOverlay,
  topOverlay,
  popover,
}: GameBoardProps) {
  const feltRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const topOverlayRef = useRef<HTMLDivElement>(null);
  const reserveBottomPct = useOverlayReservePct(
    feltRef,
    overlayRef,
    Boolean(controlsOverlay),
    CONTROLS_RESERVED_PCT_FALLBACK,
  );
  const reserveTopPct = useOverlayReservePct(
    feltRef,
    topOverlayRef,
    Boolean(topOverlay),
    TOP_OVERLAY_RESERVED_PCT_FALLBACK,
  );

  // Scattered resting positions/rotations per die, computed once per roll (keyed by
  // rollId) so re-renders (e.g. toggling a hold) don't recompute/replay the throw.
  const layout = useMemo(
    () => layoutDice(dice.length, reserveTopPct, reserveBottomPct),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollId, dice.length, reserveTopPct, reserveBottomPct],
  );

  const liveDice = dice
    .map((value, index) => ({ value, index }))
    .filter(({ index }) => !selectedIndices.includes(index) && !committedIndices.includes(index));

  // Dice that can't contribute to any valid combo this roll (e.g. a lone 2, 3, 4 or 6)
  // should be inert - clicking them can never produce a valid selection, so there's no
  // point letting the player "hold" one only to find out later it doesn't score.
  const nonScoringIndices = useMemo(() => new Set(findBestSelection(dice).remainingIndices), [dice]);

  return (
    <div className="board">
      <div className="board__felt" ref={feltRef}>
        {dice.length === 0 && showInitialPlaceholder && (
          <p className="board__placeholder">🎲 Roll to throw the dice onto the board</p>
        )}

        {interactive && dice.length > 0 && liveDice.length === 0 && (
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

        {controlsOverlay && (
          <div className="board__controls-overlay" ref={overlayRef}>
            {controlsOverlay}
          </div>
        )}

        {topOverlay && (
          <div className="board__top-overlay" ref={topOverlayRef}>
            {topOverlay}
          </div>
        )}

        {popover && (
          <div className="board__popover-backdrop">
            <div className="board__popover">{popover}</div>
          </div>
        )}
      </div>
    </div>
  );
}
