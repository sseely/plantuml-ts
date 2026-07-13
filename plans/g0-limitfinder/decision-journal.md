# G0 decision journal

| When | Task | Decision | Why | Flag for review? |
|---|---|---|---|---|
| 2026-07-13 | brief | Brief generated + D1-D7 auto-approved under autonomous execution (maintainer typed "start G0"). Research CORRECTED F4's framing: our `ensureVisible` rounding (trunc+1) is already faithful to upstream's `(int)(x+1)` — the defect is `computeTotalDimensions`' node-box hand-scan (LAYOUT_MARGIN=12) vs upstream SvekResult's LimitFinder ink walk + (6,6) re-anchor + delta(15,15). Also: MinMax has NO delta() — delta lives on XDimension2D; the F4 doc's `getMinMax().delta(15,15)` shorthand conflated them. | mission research, jar/source-verified | maintainer skim of decisions.md |
| 2026-07-13 | brief | Mainframe/BigFrame scoped as an ATTEMPT (D5): LimitFinder unblocks the geometry, but chrome operates on fragment strings LimitFinder cannot walk — branch (a) description-only implementation or (b) re-defer with updated rationale. No SVG-string extent walker this mission. | T9's G0b analysis + G0 research §6 | no |
