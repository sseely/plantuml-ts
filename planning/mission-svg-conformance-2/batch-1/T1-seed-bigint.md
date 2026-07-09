# T1 — bigint seed in SvgGraphicsCore (D8)

## Context
Brief 1 finding: upstream derives gradient/shadow ids from
`UmlSource.seed()`, a Java `long` (~19 digits). `SvgGraphicsCore`
(`src/core/klimt/drawing/svg/svg-graphics-core.ts`) takes a JS `number`,
which cannot hold it — ids only reproduce for safe-integer seeds
(Brief 1 T6 had to cherry-pick goldens around this). Brief 2 renders
arbitrary fixtures; ids must byte-match the jar for any seed.

## Task
Port the seed to `bigint`:
- `getSeed`/constructor accept `bigint` (or `bigint | number` widening at
  the boundary — journal the choice).
- Base-36 id derivation must match Java `Long.toString(Math.abs(seed), 36)`
  semantics exactly, including `Long.MIN_VALUE` overflow behavior if
  upstream can produce it (read `SvgGraphics.java`'s id code and
  `UmlSource.seed()` for the hash; be faithful to sign handling).
- Thread the type through `UGraphicSvg.build(seed, …)` and any test
  helpers that construct documents.
- Port `UmlSource.seed()`'s hash itself if not already present (check
  first — grep `seed` in `src/`); the renderer cutover (T17) will need to
  compute the same hash the jar computes for a given source.

## Write-set
- `src/core/klimt/drawing/svg/svg-graphics-core.ts`
- `tests/unit/core/klimt/svg-graphics.test.ts` (extend)
- If `u-graphic-svg.ts` signature must change: ASK first (it is another
  batch's dependency surface) — or confirm the widening avoids it.

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/drawing/svg/SvgGraphics.java` (id/seed code)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/text/…/UmlSource.java` (seed hash — find it)
- `.agent-notes/klimt-seed-number-precision.md`
- `../decisions.md#d8`

## Interface contracts (consumed by T17, T18)
`UGraphicSvg.build` accepts the full Java-long seed range; a
`seedOf(source: string): bigint` (upstream-named if upstream names it)
reproducing `UmlSource.seed()`.

## Acceptance criteria
1. Given a 19-digit (unsafe-integer) seed, when two gradients register,
   then ids match the jar's for the same seed (verify one literal pair
   against a jar-generated SVG; cite provenance in a test comment).
2. Given the same source string, then `seedOf` equals the jar's seed
   (extract one known pair via the local jar).
3. Given Brief 1's existing tests, then all still pass unchanged
   (safe-integer seeds keep identical output).

## Observability / Rollback
N/A — pure library. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90; hook-safe.

## Commit
`fix(T1): bigint seed for jar-faithful gradient/shadow ids`
