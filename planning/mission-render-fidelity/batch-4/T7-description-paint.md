# T7 — Description renderer: per-element Paint

## Context
`src/diagrams/description/renderer-helpers.ts` currently reads generic
`theme.colors.graph.*` fields for every descriptive element, so a `database`
element fills with the same color as a `class` — the element's own skinparam
(e.g. `skinparam database BackgroundColor <grad>`) is ignored. This is gap #2
from the visual-QA analysis. See `decisions.md#D4`.

## Task
Modify `src/diagrams/description/renderer-helpers.ts` so each descriptive
element resolves its own fill/stroke/font via
`resolveElementPaint(theme, sname, role)` (built in T3, keyed by upstream
`SName` values — `database`, `component`, `node`, `actor`, `usecase`, …) for
its own SName, and passes the resulting `Paint` (D1: `string | Gradient`) to
the Paint-aware shape functions in `usymbol-shapes.ts` (T6). Rewrite the
color-selection code path to route through the resolver — do not keep the old
hard-coded `theme.colors.graph.*` reads as the primary path; they remain only
as the resolver's root-default fallback layer (per D4).

Per the mission's porting stance (`decisions.md`), the existing color-selection
code here is not faithful to upstream and carries no preservation claim —
rewrite it rather than patch around it.

## Write-set
- `src/diagrams/description/renderer-helpers.ts`
- its colocated test (`renderer-helpers.test.ts`)

## Read-set
- `src/core/usymbol-shapes.ts` (T6 — Paint-aware shape function signatures)
- `src/core/theme.ts` (T3 — `resolveElementPaint`, `Paint`, `Gradient` types)
- `decisions.md#D4` (per-element resolution cascade), `#D1` (Paint type)

## Architecture decisions
- D1 — `Paint = string | Gradient`; pass through, do not stringify.
- D4 — resolve element-specific → root default; call the resolver, never a
  hard-coded field.

## Interface contracts
Consumes `resolveElementPaint(theme: Theme, sname: string, role: 'fill' |
'stroke' | 'font'): Paint` (T3) and the Paint-aware icon renderers exported
from `usymbol-shapes.ts` (T6). Does not change either signature.

## Acceptance criteria
1. Given `skinparam database BackgroundColor <grad>` on a database element,
   when rendered, then the cylinder's fill is `url(#...)` referencing that
   gradient — not the class `BackgroundColor`.
2. Given a descriptive element with no skinparam override, when rendered,
   then it falls back to the element's own root/default color (pre-T9 value;
   T9 changes the default value later, not this task's behavior).
3. Given a component with `skinparam component BorderColor X`, when rendered,
   then the component's border uses `X`, not the diagram-wide border color.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` green;
coverage 90/90/90. DOT-parity probe unchanged (350/221/41) — this is a color
change and must not move layout.

## Commit
`fix(T7): resolve descriptive element paint per-SName`
