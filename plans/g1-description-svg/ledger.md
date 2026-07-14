# G1 ledger

(loop-protocol entry format; appended as iterations close)

## I0 — image href normalize rule + error triage

### image/@xlink:href byte divergence
- Mechanism: `img`/sprite atoms pass their data-URI `xlink:href` through
  byte-verbatim (this port) vs upstream's ImageIO re-encode — a DELIBERATE
  divergence (DIVERGENCES.md § "Sprite and img rasters — pass-through and
  browser scaling"), not a bug. Ours: `tests/oracle/svg-conformance/compare.ts`
  had no exemption, so the compare harness flagged the bytes as a diff on
  every fixture carrying an `<image>` element.
- Disposition: fixed — `compare.ts`'s attribute loop now treats
  `image/@xlink:href` as present-and-nonempty-match only; geometry
  (`x`/`y`/`width`/`height`, already `NUMERIC_ATTRS`) stays strictly
  compared, and a href present on only one side is still a diff. Pinned by
  4 new tests in `tests/oracle/svg-conformance/compare.test.ts` (describe
  block "image/@xlink:href (deliberate raster pass-through divergence)").
- Slugs: any fixture rendering a stdlib/creole `img`/sprite atom (reach not
  separately counted — folds into whichever fixtures happen to hit this
  attribute; harness-level fix, not fixture-specific).

### graphviz-ts layout crash on cluster + cross-boundary-edge topology
- Mechanism: `graphviz-ts` (vendored, pinned via `.tgz`, not in this
  mission's write-set) throws `TypeError: Cannot read properties of
  undefined (reading 'info')` inside `ctx.layout(g, 'dot')` for
  `xusuxe-62-guba767`'s specific 4-node-cluster + 2-external-node +
  5-labeled-edge topology (one edge crosses the cluster boundary). Full
  mechanism + ruled-out list already recorded in
  `plans/si5b-stdlib/decision-journal.md` (I0/T9, "graphviz-ts layout crash
  on cluster + cross-boundary-edge topology (xusuxe-62-guba767)") — cited
  here rather than re-diagnosed, per that entry's own note that the crash
  is orthogonal to every G1-reachable source file.
- Disposition: blocked-on third-party (graphviz-ts, out of write-set).
- Slugs: component/xusuxe-62-guba767

### jar's own SVG comment defang leaves a residual `--` for 3+ consecutive dashes
- Mechanism: the CACHED ORACLE `in.svg` for `usecase/fepuvo-06-rugi981`
  contains a note with a literal `---` (3-dash) line in its source text.
  The jar's own `XmlWriter#comment` defangs `--` -> `- -` with a single
  left-to-right non-overlapping pass (mirrored faithfully by this port's
  `xml-writer.ts#comment`, `value.split('--').join('- -')`); for an ODD
  run of 3+ dashes that pass leaves a residual `--` (`"---".split('--')`
  matches only the first pair, giving `"- -" + "-"` = `"- --"`, which
  still contains `--`). The MALFORMED XML is baked into the jar's own
  captured golden (`test-results/dot-cache/usecase/fepuvo-06-rugi981/
  in.svg`, byte `- -- -` at the reported position) — not something our
  renderer produces. `svg-conformance-census.ts`'s `isWellFormed(jarSvg)`
  guard (added ahead of this mission) already classifies it correctly as
  a harness-level "jar SVG not well-formed" error rather than crashing the
  census run.
- Ruled out: our own comment-defang logic — `xml-writer.ts#comment`
  produces the byte-identical `- -- -` for the same 3-dash input (verified
  by inspection: same split/join algorithm, same edge case), so this is
  not a divergence from the jar, just a pre-existing jar quirk neither
  side can safely "fix" without diverging from the jar's own (malformed)
  output.
- Disposition: not fixable here (pre-existing oracle artifact, jar-side).
  Not a needs-signoff — no faithful fix exists that keeps this port
  byte-consistent with the jar's own emission of the same input.
- Slugs: usecase/fepuvo-06-rugi981

### missing entity comment + NUL-byte leak on a `set separator` collision-disambiguated port
- Mechanism: `renderer-entity.ts#drawFallbackBox` (note/port fallback)
  called `decorateEntityDrawing` unconditionally-with-comment, but
  upstream's `EntityImagePort.java:110-116` and `EntityImageNote.java:
  196-202` never draw a leading `UComment("entity " + name)` — only
  `EntityImageDescription.java:295` does. For `component/bujige-52-gase998`
  (`set separator .` + two `portin br0` children under different
  containers, a bare-id collision), `dotKeyFor`'s collision-disambiguated
  key (`namespace-groups.ts#SCOPE_KEY_SEP`, an internal NUL sentinel) fed
  `info.name`, and the wrongly-drawn comment put that raw NUL byte into
  `<!--entity NAME-->` unescaped (`UGroup.put`'s `fix()` sanitizer, which
  DOES convert non-word chars incl. NUL to `.`, only runs on attribute
  values, not `UComment` text) — invalid XML, `[xmldom fatalError] comment
  is not well-formed`. A second, distinct leak in the same fixture:
  `SvekEdge.ts#commentForSvg`'s `<!--link X to Y-->` used the raw
  `dotKeyFor` DOT-identity key (`SvekEdgeInput.from`/`.to`) where upstream
  (`abel/Link.java:118,120`) uses `getEntity().getName()` — the bare leaf
  name (`plasma/Quark.java:84-86`), not `getQualifiedName()`.
- Disposition: fixed, two origin points: (1)
  `DecorateEntityImage.ts#decorateEntityDrawing` gained an optional
  `{ withComment?: boolean }` opt (default `true`, unchanged for every
  other caller); `renderer-entity.ts#drawFallbackBox` passes
  `withComment: false`. (2) `namespace-groups.ts#bareEntityName` (new,
  strips back to the last `SCOPE_KEY_SEP`-delimited segment — a no-op for
  the non-colliding common case); `renderer-edge.ts#buildInput` now feeds
  `bareEntityName(edge.from)`/`bareEntityName(edge.to)` into
  `SvekEdgeInput.from`/`.to` (display-only; `fromUid`/`toUid` lookup still
  keys off the raw, undisambiguated `edge.from`/`edge.to`, unaffected).
  Pinned by a new `decorateEntityDrawing` unit test (withComment=false)
  and an updated `renderer.test.ts` assertion (was pinning the WRONG
  pre-fix behavior — corrected, not just extended). Moved
  `component/bujige-52-gase998` from `errors` to a measurable 98-diff
  fixture (structurally sound XML now; remaining diffs are ordinary
  geometry/measurer-gap territory for later iterations, e.g. the missing
  port text label is `svg/g[3][childCount]` — out of scope here).
- Slugs: component/bujige-52-gase998

### annotated-fixture root-attr loss also produces a hard XML parse error, not just a diff
- Mechanism: `usecase/vivido-49-nisu863` (a `title <$database>`-annotated
  fixture) errors with `NamespaceError: prefix is non-null and namespace
  is null` because our assembled root `<svg>` for the annotated path omits
  `xmlns:xlink` entirely while still emitting `xlink:href` on an `<image>`
  child — the SAME root-attr-loss mechanism I1 exists to diagnose and fix
  (svgRoot's document shell differing from klimt's own, G0b-flagged),
  just manifesting as a hard parse error (unparseable XML) here instead of
  an attribute diff (the more common case for the other 17 root-attr-
  family fixtures, whose `xlink:href`-bearing content happens not to be
  present or whose comparison never reaches a namespaced attribute before
  a structural mismatch is recorded).
- Disposition: not fixed independently in I0 — subsumed by I1 (see I1's
  journal entry below); re-verify this slug's error clears once I1 lands.
- Slugs: usecase/vivido-49-nisu863 (also a member of I1's 18-fixture family)

## I1 — root-attr family (klimt document-shell loss on annotated fixtures)

### unwrapKlimtSvg/svgRoot discards klimt's own document shell
- Mechanism: every ANNOTATED description fixture (title/legend/header/
  footer/caption) routes `renderDescription`'s complete klimt document
  through `unwrapKlimtSvg` -> `applyChrome` -> `assembleSvg`.
  `unwrapKlimtSvg` reduced the klimt document to a bare
  `RenderFragment {body,width,height,background,extraDefs}`, discarding
  every root attribute except width/height/background;
  `assembleSvg` then routed it through the GENERIC `svgRoot` (used by
  every non-klimt engine), which emits only `xmlns width height viewBox`
  — no `xmlns:xlink`/`version`/`data-diagram-type`/`zoomAndPan`/
  `preserveAspectRatio`/`contentStyleType`/`<?plantuml?>` PI/`style` —
  plus an unconditional `ALL_ARROW_TYPES` marker-def injection the
  description engine never needs (inline polygon arrowheads, never SVG
  `<marker>` refs) and an explicit background `<rect>` (klimt bakes
  background into the root `style` attribute instead).
- Disposition: fixed. `RenderFragment` gains an additive
  `klimtShell?: true` marker (`core/dispatcher.ts`), set unconditionally
  by `unwrapKlimtSvg` (every one of its call sites is already
  annotated-klimt-only, per that function's own doc comment). A new
  `assembleKlimtShell` (`diagrams/description/renderer.ts`, co-located
  with `unwrapKlimtSvg` and the `DIAGRAM_TYPE_ATTR`/`VERSION_PLACEHOLDER`
  constants) reproduces klimt's exact fixed-constant shell + a
  `finalizeRootAttributes`-matching `style`/width/height/viewBox recipe,
  with no marker-def injection and no background `<rect>`. `assembleSvg`
  (`src/index.ts`) gains one branch: `fragment.klimtShell === true` ->
  `assembleKlimtShell(fragment)` instead of `svgRoot(...)` — `svgRoot`
  itself and every other engine's assembly path are untouched (no other
  `RenderFragment` producer ever sets the flag). All 6 targeted checks
  (`svg/@version @preserveAspectRatio @zoomAndPan @xmlns:xlink
  @contentStyleType`, plus `svg/@background` as a bonus) are now ZERO
  across all 18 fixtures + `usecase/vivido-49-nisu863` (formerly an I0
  parse error, now resolved by this same mechanism and folded into the
  measurable census). `svg[childCount]` improved (4->3, dropping the
  spurious `<rect>`) but does not reach jar's exact 2 — see the
  decision-journal's "ruled out" for why the residual +1 (chrome's own
  `<g class=title>`-as-sibling vs jar's nested-in-the-content-`<g>`
  shape) is a SEPARATE, already-documented, prior-mission (G0b/T4)
  divergence in `core/annotations/chrome.ts`, deliberately left untouched
  here (shared code across every diagram type's chrome, out of I1's
  klimt-specific scope). Pinned by 2 new `unwrapKlimtSvg` tests + 8 new
  `assembleKlimtShell` tests in `renderer.test.ts`, plus a `dims()`
  helper fix in `annotations.e2e.test.ts` (tolerates the jar's own
  `px`-suffixed width/height, which the klimt-shell path now correctly
  reproduces).
- Slugs: component/bagoze-78-lada681, balopu-66-jagu236,
  gevaje-94-sajo802, josoxo-49-taci997, misube-65-seni576,
  saroje-26-vabi530, sugaca-11-boma467, tilexe-28-fiju280,
  tusugu-95-geju398, vajaxu-62-poto986, zosuje-43-zebi775,
  zozutu-82-pupa220, usecase/gigofe-94-zepe032, lizutu-99-mapa855,
  nipapu-74-roro938, pivudu-29-pele178, sprite-SVG-fill-management-3,
  tatori-66-kaci883, usecase/vivido-49-nisu863 (19 total)

### chrome's extra top-level `<g>` (title/legend as sibling, not nested) — deferred
- Mechanism: `core/annotations/chrome.ts#decorateEntityImage` wraps the
  "original" body in its OWN `<g transform="translate(...)">` and adds
  each active annotation slot as a SEPARATE sibling `<g class="title">`
  etc — 2 top-level `<g>` elements from chrome's own composition,
  regardless of how many annotation types are active (each subsequent
  chrome step nests the PREVIOUS composite as its new "original"). The
  jar instead nests title/legend directly inside the SAME single content
  `<g>` klimt's own diagram body uses (`<g><g class="title">...</g>
  <!--entity foo--><g class="entity">...</g>...</g>`, one top-level `<g>`
  total). This is a PRIOR, DOCUMENTED, deliberate mechanism-only DOM-shape
  divergence (chrome.ts's own doc comment, lines 26-33, mission G0b/T4) —
  not new to I1, and not klimt-specific: chrome.ts is shared by every
  diagram type's annotation rendering.
- Disposition: not fixed here — out of I1's scope (klimt-shell-only) and
  risks regressing other engines' annotated output if chrome.ts's shared
  nesting logic changed. Flagged as needs-signoff for a future iteration
  if the maintainer wants `svg[childCount]` fully closed for these 19
  fixtures (would require deciding how to compose chrome's title/legend
  markup INTO klimt's single content `<g>` rather than beside it, without
  touching non-description engines' own chrome shape).
- Slugs: same 19 as above (co-occurs with the fixed mechanism, residual
  after the fix).

