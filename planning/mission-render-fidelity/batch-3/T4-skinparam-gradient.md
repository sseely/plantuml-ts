# T4 — Parse gradient skinparam values -> Paint; map per-element keys -> buckets

## Context
`src/core/skinparam.ts` does not parse the `color1\color2` gradient form
(it passes the raw string straight through, producing invalid SVG
downstream — gap #1) and does not populate the T3 per-element buckets, so
`skinparam database BackgroundColor ...` never reaches a `database`-scoped
color (gap #2). See `../decisions.md#D1`/`#D4` and the "Gradient model"
citation (`klimt/color/HColorSet.java:109-116`, `HColorGradient.java`).

## Task
Modify `src/core/skinparam.ts` to:
1. Run every color-valued skinparam value through `parseColor` (from
   `src/core/paint.ts`, T1) before storing it, so a `color1\color2` value
   becomes a `Gradient` `Paint` rather than a raw string.
2. Recognize element-scoped skinparam keys — `database`, `component`,
   `node`, `actor`, `usecase`, and the other SNames T3 added buckets for —
   combined with `BackgroundColor`/`BorderColor`/`FontColor`, and write the
   parsed `Paint` into the matching T3 per-element bucket (via the `Theme`
   object's bucket fields, not a side table) rather than into the flat
   root/graph default fields.
3. A non-element-scoped (plain `class`/root) skinparam color keeps writing
   to the existing root/graph default fields as today.

Per the Porting stance, if the current color-storage code in
`skinparam.ts` has no clean seam for a `Paint`-typed value, rewrite that
portion from scratch to match the parse-then-bucket flow described above
rather than layering a special case onto the string-only path.

## Write-set
- `src/core/skinparam.ts`
- `src/core/skinparam.test.ts`

## Read-set
- `src/core/paint.ts` — T1 export: `parseColor(s: string): Paint`
- `src/core/theme.ts` — T3 exports: per-element bucket shape,
  `resolveElementPaint`
- `../decisions.md#D1` (Paint type), `#D4` (per-element resolution)
- `src/core/skinparam.ts` — current gradient-related note (~line 44) and
  the existing color-assignment code path

## Architecture decisions
- D1: skinparam color values become `Paint` (string or `Gradient`) via
  `parseColor`, not raw strings.
- D4: element-scoped skinparam keys write into the matching per-element
  bucket, not the flat root default — cascade element-specific → root is
  T3's `resolveElementPaint`'s job at read time, not this task's.

## Interface contracts
Consumes T1's `parseColor` and T3's bucket fields / `resolveElementPaint`.
Produces no new exports — the effect is observable via the `Theme` object
`skinparam.ts` populates, which downstream renderers read through
`resolveElementPaint`.

## Acceptance criteria
1. Given `skinparam database BackgroundColor #FFd8f4\#FF92d1`, when parsed,
   then the `database` bucket's `background` is a `Gradient` with
   `policy: '\\'` (and `color1`/`color2` matching the two halves).
2. Given `skinparam class BackgroundColor #FEFECE`, when parsed, then the
   value lands in the `class`/root default field — NOT the `database`
   bucket — proving scoping is per-keyword, not global.
3. Given a solid (non-gradient) color skinparam value, when parsed, then
   the stored value is a plain `string` Paint (no spurious `Gradient`
   wrapping).

Deps: T1, T3.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` all green.
Coverage 90/90/90 for `src/core/skinparam.ts`. Re-run the DOT-parity probe
(`../decisions.md#dot-parity`) — expect no change (color parsing only).

## Commit
One commit for this task: `feat(T4): parse gradient skinparam into Paint buckets`.
Body references decisions.md#D1/#D4 (why: gradient skinparam values were
passed through as literal strings, breaking SVG; element-scoped keys were
not reaching per-element resolution).
