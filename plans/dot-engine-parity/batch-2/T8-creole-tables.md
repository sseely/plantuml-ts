# T8 — Creole table syntax

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. Creole markup is used inside node
labels (class members, notes, sequence messages). `src/core/creole.ts`
parses Creole markup into spans. It does not yet support tables.

Architecture decision D5: render tables as pure SVG rect + text,
not foreignObject HTML.

PlantUML Creole table syntax:
```
|= Header 1 |= Header 2 |
| Cell 1    | Cell 2    |
| Cell 3    | Cell 4    |
```
`|=` denotes a header cell (bold). Trailing `|` is optional.
Tables can appear anywhere Creole markup is valid.

## Task

Add table parsing and rendering to `src/core/creole.ts`.

1. Parse `|cell|cell|` rows into a `TableToken` (array of rows,
   each row an array of cells; cells have `header: boolean` flag)
2. Add `TableToken` to the `CreoleToken` union in the AST
3. In the SVG rendering path, lay out tables as:
   - Column widths = max cell content width + 2× cell padding (4px)
   - Row height = lineHeight + 2× cell padding
   - `<rect>` for each cell border
   - `<text>` for cell content (bold if header)
4. `measure()` for a table returns `{ width: totalTableWidth, height: totalTableHeight }`

## Write-set

- `src/core/creole.ts`
- `tests/unit/creole.test.ts`

## Read-set

- `src/core/creole.ts` (full file)
- `tests/unit/creole.test.ts` (existing tests)
- `src/core/svg.ts` (for SVG helper patterns)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/creole/`
  (upstream table implementation for reference)

## Acceptance Criteria

- Given `"|A|B|\n|C|D|"`, when parsed, then produces a 2×2
  `TableToken` with no header cells
- Given `"|= H1 |= H2 |\n| C1 | C2 |"`, when parsed, then row 0
  cells have `header: true`, row 1 cells have `header: false`
- Given a table, when `measure()` called, then
  `width` = widest row width, `height` = rows × rowHeight
- Given a table with a missing trailing pipe (`|A|B`), when parsed,
  then it is accepted (lenient — matches upstream behavior)
- Given a table rendered to SVG, then each cell has a `<rect>`
  border and a `<text>` element; header cells use `font-weight="bold"`

## Quality Bar

`npm test` passes. `npm run typecheck` clean. All existing Creole
tests must still pass.
