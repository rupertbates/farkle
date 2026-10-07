import type { ReactNode } from 'react';
import { booleanCodec, usePersistedState } from '../hooks/usePersistedState';

export interface CollapsiblePanelProps {
  title: ReactNode;
  /** Unique localStorage key so the player's open/closed preference for this panel
   *  persists across reloads and new games instead of resetting every time. */
  storageKey: string;
  /** Used only the very first time (no stored preference yet) for this `storageKey`. */
  defaultOpen: boolean;
  children: ReactNode;
}

/**
 * A panel with a clickable header that shows/hides its content. Used for panels that
 * are useful but not always relevant (the scoring guide reference table) or that some
 * players may want to opt out of entirely (the advisor) - one collapse/expand mechanism
 * covers both cases, with each panel remembering its own open state independently.
 */
export function CollapsiblePanel({ title, storageKey, defaultOpen, children }: CollapsiblePanelProps) {
  const [open, setOpen] = usePersistedState(storageKey, defaultOpen, booleanCodec);

  const toggle = () => setOpen((prev) => !prev);

  return (
    <div className="collapsible-panel">
      <button
        type="button"
        className="collapsible-panel__header"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="collapsible-panel__title">{title}</span>
        <span className="collapsible-panel__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="collapsible-panel__body">{children}</div>}
    </div>
  );
}
