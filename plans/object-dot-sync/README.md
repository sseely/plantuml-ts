# Mission: object DOT-sync (A3)

Bring object-diagram DOT output to structural parity with the PlantUML
jar oracle by **re-mirroring upstream's engine boundary**: upstream has
no separate object engine — `ClassDiagramFactory` registers the object
commands itself (`ClassDiagramFactory.java:81-85,116-117`) and object
diagrams are `DiagramType.CLASS`. Our separate `src/diagrams/object/`
mini-parser is the structural divergence behind most failures; it gets
absorbed into the class engine, then the A2 parity loop closes the gap.

**Baseline (2026-07-11, `--type-tag CLASS object`):** 34/80 comparable
EQUAL (43%), 26 no-candidate, 1 oracle-blind (+3 fixtures with no
canonical SVG — jar crashes). Buckets: degree 18, minlen 18, edgeCount
17, shape 9, label 7, nodeCount 4 (all "under").
Corpus syntax tally (84 manifest fixtures): map 28, multiline
`object {}` 24, `X : field = value` addfields 20, mixed
class/interface/enum 13, stereotypes 7, notes 4, embedded json 4.

**Exit bar (A2 precedent):** 100% of comparable fixtures structurally
EQUAL minus maintainer-validated ledgered divergences; node sizes
asserted from the start; ratchet pins goldens; zero unledgered
non-EQUAL fixtures.

## Branch

`feature/object-dot-sync` off `main`. Merge back with a **merge
commit, not squash** (per-task commit IDs are referenced in the
journal).

## Batches

| Batch | Description | Tasks | Status |
|-------|-------------|-------|--------|
| [batch-0](batch-0/overview.md) | Branch, EXPECTED_TAG fix, baseline | T0 | [x] |
| [batch-1](batch-1/overview.md) | Parser consolidation into class engine | T1→T2→T3 (sequential) | [x] |
| [batch-2](batch-2/overview.md) | Layout/DOT/SVG for object+map, plugin removal | T4→T5 (sequential) | [x] |
| Phase L | Parity loop per [loop-protocol.md](loop-protocol.md) | loop | [ ] |

## Quality gates (all must pass before any commit)

```sh
npm test              # vitest + coverage 90/90/90 — includes class ratchet (687 goldens)
npm run typecheck
npm run lint
npm run build
```

## Write-set boundary

`src/diagrams/class/**`, `src/diagrams/object/**` (deletion),
`src/index.ts` (registry line only), `scripts/dot-sync-report.ts`
(EXPECTED_TAG only), `tests/**` (object/class unit tests, ratchet),
`oracle/goldens/object/**`, `docs/parity-report.md`, `DIVERGENCES.md`
(ledgered divergences only), `planning/mission-index.md` (A3 close),
this plan directory. Anything else: STOP.

## Stop conditions

1. Files outside the write-set boundary need changes.
2. Two consecutive gate failures on the same check.
3. A decision D1–D4 ([decisions.md](decisions.md)) proves wrong in
   practice.
4. **Class-ratchet protection:** making an object fixture EQUAL appears
   to require changing behavior pinned by the class goldens — stop;
   that contradicts A2's closed ledger.
5. Same location changed 3× consecutively without resolving the same
   failing check.
6. The comparable denominator (80) drops without a stated mechanism.

## Push-forward conditions

Bucket attack order and iteration sizing in Phase L; test naming and
ratchet mechanics per A2 conventions; drafting ledger entries
(maintainer validates at close-out); faithful-port details verifiable
against the Java (registration order, regex shapes, member semantics);
jar quirks during canonical regeneration.

## Index

- [decisions.md](decisions.md) — D1–D4 (approved 2026-07-11)
- [loop-protocol.md](loop-protocol.md) — Phase L governance
- [diagrams/component-map.md](diagrams/component-map.md) — engine boundary before/after
- [decision-journal.md](decision-journal.md) — appended during execution

Note: `plans/` is COMMITTED in this repo (established convention).

---

## Mission summary (2026-07-11, close-out)

**Exit bar met:** 80 comparable fixtures → **78 structurally EQUAL (98%)**
+ 2 ledgered ([ledger.md](ledger.md): creole `{{…}}` embedded sub-diagrams,
an unimplemented subsystem outside the write-set). Zero unledgered
non-EQUAL. Baseline was 34/80 (43%).

**Tasks:** all planned tasks complete (T0, T1–T3, T4–T5) plus 7 Phase L
iterations. One commit per task/iteration; journal has one row per
decision.

**What landed:**
- Object absorbed into the class engine per D1/D2 (plugin deleted; upstream
  has no object engine). Commands ported: CommandCreateEntityObject(+
  Multilines), addfield routing (CommandAddMethod semantics —
  CommandAddData is dead code upstream), CommandCreateMap (+bare-map via
  CommandCreateClass TYPE), CommandCreateJson/-SingleLine.
- Sizing ports: EntityImageObject/EntityImageMap/TextBlockMap/
  EntityImageJson — exact-px verified against oracle dumps.
- Phase L fixes: unicode identifier atoms (`%pLN`), `=`-body arrows,
  full ALL_TYPES mixing keyword set (+`state`), stacked stereotypes,
  raw member rows (Bodier never rejects).
- Ratchet: `tests/oracle/object-dot-parity.test.ts`, 78 goldens, node
  sizes asserted (D4) with a 29-entry shrink-only size backlog.

**Known follow-ups (not in exit bar, all journaled):**
- Size backlog survivors' mechanisms: descriptive-USymbol icon sizing,
  bracket-attribute endpoints, endpoint-only entity kind defaults,
  stacked-stereo label splitting, `<style>` blocks.
- Class-engine backlog: CommandCreateClass TYPE alternatives
  (protocol/struct/record/…) unported; separator rows in bodies
  (BodyEnhanced blocks) dropped.
- Ledger entries need maintainer validation (drafts).

**Gates at close:** npm test (5834), typecheck, lint, build — all green;
class 680/680, component 235, usecase 65 unchanged throughout.
