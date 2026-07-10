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

This runs `normalize.test.ts`, `compare.test.ts`, the emitter conformance
suite (`emitter.golden.test.ts`), and the description ratchet
(`description.golden.ratchet.test.ts`, see Brief 2 below) under vitest with
the rest of the project's tests — no separate invocation is needed.

## Read the code

- [`tests/oracle/svg-conformance/normalize.ts`](../tests/oracle/svg-conformance/normalize.ts)
  — `normalizeSvg`, the normalization pipeline above.
- [`tests/oracle/svg-conformance/compare.ts`](../tests/oracle/svg-conformance/compare.ts)
  — `TOLERANCES`, `compareSvg`, and the `Diff` shape reported for
  non-conformant cases.
- [`oracle/accepted-divergences.json`](../oracle/accepted-divergences.json)
  — the sign-off ledger (bootstrapped empty in Brief 1).

---

# Brief 2: the description-engine cutover and its ratchet

Brief 1 (above) built and conformance-verified the klimt emitter in
isolation, with zero production consumers. Brief 2 (svg-conformance-2,
T1–T20) cut the **description** diagram engine (component / use-case /
deployment) over to draw exclusively through that emitter — see
`.claude/catalog.md`'s "Klimt SVG Emitter", "USymbol Decoration Layer",
and "Svek Drawing Layer" entries for the module inventory, and
`planning/mission-svg-conformance-2/decision-journal.md` for the full
task-by-task record this section summarizes.

**Honest status:** the cutover is complete and gated by the full test
suite, but **description-engine SVG output is not yet fully conformant**.
Under **production** rendering (`renderSync`, `jarMeasurer`), 0 of 354
surveyed component/usecase fixtures reach zero-diff — this is *expected*,
not a regression (see "Why the survey shows near-zero conformant" below).
A separate, deliberately narrow **ratchet** locks 5 fixtures that *are*
zero-diff conformant under a dedicated deterministic-measurer render path.
The gap between "cutover done" and "fully conformant" is real and tracked
as follow-ups F1–F5 (see the end of this section) — do not read the
ratchet's 5 fixtures as "5/N conformant"; read it as "5 fixtures proven
and regression-locked, with an honest backlog for the rest."

## Why the survey shows near-zero conformant: the D12 measurer split

The SVG-conformance oracle corpus (`test-results/dot-cache/`, captured via
`scripts/dot-sync-report.ts`) is rendered by the jar with
`-DPLANTUML_DETERMINISTIC_TEXT=true` — a flag that swaps the jar's text
measurement from real AWT font metrics to a fixed
`UnicodeFontWidthSansSerif` width table (height=size). Production
plantuml-ts, by design (decision D12), measures text with **AWT-faithful**
metrics (`jarMeasurer`, `src/core/measurer-jar.ts`) so that real (non-flag)
jar output — what actual users see — is what the port matches.

These are two different, incompatible text-metric systems. Comparing
production output against the deterministic-mode oracle corpus will never
reach zero-diff on text-bearing fixtures, no matter how correct the
renderer is — the D12 choice is intentional and locked, not a bug.

**Resolution: dual measurer.** Production keeps `jarMeasurer` (AWT,
D12-faithful) for every real render. A second, separate measurer —
`DeterministicMeasurer` (`src/core/measurer-deterministic.ts`, a re-export
of `WidthTableMeasurer`) — exists solely for the conformance/ratchet render
path, where it is injected into *both* the layout and render stages so
both sides of the comparison (port and oracle) use the same text-metric
system. Injection happens at exactly two seams — `layoutDescription`'s
`measurer` param and `UGraphicSvg.build`'s `measurer` arg — with no
prop-drilling and no DI container. The public `SyncPlugin#render(geo,
theme)` contract has no measurer parameter, so production callers
(`renderSync`, `descriptionPlugin.render`) can never accidentally pick up
the deterministic path.

## Survey and dashboard: measuring where things stand

