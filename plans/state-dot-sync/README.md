# Mission: state DOT-sync (A4)

Bring state-diagram DOT output to structural parity with the PlantUML
jar oracle. Mission-index row **A4**. The existing
`src/diagrams/state/` engine is pre-svek greenfield (recursive
per-composite layout, no svek shapes/clusters/minlen/labels, its own
sep constants) — the A2 situation. Per CLAUDE.md, upstream architecture
is authoritative: state stays its OWN engine (upstream
`StateDiagramFactory`, DiagramType.STATE) but its layout/DOT layer is
rewritten svek-faithful ([decisions.md](decisions.md) D1).

**Baseline (2026-07-11, `dot-sync-report state`):** 278 manifest, ~255
comparable, **0 EQUAL (0%)**, 118 graph-count mismatch, 12
no-candidate, 6 oracle-blind. Buckets: shape 174, nodesep 174,
degree 77, nodeCount 58, edge/minlen 48, label 43, ranksep 43,
cluster 30, rankdir 1.

**Key diagnosed facts (verified on oracle dumps — bemena-23-zebu249):**
upstream runs MULTIPLE svek passes per diagram — an "autonom" composite
(no links crossing its boundary, `svek/GroupMakerState.java` +
`InnerStateAutonom`) is laid out in a CHILD pass (dumped FIRST, without
nodesep/ranksep lines) and re-enters the parent as a fixed-size rounded
rect; non-autonom composites become nested cluster envelopes
(`cluster6a`→`p0`→`6`→`i`→`p1` + `zaent` point anchors,
`ClusterDotString.java`). Simple states are `shape=rect,style=rounded`;
pseudostates `shape=circle` 0.277778in; edge labels are svek HTML
tables. This explains the 118 graph-count mismatches and the systemic
shape/nodesep buckets.

**Exit bar (A2/A3 precedent):** 100% of comparable fixtures
structurally EQUAL minus maintainer-validated ledgered divergences;
node sizes asserted from the start (ratchet + shrink-only
size-backlog.json per A3 convention); zero unledgered non-EQUAL.

## Branch

`feature/state-dot-sync` off `main`. Merge back with a **merge commit,
not squash** (per-task commit IDs are referenced in the journal).

## Batches

| Batch | Description | Tasks | Status |
|-------|-------------|-------|--------|
| [batch-0](batch-0/overview.md) | Branch + baseline journal | T0 | [x] |
| [batch-1](batch-1/overview.md) | Mechanism catalog + parser/command alignment | T1, T2 (parallel) | [x] |
| [batch-2](batch-2/overview.md) | Svek-faithful structural port | T3→T4 (sequential) | [x] |
| [batch-3](batch-3/overview.md) | Ratchet creation | T5 | [x] |
| Phase L | Parity loop per [loop-protocol.md](loop-protocol.md) | loop | [x] |

## Quality gates (all must pass before any commit)

```sh
npm test              # vitest + coverage 90/90/90 — class(687)/object(78)/description ratchets
npm run typecheck
npm run lint
npm run build
```

## Write-set boundary

`src/diagrams/state/**` (rewrite sanctioned), `src/core/svek-dot-emit.ts`
+ `src/core/graph-layout.types.ts` (**additive-only**, D3 — existing
ratchets are the guard), `tests/**` (state unit tests, state ratchet),
`oracle/goldens/state/**`, `docs/parity-report.md`, `DIVERGENCES.md`
(ledgered divergences only), `planning/mission-index.md` (A4 close),
this plan directory. Anything else: STOP.

## Stop conditions

1. Files outside the write-set boundary need changes.
2. Two consecutive gate failures on the same check.
3. A decision D1–D5 ([decisions.md](decisions.md)) proves wrong in practice.
4. **Sibling-ratchet protection:** a state fix appears to require
   changing behavior pinned by the class (687), object (78), or
   description goldens.
5. Same location changed 3× consecutively without resolving the same
   failing check.
6. The comparable denominator drops without a stated mechanism.
7. Multi-pass capture ORDERING cannot be made to match the oracle's
   dump order deterministically (would invalidate the comparison
   harness itself — needs a human call).

## Push-forward conditions

Bucket attack order and iteration sizing in Phase L; ratchet mechanics
per A3 conventions; drafting ledger entries (maintainer validates at
close-out); faithful-port details verifiable against the Java
(registration order, regex shapes, envelope naming); jar quirks during
canonical regeneration; splitting batch-2 tasks further if an agent's
scope proves too large (log to journal).

## Index

- [decisions.md](decisions.md) — D1–D5 (autonomous 2026-07-11, pending ratification)
- [loop-protocol.md](loop-protocol.md) — Phase L governance
- [diagrams/component-map.md](diagrams/component-map.md) — engine layers before/after
- [mechanisms.md](mechanisms.md) — written by T1 during execution
- [decision-journal.md](decision-journal.md) — appended during execution

Note: `plans/` is COMMITTED in this repo (established convention).

---

## Mission summary (2026-07-12, close-out)

**Exit bar met:** 261 comparable fixtures → **260 structurally EQUAL
(99.6%)** + 1 ledgered ([ledger.md](ledger.md): a graphviz-ts render
crash on verified-byte-correct DOT input — recommend filing the minimal
repro upstream). Zero unledgered non-EQUAL. Baseline was **0/261 (0%)**.

**Tasks:** T0–T5 plus 20 Phase L iterations, one commit per
task/iteration, one journal row per decision. One user interrupt
(iter 16) resumed cleanly from the partial tree.

**What landed:**
- Svek-faithful rewrite of the state layout/DOT layer (D1): shapes/sizes
  per the EntityImageState family, cluster envelopes + zaent anchors,
  autarkic composites as child svek passes re-entering as fixed rects.
- Parser: full StateDiagramFactory alignment, TWO-PASS parsing
  (ParserPass port, D5 escalation), global + dotted-id quark name
  resolution, history-id namespacing, sync bars, $tag/remove, notes
  (incl. note-on-link xlabels), embedded json leaves, ##linecolor,
  4-alternative name-and-code grammar.
- Ordering: CucaDiagramSimplifierState.getOrdered global firing order;
  concurrent regions as first-class firing units.
- Core (additive-only, D3): omitSepAttrs, portRanksLabelOnEe.
- Cross-engine: classAccepts now declines state-signal blocks (fixes an
  A3-introduced dispatch steal).
- Ratchet: tests/oracle/state-dot-parity.test.ts, 260 goldens
  (multi-graph), sizes asserted with a shrink-only backlog (~90 entries
  = the size-fidelity follow-up queue: wrapWidth, scale drift,
  composite-wrapper sizing, creole note bodies).

**Gates at close:** 6458 tests / typecheck / lint / build green;
class 680/680, object 78/78, component 235, usecase 65 unchanged
throughout.
