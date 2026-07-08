# T8 — Class renderer: per-element Paint + plain association edge fix

## Context
`src/diagrams/class/renderer.ts` has two faithfulness gaps found in the
visual-QA analysis: (1) descriptive classifiers embedded in the class engine
(usymbol/usecase kinds) pull the generic class color instead of their own
element-specific color (gap #2); (2) a plain undirected association
(`foo1 -- foo2`) renders with a filled arrowhead marker, when upstream draws
no marker at all for a plain link (gap #5). See `decisions.md#D4` and `#D6`.

## Task
Modify `src/diagrams/class/renderer.ts`:
(a) Descriptive classifiers (usymbol/usecase kinds rendered by the class
engine) resolve their fill/stroke/font via `resolveElementPaint(theme, sname,
role)` (T3) for their own SName, same pattern as T7 — rewrite the existing
color-selection branch rather than patch it.
(b) A plain `--` association (no arrow/diamond/triangle decor on either end)
must render with **no** `markerEnd` and **no** `markerStart` — only links
with an explicit decoration (arrowhead, diamond, triangle, etc.) get a
marker. Consult the existing edge-decor logic in this file and upstream link
semantics (`decisions.md`, `~/git/plantuml` class/link decor source) if it is
ambiguous which decors count as "plain" vs. decorated.

## Write-set
- `src/diagrams/class/renderer.ts`
- its colocated test (`renderer.test.ts`)

## Read-set
- `src/core/usymbol-shapes.ts` (T6 — Paint-aware icon renderers)
- `src/core/theme.ts` (T3 — `resolveElementPaint`)
- `decisions.md#D4`, `#D6`
- The existing edge-decor logic in `src/diagrams/class/renderer.ts` (to
  identify which decor values are "plain" vs. arrow/diamond/triangle)

## Architecture decisions
- D4 — per-element color resolution: resolve element-specific → root default
  via the resolver, not a hard-coded field.
- D6 — plain-association marker fix is in scope for this task (small,
  same-file, no new write-set).

## Interface contracts
Consumes `resolveElementPaint(theme: Theme, sname: string, role: 'fill' |
'stroke' | 'font'): Paint` (T3) and the Paint-aware icon renderers from
`usymbol-shapes.ts` (T6). Does not change either signature.

## Acceptance criteria
1. Given `foo1 -- foo2` (plain association, no decor), when rendered, then
   the edge's SVG element has no `markerEnd` and no `markerStart` attribute.
2. Given `A <|-- B` (inheritance), when rendered, then the triangle marker is
   still present — no regression on decorated links.
3. Given a class-engine `database` element with a database-scoped skinparam
   color, when rendered, then it fills from that element's own bucket, not
   the class-default bucket.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` green;
coverage 90/90/90. DOT-parity probe unchanged (350/221/41) — neither the
color resolution nor the marker fix may move layout or edge routing.

## Commit
`fix(T8): resolve class element paint, drop plain-link marker`
