# T2 — Pin baseline class goldens + wire the class ratchet

## Context
9 class fixtures (of 680) are already structurally EQUAL under the current
engine (all bare-class shapes). T4 will change the node-shape rule; if the rule
is wrong it could regress these. Pin them as committed goldens **now** so the
ratchet catches any regression. This mirrors the description ratchet
(`tests/oracle/description-parity.ratchet.test.ts`) exactly.

## Task
1. Identify the currently-EQUAL class fixtures (run `scripts/dot-sync-report.ts
   class` or a pin scan analogous to the S1L `pin-equal.ts`).
2. Copy each EQUAL fixture's `in.puml` + `svek-*.dot` into
   `oracle/goldens/class/<slug>/`.
3. Ensure `tests/oracle/class-dot-parity.test.ts` asserts `structurallyEqual`
   offline against the pinned goldens (same shape as the description ratchet):
   parse the golden svek DOT, generate our `DotInputGraph` with
   `WidthTableMeasurer`, `compareStructural(...).structurallyEqual === true`.

## Write-set
- `oracle/goldens/class/**` (create — input.puml + svek-N.dot per EQUAL fixture)
- `tests/oracle/class-dot-parity.test.ts` (modify — pin the goldens; it exists
  but may be a stub)

## Read-set
- `tests/oracle/description-parity.ratchet.test.ts` (the pattern to mirror)
- `tests/oracle/svek-dot.ts` (`parseSvekDot`, `dotInputToStructural`,
  `compareStructural`)
- `scripts/dot-sync-report.ts` (EQUAL detection)
- `src/core/measurer.ts` (`WidthTableMeasurer`)

## Architecture decisions
Deterministic goldens (S1L): measure with `WidthTableMeasurer`; the oracle jar
in `oracle/dist` is the deterministic-patched build (do NOT re-capture with a
different jar). Sizes are tolerant in `compareStructural`; only structure is
asserted.

## Interface contract
Golden layout: `oracle/goldens/class/<slug>/{input.puml, svek-1.dot[, svek-2…]}`.
Consumed by the ratchet test.

## Acceptance criteria
- Given the current engine, when the ratchet runs, then ≥9 class fixtures are
  pinned and assert `structurallyEqual` offline (green).
- Given `npm test`, then it passes (the new ratchet included).

## Observability / Rollback
N/A. Reversible (goldens additive; revert the commit).

## Quality bar
`npm test` green; `npx vitest run tests/oracle/class-dot-parity.test.ts` green.

## Commit
`test(T2): pin baseline class DOT goldens + wire class ratchet`
