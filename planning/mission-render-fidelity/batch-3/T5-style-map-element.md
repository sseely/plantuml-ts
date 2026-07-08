# T5 — Route element-scoped style-block entries into per-element buckets

## Context
`src/core/style-map-theme.ts` applies element-scoped `.puml` style blocks
(e.g. `database { BackgroundColor X }`) into the theme, but does not route
them into the T3 per-element buckets — they currently land in (or fall
back to) the generic/class color fields, so a style block scoped to
`database` still tints the `class` color — gap #2. See
`../decisions.md#D4`.

## Task
Modify `src/core/style-map-theme.ts` so that when a style-block entry's
selector matches an SName with a T3 bucket (`database`, `component`,
`node`, `actor`, `usecase`, etc.), its `BackgroundColor`/`BorderColor`/
`FontColor` declarations are written into that element's bucket on the
`Theme` object, not the generic/class fields. Run color values through
`parseColor` (from `src/core/paint.ts`, T1) so a gradient value in a style
block becomes a `Gradient` `Paint`, consistent with T4's skinparam path.
Selectors that do not match a known per-element SName keep applying to the
existing generic/class fields as today.

## Write-set
- `src/core/style-map-theme.ts`
- `src/core/style-map-theme.test.ts`

## Read-set
- `src/core/theme.ts` — T3 exports: per-element bucket shape
- `src/core/paint.ts` — T1 export: `parseColor`
- `../decisions.md#D4` (per-element resolution)
- `src/core/style-map-theme.ts` — current `applyStyleMap` implementation

## Architecture decisions
- D4: element-scoped style-block entries write into the matching
  per-element bucket, mirroring the skinparam path in T4 — both entry
  points converge on the same `Theme` bucket shape from T3.

## Interface contracts
Consumes T3's per-element bucket fields and T1's `parseColor`. No new
exports — effect is observable via the `Theme` object this module mutates,
read downstream through `resolveElementPaint`.

## Acceptance criteria
1. Given a style block `database { BackgroundColor X }`, when applied,
   then the `database` bucket's background is set to `X` — NOT the
   `class`/generic background field.
2. Given a gradient color value inside an element-scoped style block, when
   applied, then the bucket holds a `Gradient` `Paint`, not a raw string.

Deps: T3.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` all green.
Coverage 90/90/90 for `src/core/style-map-theme.ts`. Re-run the DOT-parity
probe (`../decisions.md#dot-parity`) — expect no change (color routing
only, no layout impact).

## Commit
One commit for this task: `feat(T5): route element style blocks to Paint buckets`.
Body references decisions.md#D4 (why: database-scoped style blocks were
landing in the class color field instead of their own element bucket).
