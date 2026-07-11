# T2 — CommandCreateEntityObjectMultilines + CommandAddData

## Context
Follows T1 (OBJECT leaf exists). 24 corpus fixtures use multiline
`object X { … }` bodies; 20 use post-hoc `X : field = value` lines.
Upstream: `objectdiagram/command/CommandCreateEntityObjectMultilines.java`
and `CommandAddData.java`, both registered by ClassDiagramFactory.

## Task
Port both commands into the class command engine, faithful to the Java
(multiline body member handling, blank/separator lines, AddData's
target resolution and member append). TDD per command.

## Write-set
- src/diagrams/class/ast.ts (if member shape needs extension),
  class-commands.ts, class-member-parser.ts (only if member-line
  parsing hooks live there), tests

## Read-set
- ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObjectMultilines.java (whole)
- ~/git/plantuml/.../objectdiagram/command/CommandAddData.java (whole)
- batch-1/T1-entity-object.md#interface-contracts

## Acceptance criteria
- Given `object user1 { name = "x" }` when parsed, then leaf user1 has
  one member `name = "x"`.
- Given `user1 : age = 30` after the object exists, then the member is
  appended to user1.
- Given upstream's separator/blank-line forms inside bodies, then
  members match the Java's handling.
- Given `npm test`, then class ratchet still green.

## Observability
N/A.

## Rollback
Reversible.

## Commit
`feat(class-dot): port CommandCreateEntityObjectMultilines + CommandAddData`
