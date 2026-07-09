# T5 — Box family: Rectangle, Card, Action, Label, Collections, Stack (+ agent mapping)

Shared spec: [`symbols-common.md`](symbols-common.md). This file adds
only the family specifics.

## Classes
`USymbolRectangle.java`, `USymbolCard.java`, `USymbolAction.java`,
`USymbolLabel.java`, `USymbolCollections.java`, `USymbolStack.java`.

## Family specifics
- `agent` keyword: upstream has no `USymbolAgent` — verify in
  `USymbols.java` which symbol `agent` resolves to (expected: a
  rectangle variant) and journal the mapping. Do NOT invent a class.
- `USymbolCollections`/`USymbolStack` draw offset multi-rect stacks —
  preserve the exact offsets and draw order (back-to-front matters for
  fill overlap).
- `USymbolLabel` draws no border — port its empty-context behavior
  exactly.
- Rounded/diagonal corner variants flow from `SymbolContext` — exercise
  both in tests (URectangle rx/ry from Brief 1 carries them).

## Write-set
- `src/core/decoration/symbol/USymbol{Rectangle,Card,Action,Label,Collections,Stack}.ts`
- `tests/unit/core/decoration/symbols-box.test.ts`

## Acceptance criteria
1. Per symbol: standalone render conformant vs jar fragment
   (symbols-common rule).
2. Given a SymbolContext with roundCorner, then rect rx/ry match
   upstream's halving/pass-through semantics.
3. Given Stack/Collections, then rect draw order and offsets match the
   Java exactly (assert the emitted element sequence).
