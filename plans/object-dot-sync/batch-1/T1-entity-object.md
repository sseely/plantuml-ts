# T1 — CommandCreateEntityObject into the class engine

## Context
plantuml-ts class engine (`src/diagrams/class/`) mirrors upstream
`ClassDiagramFactory`'s command list (A2). Upstream registers
`CommandCreateEntityObject` at `ClassDiagramFactory.java:116` — object
diagrams ARE class diagrams (decisions.md#d1). The existing separate
parser `src/diagrams/object/parser.ts` holds a faithful port of this
command's semantics — reuse its logic/tests where sound, but the
Java is the spec.

## Task
1. Port `objectdiagram/command/CommandCreateEntityObject.java` into the
   class command engine (`class-commands.ts`), at upstream's
   registration position. AST: new OBJECT leaf kind in `class/ast.ts`
   with `field = value` members (untyped, no visibility).
2. Extend `classAccepts` (`class-dispatch.ts`) with the object keyword
   patterns from `src/diagrams/object/index.ts:28-31` VERBATIM
   (name-start guard + case-insensitivity, with their Java citations).
3. Do NOT delete the object plugin yet (T5). NOTE: registration order in
   `src/index.ts` means objectPlugin still wins pure-object blocks until
   T5 — class-engine object tests must call the class parser directly.
4. TDD: unit tests first (object leaf creation, display-vs-code split
   per nameAndCode, stereotype, `Object <|-- Foo` stays a class
   relationship).

## Write-set
- src/diagrams/class/ast.ts, class-commands.ts, class-dispatch.ts
- tests for the above (co-located per repo convention)

## Read-set
- ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObject.java (whole)
- ~/git/plantuml/.../classdiagram/ClassDiagramFactory.java:100-145 (order)
- src/diagrams/object/parser.ts (existing port), src/diagrams/object/index.ts:20-31 (guard)
- plans/object-dot-sync/decisions.md#d1

## Interface contracts (consumed by T2–T4)
OBJECT leaf kind in ClassDiagramAST: `{ kind: 'object', code, display,
stereotype?, members: {text}[] }` — exact field names may follow the
existing class-leaf shape; document the final shape in the journal.

## Acceptance criteria
- Given `object foo`, when parsed by the class engine, then an OBJECT
  leaf `foo` exists.
- Given `object "Display" as F1 <<stereo>>`, then display/code/
  stereotype are split per nameAndCode.
- Given `Object <|-- Foo`, then it parses as a class relationship
  (guard preserved).
- Given `npm test`, then class ratchet (687 goldens) still green.

## Observability
N/A.

## Rollback
Reversible.

## Commit
`feat(class-dot): port CommandCreateEntityObject (object leaves in class engine)`
