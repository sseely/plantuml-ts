# Architecture decisions — settled (do not relitigate)

Approved by the maintainer 2026-07-09 during `/plan-mission`. Program
decision “B”: port upstream's emission layer rather than build a
shape-inventory adaptation around the homegrown `svg.ts` emitter.

## D1′ — Positional golden comparison (per program decision B)
- **Context:** jar vs current-`svg.ts` SVGs are structurally incomparable
  (verified: same fixture → `6 g/5 path/3 text/2 polygon/2 ellipse` vs
  `12 marker/7 polygon/4 line/2 rect/2 circle/…`). With the emitter mirroring
  `SvgGraphics.java`, graphviz-ts's positional tree-walk becomes valid.
- **Decision:** port `~/git/graphviz-ts/test/golden/normalize.ts` (163 ln)
  and `compare.ts` (~400 ln) **near-verbatim**, walker included. No
  shape-inventory layer. Renderers gain an SVG gate only when migrated.

## D2′ — Module layout mirrors upstream; split only where the hook forces
- **Decision:** `src/core/klimt/` preserves upstream package structure and
  **names verbatim** (`UPath`, `UTranslate`, `UGraphic`, `SvgGraphics`,
  `DriverRectangleSvg`, …). `SvgGraphics.java` (1,267 ln) exceeds the
  500-line file cap → physically split along its existing method groups,
  re-exported from `svg-graphics.ts` so importers see one upstream-named
  surface.

## D3′ — Driver scope: what svek/description output needs; rest deferred
- **Decision:** port the state model + drivers for **rect, ellipse, line,
  polygon, path, DotPath, text, comment (`UComment`), group (`UGroup`)**.
  `DriverImagePng`, `DriverPixelSvg`, `DriverImageSvgSvg`, centered-char and
  sprite paths are **deferred as throwing stubs** naming this decision —
  deferral to the mission that needs them, not trimming.

## D4′ — Conformance target for the emitter
- **Decision:** T6 goldens (draw sequences vs jar-verified fragments) must
  be **fully conformant**: zero diffs at the 0.01 band via `compareSvg`.
  Includes the document preamble (root attrs + `<?plantuml?>` PI) so Brief 2
  inherits a root-comparable document. Outward term: **conformant** —
  numeric agreement within ±0.01, non-numeric exactly equal (graphviz-ts
  `docs/conformance.md` definition). Never “byte-level” in docs.

## D5′ — Divergence accounting (the PARITY.md model)
- **Context:** graphviz-ts `test/corpus/PARITY.md`: 759/788 conformant,
  **0 tracked gaps** — every non-conformance is an accepted divergence:
  root-caused, bounded (maxΔ), family-classified, ledgered in
  `accepted-divergences.json` + `known-divergences.md`.
- **Decision:** adopt the same model. Target is 100% conformance; residue is
  either a **tracked gap** (will-fix, drives a named follow-up) or an
  **accepted divergence** (maintainer-signed ledger entry). No untracked
  residue. Brief 1 bootstraps `oracle/accepted-divergences.json` (empty);
  Brief 2's dashboard generates the PARITY-style report.

## D6 — XML parsing: `@xmldom/xmldom` devDependency
- Same parser graphviz-ts uses. Dev-only; never bundled.

## D7 — Conformance band: 0.01 (graphviz-ts TOLERANCES model)
- `TOLERANCES = { deterministic: 0.01 }`; per-case pass = zero diffs beyond
  band; numeric attrs + path/points/transform numbers banded, everything
  else exact.

## Adaptation seams (pre-decided direction; journal details)
- **Paint for HColor (T2):** upstream `UParam` carries `HColor`; the port
  carries the existing `Paint` model (`src/core/paint.ts`, render-fidelity
  mission). Drivers serialize via `paintToSvg`. The full HColor system is
  NOT ported.
- **Harness normalize (T1):** adds jar-specific normalization graphviz-ts
  doesn't need: resolve `style="k:v;…"` into attrs (style wins, then drop),
  strip `data-*` attrs and comments/PI. Needed so Brief 2 can compare
  jar output whose paint rides in `style=""`.

---

## Port sources (authoritative — cite in commits)

| Port target | Upstream source | Lines |
|---|---|---|
| T1 harness | `~/git/graphviz-ts/test/golden/normalize.ts`, `compare.ts` | 163 + ~400 |
| T2 model | `klimt/drawing/UGraphic.java`, `AbstractCommonUGraphic.java`, `klimt/UParam.java`, `UTranslate.java`, `UStroke.java`, `UShape.java`, `UChange.java` | ~600 |
| T3 shapes | `klimt/UPath.java` (250), `shape/UEllipse` (111), `ULine` (100), `URectangle` (217), `UPolygon` (183), `UText` (98), `UComment`, `UGroup`, `DotPath` | ~1,200 |
| T4 serializer | `klimt/drawing/svg/SvgGraphics.java` (1,267), `XmlWriter` (285) + `Xml*` (~350) | ~1,900 |
| T5 drivers | `klimt/drawing/svg/Driver{Rectangle,Ellipse,Line,Polygon,Path,DotPath,Text}Svg.java` (~700), `UGraphicSvg.java` (194) | ~900 |

All under `~/git/plantuml/src/main/java/net/sourceforge/plantuml/`.

## Verified facts (2026-07-09)

### Jar document preamble (T4/T6 must reproduce; captured from a real run)
```
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
 version="1.1" data-diagram-type="DESCRIPTION"
 style="width:79px;height:301px;background:#FFFFFF;" width="79px" height="301px"
 viewBox="0 0 79 301" zoomAndPan="magnify" preserveAspectRatio="none"
 contentStyleType="text/css"><?plantuml $version$?><defs/><g>…
```
Note: `data-diagram-type` and `data-*` are emitted by upstream but stripped
by the harness normalizer for comparison (T1 adaptation). Entity wrappers
(`<g class="entity" data-qualified-name=…>` + `<!--entity X-->` comments)
are drawn by **svek code** (`DecorateEntityImage`/`Cluster`/`SvekEdge`) as
`UComment`/`UGroup` — Brief 2 territory; T3 ports the shapes so they exist.

### Golden material for T6
Real jar SVGs are cached at `test-results/dot-cache/<type>/<slug>/in.svg`
(716 class / 265 component / 90 usecase). Extract element-level fragments
from these as reference; regenerate via the local jar
(`~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar`) only if needed.

### Repo conventions that bite
- vitest include glob: `tests/**/*.test.ts` — never colocate tests in src/.
- Complexity hook: files ≤500 lines, funcs ≤30 NLOC / CCN ≤10. Regex
  literals containing `<>{}|` corrupt lizard's span detection — build from
  strings. `#lizard forgives` must sit near a large function's END.
  (memory: complexity-hook-workarounds)
- Coverage gate 90/90/90 — throwing stubs (D3′) need tests asserting the
  throw, or coverage dips.
- `scripts/*` importing from `tests/oracle/*` is established precedent.
