import type { DieValue } from '../game';

const PIP_LAYOUTS: Record<DieValue, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export type DieSize = 'sm' | 'lg';

export interface DieProps {
  value: DieValue;
  selected: boolean;
  disabled?: boolean;
  size?: DieSize;
  onClick?: () => void;
}

/** Renders a single die face as a 3x3 pip grid. */
export function Die({ value, selected, disabled, size = 'lg', onClick }: DieProps) {
  const pips = PIP_LAYOUTS[value];
  return (
    <button
      type="button"
      className={`die die--${size}${selected ? ' die--selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Die showing ${value}${selected ? ', held' : ''}`}
    >
      <span className="die__grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={`die__pip${pips.includes(i) ? ' die__pip--visible' : ''}`} />
        ))}
      </span>
    </button>
  );
}
