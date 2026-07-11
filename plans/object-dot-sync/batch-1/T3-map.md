# T3 — CommandCreateMap + MAP leaf

## Context
Follows T1. 28 corpus fixtures use `map` — the largest single syntax
gap (unsupported anywhere in plantuml-ts today). Upstream:
`objectdiagram/command/CommandCreateMap.java`, registered at
`ClassDiagramFactory.java:117`.

## Task
Port CommandCreateMap into the class command engine: `map "name" as M
{ key => value }` blocks, MAP leaf kind with `key => value` rows, and
the linking forms the Java supports from row values (e.g. `key *-> code`
entries creating links to other entities — read the Java for the exact
forms; do not invent). Extend `classAccepts` with the map keyword
pattern (same name-start guard style as object). TDD.

## Write-set
- src/diagrams/class/ast.ts, class-commands.ts, class-dispatch.ts
  (map accepts pattern), tests

## Read-set
- ~/git/plantuml/.../objectdiagram/command/CommandCreateMap.java (whole)
- batch-1/T1-entity-object.md#interface-contracts

## Interface contracts (consumed by T4)
MAP leaf kind: `{ kind: 'map', code, display, rows: {key, value,
linkedCode?}[] }` — align field names with T1's OBJECT shape; document
the final shape in the journal.

## Acceptance criteria
- Given `map "m" as M { k => v }`, then a MAP leaf with one row exists.
- Given the Java's link-from-row forms, then links land in the AST like
  other class relationships.
- Given `npm test`, then class ratchet still green.

## Observability
N/A.

## Rollback
Reversible.

## Commit
`feat(class-dot): port CommandCreateMap (map leaves + row links)`
