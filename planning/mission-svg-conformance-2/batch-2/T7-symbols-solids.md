# T7 — Container-solids: Database, Queue, Storage, Hexagon, Process

Shared spec: [`symbols-common.md`](symbols-common.md).

## Classes
`USymbolDatabase.java`, `USymbolQueue.java`, `USymbolStorage.java`,
`USymbolHexagon.java`, `USymbolProcess.java`.

## Family specifics
- Database cylinder: Brief 1's T6 already proved a jar database-cylinder
  fragment conformant through raw UPath draws
  (`oracle/goldens/svg-conformance/database-cylinder-dashed/`) — reuse
  that fragment as one of this task's references; the symbol port must
  reproduce the same cubics from its own coordinate math.
- Queue: horizontal cylinder — distinct path, don't derive from Database.
- Storage: rounded-everything rect variant; Hexagon: 6-point polygon
  math; Process: rect with side-strips.
- Title placement inside curved tops (Database/Queue) has asymmetric
  clearance constants — preserve them.

## Write-set
- `src/core/decoration/symbol/USymbol{Database,Queue,Storage,Hexagon,Process}.ts`
- `tests/unit/core/decoration/symbols-solids.test.ts`

## Acceptance criteria
1. Per symbol: standalone render conformant vs jar fragment.
2. Given the Brief 1 database fragment's dimensions, then the ported
   USymbolDatabase reproduces those exact cubics.
