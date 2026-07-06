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

## Findings from the first port pass (2026-07-05)

Landed: `leaf-sizing.ts` module (split from `layout-helpers.ts`), the per-symbol
margin table, and the multi-line height formula (`lineCount×fontSize + marginV`,
per-line width). Verified against the deterministic oracle:

- **artifact** height matches exactly: 37px = 14 + 23 (V margin). ✓
- **node** single-line height matches: 44px = 14 + 30. ✓
- All 686 description tests pass; ratchet green (sizes are tolerant, structure
  unchanged). No regression.

Unresolved (the remaining S1L depth — each its own sub-step):

1. **Leaf height = marginV + `BodyFactory.create3(display)` text-block height**,
   NOT `lineCount × fontSize`. `EntityImageDescription:186-191` builds `desc`
   via `BodyFactory`, whose text block has its own line spacing/margins. Our
   `lineCount × fontSize` is only coincidentally right for some symbols. Port
   the BodyFactory text-block height to fix the rest.
2. **Per-USymbol block stacking differs.** `USymbolComponent1.asSmall` uses
   `stereo ⊕ desc` (no name); `USymbolNode`/`Folder`/`Artifact` use
   `name ⊕ stereo ⊕ desc` (`dimName.mergeTB(...)`). The margin table is
   necessary but not sufficient — each symbol's `asSmall.calculateDimension`
   must be mirrored.
3. **`component` UML2 anomaly**: default componentStyle = UML2 (component1,
   flat Margin V=20 → 34px), but oracle shows 44px for `component foo`. Root:
   finding #1 (BodyFactory desc height ≠ 14 for one line) — not the margin.
4. **`minClassWidth` / `MinimumWidth` skinparam** sets the box width floor
   (`EntityImageDescription:186` reads `PName.MinimumWidth`). dexigu-24 sets
   `minClassWidth 200` → oracle widths ~3.2in; we use `BOX_MIN_WIDTH`=80. Wire
   the skinparam through to the box floor.
5. **Display-text expansion** (bracket bodies `[...]`, `$var`, Creole `====`
   hr, `<U+000A>`) — the dominant WIDTH blocker on the corpus. Parser/Creole
   layer, above `measureLeafNode`. Tracked as an A1 follow-up.

Aggregate conformant% is still ~1-2% because the issue-derived corpus is
saturated with #4 and #5. The formula is faithful where display is clean and
the symbol's stacking is simple; the next sub-steps (#1, #2, #4) unblock the
rest.

## Verification

- `npx tsx <scratchpad>/size-drill.ts` — plain-text ≤0.01in bucket ≥90%.
- `npx tsx scripts/dot-sync-report.ts component usecase` — structure unchanged
  (sizes changing must not move structural verdicts; they are tolerant today).
- `npx vitest run tests/oracle/description-parity.ratchet.test.ts` — stays green
  (ratchet is structural; re-pin only if a golden's structure changed, which it
  must not).
