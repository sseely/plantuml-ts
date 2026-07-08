# T3 — Theme colors -> Paint type, per-element buckets, resolveElementPaint

## Context
`Theme.colors.*` is typed `string` with no per-element-type buckets, so a
`database` element's background falls back to `classBackground` — gap #2
from the mission evidence. See `../decisions.md#D1` (Paint type) and `#D4`
(per-element color resolution: element-specific bucket → root default,
mirroring upstream's SName→Style cascade).

**KEEP the existing `#FEFECE`/`#A80036` default color values in this task.**
The default-skin flip to `#F1F1F1`/`#181818` is D2, isolated to T9
(Batch 5) so this batch and Batch 3 stay green under the current default.
This task only widens the type and adds the bucket/resolver machinery.

## Task
Modify `src/core/theme.ts`:
1. Change the value type of `colors.*` fields from `string` to `Paint`
   (imported from `src/core/paint.ts`). A `string` remains a valid
   assignment per D1 — this is a type widening, not a value change.
2. Add per-element color buckets keyed by upstream `SName` values
   (`database`, `component`, `node`, `actor`, `usecase`, `artifact`,
   `rectangle`, and any other descriptive-element SName already referenced
   elsewhere in the theme/skinparam code), each bucket holding
   `background`/`border`/`font` as `Paint | undefined`.
3. Export `resolveElementPaint(theme: Theme, sname: string, role:
   'background' | 'border' | 'font'): Paint` implementing the D4 cascade:
   element-specific bucket value if set, else the existing root/graph
   default field for that role (do not throw on an unrecognized `sname` —
   fall through to the root default).

Do not change any default color VALUE — only the type (`string` → `Paint`),
the new bucket shape, and the resolver function.

## Write-set
- `src/core/theme.ts`
- `src/core/theme.test.ts`

## Read-set
- `src/core/paint.ts` — T1 exports: `Paint`, `Gradient`
- `../decisions.md#D1` (Paint type), `#D4` (per-element resolution cascade
  + upstream `SName` citation, `skin/ColorParam.java` /
  `decoration/symbol/USymbol*.getSNames()`)
- `src/core/theme.ts` — current `colors.graph.*` shape and default values
  (read before editing; do not alter the values)

## Architecture decisions
- D1: `colors.*: Paint`, with `Paint = string | Gradient`; existing string
  assignments remain valid without caller changes.
- D4: `resolveElementPaint` cascades element-specific bucket → root/graph
  default. This is the resolver every later renderer (T4-T9) calls instead
  of reading a hard-coded field directly.

## Interface contracts
Consumed by T4, T5, T6, T7, T8, T9: `colors.*: Paint` (type change only,
values unchanged this task); the per-element bucket shape (keyed by
`SName`, holding `background`/`border`/`font`); `resolveElementPaint(theme,
sname, role): Paint`. Downstream tasks must use this exact signature — do
not rename parameters or reorder them.

## Acceptance criteria
1. Given `sname='database'` with no per-element override set, when
   `resolveElementPaint(theme, 'database', 'background')` runs, then it
   returns the root/graph default paint — NOT the `class`-specific
   background value — proving the bucket is scoped per-element and not
   aliased to `class`.
2. Given a plain `string` assigned to `theme.colors.border` (or an
   equivalent existing field), then it type-checks as a valid `Paint`
   without a cast.
3. Given an unrecognized `sname` (not in the known bucket set), when
   `resolveElementPaint` runs, then it falls back to the root default
   without throwing.

Deps: T1.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` all green.
Coverage 90/90/90 for `src/core/theme.ts`. Re-run the DOT-parity probe
(`../decisions.md#dot-parity`) — expect no change (type/bucket addition
only, no default value or layout change).

## Commit
One commit for this task: `feat(T3): add per-element Paint buckets to theme`.
Body references decisions.md#D1/#D4 (why: database/component/etc. currently
inherit the class color; this adds the per-SName resolution upstream has).
