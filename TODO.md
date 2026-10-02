# TODO

A running list of ideas and improvements for the Farkle app.

- [ ] **Document the advisor's methodology.** Add a section (in the app, e.g. an
  expandable "How this works" / "Methodology" panel, and/or in the repo docs) that
  explains the probability/EV model behind the advisor for interested users:
  - How "expected value" is calculated, and that it's a probability-weighted average
    across all outcomes (including the chance of Farkling and losing the turn score),
    not a guaranteed result - so it can legitimately be lower than the current turn
    score even though the "success" branch is worth more.
  - The exact-enumeration approach for single-roll stats (`getRollDistributionStats`:
    all 6^n outcomes per dice count) and the recursive, depth-limited multi-roll
    lookahead (`getContinuationValue`/`getStateValue`), including how Hot Dice chains
    are credited.
  - A worked example (e.g. the "700 banked, 2 dice left, continue EV ≈ 491" case:
    44.4% Farkle chance contributes 0, 55.6% chance of scoring contributes the rest,
    blended average lands below the certain 700).
  - Where risk-awareness nudges (`applyRiskAwareness`) fit in and how they differ from
    the pure-EV baseline.
