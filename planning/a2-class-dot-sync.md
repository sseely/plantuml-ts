# A2 — class DOT-sync (scope + baseline)

Pivoted here after S1L (description) plateaued at 62% conformant. The
leaf-sizing infrastructure (WidthTableMeasurer, deterministic oracle jar,
`scripts/dot-sync-report.ts`, the ratchet) is reused directly.

## Baseline (2026-07-06) — SUPERSEDED, see refresh below

`npx tsx scripts/dot-sync-report.ts class` on 680 CLASS fixtures:
- **structurally EQUAL: 9 (1%)** — this is the STRUCTURAL stage, not sizing.
- graph-count mismatch: 158; nodeCount fails 187; edgeCount 295; degree 321;
  shape 227; label 87; cluster 105.

## Baseline refresh (2026-07-10) — 53% EQUAL, not 1%

Re-run after S1L and svg-conformance Brief 2 merged (same command, 680 CLASS
fixtures, 715 scanned):
- **structurally EQUAL: 357 (53%)** — the shared-path work (S1L measurement/
  label fixes, componentStyle, Brief 2 fixes) lifted class from 9 to 357
  without a class-targeted pass. This 357 matches the Brief 2 final-gate
  "DOT parity 357/234/60" figure.
- no-candidate (we feed nothing): 1
- oracle-blind (`!pragma layout` smetana/elk): 35 — excluded from the target
  denominator per the original scoping.
- **graph-count mismatch: 158 (unchanged)** — now the largest single tranche;
  raises `newpage`/multi-graph priority relative to the HTML-table work.
- diverging-check fails among the rest: degree 141, minlen 120, shape 117,
  nodeCount 114, edgeCount 107, label 25, cluster 35, nodesep 4, ranksep 3.
- count deltas: nodes over 45 / under 69; edges over 20 / under 87; clusters
  over 1 / under 13 — we under-emit more than we over-emit.

Implication for the exit bar: 90% of the 645 non-oracle-blind fixtures = 581,
so A2 needs **+224 EQUAL** from 357. The 2026-07-06 bucket counts elsewhere in
this doc (nodeCount 187, edgeCount 295, degree 321, shape 227) are stale;
whether the HTML-table gap is still the dominant shape/label mechanism needs
re-verification against the refreshed buckets before the first iteration.

Unlike description (which reached 90% EQUAL in an earlier mission before its
sizing grind), **class has never had its structural port** — it diverges on
node/edge/shape counts, not pixel sizes. So A2 is the class analog of the
original description *structural* grind (7% → 90%), a multi-pass effort.

## The core structural gap — class nodes are HTML tables

Class svek nodes are **not plain `shape=rect` boxes**. A class with
attributes/methods renders as `shape=plaintext` with an HTML `<TABLE>` label —
one `<TR>` per compartment (name / attributes / operations), stereotype row,
etc. (upstream `CucaDiagramFileMakerSvek` + the class HTML-table generator).
We currently emit plain rects, so shape/label/size all diverge.

Evidence (`baneru-00-kuro607`, 2 classes + a qualified edge):
- oracle `sh0006` = `shape=plaintext` with a `<TABLE>` label and `PORT="h"`
  (the `class1 [Qualifier]` qualifier forces the HTML-table + port form).
- oracle `sh0007` = `shape=rect` (class2 — empty, no members → simple box).
- ours: both plain `shape=rect`.

## Sub-areas to port (rough, to refine per pass)

1. **HTML-table class node** — compartments (name, attributes, operations),
   stereotype, visibility markers. The dominant shape/label/size fix.
2. **Empty class → `shape=rect`** — a member-less class is a plain box (like
   sh0007). Distinguish member vs member-less.
3. **Qualifier ports** (`class1 [Qualifier] <-- class2`) — plaintext + `PORT`.
4. **`newpage`** — multiple svek graphs per fixture (drives graph-count
   mismatch: 158). `bufogi-69` = `class test / newpage / class test2`.
5. **Association/inheritance/composition edges** — arrowtail/head decorations,
   minlen, labels (edgeCount 295, degree 321 are the biggest counts).
6. **`!pragma layout smetana|elk`** — oracle-blind (35), exclude from denom.

## No cheap win — the graph-count mismatch is not render errors

Sampled 200 class fixtures: graph-count mismatch has **0 thrown, 0
wrong-count, 1 emits-0**. So the 158 mismatches are not render crashes we could
cheaply fix — they're multi-graph (`newpage`) or genuine structural divergence.
The path really is the HTML-table structural port; there is no shortcut.

## Recommended approach

This is large enough to warrant its own mission brief (`/plan-mission`) rather
than ad-hoc loop passes. Suggested first target: **the HTML-table class node**
(sub-area 1+2) — it's the root of shape/label/node-count divergence and unblocks
the rest. Reuse `WidthTableMeasurer` for cell text sizing (the sizing tier is
already solved). Measure with the same `dot-sync-report.ts class` gate; ratchet
EQUAL fixtures as they land.

Exit bar (mission-index A2): class ≥90% conformant + ledger. Interim: ≥90%
structurally EQUAL first (the description arc), then tighten sizes.
