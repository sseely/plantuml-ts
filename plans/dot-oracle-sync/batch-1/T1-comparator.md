# T1 — Tighten the structural comparator (parity bar D1)

## Context

plantuml-ts, TypeScript, vitest. `tests/oracle/svek-dot.ts` parses svek DOT
(oracle side and our emitted side via `toSvekDot`) into `StructuralGraph` and
compares. Today `rankdir`/`nodesep`/`ranksep` are parsed but only *reported*
(`attrs` field) — a fixture counts EQUAL even when we emit `rankdir=LR` and
the oracle emits none (verified real case: babafi-51-dixi026).

## Task

1. Add to `StructuralDiff`: `rankdirOk`, `nodesepOk`, `ranksepOk` booleans;
   fold all three into `structurallyEqual`. nodesep/ranksep compare as
   numbers with epsilon 1e-6 (both sides print 6-decimal inches); absent ==
   absent counts equal; absent vs present is a mismatch (rankdir absent means
   TB default — treat absent≠"TB" as textual: absent==absent only, matching
   what svek emits).
2. Add `medianSizeDeltaIn` (median of per-index sorted node-dimension deltas,
   alongside existing `maxSizeDeltaIn`).
3. New focused unit tests `tests/oracle/svek-dot.test.ts`: parse a small
   hand-written svek DOT; each check flips on a single perturbation
   (rankdir present/absent, nodesep off by 0.01, etc.).

## Read-set

- `tests/oracle/svek-dot.ts` (whole file, 257 lines)
- `test-results/dot-cache/component/babafi-51-dixi026/svek-1.dot` (real
  oracle sample)
- `~/git/plantuml/.../svek/DotStringFactory.java:110–135` (attr emission —
  what absent/present means)

## Boundaries

- Do NOT relax any existing check.
- Do NOT change `parseSvekDot`'s public signature; additive fields only
  (consumers: scripts/oracle-gap.ts, scripts/visual-qa-dot.ts,
  scripts/dot-sync-report.ts, tests/oracle/class-dot-parity.test.ts must
  still compile — run typecheck).

## Acceptance criteria

- Given oracle DOT with no rankdir and candidate with `rankdir=LR`, when
  compared, then `rankdirOk=false` and `structurallyEqual=false`.
- Given identical DOT on both sides, then all checks true.
- Given nodesep 0.486111 vs 0.833333, then `nodesepOk=false`.
- Given the existing consumers, when `npm run typecheck` runs, then exit 0.

## Quality bar

All four gates. Coverage thresholds hold (new file is tested).

## Observability: N/A. Rollback: Reversible.
