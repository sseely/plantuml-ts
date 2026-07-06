# Conformance: what "match" means (plantuml-ts)

Adopted from graphviz-ts (`~/git/graphviz-ts/docs/conformance.md`). "Faithful"
is not a feeling and not byte-identity — it is a **graded, code-enforced
verdict** against PlantUML as the oracle. This doc defines the verdicts; the
`oracle/` harness is the code that assigns them.

The lesson the DOT grind taught (description 7% → 90%) only holds if "match" is
mechanical. A verdict a human eyeballs regresses silently; a verdict the ratchet
computes does not.

## Two gates (from `oracle/README.md` staged doctrine)

Every svek-backed type is checked at two layers; non-svek types (sequence,
activity, bespoke-layout) have only the SVG gate.

| Gate | Compares | Applies to | Instrument |
|------|----------|-----------|------------|
| **DOT** | the DOT we feed graphviz vs PlantUML's svek DOT | svek types (description, class, state, object) | `scripts/dot-sync-report.ts`, `tests/oracle/svek-dot.ts`, the ratchet |
| **SVG** | our final SVG vs PlantUML's SVG | every type | (to build — roadmap E4; graphviz-ts's `compareSvg` is the template) |

The DOT gate fails fast: a structural DOT mismatch guarantees a broken SVG, so
we stop there and never reach the SVG gate for that fixture.

## The verdicts (per gate, per fixture)

Each fixture gets exactly one verdict, mirroring graphviz-ts:

| Verdict | Meaning |
|---------|---------|
| **`conformant`** | Structure matches **and** every numeric value is within tolerance **and** every non-numeric value is exact. The bar. |
| **`structural-match`** | Same structure (element/graph tree), but one or more numeric values exceed tolerance. Right shape, coordinates/sizes drifting. |
| **`diverged`** | The trees differ — a missing/extra node/edge/cluster, or a non-numeric mismatch (shape, topology). A real gap. |
| **`oracle-blind`** | No oracle exists to compare against (e.g. `!pragma layout smetana|elk` — the dump seam taps only the graphviz path). Excluded from the denominator. |
| **`no-candidate`** | We feed the layout nothing (render error / unimplemented subsystem). Ledgered. |
| **`count-mismatch`** | Oracle emits N graphs, we emit M. |
| **`errored` / `timeout`** | The port threw or exceeded budget. |

`conformant` is the bar; `structural-match` is meaningful progress; everything
else is a gap or an exclusion. **Report both `conformant %` and
`structural-match %`** — the way graphviz-ts reports "91.1% conformant / 97.1%
structural." Two numbers, because they answer different questions: *is the shape
right* (structural) vs *is it right to the pixel* (conformant).

## DOT-gate specifics — what "numeric" and "structural" mean here

- **Structural** (the tree): node count, edge topology (degree sequence),
  shape multiset, minlen multiset, label/taillabel/headlabel/xlabel counts,
  cluster-size multiset, and the graph attrs `rankdir`/`nodesep`/`ranksep`.
  This is exactly today's `compareStructural(...).structurallyEqual` in
  `tests/oracle/svek-dot.ts`.
- **Numeric** (within tolerance): node `width`/`height`. Today these are
  *tolerant* (reported as `maxSizeDeltaIn`/`medianSizeDeltaIn`, not asserted) —
  so **today's `structurallyEqual` verdict IS `structural-match`**, not
  `conformant`.
- **S1i unlocks `conformant`.** Once the oracle runs under
  `-DPLANTUML_DETERMINISTIC_TEXT` (its sizes come from the same
  `UnicodeFontWidthSansSerif` table our `WidthTableMeasurer` ports — proven
  per-glyph identical, 6×M = 0.969792 in both sides), node sizes become
  assertable within a tiny decimal-noise tolerance (±0.01 in, matching
  graphviz-ts's deterministic class). `structural-match` + sizes-in-tolerance =
  `conformant`.

## SVG-gate specifics — the ultimate bar (to build, roadmap E4)

The DOT gate is a proxy: it proves the *input* to layout matches. The real
product is SVG. The SVG gate is graphviz-ts's model applied to PlantUML output:
parse both SVGs into a normalized element tree, then numeric-within-tolerance +
non-numeric-exact. It is the **only** gate for non-svek types, and the final
word for svek types once their DOT is conformant. Tolerance classes follow
graphviz-ts (deterministic ±0.01; anything iterative looser + structural).

## Vocabulary reconciliation

- The reports/journal say "EQUAL" / "structurally EQUAL". Read that as the
  **`structural-match`** verdict until S1i lands, then as **`conformant`** once
  sizes are asserted.
- Mission exit bars are stated as "≥90% EQUAL". Restate as: **≥90%
  `structural-match` now, ≥90% `conformant` after S1i** — and always with the
  residual ledgered (every non-`conformant` fixture has a root cause).

## Why this matters

Same reason as graphviz-ts: byte-identity is untestable (float formatting,
IEEE-754, platform libm), and "looks right" is unfalsifiable. A defined verdict
pins the property a viewer actually sees, at a bound small enough to be
sub-perceptual, and makes progress a number the ratchet defends rather than a
claim a human re-checks.
