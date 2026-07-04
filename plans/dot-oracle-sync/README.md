# Mission: dot-oracle-sync

## Objective

Make plantuml-ts feed graphviz the **same DOT** PlantUML's Svek feeds graphviz,
across every svek-routed diagram type, measured against the patched oracle jar
(`oracle/README.md` — the staged-gate doctrine: DOT gate first, SVG gate only
after DOT matches). This is the step the previous mission drifted past: the
consolidation shipped, then work moved to SVG visual QA while DOT parity sat at
**7% (component) / 1% (usecase)**. This mission parks visual QA and drives DOT
sync with a ratchet so parity can never regress.

Parity bar (per decisions.md D1): the 7 structural checks in
`tests/oracle/svek-dot.ts` **plus** `rankdir`, `nodesep`, `ranksep` asserted.
Node `width`/`height` stay reported-not-asserted (Java text metrics), tracked
as a shrinking median.

## Branch

`feat/dot-oracle-sync` off `main`, created in Batch 0 **after** merging the
completed `feat/consolidate-description-engine` into main (merge commit — its
brief requires preserving per-task commit IDs). Merge strategy for THIS
mission: merge commit.

## Baseline (measured 2026-07-04, `scripts/dot-sync-report.ts`)

| Corpus | Fixtures (DESCRIPTION per oracle) | EQUAL | no-candidate | graph-count |
|---|---|---|---|---|
| component | 263 | 18 (7%) | 12 | 18 |
| usecase | 90 | 1 (1%) | 15 | 23 |

Top failing checks (component / usecase): degree 188/40, minlen 163/38,
edges 160/34 (almost all UNDER-produced), shapes 124/47, nodes 111/25,
clusters 91/15 (all under), labels 42/18.
Class (oracle/GAP.md sample): 8/24 comparable.

## Phasing

- **Batch 0** — housekeeping: merge, branch, commit stray tooling/docs.
- **Batch 1** — type-generic parity harness: tightened comparator, per-slug
  drill-down, corpus classification for class/state/object, offline ratchet.
- **Phase 2** — description loop (component + usecase corpora) → exit bar.
- **Phase 3** — class loop (object rides the class engine) → exit bar.
- **Phase 4** — state loop → exit bar.
- **Phase 5** — json + dot: scoping probe first (upstream may not route these
  through svek DOT); then loop or documented re-scope.

Phases 2–5 are **diagnosis loops**, not pre-enumerated tasks — see
[loop-protocol.md](loop-protocol.md). Each iteration: report → largest
divergence category → mechanism per `~/.claude/rules/diagnosis.md` against the
Java source → fix at origin → re-run → extend ratchet → one commit.

## Exit bar (per type)

1. EQUAL ≥ **90%** of the type's oracle-classified corpus, AND
2. **Zero unexplained divergence**: every non-EQUAL fixture has a root-cause
   entry in the type's ledger (`phase-N-*/ledger.md`). Fixtures blocked on
   genuinely unimplemented subsystems (stdlib sprites, etc.) are ledgered,
   not fixed here.

## Quality gates (after every commit)

| Command | Pass |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | exit 0 (includes the offline parity ratchet from Batch 1) |
| `npm run build` | exit 0 |
| `npx tsx scripts/dot-sync-report.ts <type>` | EQUAL count ≥ last logged value; log delta in decision-journal.md |

## Constraints

**STOP and wait for human input when:**
- A fix would make our DOT deliberately diverge from the oracle's (claimed
  upstream bug, intended improvement) — needs maintainer sign-off +
  DIVERGENCES.md entry.
- The ratchet or the report EQUAL count regresses and the cause is not an
  intended, documented change.
- The same divergence category is attempted 3× without a stated mechanism
  (cause, file:line, causal chain, ruled-out).
- A task needs files outside its declared write-set (and no other task owns
  them).
- Two consecutive quality-gate failures on the same check.

**PUSH FORWARD with judgment when:**
- The fix is a faithful port verified against the Java source — port it, cite
  the Java file:line in the commit body.
- Adding newly-EQUAL slugs to the ratchet; reordering categories by count.
- A category turns out smaller than expected (log and move on).
- Existing SVG snapshot tests change because DOT converged — update them in
  the same commit as the fix that moved them.

## Batches / phases

| # | What | Tasks | Status |
|---|------|-------|--------|
| [batch-0](batch-0/overview.md) | Merge + branch + housekeeping | T0 | [x] |
| [batch-1](batch-1/overview.md) | Parity harness | T1–T3 | [ ] |
| [phase-2](phase-2-description/overview.md) | Description loop | loop | [ ] |
| [phase-3](phase-3-class/overview.md) | Class (+object) loop | loop | [ ] |
| [phase-4](phase-4-state/overview.md) | State loop | loop | [ ] |
| [phase-5](phase-5-json-dot/overview.md) | json/dot probe + loop | loop | [ ] |

## Index

- [decisions.md](decisions.md) — D1–D7 (approved 2026-07-04)
- [loop-protocol.md](loop-protocol.md) — the per-iteration procedure
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/data-flow.md](diagrams/data-flow.md) — oracle vs ours DOT pipelines
- [diagrams/component-map.md](diagrams/component-map.md) — touched components

## Reference (read-only)

- `oracle/README.md` — staged-gate doctrine, patched jar, capture scripts.
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/` —
  `DotStringFactory.java` (graph attrs, min seps), `SvekEdge.java` (minlen =
  length−1, labels), `SvekNode.java`, `ClusterDotString.java` (clusters),
  `GeneralImageBuilder.java` (entity→svek image/shape mapping).
- `~/git/plantuml/.../descdiagram/`, `classdiagram/`, `statediagram/`,
  `cucadiagram/` — per-type entity/link semantics.
- `tests/oracle/svek-dot.ts` — comparator; `src/core/svek-dot-emit.ts` —
  emitter; `src/core/graph-layout.ts` — the seam + input observer.
- graphviz-ts is consumed as `file:../graphviz-ts` today, npm later — DOT-input
  parity does not depend on it; do not modify graphviz-ts in this mission.
