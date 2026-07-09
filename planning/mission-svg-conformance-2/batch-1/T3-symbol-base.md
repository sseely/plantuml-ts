# T3 — USymbol / SymbolContext / TextBlock base plumbing (D9)

## Context
Every concrete `USymbol*` class (T5–T9) extends `USymbol` and draws
through a `SymbolContext` (stroke, colors, shadow, corner) into a
TextBlock-shaped surface. This task ports the shared base so the family
tasks are pure leaf ports.

## Task
Port to `src/core/decoration/symbol/` (names verbatim, D9):
- `USymbol.ts` — the abstract base: `asSmall(...)`/`asBig(...)`
  signatures, `getSkinParameter`/`getSName` surfaces as far as they are
  read by EntityImageDescription (check T14's source before trimming
  anything — when in doubt, port it).
- `SymbolContext.ts` — find upstream's class (grep `class SymbolContext`
  under `~/git/plantuml`); port stroke/backColor/foreColor/shadowing/
  roundCorner/diagonalCorner surface. Colors carry `Paint`
  (`src/core/paint.ts`) at the Brief 1 seam — same mapping as klimt
  `UParam` (journal the field map once).
- Minimal TextBlock seam: upstream `asSmall/asBig` take and return
  `TextBlock`s (`klimt/shape/TextBlock*.java`). Port the minimal
  interface the symbols and EntityImageDescription actually exercise
  (`drawU(ug)`, `calculateDimension(bounder)`) as upstream-named
  interface(s) — journal exactly what is included; do NOT port the whole
  TextBlock hierarchy.

Tests at `tests/unit/core/decoration/symbol-base.test.ts`.

## Write-set
- `src/core/decoration/symbol/{USymbol,SymbolContext}.ts` + the minimal
  TextBlock seam file(s) (upstream-named)
- `tests/unit/core/decoration/symbol-base.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/{USymbol,USymbolSimpleAbstract}.java`
- Upstream `SymbolContext` + `TextBlock` interface (find both)
- `src/core/klimt/UGraphic.ts`, `src/core/paint.ts`
- `../decisions.md#d9`, `#d10`

## Interface contracts (consumed by T5–T10, T14)
`USymbol` abstract surface + `SymbolContext` (Paint-carrying) + the
TextBlock seam — stable once landed; family tasks may not reshape them.

## Acceptance criteria
1. Given a trivial concrete subclass in-test, when `asBig(...).drawU(ug)`
   runs against a klimt UGraphicSvg, then draw calls flow through with
   SymbolContext stroke/colors applied.
2. Given SymbolContext `withShadow/withStroke`-style copy methods, then
   copies are independent (upstream copy-on-write semantics).

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90; hook-safe.

## Commit
`feat(T3): port USymbol/SymbolContext base + TextBlock seam`
