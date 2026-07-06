# Mission A2 — Class DOT-sync structural port

## Objective

Bring the class diagram's svek DOT into structural parity with the PlantUML
oracle: from **1% structurally EQUAL (9/680) → ≥90%**.

> **Re-scoped 2026-07-06 (see decisions.md + decision-journal).** The original
> premise — "class svek nodes are HTML-table `plaintext` compartment nodes" —
> was **falsified by evidence** during T4: oracle renders ordinary classes as
> `shape=rect,label=""` (compartments are painted in a later SVG pass, not via
> Graphviz), and `structurallyEqual` also gates on `nodesep`. The verified
> parity levers, in impact order, are:
> 1. **Graph-attr parity** (ADR-6): `nodesep=35px` — one constant, **1%→20%** (T4, done).
> 2. **Parser gaps + misrouting** (T1 diagnosis): `Class::member` ports, `(A,B)`
>    association-class misroute to the description engine, `note as` alias,
>    `[Qualifier]` — the edge/node lever (T5).
> 3. **`newpage` multi-graph** (ADR-3): ~158 graph-count mismatches (T6).
> 4. **Narrow plaintext** for the 3 real triggers — qualifier-shield / port /
>    lollipop (revised ADR-1) — folded into T7.

Scope background: `planning/a2-class-dot-sync.md`.

## Branch

`feat/a2-class-dot-sync` (create from `main`; mission-brief branches use
**merge commits**, not squash — preserve per-task commit IDs).

## Startup

1. Read this README.
2. Read `decisions.md` (5 ADRs, all approved).
3. Read `decision-journal.md` (may have entries from earlier in the session).
4. Start at the lowest-numbered batch with unchecked tasks. Read that batch's
   `overview.md`, then each `TN-*.md` (usable directly as the agent prompt).

## Quality gates (run per task; full set between batches)

```
- command: npm run typecheck        # tsc --noEmit (both tsconfigs)   | pass: exit 0 | on_fail: fix_and_rerun
- command: npm run lint             # eslint src tests demo           | pass: exit 0 | on_fail: fix_and_rerun
- command: npm test                 # vitest + 90/90/90 coverage      | pass: exit 0 | on_fail: fix_and_rerun
- command: npx vitest run tests/oracle/class-dot-parity.test.ts       | pass: exit 0 | on_fail: fix_and_rerun
```
Also: 500-line-per-file complexity cap (PostToolUse hook) and one-writer-per-file
per batch. After the **newpage batch (batch-4)**, run the FULL suite as a
cross-type regression guard (it touches shared `block-extractor.ts`).

## Measurement

```
npx tsx scripts/dot-sync-report.ts class     # structural-EQUAL %; the mission metric
```

## Constraints

**STOP** when: a task needs files outside its write-set; 2 consecutive gate
failures on one check; the newpage change breaks another diagram type's tests;
the same shape/edge approach fails a check 3×; the upstream shape condition
(ADR-1) can't be determined unambiguously; an ADR is contradicted.

**PUSH FORWARD** on: upstream-mirroring shape/edge/label rules (the port is the
spec); golden pinning / ratchet updates; stylistic no-ops; simpler-than-estimated
tasks (log why). If 90% isn't reached after T8, **ledger the residual and stop
cleanly** — no speculative number-chasing.

## Batches

| # | Batch | Tasks | Status |
|---|-------|-------|--------|
| 1 | Foundation (diagnose, pin, label builder) | T1, T2, T3 | [x] |
| 2 | Graph-attr parity (nodesep) — re-scoped from shapes | T4 | [x] |
| 3 | Parser gaps + misrouting (T5a/b/c) | T5 | [x] |
| 4 | `newpage` shared-infra (multi-graph) | T6 | [ ] |
| 5 | Qualifier/port/lollipop + narrow plaintext | T7 | [ ] |
| 6 | Re-baseline + measure | T8 | [ ] |

**Progress:** 1% → **20%** (T4 nodesep). Batch 3 (T5a/b/c) banked large
per-check gains (edgeCount 295→211, degree 321→244, shape 227→197) but EQUAL
held at 20% — `structurallyEqual` is a 10-way AND; remaining fixtures fail
multiple dims. Biggest remaining bucket: **graph-count 158 (newpage, T6)**.
Discovered follow-ups (ledger): association-class parse+emit, minlen-per-type,
multiplicity labels, clustering (106), narrow plaintext (T7).

Critical path: **T3 → T4 → T5 → T7** (the `layout.ts` single-writer chain).
**T1, T2, T6** parallelize (disjoint files).

## Index

- `decisions.md` — the 5 ADRs
- `batch-N/overview.md` — batch task tables + write-sets
- `batch-N/TN-*.md` — full task specs (agent prompts)
- `diagrams/component-map.md`, `diagrams/data-flow.md`
- `decision-journal.md` — appended during execution
