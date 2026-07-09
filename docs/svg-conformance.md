# SVG conformance: what "conformant" means

plantuml-ts's klimt SVG emitter (`src/core/klimt/**`) is validated against
upstream PlantUML's Java `SvgGraphics` emitter as an oracle. When this
project says an emitter render **conforms** with the jar's output, it means
a specific, mechanically-checked property — not literal equality of the SVG
text.

> **Definition.** A port render is **conformant** with the jar's render
> when, after both SVGs are parsed into a normalized element tree:
>
> 1. every **numeric** value (coordinates, path data, `points`, `viewBox`,
>    `transform` parameters) agrees with the oracle within a fixed
>    **tolerance**, and
> 2. every **non-numeric** value (tag names, colors, text content,
>    attribute keys, enumerated attribute values) is **exactly equal**.
>
> If any numeric value exceeds the tolerance, or any non-numeric value
> differs, the render is **not** conformant. A per-case pass requires zero
> diffs at the tolerance band.

This is the same conformance model graphviz-ts uses for its dot-oracle
parity survey (`~/git/graphviz-ts/docs/conformance.md`); the harness below
is a near-verbatim port of graphviz-ts's `normalize.ts` / `compare.ts`.

## Why not literal bytes?

SVG serializes floating-point coordinates as decimal text. Two renders that
are mathematically equivalent can still differ in the last printed digit
because of IEEE-754 rounding and floating-point operation order that varies
by JS engine. A literal-byte bar is therefore untestable across the
runtimes this library targets, rather than merely strict. Conformance pins
the property that actually matters — the geometry and content a viewer
sees — to a bound small enough to be sub-perceptual.

## The normalization pipeline

`tests/oracle/svg-conformance/normalize.ts` (`normalizeSvg`) parses both the
port's SVG and the jar's SVG with `@xmldom/xmldom` and reduces each to a
comparable `NormalizedNode` tree:

1. Parse the SVG string into a DOM via xmldom.
2. Resolve `style="k:v;…"` declarations into plain attributes — where a
   `style` value and a same-named plain attribute both exist, `style` wins,
   then the `style` attribute itself is dropped. (This is a jar-specific
   addition beyond graphviz-ts's normalizer: PlantUML's jar SVGs carry paint
   in `style=""`.)
3. Strip `data-*` attributes, XML comments, and processing instructions —
   these carry no rendered geometry or content and differ incidentally
   between the port and the jar (e.g. `data-diagram-type`,
   `<?plantuml …?>`).
4. Round every numeric value to 6 significant figures.
5. Sort attributes by name for order-independent comparison.

## The tolerance model

`tests/oracle/svg-conformance/compare.ts` (`compareSvg`) walks the two
normalized trees and applies the two-part rule above: numeric-within-band,
non-numeric-exact. The tolerance table:

| Class | Tolerance (pt) |
|---|---:|
| `deterministic` | **±0.01** |

The klimt emitter is a deterministic serializer (no iterative/force-directed
layout math in this layer), so every comparison uses the `deterministic`
band. ±0.01 absorbs decimal-formatting noise only; it is not a loose bound.

## The divergence accounting model

The target is **100% conformance**. Any residue — a case that does not
reach zero diffs at the tolerance band — is one of exactly two things:

- **Tracked gap** — an unaccepted non-conformance. This is a will-fix: it
  drives a named follow-up task and must not be left undocumented.
- **Accepted divergence** — a deliberate, root-caused, bounded (`maxΔ`),
  family-classified difference that the maintainer has signed off on as
  won't-fix. Ledgered in `oracle/accepted-divergences.json`.

There is no third category. Every non-conformant case is either being
fixed or has an accepted-divergence ledger entry — never silently ignored.

**Adding an accepted-divergence entry requires maintainer sign-off.** A
golden that cannot be made fully conformant is never pinned loose without
that sign-off: a port bug is fixed; a genuinely irreducible difference (for
example, JVM float-formatting behavior that cannot be reproduced in JS) is
proposed to the maintainer with its root cause and bound before it is
accepted.

## Running the suite

The conformance suite lives at `tests/oracle/svg-conformance/` and runs as
part of the normal test command:

```sh
npm test
```

This runs `normalize.test.ts`, `compare.test.ts`, and the emitter
conformance suite (`emitter.golden.test.ts`) under vitest with the rest of
the project's tests — no separate invocation is needed.

## Read the code

- [`tests/oracle/svg-conformance/normalize.ts`](../tests/oracle/svg-conformance/normalize.ts)
  — `normalizeSvg`, the normalization pipeline above.
- [`tests/oracle/svg-conformance/compare.ts`](../tests/oracle/svg-conformance/compare.ts)
  — `TOLERANCES`, `compareSvg`, and the `Diff` shape reported for
  non-conformant cases.
- [`oracle/accepted-divergences.json`](../oracle/accepted-divergences.json)
  — the sign-off ledger (bootstrapped empty in Brief 1).
