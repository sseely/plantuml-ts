# T6 — newpage parsing: ClassAst.pages

## Context
`newpage` currently matches no command and is silently dropped
(`parser.ts#dispatchCommand:462-471` falls through) — multi-page sources
collapse into one AST. Upstream: `CommandNewpage` (registered at
`classdiagram/ClassDiagramFactory.java:105`) creates a fresh diagram and
wraps pages in `NewpagedDiagram` (`descdiagram/command/CommandNewpage.java:
77-88`, `NewpagedDiagram.java:61-162`); subsequent commands append to the
last page. Decision D1.

## Task
Add a `newpage` command to `class-commands.ts` mirroring upstream: on
match, snapshot the current page state and start a fresh one; all
subsequent commands mutate the newest page. `parseClass` returns the
first page's AST with `pages?: ClassAst[]` listing ALL pages (in source
order) when ≥2 exist; absent for single-page sources so every existing
caller and test is untouched.

## Write-set
- `src/diagrams/class/class-commands.ts`, `parser.ts`, `ast.ts`
- `tests/unit/class/**` (new parser tests)

## Read-set
- `~/git/plantuml/.../descdiagram/command/CommandNewpage.java`
- `~/git/plantuml/.../NewpagedDiagram.java:61-162`
- `plans/class-dot-sync/decisions.md#d1`

## Interface contracts (consumed by T7)
`ClassAst.pages?: ClassAst[]` — absent ⇒ single page; present ⇒ length ≥ 2,
each element a complete standalone per-page AST (classifiers,
relationships, namespaces, notes all page-local), source order preserved.

## Acceptance criteria
- Given a source with no `newpage`, when parsed, then `pages` is absent and
  the AST is byte-identical to before.
- Given `class A\nnewpage\nclass B`, when parsed, then `pages.length === 2`,
  page 0 has only A, page 1 has only B.
- Given `tests/corpus/class/sadamo-18-siva346.puml` (10+ newpages), when
  parsed, then page count matches the oracle's `svek-N.dot` file count in
  `test-results/dot-cache/class/sadamo-18-siva346/`.
- All four gates pass; EQUAL unchanged (layout not yet page-aware).

## Observability
N/A.

## Rollback
Reversible.

## Commit
`feat(class): parse newpage into per-page ASTs (CommandNewpage port)`
