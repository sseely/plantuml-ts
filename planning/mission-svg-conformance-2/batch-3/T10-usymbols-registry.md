# T10 — USymbols registry

## Context
`USymbols.java` (~150 ln) maps element keywords to symbol instances and
carries the `fromString` resolution EntityImageDescription uses. All 27
concrete classes exist after Batch 2.

## Task
Port `src/core/decoration/symbol/USymbols.ts` verbatim: the static
instances, `fromString(name, …)` semantics (case rules, `actor/` →
business actor, `agent`/`circle` mappings, componentStyle-dependent
component resolution). Journal any keyword the port cannot resolve
identically (should be none).

## Write-set
- `src/core/decoration/symbol/USymbols.ts`
- `tests/unit/core/decoration/usymbols-registry.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/USymbols.java`
- Batch 2 family classes; `src/core/descriptive-keywords.ts` (our
  parser's keyword union — read-only cross-check)

## Interface contracts (consumed by T14, T17)
`USymbols.fromString(name: string, …): USymbol | null` (upstream
signature shape).

## Acceptance criteria
1. Given each of upstream's ALL_TYPES keywords, when resolved, then the
   returned symbol class matches upstream's mapping (table-driven test).
2. Given our parser's USymbol union values, then every one resolves
   (cross-check — a gap here is a finding to journal, not to fix in the
   parser).

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90.

## Commit
`feat(T10): port USymbols registry (keyword → symbol resolution)`
