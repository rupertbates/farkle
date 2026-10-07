import { ScoringChart } from './ScoringChart';

export interface HelpOverlayProps {
  onClose: () => void;
}

/** Full-screen overlay explaining how to play Farkle, opened from the header's "?"
 *  button. Covers the whole viewport (rather than just the board) since it's reference
 *  material the player may want to consult at any point, not tied to board layout. */
export function HelpOverlay({ onClose }: HelpOverlayProps) {
  return (
    <div className="fullscreen-overlay" role="dialog" aria-modal="true" aria-label="How to play Farkle" onClick={onClose}>
      <div className="fullscreen-overlay__card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="fullscreen-overlay__close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h2>❓ How to play Farkle</h2>
        <div className="fullscreen-overlay__body">
          <section>
            <h3>Objective</h3>
            <p>Be the first player to reach the target score. Players take turns rolling six dice and banking points.</p>
          </section>
          <section>
            <h3>On your turn</h3>
            <p>
              Roll all six dice. At least one scoring die or combination must come up, or you&rsquo;ve <strong>Farkled</strong>{' '}
              and lose every point you&rsquo;ve accumulated this turn. Set aside at least one scoring die (or
              combination) from the roll, then choose to either:
            </p>
            <ul>
              <li>
                <strong>🎲 Keep rolling</strong> the remaining dice to try to add more points - riskier, but raises
                your potential score this turn.
              </li>
              <li>
                <strong>🏦 Bank</strong> your turn score and end your turn - safe, locking in what you&rsquo;ve scored
                so far.
              </li>
            </ul>
          </section>
          <section>
            <h3>🔥 Hot dice</h3>
            <p>
              If every one of the six dice has scored (across one or more rolls this turn), you get a fresh set of
              six to roll again - all without banking, so you can keep building your turn score.
            </p>
          </section>
          <section>
            <h3>💥 Farkle</h3>
            <p>
              If a roll comes up with no scoring dice at all, your turn ends immediately and you lose every point
              banked so far <em>this turn</em> (points already locked in from previous turns are safe).
            </p>
          </section>
          <section>
            <h3>Scoring combinations</h3>
            <ScoringChart />
          </section>
        </div>
      </div>
    </div>
  );
}
