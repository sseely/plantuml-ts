# Evidence — Class DOT Parity (verified 2026-07-06)

All numbers below are instrumented, not assumed. They supersede the premises of
`planning/mission-a2-class/` (which was ~4/4 wrong; see that brief's
decision-journal for the falsification trail). Reproduce with
`npx tsx scripts/dot-sync-report.ts class` plus the scratch probes described here.

## The equality gate
`compareStructural` (`tests/oracle/svek-dot.ts:255-314`) sets
`structurallyEqual` = a **10-way AND** of: nodeCountOk, edgeCountOk, degreeOk,
minlenOk, shapeOk, labelOk, clusterOk, rankdirOk, nodesepOk, ranksepOk. A fixture
is EQUAL only if ALL ten pass. This is why large per-check improvements barely
move the EQUAL % — most non-EQUAL fixtures fail several checks at once.

## Current standing
- **137 / 680 structurally EQUAL (20%)**, up from 9 (1%) at mission start.
- The entire 1%→20% jump came from ONE constant: class layout `nodeSep` 40→35
  (oracle emits `nodesep=0.486111in`=35px in 511/515 fixtures). `ranksep=60`
  already matched. This lever was absent from the original brief.

## Oracle DOT-count distribution (why "graph-count mismatch" is NOT newpage)
715 class cache fixtures: **200 have 0 oracle svek DOTs, 515 have 1, ZERO have
2+.** There are no multi-page (`newpage`) diagrams in the class corpus, so the
original ADR-3 (newpage → 158 graph-count) is void. The ~158–192 "graph-count
mismatch" bucket is oracle-emits-0-DOT vs we-emit-1, and it is **heterogeneous**
(cross-tab via `parseClass`):

| oracle DOTs | structure (our parser) | count | interpretation |
|---|---|---|---|
| 0 | 1 class, 0 rels | 165 | mix of genuine graphviz-skips AND oracle-side gaps |
| 0 | 2+ classes, 0 rels | 10 | ditto |
| 0 | has relationships | 25 | likely oracle render failures (not skips) |
| 1 | 1 class, 0 rels | **78** | same signature as the 165 → NO clean skip predicate |
| 1 | 2+ classes, 0 rels | 165 | oracle DID run graphviz |
| 1 | has relationships | 272 | normal |

Key: the same structural signature (`cls1/rel0`) appears in BOTH oracle-0 (165)
and oracle-1 (78). There is **no simple structural predicate** for oracle's
graphviz-skip. Much of the 0-DOT bucket is oracle-side and unfixable by us
(`!include <tupadr3/…>`, `!pragma layout smetana`, `<style>` blocks that oracle
also can't render normally). Treat this bucket as mostly a harness-classification
concern, not a feature gap.

## Distance-to-EQUAL (the re-plan backbone)
Of the 511 comparable fixtures (both sides emit an equal, non-zero graph count),
**382 are non-EQUAL**. Histogram by how many of the 10 checks each fails:

| fails N checks | fixtures |
|---|---|
| **1** | **89** ← one fix from EQUAL |
| 2 | 42 |
| 3 | 81 |
| 4 | 44 |
| 5 | 81 |
| 6 | 42 |
| 7 | 3 |

Among the **89 that fail exactly one check**, which single check (the cheapest
wins — fixing that check flips the fixture straight to EQUAL):

| single failing check | flips to EQUAL if fixed | total fails (all fixtures) |
|---|---|---|
| **clusterOk** (packages/namespaces) | **34** | 106 |
| **labelOk** (edge label counts) | **21** | 89 |
| **shapeOk** (narrow plaintext triggers) | **19** | 197 |
| **minlenOk** (per-relationship-type) | **15** | 262 |

## Realistic ceiling
Fixing cluster + label + shape + minlen flips up to the 89 single-fail fixtures
and chips into the 42 two-fail fixtures → **20% → ~33–40%**. 90% is not
reachable: the remaining 250 fixtures fail 3–7 checks each (deep, multi-lever),
and a large slice of the "mismatch" bucket is oracle-side and unfixable. Per the
original brief's own clause, ledger the residual rather than chase the number.
