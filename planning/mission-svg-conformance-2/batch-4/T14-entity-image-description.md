# T14 — EntityImageDescription assembly

## Context
`svek/image/EntityImageDescription.java` (383 ln) is where an entity
becomes drawing: it resolves the USymbol, builds title/stereotype
TextBlocks, computes the SymbolContext from style, and calls
`symbol.asBig(...)`. With T10 (registry) and T11 (decoration) landed,
this is the last piece before the renderer cutover.

## Task
Port `src/core/svek/image/EntityImageDescription.ts`: symbol resolution
(via USymbols + componentStyle), SymbolContext construction from the
resolved style (colors arrive as `Paint` — our theme/skinparam system
substitutes upstream's style engine at this seam; take values from the
existing `resolveElementPaint`/theme surface the current renderer uses,
journal the mapping), title + stereotype TextBlock construction (text
via klimt UText with the jar measurer available for dimension math),
`asSmall` vs `asBig` selection, URL/link stubs throwing per D3′.

Where the Java reads `ISkinParam`/style objects we don't have, the seam
is: current theme values in, upstream draw behavior out. Journal each
substitution — these seams are where Brief 3+ style work will attach.

## Write-set
- `src/core/svek/image/EntityImageDescription.ts`
- `tests/unit/core/svek/entity-image-description.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/image/EntityImageDescription.java` (all)
- `src/core/decoration/symbol/USymbols.ts` (T10), `SymbolContext.ts` (T3)
- `src/core/svek/DecorateEntityImage.ts` (T11)
- `src/diagrams/description/renderer-helpers.ts` (read-only — the theme
  seam the current renderer uses)

## Interface contracts (consumed by T17)
`EntityImageDescription` built from (node geometry + symbol keyword +
labels + theme paint) drawing a complete decorated entity through a
klimt UGraphic.

## Acceptance criteria
1. Given a component entity with the jar's geometry, when drawn, then
   the full entity subtree (comment + group + symbol + title) is
   conformant vs a cached jar fragment.
2. Given a stereotype, then the guillemet block places per upstream
   math.
3. Given an unsupported feature path (URL/image), then it throws naming
   D3′ (asserted).

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90.

## Commit
`feat(T14): port EntityImageDescription assembly`
