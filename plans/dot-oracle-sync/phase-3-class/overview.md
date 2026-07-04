# Phase 3 — Class (+object) DOT-sync loop

Starts after Phase 2 exits. Object diagrams ride the class engine
(object→class transitive path) — one loop covers both; classify object
fixtures with the CLASS type tag.

Corpus: `tests/visual/data/class.json` (+ object manifest if present),
oracle-classified via T2's `--type-tag CLASS`. Known sample baseline:
8/24 comparable (oracle/GAP.md; old bar, small committed goldens set).
Exit bar: EQUAL ≥ 90% AND zero unexplained (ledger.md — create at phase
start, same format as phase-2).

Protocol: [loop-protocol.md](../loop-protocol.md). Ratchet: extend the T3
test shape with `oracle/goldens/class/` (already exists — the harness test
`class-dot-parity.test.ts` stays; the ratchet test asserts EQUAL only for
pinned-EQUAL slugs).

Seeded categories from oracle/GAP.md (report counts override):

| # | Category | Evidence |
|---|----------|----------|
| 1 | Edge labels differ (association labels, cardinality → label/taillabel/headlabel) | 02-members, 05-assoc-label-card |
| 2 | Packages → clusters (nodes/edges/clusters all under when packages present) | 06-package, cuxebo-14, jojime-80, gufife-94 |
| 3 | Edges under-produced (extends/implements chains, lollipops) | garizu-98 (4→1), gojatu-01 (3→0) |
| 4 | Graph attrs + minlen (same mechanisms as Phase 2 — verify the class layout.ts didn't duplicate the description fixes; if it did, port the shared fix, don't re-derive) | class/layout.ts hardcodes its own defaults |
| 5 | Shape mapping for classifier kinds (class/interface/enum/annotation…) | shapes differ on most misses |

Watch-out: the class engine is an early spike (mission-guide.md G-2 calls it
greenfield-target). If a divergence's root cause is structural (entity model
not cucadiagram-shaped), STOP and surface it — the fix may belong to a
G-2 rebuild mission, not a patch here. Journal the boundary call.
