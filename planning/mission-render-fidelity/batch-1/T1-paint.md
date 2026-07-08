# T1 — Create the Paint color/gradient model

## Context
The renderer currently treats every skinparam color value as an opaque
string. A `color1\color2` gradient value flows straight into `fill="..."`,
producing `fill="#c3d8f4\#6192d1"` — invalid SVG that renders solid black.
Upstream parses the separator, builds a real `<linearGradient>`, and
references it via `fill="url(#id)"`. This task builds the color model that
fixes it. See `../decisions.md#D1` (the `Paint` type shape) and `#D3` (defs
placement / id scheme), plus the "Gradient model" and "Gradient SVG
emission" citations in the same file.

## Task
Create a new module `src/core/paint.ts` with a colocated `src/core/paint.test.ts`.
Do not modify any other file — this batch only establishes the type; nothing
consumes it yet (T2/T3 do, in Batch 2).

Export exactly:

```ts
export interface Gradient {
  color1: string;
  color2: string;
  policy: '-' | '\\' | '|' | '/';
}

export type Paint = string | Gradient;

export function parseColor(s: string): Paint;

export function paintToSvg(p: Paint): { fill: string; def?: string };
```

- `parseColor`: scan `s` for the first occurrence of any of `- \ | /` (in
  that priority order, matching upstream's `HColorSet` — see decisions.md
  citation). If found, split into `color1` (before) / `color2` (after) and
  set `policy` to the separator character. If no separator is found, or
  either half is empty/unparseable as a plain color, return `s` unchanged
  as a plain string (do not throw).
- `paintToSvg`: a plain string returns `{ fill: p }` (no `def`). A
  `Gradient` returns `{ fill: 'url(#g<hash>)', def: '<linearGradient ...>' }`
  where the `<linearGradient>` vector (`x1/y1/x2/y2`, as percentages) comes
  from the policy→vector table in `decisions.md` (Gradient SVG emission
  citation), and the def contains two `<stop>` elements: `stop-color`
  `color1` at `offset="0%"`, `color2` at `offset="100%"`.
- The gradient id is `g<hash>` where `hash` is a deterministic content hash
  of the string `` `${color1}|${color2}|${policy}` `` — a small stable
  string-hash function is fine (e.g. FNV-1a or djb2 rendered as hex/base36).
  No `Math.random()`, no `Date.now()`, no incrementing counters: identical
  input must always produce the identical id (this is what makes dedup in
  T2 work — see D3).

## Write-set
- `src/core/paint.ts` (new)
- `src/core/paint.test.ts` (new)

## Read-set
- `../decisions.md` — D1 (Paint type), D3 (defs placement + id scheme),
  "Gradient model" citation (`klimt/color/HColorSet.java:109-116`,
  `HColorGradient.java`), "Gradient SVG emission" citation
  (`svg/SvgGraphics.java:357-399`, policy→vector table)
- `src/core/svg.ts:1-60,290-310` — existing attribute-string and `<defs>`
  wrapping conventions (`escapeXml`, `svgDefs`), to match style/quoting
  conventions in the new module. Do not import from `svg.ts`; `paint.ts`
  is a leaf module with no dependencies.

## Architecture decisions
- D1: `Paint = string | Gradient`; a bare string is always a valid solid
  paint. This is the type every downstream consumer (T2 svg primitives, T3
  theme, T4-T8 renderers) imports.
- D3: defs are emitted inline per-call, deduped by deterministic
  content-hash id — `paintToSvg` returning the same `def` string for the
  same input is what makes that dedup possible upstream in T2.

## Interface contracts (consumed by T2, T3, T4, T6)
Exact exports, signatures, and semantics as specified in Task above:
`Gradient`, `Paint`, `parseColor(s: string): Paint`,
`paintToSvg(p: Paint): { fill: string; def?: string }`.
Downstream tasks import these directly from `src/core/paint.ts` — do not
rename or change the shape without flagging it (this would ripple through
every later batch).

## Acceptance criteria
1. Given `#c3d8f4\#6192d1`, when `parseColor` runs, then it returns
   `{ color1: '#c3d8f4', color2: '#6192d1', policy: '\\' }`.
2. Given that gradient, when `paintToSvg` runs, then `fill` is `url(#g...)`
   and `def` contains `x1="0%" y1="100%" x2="100%" y2="0%"` and both
   `<stop>` elements (`#c3d8f4` at `0%`, `#6192d1` at `100%`).
3. Given a bare `#FFFFFF`, when `parseColor` runs, then it returns the
   string `'#FFFFFF'` unchanged; when `paintToSvg` runs on it, then it
   returns `{ fill: '#FFFFFF' }` with no `def` key set.
4. Given two separate `paintToSvg` calls with an identical `Gradient`
   (same `color1`/`color2`/`policy`), when compared, then both calls
   produce the identical `fill` id string (dedup precondition for T2).
5. Given each policy value `-`, `|`, `/` in turn, when `paintToSvg` runs,
   then the emitted vector matches the corresponding row of the
   policy→vector table in `decisions.md` (`-` → `50% 0% → 50% 100%`;
   `|` → `0% 50% → 100% 50%`; `/` → `0% 0% → 100% 100%`).

## Observability
N/A — pure synchronous library, no runtime observable operations.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` all green.
Coverage 90/90/90 for the new module. Also re-run the DOT-parity probe
(`../decisions.md#dot-parity`) — expect no change, since no renderer yet
consumes this module.

## Commit
One commit for this task: `feat(T1): add Paint color/gradient model`.
Reference decisions.md#D1/#D3 in the commit body (why: gradient values
currently break SVG output; this is the shared type all render-fidelity
work builds on).
