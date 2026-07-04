# Phase 5 — json + dot: probe-gated

T2's probe (probe.md, written in Batch 1) decides this phase's shape:

- **If upstream routes the type through svek DOT** (svek-*.dot appears in the
  dump): run the standard loop (ratchet + ledger + 90% bar) against that
  oracle, corpus from `tests/visual/data/<type>.json`.
- **If not** (expected: @startjson uses Smetana directly via SmetanaForJson;
  @startdot feeds the user's DOT to graphviz verbatim):
  - **dot:** the oracle IS the fixture's own DOT body. Parity = the
    DotInputGraph we feed the seam preserves the input graph (nodes, edges,
    attrs we claim to support). Define the comparison in a short design note,
    get maintainer sign-off (STOP condition — it is a new oracle definition),
    then loop.
  - **json (+ transitive yaml/hcl):** journal the finding and STOP for a
    maintainer decision — options are (a) out of scope for this mission,
    (b) define a Smetana-input oracle analogous to svek. Do not invent an
    oracle without sign-off.

Exit bar for any looped type here: same as other phases (≥90% + zero
unexplained).
