export interface SettingsOverlayProps {
  pauseAfterComputerTurn: boolean;
  onTogglePauseAfterComputerTurn: () => void;
  onClose: () => void;
}

/** Full-screen overlay for game settings, opened from the header's cog button. */
export function SettingsOverlay({ pauseAfterComputerTurn, onTogglePauseAfterComputerTurn, onClose }: SettingsOverlayProps) {
  return (
    <div className="fullscreen-overlay" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="fullscreen-overlay__card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="fullscreen-overlay__close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h2>⚙️ Settings</h2>
        <div className="fullscreen-overlay__body">
          <label className="settings__toggle">
            <input type="checkbox" checked={pauseAfterComputerTurn} onChange={onTogglePauseAfterComputerTurn} />
            <span>
              Pause after computer's turn
              <span className="settings__toggle-hint">
                Show a "Continue" button after the computer banks or Farkles, so you can review its move before play
                passes back. Turn off to let the computer's turns advance automatically.
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
