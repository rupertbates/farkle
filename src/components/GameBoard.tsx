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
  /** A small status banner (e.g. "Hot dice!") pinned to the top of the felt. Dice are
   *  scattered below the banner's actual (measured) height - including its "why?"
   *  reasoning popover when expanded - so a die is never scattered underneath it or
   *  left stranded under it after it grows (e.g. wrapped text, or opening the
   *  reasoning popover). See `useOverlayReservePct`. */
  topOverlay?: ReactNode;
  /** Whether `topOverlay`'s reserved space should track its real, live-measured
   *  height (for the human's advisor banner, whose reasoning popover can open and
   *  genuinely needs the room) or stay at one fixed, generously-sized reserve (for
   *  the computer-turn status line, whose short phrase changes - and so wraps to a
   *  different number of lines - every time the computer moves through a phase, with
   *  nothing for the player to actually read "under"). Fixed avoids dice visibly
   *  re-settling on every such change for content nobody's interacting with, while
   *  still reserving enough room that a 2-line wrap never overlaps a die - just
   *  without chasing every intermediate size. Defaults to `true` (live). */
  topOverlayMeasuresLive?: boolean;
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

/** Fixed reserve used for the computer-turn status line instead of its measured
 *  height (see `topOverlayMeasuresLive`) - sized generously enough to comfortably fit
 *  its icon row plus a full second wrapped line on the narrowest supported felt,
 *  confirmed visually, so it can stay fixed without ever risking overlap. */
const TOP_OVERLAY_STATIC_RESERVE_PCT = 26;

/** Ceilings on how much of the felt's height an overlay may ever claim, so a single
 *  die or two is never asked to squeeze into literally zero space. The top banner
 *  gets a much higher ceiling than the bottom controls bar: its content (especially
 *  the reasoning popover, bounded but still sizeable - see `.board__headline-
 *  reasoning-popover`) can legitimately need most of a short, narrow felt, and unlike
 *  the bottom bar it's the one dice must never end up underneath (see `applyReserve`'s
 *  `topMarginPct`, enforced only against this boundary). */
const CONTROLS_RESERVE_PCT_MAX = 70;
const TOP_OVERLAY_RESERVE_PCT_MAX = 92;

/** Small extra clearance (in px, converted to a percentage of the felt's actual
 *  measured height) added on top of an overlay's measured height, just for a touch of
 *  breathing room beyond its edge. The bigger concern - a die's own footprint poking
 *  back over that edge, since each die is positioned by its *center* - is handled
 *  separately per-die (see `DIE_FOOTPRINT_RADIUS_PX`/`applyReserve`), because that
 *  depends on how compressed the usable area ends up, not just the overlay's size. */
const OVERLAY_RESERVE_BUFFER_PX = 8;

/** Half the diagonal of the largest (44px) die once rotated up to 35deg - i.e. the
 *  furthest any point of a settled die can extend from its own center point. Used to
 *  keep every die's full footprint (not just its center) clear of reserved overlay
 *  space, regardless of how the usable area happens to get rescaled. Deliberately
 *  sized for the larger desktop die so it's still safely conservative at the smaller
 *  (36px) mobile size. */
const DIE_FOOTPRINT_RADIUS_PX = 32;

/** Measures `overlayRef`'s rendered height as a percentage of `feltRef`'s height,
 *  live, so the dice-reserved area always matches the actual overlay - which varies in
 *  content by turn phase and viewport width - instead of relying on one fixed guess
 *  for every case. Used for both the bottom controls bar and the top status banner.
 *  Pass `measureLive: false` to skip the live measurement altogether and just reserve
 *  a fixed `fallbackPct` instead - for content whose size changes often but isn't
 *  worth re-settling already-placed dice over (see `topOverlayMeasuresLive`). */
function useOverlayReservePct(
  feltRef: React.RefObject<HTMLDivElement | null>,
  overlayRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  fallbackPct: number,
  maxPct: number,
  measureLive: boolean = true,
): number {
  const [pct, setPct] = useState(fallbackPct);

  useEffect(() => {
    if (!active || !measureLive) return;
    const felt = feltRef.current;
    const overlay = overlayRef.current;
    if (!felt || !overlay) return;

    const measure = () => {
      const feltHeight = felt.getBoundingClientRect().height;
      const overlayHeight = overlay.getBoundingClientRect().height;
      if (feltHeight === 0) return;
      const bufferPct = (OVERLAY_RESERVE_BUFFER_PX / feltHeight) * 100;
      const measured = (overlayHeight / feltHeight) * 100 + bufferPct;
      setPct(Math.min(maxPct, Math.max(fallbackPct, measured)));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(felt);
    observer.observe(overlay);
    return () => observer.disconnect();
  }, [active, feltRef, overlayRef, fallbackPct, maxPct, measureLive]);

  return active ? (measureLive ? pct : fallbackPct) : 0;
}

/** Tracks `ref`'s rendered pixel height live, so percentage-based sizing elsewhere
 *  (e.g. converting `DIE_FOOTPRINT_RADIUS_PX` into a felt-relative percentage) stays
 *  correct across viewport widths and resizes rather than assuming one fixed size. */
function useMeasuredHeightPx(ref: React.RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setHeight(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}

interface RawDieLayout {
  /** Resting horizontal position as a percentage of the board, from its center. */
  leftPct: number;
  /** Resting vertical position as a percentage *of the usable (unreserved) height*,
   *  i.e. before `reserveTopPct`/`reserveBottomPct` are applied - kept separate from
   *  the reserve calculation (see `applyReserve`) so dice never need to be
   *  re-shuffled into new cells/positions just because the reserved space changed. */
  topPctRaw: number;
  rotate: number;
  throwX: number;
}

/** Divides the board into a jittered grid so dice land scattered but without heavy
 *  overlap. Computed once per roll (see `layout` in `GameBoard`, keyed only on
 *  `rollId`/`dice.length`) - the raw `topPctRaw` is independent of how much space is
 *  currently reserved for overlays, so later reserve changes (e.g. the controls bar's
 *  measured height settling) never require re-randomizing positions (which would make
 *  already-settled dice visibly jump). */
function layoutDice(count: number): RawDieLayout[] {
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
      topPctRaw: row * cellH + cellH / 2 + jitterY,
      rotate: Math.random() * 70 - 35,
      throwX: (Math.random() - 0.5) * 160,
    };
  });
}

