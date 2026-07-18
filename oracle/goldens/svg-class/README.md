# svg-class conformance ratchet

Regression-proof gate for the class diagram engine (`src/diagrams/class/`),
mirroring `oracle/goldens/svg-description/` (component/usecase, mission
G1/G1b/G1c). A fixture ratchets in once it renders byte-for-byte identical
to the jar oracle under a **deterministic** text measurer; the ratchet test
then holds it forever. See
`tests/oracle/svg-conformance/class.golden.ratchet.test.ts`.

## Why a deterministic measurer, not production

Same rationale as `oracle/goldens/svg-description/README.md`: production
(`renderSync`) always measures text with `jarMeasurer` (AWT font metrics via
the cached jar), which is a pre-existing, already-documented apples-to-
oranges gap (D12), not evidence of a rendering bug. `render-fixture-
class.ts#renderFixtureClass` renders through the class engine's low-level
pipeline (`parseClass` -> `layoutClass` -> `renderClass`) with
`DeterministicMeasurer` injected at the layout stage (unlike description's
`renderDescription`, `renderClass(geo, theme)` takes no measurer of its own
— every text metric it needs is already baked into `ClassGeometry` by
`layoutClass`). See `scripts/svg-conformance-census.ts class` for the
census that discovers zero-diff candidates this way.

## Layout

```
oracle/goldens/svg-class/
  ratchet.json                 <- the manifest (source of truth for CI)
  README.md                    <- this file
  <slug>/
    in.puml                    <- fixture source (committed, offline)
    golden.svg                 <- committed jar SVG, copied verbatim from
                                   test-results/dot-cache/class/<slug>/in.svg
```

Class fixtures have no `<type>` subdirectory level (unlike svg-description's
`<type>/<slug>/`, which spans component AND usecase) — every entry here is
type `class`. `in.puml` and `golden.svg` are committed copies so the ratchet
test runs fully offline — no dependency on the gitignored, regenerable
`test-results/dot-cache/` tree at test time.

## Current state (G2/N4, 2026-07-16)

**29 fixtures pinned** — the first class ratchet pins, landed after the
2026-07-16 oracle re-capture made zero-diff reachable (N0-N3's cache
predated the deterministic-text patch; see `plans/g2-class-svg/README.md`'s
"Re-baseline" section) and N4's text-rendering + badge-color + background-
rect mechanisms closed the gap for these 29. Census:
`0/718 -> 29/718` conformant, `1-3: 20 · 4-10: 242 · 11-30: 22 · 31+: 405`
(`plans/g2-class-svg/ledger.md` N4 has the full mechanism list). All 29 are
`dotEqual: true` per `parity-class.json` (regenerated 2026-07-16 against
the current code, `conformant:23, structural-match:45, diverged:650`).

## Add rule

A fixture may be added to `ratchet.json` only when **both** hold:

1. **Conformant** — rendering the fixture's `in.puml` through
   `renderFixtureClass` with `DeterministicMeasurer` produces an SVG that is
   zero-diff (`compareSvg(ours, golden, 'deterministic').pass === true`)
   against the jar's `in.svg`.
2. **DOT-EQUAL** — the fixture's DOT emission is structurally `EQUAL`
   against the oracle DOT. Class DOT is already 708/708 (frozen gate), so
   this condition should be near-universally satisfied once (1) holds — but
   is still enforced by the suite itself via
   `tests/oracle/svg-conformance/parity-class.json`, mirroring svg-
   description's `parity.json` eligibility gate. Regenerate via `npx tsx
   scripts/svg-parity-survey.ts --out tests/oracle/svg-conformance/
   parity-class.json class` after any render-side change, before adding new
   slugs (N0 added the `--out`/positional-type args to `svg-parity-
   survey.ts`, additive, default invocation unchanged — does NOT touch the
   shared component/usecase `parity.json`).

To add a slug:

1. Confirm both conditions above.
2. Copy `test-results/dot-cache/class/<slug>/in.puml` and `in.svg` into
   `oracle/goldens/svg-class/<slug>/` (renaming `in.svg` to `golden.svg`).
3. Append `{ slug, addedAt, source: "dot-cache" }` to `ratchet.json`.

## Remove rule

Removal is **maintainer-only** — see `oracle/goldens/svg-description/
README.md`'s identical rule; the same rationale applies verbatim.
