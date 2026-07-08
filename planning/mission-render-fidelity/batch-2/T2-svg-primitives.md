# T2 — svg.ts primitives accept Paint + emit gradient defs

## Context
`src/core/svg.ts`'s shape helpers (`rect`, `ellipse`, `path`, `polygon`, and
any other filled-shape helper) accept only `string` fill/stroke values, so a
gradient `Paint` from T1 has nowhere to go — this is gap #1 from the mission
evidence: a gradient skinparam value currently serializes as a literal
`fill="#c3d8f4\#6192d1"`, which is invalid SVG and renders solid black. See
`../decisions.md#D1` (the `Paint` type every primitive must accept) and
`#D3` (inline `<def>` placement, content-hash dedup).

## Task
Modify `src/core/svg.ts` so every filled/stroked shape helper (`rect`,
`ellipse`, `path`, `polygon`, and any sibling helper with a fill/stroke
parameter) accepts `string | Paint` for those parameters. Call
`paintToSvg` (from `src/core/paint.ts`, built in T1) to resolve the value:
- If `paintToSvg` returns no `def`, emit the attribute exactly as today
  (`fill="<string>"`) — a string fill must produce byte-identical output to
  the current implementation.
- If `paintToSvg` returns a `def`, emit the `<linearGradient>` element
  immediately before the shape's own element in the output string, then set
  `fill="url(#id)"` on the shape, per D3. Two shapes sharing an identical
  `Gradient` (same `color1`/`color2`/`policy`, hence the same content-hash
  id from T1) must not emit the def twice — dedup within a single render
  call.

Per the mission's Porting stance (`../decisions.md`), the existing shape
helpers are an unfaithful approximation with no preservation claim — rewrite
their internals as needed to thread `Paint` through cleanly rather than
patching string-only code with special cases.

## Write-set
- `src/core/svg.ts`
- `src/core/svg.test.ts` (create if it does not already exist; otherwise
  extend it)

## Read-set
- `src/core/paint.ts` — T1 exports: `Paint`, `Gradient`, `paintToSvg`
- `../decisions.md#D1` (Paint type), `#D3` (defs placement + dedup)
- `src/core/svg.ts:1-60,290-310` — existing attribute-string and `<defs>`/
  `svgDefs` conventions to match

## Architecture decisions
- D1: `Paint = string | Gradient`; every filled/stroked primitive accepts
  `string | Paint`. A bare string is always a valid solid paint and must
  round-trip unchanged.
- D3: gradient `<def>`s are emitted inline immediately before the
  referencing shape, deduped by the deterministic content-hash id `paint.ts`
  already produces — do not introduce a separate id scheme or hoist defs
  into a shared top-level `<defs>` block.

## Interface contracts
Consumes from T1: `paintToSvg(p: Paint): { fill: string; def?: string }`,
`type Paint`. Produces for T6/T7/T8 (icon renderers, Batch 3/4): every
`svg.ts` shape helper's fill/stroke parameter type widens from `string` to
`string | Paint` — downstream renderers may now pass a `Paint` (typically
via `resolveElementPaint` from T3) directly to `rect`/`ellipse`/`path`/
`polygon` without pre-stringifying it.

## Acceptance criteria
1. Given a `rect` call with a `Gradient` Paint for `fill`, when rendered,
   then the output contains a `<linearGradient>` element and the rect's
   `fill` attribute is `url(#<id>)`.
2. Given a `rect` call with a plain `string` fill, when rendered, then the
   output is byte-identical to the current (pre-change) implementation.
3. Given two shapes in the same render passed the identical `Gradient`
   value, when rendered, then only one `<linearGradient>` def with that
   content-hash id appears in the output (no duplicate/conflicting defs).

Deps: T1.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` all green.
Coverage 90/90/90 for `src/core/svg.ts`. Re-run the DOT-parity probe
(`../decisions.md#dot-parity`) — expect no change (this is a color/fill
change only, no layout impact).

## Commit
One commit for this task: `feat(T2): thread Paint through svg primitives`.
Body references decisions.md#D1/#D3 (why: gradient skinparam values
currently produce invalid SVG; this makes the primitive layer gradient-aware).
