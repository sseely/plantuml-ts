# Phase 4 — State DOT-sync loop

Starts after Phase 3 exits. Corpus: `tests/visual/data/state.json`,
oracle-classified via `--type-tag STATE`. No baseline yet — first iteration
is measurement only (journal it).

Exit bar: EQUAL ≥ 90% AND zero unexplained (ledger.md — create at phase
start). Protocol: [loop-protocol.md](../loop-protocol.md). Ratchet:
`oracle/goldens/state/` + the T3 test shape.

Expected categories (verify against the report before acting):
- Shared graph-attr/minlen mechanisms from Phases 2–3 applied to
  `src/diagrams/state/layout.ts` (port the shared fix).
- Pseudostates (initial/final/history/choice/fork/join) → svek node shapes.
- Composite states → clusters; concurrent regions.
- Transition labels (event/guard/action) → edge labels.

Same watch-out as Phase 3: the state engine is a spike (G-3). Structural
root causes STOP for a boundary decision rather than get patched.
