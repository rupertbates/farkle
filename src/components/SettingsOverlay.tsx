import type { ComputerSkill } from '../game';

const SKILL_OPTIONS: { value: ComputerSkill; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

export interface SettingsOverlayProps {
  pauseAfterComputerTurn: boolean;
  onTogglePauseAfterComputerTurn: () => void;
  showAdvice: boolean;
  onToggleShowAdvice: () => void;
  computerSkill: ComputerSkill;
  onChangeComputerSkill: (skill: ComputerSkill) => void;
  riskAwareness: boolean;
  onToggleRiskAwareness: () => void;
  onClose: () => void;
}

/** Full-screen overlay for game settings, opened from the header's cog button. */
export function SettingsOverlay({
  pauseAfterComputerTurn,
  onTogglePauseAfterComputerTurn,
  showAdvice,
  onToggleShowAdvice,
  computerSkill,
  onChangeComputerSkill,
  riskAwareness,
  onToggleRiskAwareness,
  onClose,
}: SettingsOverlayProps) {
  return (
    <div className="fullscreen-overlay" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="fullscreen-overlay__card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="fullscreen-overlay__close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h2>⚙️ Settings</h2>
        <div className="fullscreen-overlay__body">
          <div className="settings__group">
            <span className="settings__group-label">🤖 Computer skill</span>
            <span className="settings__toggle-hint">
              How well the computer opponent plays. "Hard" always plays the mathematically optimal move; lower
              settings make it think less far ahead and occasionally second-guess a good decision.
            </span>
            <div className="settings__segmented" role="radiogroup" aria-label="Computer skill">
              {SKILL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={computerSkill === option.value}
                  className={`settings__segmented-btn${computerSkill === option.value ? ' settings__segmented-btn--active' : ''}`}
                  onClick={() => onChangeComputerSkill(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="settings__toggle">
            <input type="checkbox" checked={showAdvice} onChange={onToggleShowAdvice} />
            <span>
              🧭 Show advice
              <span className="settings__toggle-hint">
                Show the advisor's recommendation banner at the top of the board on your turn. Turn off to play
                without any hints.
              </span>
            </span>
          </label>
          <label className="settings__toggle">
            <input type="checkbox" checked={riskAwareness} onChange={onToggleRiskAwareness} />
            <span>
              🎯 Take game state into account
              <span className="settings__toggle-hint">
                Nudge advice (for you and the computer) based on the race to the target score - pushing harder to
                continue when behind, and playing safer by banking sooner when close to winning - instead of always
                recommending the pure expected-value-maximizing play.
              </span>
            </span>
          </label>
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
