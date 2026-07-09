# T8 — Path-heavy: Cloud, Folder

Shared spec: [`symbols-common.md`](symbols-common.md).

## Classes
`USymbolCloud.java`, `USymbolFolder.java`.

## Family specifics
- Cloud is the largest single symbol (bumpy perimeter generated from
  segment math, not a fixed path) — port the generation loop faithfully;
  expect the 500-line/CCN hook to bite → split per D2′, journal the
  boundary. Verify against a jar cloud fragment at two different sizes
  (the bump count varies with size — that behavior must match).
- Folder draws the name-tab; two variants (folder for entities vs
  packages) — check how upstream parameterizes it (constructor flag) and
  port both.

## Write-set
- `src/core/decoration/symbol/USymbol{Cloud,Folder}.ts` (+ split file if
  the hook forces, journaled)
- `tests/unit/core/decoration/symbols-paths.test.ts`

## Acceptance criteria
1. Per symbol: standalone render conformant vs jar fragment.
2. Given two cloud sizes, then bump segmentation matches the jar at both.
3. Given folder-with-tab, then tab dimensions match the Java constants.