The survey compares **production** `renderSync` output against the cached
jar SVG over the full component/usecase corpus. It is a report, not a
gate — it exists to make the (currently large, D12-driven) production gap
visible and trackable, not to fail CI.

```sh
npm run svg:survey      # scripts/svg-parity-survey.ts
                         # writes tests/oracle/svg-conformance/parity.json
npm run svg:dashboard   # scripts/svg-parity-dashboard.ts
                         # renders tests/oracle/svg-conformance/PARITY-SVG.md
```

Each row in `parity.json` records a `verdict` (`conformant`,
`structural-match`, `diverged`, `errored`, `timeout`, `oracle-error`) and a
`dotEqual` flag — whether the fixture's DOT emission is structurally
`EQUAL` against the DOT oracle, independent of SVG rendering. `dotEqual`
is the ratchet's eligibility gate (see below); it does not by itself imply
SVG conformance.

Regenerate the dashboard after every survey run so `PARITY-SVG.md` stays
in sync with `parity.json` — the dashboard reads `parity.json` from disk,
it does not re-render anything itself.

## Overlay triage: diagnosing one fixture

For a specific `diverged` fixture, the overlay report renders both SVGs,
runs `compareSvg`, and writes one self-contained HTML file with:

- both SVGs inline, an opacity-slider overlay toggle, and a side-by-side
  toggle, and
- a `Diff[]` table (path, expected, actual, tolerance-class) for every
  divergence `compareSvg` found.

```sh
npx jiti scripts/svg-overlay-report.ts component/buduni-98-bima526
npx jiti scripts/svg-overlay-report.ts --from-parity   # batch: every `diverged` row
```

Output lands in `test-results/svg-overlay/` (gitignored). No pixels, no
Playwright, no external network requests from the generated HTML — purely
SVG-harness driven, reading the same cached `test-results/dot-cache/`
fixture pairs the survey uses.

## The census: finding ratchet-seed candidates

Because the survey compares under `jarMeasurer` (production), it will not
surface fixtures that are conformant *modulo D12*. The census instead
renders through the description engine's **low-level** pipeline
(`parseDescription` → `layoutDescription` → `renderDescription`),
injecting one measurer into both stages, in two passes:

```sh
npx tsx scripts/svg-conformance-census.ts             # both types
npx tsx scripts/svg-conformance-census.ts component   # one type
```

- **`deterministic` pass** — the real conformance/ratchet metric:
  `DeterministicMeasurer` in both stages, compared against the
  deterministic-mode oracle. A fixture with zero diffs here is a ratchet
  candidate.
- **`jar` pass** — a sanity check: `jarMeasurer` (production's own
  default) against the same oracle, to confirm the gap looks like the
  known D12 apples-to-oranges gap and not a new regression.

## The ratchet: locking proven-conformant fixtures forever

`oracle/goldens/svg-description/` is the regression-proof gate — once a
fixture is in it, `npm test` fails if that fixture ever stops rendering
zero-diff. See `oracle/goldens/svg-description/README.md` for the
authoritative, maintained copy of these rules; this section is a workflow
summary, not a replacement for it.

### Add rule

A fixture may be added only when **both** hold:

1. **Conformant** — the low-level pipeline, with `DeterministicMeasurer`
   injected into layout and render, produces zero diffs
   (`compareSvg(ours, golden, 'deterministic').pass === true`) against the
   jar's cached `in.svg`.
2. **DOT-EQUAL** — `parity.json`'s `fixtures[].dotEqual === true` for that
   fixture. The ratchet test's own "eligibility" describe block enforces
   this in-suite, not just in this doc.

### Workflow: survey → overlay → fix → ratchet

A new contributor chasing description-engine conformance follows this
loop without needing the mission brief:

1. **Survey** — `npm run svg:survey && npm run svg:dashboard`. Read
   `tests/oracle/svg-conformance/PARITY-SVG.md` for the current shape of
   the gap (per-family counts, top divergence buckets).
