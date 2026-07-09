# Architecture decisions — settled (do not relitigate)

D1′–D7 are inherited from Brief 1 by reference:
[`../mission-svg-conformance/decisions.md`](../mission-svg-conformance/decisions.md).
D8–D12 below were approved by the maintainer 2026-07-09 during
`/plan-mission` for Brief 2.

## D8 — Gradient/shadow id seeds: `bigint` port
- **Context:** Brief 1 finding (`.agent-notes/klimt-seed-number-precision.md`):
  upstream derives gradient/shadow ids from `UmlSource.seed()`, a Java
  `long` hash (~19 digits) that JS `number` cannot hold, so ids were only
  reproducible for safe-integer seeds.
- **Decision:** port the seed to `bigint` in `SvgGraphicsCore`
  (`getSeed` + base-36 derivation matching Java `Long` semantics, incl.
  sign handling). No harness id-normalization — faithfulness at the
  source beats masking in the instrument; ids stay inside the
  conformance claim.

## D9 — Module layout for new port surfaces
- Upstream packages are `net.sourceforge.plantuml.decoration.symbol`
  (USymbols) and `net.sourceforge.plantuml.svek` — NOT under `klimt`.
- **Decision:** mirror as `src/core/decoration/symbol/` and
  `src/core/svek/` per D2′. Names verbatim, PascalCase files.

## D10 — Complete USymbol set
- **Context:** upstream `CommandCreateElementFull.ALL_TYPES` (the
  description engine's element regex) accepts 33 keywords covering
  essentially every concrete `USymbol*` class — none are unreachable.
- **Decision:** port the **complete** concrete set (~27 classes,
  ~4,100 ln total) + `USymbols` registry + bases. Nothing deferred.
  Extremity factories (T13) are scoped to the decors our description
  `link-grammar.ts` can produce — parser-bounded reachability, not
  YAGNI; when ambiguous, include and journal.

## D11 — Ratchet mechanics
- **Decision:** `oracle/goldens/svg-description/ratchet.json` manifest of
  locked fixture slugs + one committed jar `golden.svg` per slug. Ratchet
  test iterates the manifest inside `npm test`. Adding a slug requires
  conformance; removal is maintainer-only. **DOT-EQUAL-first
  eligibility:** only fixtures the DOT parity report marks EQUAL may
  enter (topology/geometry already agree, so SVG diffs mean emission).

## D12 — Text metrics: identically mimic Java, via the existing seam
- **Context:** jar SVGs carry AWT font metrics; our
  `StringBounderFixed`-derived table approximates. The injection seam
  already exists at both levels: `StringMeasurer` DI into layout
  (`src/core/measurer.ts`) and the `stringBounder` param on
  `UGraphicSvg.build` (Brief 1 T5), mirroring graphviz-ts
  `ctx.textMeasurer`.
- **Decision:** extract per-glyph advance widths + ascent/descent from
  the local JVM (one-time Java helper → committed data table); implement
  a jar-metrics `StringMeasurer`; inject into klimt text emission and
  the description layout path. Band stays 0.01; residue is tracked-gap
  or maintainer-signed divergence (D5′), never a widened band.
- **Risk control:** T4 probes DOT-parity impact before wiring; any count
  decrease is a stop.

---

## Port sources (authoritative — cite in commits)

All under `~/git/plantuml/src/main/java/net/sourceforge/plantuml/`.

| Port target | Upstream source | Lines |
|---|---|---|
| T3 base | `decoration/symbol/{USymbol,USymbolSimpleAbstract}.java`, `SymbolContext` (find it), minimal TextBlock seam | ~400 |
| T5–T9 symbols | `decoration/symbol/USymbol*.java` (27 concrete) | ~3,700 |
| T10 registry | `decoration/symbol/USymbols.java` | ~150 |
| T11 decoration | `svek/DecorateEntityImage.java` (+ where svek stamps `class="entity"`/`data-qualified-name` — grep `qualified` in `svek/`) | ~200 |
| T12 cluster | `svek/Cluster.java` (drawing half) | 760 total |
| T13 edges | `svek/SvekEdge.java` (drawing half of 1,361), `svek/extremity/Extremity*.java` (reachable decors only) | ~1,400 |
| T14 assembly | `svek/image/EntityImageDescription.java` | 383 |

## Verified facts (2026-07-09)

- **Golden material:** `test-results/dot-cache/component/` (265) and
  `usecase/` (90). There is NO `description/` cache dir (charter guessed
  wrong). Local jar for regeneration:
  `~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar`.
- **DOT-parity ratchet precedent:** `tests/oracle/description-parity.ratchet.test.ts`
  (91 ln) already ratchets DOT output — model the SVG ratchet's manifest
  handling on it, but goldens/manifest live under `oracle/` per D11.
- **Dashboard model:** `~/git/graphviz-ts/test/corpus/dashboard.ts`
  renders `PARITY.md` from survey JSON; `survey.test.ts` adjacent.
- **Current description renderer:** `renderer.ts` (143 ln) +
  `renderer-helpers.ts` (287 ln), emitting via `src/core/svg.ts` helpers
  and `<marker>` arrowheads. Jar draws arrowheads as polygons via
  extremity classes — markers disappear in the cutover.
- **Retirement paths (verified):** `tests/visual/compare.spec.ts`,
  `tests/visual/playwright-visual.config.ts`,
  `tests/visual/capture-reference.ts`, `tests/visual/reference/**`
  (28 subdirs), `visual:compare` npm script, `scripts/visual-qa-svg.ts`.
  NOT touched: `scripts/visual-qa-dot.ts`, root `playwright.config.ts`,
  `visual:classify/capture/build/upload` scripts,
  `scripts/capture-corpus.ts`, `scripts/upload-references.ts`.
- **Brief 1 emitter surface:** `UGraphicSvg.build(seed, option, version,
  stringBounder)`; `.apply/.draw/.getSvgString()`;
  `startGroup/closeGroup` for UGroup. D3′ stubs throw for links, images,
  sprites, pixel, centered-char, text-as-path.
- **Text-driver gaps carried from Brief 1 T5** (may surface as
  divergences here): FontConfiguration carries family/size/color/styles
  only; no FontFace weight refinement; UNDERLINE/STRIKE plain-CSS path;
  BACKCOLOR/getAttributes deferred.

## Repo conventions that bite
- vitest include glob: `tests/**/*.test.ts` — never colocate tests in src/.
- Complexity hook: files ≤500 lines, funcs ≤30 NLOC / CCN ≤10. Regex
  literals containing `<>{}|` corrupt lizard — build from strings.
  `#lizard forgives` must sit near a large function's END.
- Coverage gate 90/90/90 — throwing stubs need throw-assertion tests.
- `scripts/*` importing from `tests/oracle/*` is established precedent.
- `planning/` is committed in this repo (repo convention overrides the
  plan-mission skill's gitignore default); `.claude/` is gitignored.
