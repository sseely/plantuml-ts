# Phase 2 — Description DOT-sync loop

Corpus: component (263) + usecase (90) fixtures the oracle classifies as
DESCRIPTION. Baseline (OLD bar): 18+1 EQUAL. Re-measure under the T1 bar at
phase start and journal the true baseline. Exit: EQUAL ≥ 90% per corpus AND
zero unexplained non-EQUAL slugs (see [ledger.md](ledger.md)).

Run per [loop-protocol.md](../loop-protocol.md). Seeded categories, ordered by
verified/expected impact — the report's counts override this order at each
iteration:

| # | Category | Evidence / Java origin |
|---|----------|------------------------|
| 1 | Graph attrs: rankdir TB default, min nodesep 35px / ranksep 60px, skinparam overrides | Ours hardcodes `rankDir:'LR',nodeSep:60,rankSep:80` (`src/diagrams/description/layout.ts:429`); oracle emits no rankdir, 0.486111/0.833333 (from a fixture with skinparam) with floors in `DotStringFactory.getMinNodeSep/getMinRankSep` |
| 2 | minlen semantics: `minlen = link length − 1`; `->` (len1) → minlen 0 (same rank); direction hints (`-up->` etc.) | `SvekEdge.java:421,426`; minlenOk fails 163+38 fixtures |
| 3 | Auto-create link-only endpoints (`(A) ..> (B)`, `[X] --> y`) | Known gap, `.agent-notes/description-autocreate-link-endpoints.md`; nodes UNDER 77+19 |
| 4 | Dropped edges (container endpoints and other loss paths) | babafi-51: `a->b` where b is an empty container → we emit 0 edges; edges UNDER 159+31 |
| 5 | Cluster emission parity (which containers become clusters, nesting, empty-container-as-leaf rule) | clusters UNDER 91+15; `ClusterDotString.java`, `Cluster.java:333` |
| 6 | Shape mapping: USymbol → svek shape (incl. actor/interface `shape=plaintext` HTML-table nodes with ports) | shapeOk fails 124+47; `GeneralImageBuilder`/`SvekNode.java`; see root `svek.dot` sample (actor = plaintext TABLE with PORT="h") |
| 7 | Edge label / taillabel / headlabel presence (qualifiers, stereotype labels) | labelOk fails 42+18 |
| 8 | no-candidate: render errors (stdlib sprite !includes, @enduml-trailing-junk extractor edge) and accepts() misroutes | 12+15 fixtures; classify each: fix cheap ones, ledger subsystem-blocked ones |
| 9 | graph-count mismatch: oracle emits N svek dots, we emit M | 18+23 fixtures; diagnose what triggers multiple dot passes upstream (e.g. ports/lollipops, `together`, packages with independent layouts) |

Notes:
- Categories interact (fixing attrs flips many fixtures' remaining single
  check). Always re-measure after each iteration; do not batch fixes.
- Node-size deltas (babafi-51: `\n====\n` separator mis-measured) are NOT
  gated (D1) but keep the median metric in the journal; a text-measurement
  mission follows later if it dominates visual QA.
- Every semantic fix cites the Java in the commit body.