/** Compresses a raw layout's vertical positions into the space left over after
 *  reserving `reserveTopPct`/`reserveBottomPct` for overlays - a pure rescale, with no
 *  randomization, so it can safely re-run whenever the reserved space changes without
 *  shuffling any die into a different cell.
 *
 *  `topMarginPct` only guards the *top* boundary (not the bottom) deliberately: the
 *  top banner is the one that can grow tall enough to cover a die's whole center point
 *  (e.g. the reasoning popover expanding on a short, narrow screen) and is the one
 *  users read, so it gets a firm guarantee. The bottom controls bar is just the
 *  roll/bank buttons - on the same cramped screens there usually isn't room to keep
 *  a die's full footprint clear of *both* bars at once, so only the top is enforced
 *  (matching the specific "a die ends up under the banner" bug this guards against). */
function applyReserve(
  raw: RawDieLayout[],
  reserveTopPct: number,
  reserveBottomPct: number,
  topMarginPct: number,
): DieLayout[] {
  const usableHeightPct = 100 - reserveTopPct - reserveBottomPct;
  const minTopPct = reserveTopPct + topMarginPct;
  return raw.map((pos) => {
    const rawTopPct = reserveTopPct + pos.topPctRaw * (usableHeightPct / 100);
    return {
      leftPct: pos.leftPct,
      topPct: Math.max(minTopPct, rawTopPct),
      rotate: pos.rotate,
      throwX: pos.throwX,
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
  topOverlayMeasuresLive = true,
  popover,
}: GameBoardProps) {
  const feltRef = useRef<HTMLDivElement>(null);
  const controlsOverlayRef = useRef<HTMLDivElement>(null);
  const topOverlayRef = useRef<HTMLDivElement>(null);
  const reserveBottomPct = useOverlayReservePct(
    feltRef,
    controlsOverlayRef,
    Boolean(controlsOverlay),
    CONTROLS_RESERVED_PCT_FALLBACK,
    CONTROLS_RESERVE_PCT_MAX,
  );
  // Measured live (see `useOverlayReservePct`) rather than a fixed guess, so dice are
  // never left scattered underneath the banner whatever its actual height turns out to
  // be - including the "why?" reasoning popover, which is part of normal document flow
  // (not floated) specifically so opening it grows this measurement too. Already-
  // settled dice smoothly re-settle into the newly-shrunk space instead of jumping
  // (see the `top`/`left` transition on `.board__die-slot`). Falls back to a fixed
  // reserve instead (ignoring the real measured height) when `topOverlayMeasuresLive`
  // is false - see its doc comment for why (the computer-status line).
  const reserveTopPct = useOverlayReservePct(
    feltRef,
    topOverlayRef,
    Boolean(topOverlay),
    topOverlayMeasuresLive ? TOP_OVERLAY_RESERVED_PCT_FALLBACK : TOP_OVERLAY_STATIC_RESERVE_PCT,
    TOP_OVERLAY_RESERVE_PCT_MAX,
    topOverlayMeasuresLive,
  );

  // Converts `DIE_FOOTPRINT_RADIUS_PX` into a felt-relative percentage so it scales
  // correctly across viewport widths, for clamping each die clear of reserved space.
  const feltHeightPx = useMeasuredHeightPx(feltRef);
  const dieMarginPct = feltHeightPx > 0 ? (DIE_FOOTPRINT_RADIUS_PX / feltHeightPx) * 100 : 0;

  // The randomized cell/jitter/rotation assignment, computed once per roll (keyed by
  // rollId) so re-renders - including the reserved-space recalculation below settling
  // to its measured value, or a hold toggling - never reshuffle already-settled dice
  // into different positions.
  const rawLayout = useMemo(
    () => layoutDice(dice.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollId, dice.length],
  );

  // Rescaled into the space left over after reserving room for the top/bottom
  // overlays - a cheap, non-randomized transform, so it can safely re-run whenever
  // `reserveTopPct`/`reserveBottomPct` change (e.g. once an overlay's real height is
  // measured) without disturbing any die's assigned cell.
  const layout = useMemo(
    () => applyReserve(rawLayout, reserveTopPct, reserveBottomPct, dieMarginPct),
    [rawLayout, reserveTopPct, reserveBottomPct, dieMarginPct],
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
          <div className="board__controls-overlay" ref={controlsOverlayRef}>
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
