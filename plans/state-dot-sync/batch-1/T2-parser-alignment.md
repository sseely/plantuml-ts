# T2 — Parser/AST audit vs StateDiagramFactory + port the gaps

## Context
`src/diagrams/state/parser.ts` (467 lines) predates the depth passes.
Upstream `StateDiagramFactory.initCommandsList` registers ~10 commands
under `statediagram/command/`. Decision D5: extend in place; escalate
to rewrite only if the STRUCTURE diverges from upstream dispatch (log
either way).

## Task
1. Enumerate upstream's command list (read StateDiagramFactory.java
   whole) and audit our parser against it, syntax feature by feature:
   entry/exit border points (`state X <<entryPoint>>` etc. +
   EntityPosition), history `[H]`/`[H*]` (incl. as transition targets),
   fork/join stereotypes, `<<choice>>`, `<<sdlreceive>>`, concurrent
   regions (`--` separators inside a composite), `hide empty
   description`, notes on states, `set separator`, state description
   lines (`X : text`), long-name `state "..." as X`, `state X begin/
   end state` block form (bemena uses it), nested composites, color/
   stereotype on declarations.
2. Port the gaps TDD (tests in tests/unit/state/). AST may need new
   kinds/fields — keep the discriminated-union style of ast.ts;
   document additions for T3/T4.
3. Do NOT touch layout/renderer (batch-2's write-set); parser output
   may be richer than layout consumes for now.

## Write-set
- src/diagrams/state/parser.ts, ast.ts; tests/unit/state/**

## Read-set
- ~/git/plantuml/.../statediagram/StateDiagramFactory.java (whole) + statediagram/command/*.java
- src/diagrams/state/{parser,ast}.ts; planning/state-deepdive.md (watch-outs)
- Complexity hook: 500-line cap (parser.ts at 467!) — split a sibling module if needed (repo precedent everywhere); CCN 10/NLOC 30; string-built regexes for <>{}; tests exempt.

## Interface contracts (consumed by T3/T4)
Document every AST addition (kind names + fields) in your return AND
as JSDoc in ast.ts — T3/T4 read ast.ts as their input spec.

## Acceptance criteria
- Given each StateDiagramFactory command, then either our parser covers
  its grammar (test proves it) or the gap is journaled with a reason.
- Given `npm test`, then all sibling ratchets stay green.

## Observability
N/A. **Rollback:** Reversible.

## Commit
`feat(state-dot): parser/AST alignment with StateDiagramFactory (T2)`
