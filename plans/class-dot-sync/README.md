# Mission: class DOT-sync (A2)

Bring class-diagram DOT output to structural parity with the PlantUML jar
oracle, reusing the dot-oracle-sync harness. Mission-index row **A2**.

**Baseline (2026-07-10):** 357/680 CLASS fixtures structurally EQUAL (53%).
**Exit bar (updated 2026-07-10, supersedes the original ≥90%/581 bar):**
**100% of the 645 non-oracle-blind fixtures EQUAL, minus validated
divergences** — every non-EQUAL fixture must be a ledgered, maintainer-
validated divergence with a mechanism ([ledger.md](ledger.md)); nothing
non-EQUAL may remain unledgered. Interim measurement:

```sh
npx tsx scripts/dot-sync-report.ts class
```

**Scope correction (supersedes planning/a2-class-dot-sync.md §"core
structural gap"):** upstream does NOT emit class members as HTML `<TABLE>`
DOT labels. Every normal class is `shape=rect,label=""` with pre-measured
width/height (`svek/SvekNode.java#appendShape:132-166`); compartments are
drawn in SVG, never in DOT. The real mechanisms are newpage, the
degenerate-diagram skip, edge semantics, missing entities, and
shielded/qualifier ports — see [decisions.md](decisions.md) verified facts.

## Branch

`feature/class-dot-sync` off `main`. Merge back with a **merge commit, not
squash** (per-task commit IDs are referenced in the journal).

## Structure

Setup batches 0–2 below, then **Phase L**: the open-ended parity loop
governed by [loop-protocol.md](loop-protocol.md) (measure → pick bucket →
diagnose → fix at origin → re-measure → ratchet → commit → ledger).

| Batch | Description | Tasks | Status |
|-------|-------------|-------|--------|
| [batch-0](batch-0/overview.md) | Branch + baseline gates | T0 | [x] |
| [batch-1](batch-1/overview.md) | Splits, deletion, jar unification, ratchet lock | T1–T4, T9 | [x] |
| [batch-2](batch-2/overview.md) | newpage + degenerate skip + shielded ports | T5–T8 | [x] |
| Phase L | Parity loop to ≥581 EQUAL | loop | [ ] |

Seeded loop bucket order (refreshed 2026-07-10 counts): graph-count residue
(after T5/T7), degree 141, minlen 120, shape 117, nodeCount 114,
edgeCount 107, cluster 35, label 25, nodesep/ranksep 7.

## Quality gates (all must pass before any commit)

```sh
npm test              # vitest + coverage 90/90/90 — includes both ratchets
npm run typecheck
npm run lint
npm run build
```

Plus per-batch: `git diff --name-only` stays within the declared write-set;
`npx tsx scripts/dot-sync-report.ts class` EQUAL count never drops.

## Write-set boundary

`src/diagrams/class/**`, `tests/**`, `oracle/goldens/class/**`,
`scripts/dot-sync-report.ts`, `CHANGELOG.md`, this plan directory, and —
**additively only** — `src/core/graph-layout.types.ts` +
`src/core/svek-dot-emit.ts`. Anything else: STOP.

## Stop conditions

1. Files outside the write-set boundary need changes.
2. A shared-file change can't be additive, or the description ratchet
   (`description-parity.ratchet.test.ts`) breaks.
3. Two consecutive gate failures on the same check, or 3 consecutive
   changes to the same location without fixing the same failing check.
4. EQUAL drops and reverting the iteration doesn't restore it.
5. Report verdict and ratchet verdict conflict for the same slug (post-T4).
6. A decision D1–D6 contradicts the Java on close reading — journal + stop.
7. A fix requires diverging from information-carrying upstream behavior —
   ledger as `needs-signoff`, do not silently diverge.

## Push-forward conditions

- Faithful port verified against cited Java (`file:line` in commit body).
- Ratcheting newly-EQUAL slugs; reordering bucket priority as counts shift.
- Splitting a multi-mechanism bucket into separate iterations (journal it).
- Ledgering fixtures blocked on out-of-scope subsystems (stdlib `!include`,
  LaTeX) per [ledger.md](ledger.md) format.
- Updating snapshot tests that changed because DOT converged (same commit).
- Class-internal pure-move file splits when a file nears the 500-line cap.

## Index

- [decisions.md](decisions.md) — D1–D6 (approved 2026-07-10) + verified Java facts
- [loop-protocol.md](loop-protocol.md) — Phase L per-iteration procedure
- [ledger.md](ledger.md) — unfixable/deferred fixtures (append during loop)
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — touched components
- [diagrams/data-flow.md](diagrams/data-flow.md) — parity measurement flow
