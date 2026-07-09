# T6 — Component family: Component1, Component2, Node, Artifact, File, Frame

Shared spec: [`symbols-common.md`](symbols-common.md).

## Classes
`USymbolComponent1.java`, `USymbolComponent2.java`, `USymbolNode.java`,
`USymbolArtifact.java`, `USymbolFile.java`, `USymbolFrame.java`.

## Family specifics
- Component1 vs Component2: the two component styles (legacy tabs vs
  UML2 icon) — both reachable via skinparam `componentStyle`; port both.
- `USymbolNode` draws the 3D-box path — preserve the exact UPath.
- `USymbolFrame` draws the name-tab polygon and inner clearance —
  preserve the tab dimension math.
- `USymbolArtifact`/`USymbolFile` draw the dog-ear corner — preserve
  path point order.

## Write-set
- `src/core/decoration/symbol/USymbol{Component1,Component2,Node,Artifact,File,Frame}.ts`
- `tests/unit/core/decoration/symbols-component.test.ts`

## Acceptance criteria
1. Per symbol: standalone render conformant vs jar fragment.
2. Given componentStyle uml1 vs uml2 contexts, then Component1/Component2
   each reproduce their jar shape (two distinct fragments).
3. Given Node, then the 3D-offset path points match the Java constants.
