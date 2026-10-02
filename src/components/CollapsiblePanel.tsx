import { useState, type ReactNode } from 'react';

export interface CollapsiblePanelProps {
  title: ReactNode;
  /** Unique localStorage key so the player's open/closed preference for this panel
   *  persists across reloads and new games instead of resetting every time. */
  storageKey: string;
  /** Used only the very first time (no stored preference yet) for this `storageKey`. */
  defaultOpen: boolean;
  children: ReactNode;
}

function readStoredOpen(storageKey: string, defaultOpen: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? defaultOpen : stored === 'true';
  } catch {
    // localStorage can throw in some privacy modes/environments - just fall back silently.
    return defaultOpen;
  }
}

/**
 * A panel with a clickable header that shows/hides its content. Used for panels that
 * are useful but not always relevant (the scoring guide reference table) or that some
 * players may want to opt out of entirely (the advisor) - one collapse/expand mechanism
 * covers both cases, with each panel remembering its own open state independently.
 */
export function CollapsiblePanel({ title, storageKey, defaultOpen, children }: CollapsiblePanelProps) {
  const [open, setOpen] = useState(() => readStoredOpen(storageKey, defaultOpen));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // Ignore storage failures - the toggle still works for the rest of this session.
      }
      return next;
    });
  };

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