2. **Pick a candidate** — run the census
   (`npx tsx scripts/svg-conformance-census.ts <type>`) to find a fixture
   that is *already* zero-diff under `DeterministicMeasurer` but not yet
   ratcheted, or **overlay** a `diverged` survey row
   (`npx jiti scripts/svg-overlay-report.ts <type>/<slug>`) to see exactly
   what differs.
3. **Fix** — if the overlay shows a real renderer/layout bug, fix it in
   `src/diagrams/description/**` or `src/core/svek/**` (see
   `.claude/catalog.md` for the module map); do not hardcode
   `DeterministicMeasurer` values into production code paths — that was
   tried and reverted (decision journal, "Conformance-pass agent —
   findings preserved, changes triaged"). Re-run the census.
4. **Ratchet** — once a fixture passes both add-rule conditions:
   - copy `test-results/dot-cache/<type>/<slug>/{in.puml,in.svg}` to
     `oracle/goldens/svg-description/<type>/<slug>/{in.puml,golden.svg}`
   - append `{ slug, type, addedAt, source: "dot-cache" }` to
     `ratchet.json`
   - run `npm test` — the new fixture is now permanently gated.

### Remove rule

Removal is **maintainer-only**. A locked fixture is a promise the codebase
does not regress on it; do not remove one inline while working on an
unrelated change.

## Current description-engine conformance status (as of Brief 2 close)

**5 fixtures ratcheted**, all single-element/simple cases:

| Type | Slug |
|------|------|
| component | `buduni-98-bima526` |
| component | `vacuxi-18-baxu582` |
| component | `vumija-03-xise495` |
| usecase | `majuma-84-loma401` |
| usecase | `kevipe-39-gaji640` |

**No conformant fixture yet** for: package/cluster containers, multi-edge
diagrams, or any fixture using a named CSS color (e.g. `#orange` — named
colors are not yet normalized to hex, see F below). Do not force-add a
fixture in one of these categories to "close" it — widen the ratchet only
once a real fixture in that category reaches zero-diff.

**Do not confuse "5 ratcheted" with "conformance is done."** The mission
delivered the klimt cutover, the dual-measurer infrastructure, and a live
(if small) regression-proof ratchet — not full description-engine
conformance. The remaining gap is real and tracked:

| ID | Gap | Scope |
|----|-----|-------|
| F1 | Spline-clip edge-drop | `layout-helpers.ts` clip-splicing can produce non-`1+3n` point counts that `buildDotPathFromSplinePoints` (`svek-edge-geometry.ts`) rejects; caller `try/catch` skips the edge. Affects 3 fixtures. Proper fix: bezier-aware/de-Casteljau clip that preserves the invariant. |
| F2 | Structural features | Legend, title/header/footer, `<img>`, monospace creole not yet implemented in the description engine — largest single bucket in the production survey (`childCount`/`svg/g` divergence buckets). |
| F3 | D12 measurer-mode residue | Production (`jarMeasurer`) vs the deterministic-mode oracle corpus — expected, documented, not itself a defect; the ratchet's dual-measurer design is the mitigation, not a fix for production's own survey numbers. |
| F4 | Multi-leaf document-dimension under-count | ~1px under production; `computeTotalDimensions` is a hand-scan where upstream uses `TextBlockUtils.getMinMax().delta(15,15)` (needs a `LimitFinder`/`UGraphicNo` port — currently a throwing stub). |
| F5 | `newpage` / multi-page | Not yet supported by the description engine. |

Also pending **maintainer write-set approval** (cross-engine files, larger
blast radius than the description engine alone):

- named-CSS-color → hex table (`src/core/theme.ts` — no `HColorSet` port
  exists yet; blocks named-color fixtures from ever reaching conformance)
- `transparent` background omission (`src/core/klimt/drawing/svg/
  svg-graphics-core.ts:243`, `setupBackcolor`)
- `roundCorner`/`componentRoundCorner` skinparam parsing
  (`src/core/skinparam.ts` + `src/core/theme.ts`)

None of F1–F5 or the pending unblockers gate `npm test` today — they gate
*future* additions to the ratchet, not the current one.
