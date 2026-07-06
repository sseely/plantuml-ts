# S1L — description leaf-box sizing port (spec)

Goal: make `measureLeafNode` (`src/diagrams/description/layout-helpers.ts`)
reproduce PlantUML's box dimensions so DOT node `width`/`height` become
**assertable** (`conformant`, ≤0.01in) instead of tolerant. Unblocks A2–A4.

Diagnosed 2026-07-05 (see mission-index S1L). Under deterministic measurement
(S1i done), only 4/262 EQUAL description fixtures land within ±0.01in. The gap
is layout, not measurement.

## The faithful formula (from upstream)

`EntityImageDescription.calculateDimensionSlow` = `asSmall.calculateDimension`.
Each USymbol's `asSmall.calculateDimension` is:

```
margin.addDimension( dimStereo.mergeTB(dimName/dimLabel) )
```

`Margin(x1, x2, y1, y2)` adds `x1+x2` to width and `y1+y2` to height.
`mergeTB` stacks stereotype above label (heights add, width = max).

Reconciled against the oracle (deterministic bounder):
- **text-block height = lineCount × fontSize** exactly — no inter-line leading.
  (node single line 44px = 14 + 30 margin; two lines 58px = 28 + 30. Exact.)
- **text-block width = max line width** (measured per line, not whole string).
- So per leaf box:
  - `height = lineCount × fontSize + (y1 + y2)  [+ stereo height if present]`
  - `width  = maxLineWidth + (x1 + x2)          [max with stereo width]`

Current code (`layout-helpers.ts:171-175`) uses `size*1.4+16` for height (no
line term, wrong constant) and measures the *whole* display string for width
(no per-line split) → both wrong for multi-line, and symbol-agnostic.

## USymbol margin table (x1, x2, y1, y2) → (H=x1+x2, V=y1+y2)

Sourced verbatim from `decoration/symbol/USymbol*.java` `getMargin()`:

| our `symbol` | upstream class | Margin(x1,x2,y1,y2) | H | V |
|---|---|---|---|---|
| component | USymbolComponent1 (uml2/default) | 10,10,10,10 | 20 | 20 |
| rectangle | USymbolRectangle | 10,10,10,10 | 20 | 20 |
| node | USymbolNode | 15,25,20,10 | 40 | 30 |
| frame | USymbolFrame | 15,25,20,10 | 40 | 30 |
| folder | USymbolFolder | 10,20,13,10 | 30 | 23 |
| package | USymbolFolder | 10,20,13,10 | 30 | 23 |
| artifact | USymbolArtifact | 10,20,13,10 | 30 | 23 |
| card | USymbolCard | 10,10,3,3 | 20 | 6 |
| cloud | USymbolCloud (non-uml2) | 10,10,10,10 | 20 | 20 |
| database | USymbolDatabase | 10,10,24,5 | 20 | 29 |
| storage | USymbolStorage | 10,10,10,10 | 20 | 20 |
| file | USymbolFile | 10,10,10,10 | 20 | 20 |
| person | USymbolPerson | 10,10,10,10 | 20 | 20 |
| hexagon | USymbolHexagon | 10,10,10,10 | 20 | 20 |
| label | USymbolLabel | 10,10,10,10 | 20 | 20 |
| collections | USymbolCollections | 10,10,10,10 | 20 | 20 |
| queue | USymbolQueue | 5,15,5,5 | 20 | 10 |
| stack | USymbolStack | 25,25,10,10 | 50 | 20 |
| action | USymbolAction | 10,20,10,10 | 30 | 20 |
| process | USymbolProcess | 20,20,10,10 | 40 | 20 |
| agent | (rectangle-like) | 10,10,10,10 | 20 | 20 |

Default for any symbol not listed: (10,10,10,10) → H=20, V=20.

Note: `component` default is uml2 (component1). Classic `componentStyle` uses
USymbolComponent2 (15,25,20,10 → H=40,V=30). Gate on the resolved
`componentStyle` skinparam if fixtures exercise it — verify against oracle.

## Special (non-box) shapes — own sizing, NOT this table

- `interface` — small circle (lollipop) or rect; check `EntityImageDescription`
  shapeType OVAL / `USymbolInterface`.
- `boundary` / `control` / `entity` — abel/`EntityImage*` small shapes
  (boundary =|O, control ⟳, entity ⎯). Their own `calculateDimension`.
- `circle` — fixed circle.
- `usecase` / `actor` / `port` / `note` — already handled (keep).

## Two width sub-bugs (from the diagnosis)

1. **Multi-line measured as one string** — the common corpus case. Fixed by the
   per-line split above.
2. **Variable/markup `display` measures empty** (e.g. `$var` with `<U+000A>`,
   `<code>`, `<u:>` — gafico-37) → width falls to `BOX_MIN_WIDTH`. This is a
   *parser/Creole* gap (display never expands the markup into text lines), a
   layer above `measureLeafNode`. Track separately; do NOT try to patch it
   inside the sizing function.

## Implementation steps

1. Port the margin table as `SYMBOL_MARGIN: Record<USymbol, [H, V]>` (or a
   `Margin` struct) in `layout-helpers.ts`, sourced from the table above.
2. Rewrite the box branch of `measureLeafNode`: split `display` on `\n`,
   measure each line, `width = maxLine + H`, `height = lines×size + V`,
   with stereotype `mergeTB` stacking when a stereotype block exists.
3. Keep `BOX_MIN_WIDTH` as the floor (`Math.max`), matching upstream
   `MinimumWidth` style default.
4. Handle the special shapes (interface/boundary/control/entity/circle) with
   their own upstream sizing.
5. Re-run `scratchpad/size-drill.ts` → target ≥90% plain fixtures ≤0.01in.
6. Once sizes match: flip `width`/`height` tolerant→asserted in
   `compareStructural` (`tests/oracle/svek-dot.ts`), re-run the report + ratchet.
7. Ledger any fixture still failing on sub-bug #2 (parser/Creole) as A1 follow-up.

## Verification

- `npx tsx <scratchpad>/size-drill.ts` — plain-text ≤0.01in bucket ≥90%.
- `npx tsx scripts/dot-sync-report.ts component usecase` — structure unchanged
  (sizes changing must not move structural verdicts; they are tolerant today).
- `npx vitest run tests/oracle/description-parity.ratchet.test.ts` — stays green
  (ratchet is structural; re-pin only if a golden's structure changed, which it
  must not).
