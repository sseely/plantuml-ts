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


## RESOLVED 2026-07-14: xusuxe-62 graphviz-ts crash
- graphviz-ts@0.1.26071415 fixes the labeled cross-cluster-boundary-edge crash;
  xusuxe renders a real 71KB diagram (image icons present), census errors 2->1
  (residual: fepuvo jar-side malformed golden), golden-pinned in
  oracle/goldens/description/. The si5b journal + state-dot-sync ledger rows
  are retired in the same commit.

## I2 — text style constants (font-size, font-weight, fill, font-family)

### cluster/group title never bold — FIXED
- Mechanism: `renderer-cluster.ts#buildHeader`'s title font carried no
  style flags; jar (`abel/Entity.java:478-489
  #getFontConfigurationForTitle` + `klimt/font/FontParam.java:167-172
  #getDefaultFontFace`) bolds EVERY group/container title via
  `FontParam.PACKAGE` + `inPackageTitle=true`, regardless of the
  container's own keyword.
- Disposition: fixed — `TITLE_STYLES = new Set([FontStyle.BOLD])` added
  to the cluster title font. Census: font-weight family 73->8 fixtures
  (149->12 diffs).
- Slugs: reach not separately tracked (73-fixture family fix, see
  decision-journal.md I2 for the 3 jar-verified sample slugs).

### stereotype text 2pt smaller + upright instead of same-size + italic — FIXED
- Mechanism: both `renderer-entity.ts` (leaf) and `renderer-cluster.ts`
  (container) used a local `theme.fontSize - 2` delta with no style
  flags for stereotype text; every reachable `klimt/font/FontParam.java`
  `*_STEREOTYPE` entry is the SAME size as its non-stereotype
  counterpart, italic only.
- Disposition: fixed — `renderer-symbol.ts#textFont` gained a `styles`
  param; both callers pass `STEREOTYPE_STYLES = new
  Set([FontStyle.ITALIC])`, sizeDelta 0. Census: font-size family
  72->16 fixtures (172->26 diffs, the "12->14" cluster closed);
  font-style (not one of I2's 4 named families, same origin) 38->3
  fixtures (102->3 diffs) as a direct side effect.
- Slugs: reach not separately tracked (94-of-172-diff cluster fix, see
  decision-journal.md I2).

### edge/link label font hardcoded to theme.fontSize-2 + edgeLabel gray — FIXED
- Mechanism: `renderer-edge.ts#buildInput`'s `labelFont` used the same
  `-2` delta plus `theme.colors.graph.edgeLabel` (`#444444`); jar's
  `FontParam.ARROW` is a FIXED size 13 (independent of theme.fontSize)
  with the jar's default black text color (`FontParamConstant.COLOR`),
  not the shared edgeLabel gray (which class/state/dot renderers use
  for a different, still-correct role there).
- Disposition: fixed — literal `ARROW_LABEL_FONT_SIZE = 13` constant +
  the (now-exported) `JAR_DEFAULT_TEXT_COLOR` from `renderer-symbol.ts`.
  `theme.ts`'s shared `edgeLabel` field itself untouched (out of
  scope — used by class/state/dot, DOT gate frozen throughout). Census:
  font-size "12->13" cluster (53/172 diffs) closed; fill "#444444-
  >#000000" cluster (44/114 diffs) closed.
- Slugs: reach not separately tracked (see decision-journal.md I2 for
  the jar-verified sample slug, component/babafi-51-dixi026).

### cluster text: color override wiring gap — NOT FIXED, needs-signoff
- Mechanism: `renderer-cluster.ts#buildHeader` never applies
  `node.color`'s `text:` inline override to the title/stereo font,
  unlike `renderer-entity.ts#buildEntityParams` (leaf entities). Real
  and independently diagnosable (`component/bisedo-29-kone620`'s 9
  container stereotypes/titles show `fill="#000000"` — the jar
  default — not even the raw unresolved override value), but wiring it
  alone would NOT reach zero-diff for any of those 9 fixtures without
  also fixing the named-color-resolution gap below (their overrides
  use named colors, e.g. `text:blue`), so left unfixed rather than
  half-fixed this iteration.
- Disposition: not fixed here — needs-signoff alongside the named-color
  table below (same fixtures depend on both).
- Slugs: component/bisedo-29-kone620 (9 of its `fill` diffs); reach
  beyond this one fixture not surveyed.

### named CSS color → hex resolution — NOT FIXED, deferred (pre-existing gap, T19)
- Mechanism: this port has no `HColorSet` name→hex table (`src/core/
  paint.ts` grep-verified — no such table anywhere in the codebase).
  Named colors (`green`, `blue`, `red`, `yellow`, …) pass through
  verbatim instead of resolving to the jar's uppercase hex
  (`green`→`#008000`, `blue`→`#0000FF`, …); case is also not
  normalized (`#ffffff`→jar's `#FFFFFF`). This is a PRE-EXISTING,
  already-documented gap from an earlier task (T19) —
  `tests/unit/description/renderer.test.ts:505-509`'s own doc comment
  already states it explicitly, not a new I2 finding.
- Disposition: not fixed here — a full ~150-name CSS/PlantUML color
  table (`HColorSet.java`'s real name table) is a distinct, larger
  mechanism than a "constant/default" fix, out of this iteration's
  scope. Accounts for the majority (~63 of 114) of the still-open
  `text/@fill` diffs after I2's edge-label fix.
- Slugs: reach not surveyed this iteration (pre-existing, T19-flagged
  gap); sample slugs observed: component/bisedo-29-kone620 (green/
  blue), and the general `text:<namedcolor>` override pattern across
  the corpus.

### per-diagram-type ArrowFont* skinparam family — NOT FIXED, unbuilt feature
- Mechanism: `component/figika-36-sola271` exercises `skinparam
  ComponentArrowFontColor/FontName/FontStyle/FontSize`; grep-verified,
  no `ArrowFont*` skinparam has any wiring in `skinparam.ts`/`theme.ts`
  at all. Not a default-value bug — an entirely unbuilt skinparam
  family.
- Disposition: not fixed here — a distinct, unbuilt feature (per-
  diagram-type/per-element font skinparam overrides), out of a
  "text style constants" iteration's scope.
- Slugs: component/figika-36-sola271.

## I3 — element @id conventions (g/@id, path/@id)

### mechanism A: missing SvekEdge#setSharedIds wiring — FIXED
- Mechanism: `renderer.ts#drawEdges` never created/passed a per-diagram
  shared `Set<string>` to `SvekEdge` instances (upstream: one
  `Set<String> ids` per `SvekResult#drawU` call, `SvekResult.java:93-101`,
  wired via `setSharedIds` before each edge's own `drawU`). `SvekEdge.ts`'s
  own `uniq()` port (SvekEdge.java:1093) was already byte-faithful and
  unit-tested when wired manually — only the caller never wired it, so
  duplicate `idCommentForSvg()` strings across a diagram's edges never got
  the jar's `-1`/`-2` disambiguation suffix.
- Disposition: fixed — `drawEdge` (renderer-edge.ts) gained a `sharedIds`
  param; `drawEdges` (renderer.ts) creates one `Set<string>` per diagram
  and threads it through. Pinned by a new `renderer.test.ts` case
  (two same-endpoint edges -> `id="n1-to-n2"` + `id="n1-to-n2-1"`).
- Slugs: reach not separately tracked (part of the combined 10->1 fixture
  `path/@id` family reduction — see decision-journal.md I3).

### mechanism B: buildInput's headDecor fallback fired even with a real tailDecor — FIXED
- Mechanism: `renderer-edge.ts#buildInput` applied
  `fallbackHeadToken(edge.arrowHead)` whenever `edge.headDecor` was
  undefined, regardless of whether `edge.tailDecor` already carried the
  link's real (single-sided) decor — `edge.arrowHead` is a side-blind
  aggregate classification, not "which side had the decor". For any
  tail-only-decorated link this synthesized a PHANTOM head decor,
  flipping `looksLikeRevertedForSvg`/`looksLikeNoDecorAtAllSvg`
  (link-decor.ts, itself correct) into the wrong branch AND drawing an
  extra jar-absent arrowhead polygon (`g[childCount]` mismatch).
- Disposition: fixed — the fallback now only fires when
  `edge.tailDecor === undefined` too. Pinned by a new `renderer.test.ts`
  case (tail-only decor -> `id="n1-backto-n2"`, not bare `n1-n2`).
- Slugs: reach not separately tracked; jar-verified sample
  component/berelu-46-namo819, component/cegale-42-loxa672 (childCount
  side effect).

### mechanism D: LEFT/UP inversion swapped raw decor tokens without mirroring vocabulary — FIXED
- Mechanism: `link-grammar.ts#resolveDecorPair` (LEFT/UP direction
  inversion) swapped `head1`/`head2` raw token STRINGS verbatim between
  the tail/head slots. Upstream inverts via `Link#getInv()` ->
  `LinkType#getInversed()` (`decoration/LinkType.java:131-132,145-147`),
  which swaps the ALREADY-RESOLVED `decor1`/`decor2` `LinkDecor` enum
  fields — an abstract "which side" relabel needing no character
  translation. This port carries the RAW TOKEN through to `SvekEdge` for
  lookup there (by design), so moving e.g. `'>'` (a DECORS2/head-only
  spelling) verbatim into the `tailDecor` slot is a guaranteed
  `lookupDecors1` miss (DECORS1 uses `'<'` for the same ARROW decor) —
  silently dropping the decor for EVERY LEFT/UP-directed decorated link.
- Disposition: fixed — `TAIL_TO_HEAD_TOKEN`/`HEAD_TO_TAIL_TOKEN` mirror
  maps built from the file's own pre-existing, positionally-parallel
  `DECORS1_TOKENS`/`DECORS2_TOKENS` arrays; `resolveDecorPair` now
  translates through them on inversion instead of relabeling verbatim.
  Pinned by 3 new `parser.test.ts` cases (LG-5b/5c/5d), jar-verified
  against component/berelu-46-namo819 (`A -up-> B`) and
  component/golati-24-xika861 (`Component -LEFT-> Participant10<<v1.0>>`).
- Slugs: reach not separately tracked (every LEFT/UP-directed decorated
  link in the corpus); jar-verified samples as above.

### mechanism C: ent%04d/lnkN uid ordering — NOT FIXED, pre-existing/deferred (T17)
- Mechanism: confirmed (not rediscovered) as the SAME gap `renderer-uid
  .ts`'s own module doc comment already names — `buildUidPlan`
  approximates upstream's true parse-time INTERLEAVED (one shared
  `AtomicInteger`, entity-then-link-then-entity in declaration order)
  creation-time uid assignment with a two-phase "all nodes pre-order,
  then all edges" walk. Classified 84 post-fix id-bearing fixtures: 81
  have EVERY `@id` diff shaped as `ent####<->ent####` or
  `lnk#<->lnk#` (pure renumbering, order-only); the 1 non-pure
  `path/@id` exception (`usecase/xacaxe-43-bupe002`) is mechanism A's
  dedup operating CORRECTLY on the wrong (C-shifted) edge-draw order — a
  downstream symptom of C, not a new mechanism; `defs/linearGradient/@id`
  (1 fixture) is an unrelated family, out of `g/@id`/`path/@id` scope.
- Disposition: not fixed here — a proper fix requires restoring true
  parse-time interleaved entity/link creation order (an AST-level
  architecture change tracking one shared creation sequence, not two
  separate node/edge lists), out of this iteration's reach. Deferred
  exactly as T17 already recorded it — this iteration only confirms it
  is the dominant remaining driver (81/83 unchanged `g/@id`-family
  fixtures) and rules out any additional new mechanism hiding behind it.
- Slugs: the 81-of-83 `g/@id`-family fixtures unaffected by A/B/D (reach
  not individually enumerated — see decision-journal.md I3's classifier
  methodology); sample: component/babafi-51-dixi026,
  component/bijoko-90-riro507, usecase/xacaxe-43-bupe002.

### ratchet-parity backfill gap (I2-flagged) — PARTIALLY CLOSED, 3 remain
- Mechanism: `parity.json` (2026-07-10) predates this mission and is
  stale for 3 candidate fixtures (`usecase/norebe-58-bixu182`,
  `sidame-35-cozu078`, `zoriso-46-vata931`) — it records `dotEqual:
  false` for all three despite usecase's CURRENT `dot-sync-report.ts
  --equal-list` showing 90/90 (100%) EQUAL, confirmed by direct slug
  lookup in the live equal-list file. The ratchet's own eligibility test
  (`description.golden.ratchet.test.ts`) gates strictly on the
  `parity.json` field as written, not live re-derivation, and correctly
  FAILED when these 3 were force-added.
- Disposition: partially fixed — 4 of the 7 census-zero-diff/ratchet-gap
  fixtures had a clean (non-stale) `dotEqual:true` entry and were
  backfilled (component/cifaki-66-boxa005, component/jesibe-85-sozu187,
  component/vapalu-27-muxa300, usecase/dipixi-71-nuga611). The remaining
  3 need `parity.json` regenerated (full `svg-parity-survey.ts` corpus
  run) before they can be added — out of this iteration's write-set, not
  run inline. Gap: 7 -> 3 (not silently widened, not silently closed
  past what the ratchet's own gate accepts).
- Slugs: usecase/norebe-58-bixu182, usecase/sidame-35-cozu078,
  usecase/zoriso-46-vata931.

## I4 — text/@textLength value derivation

### number-formatting rounding: HALF_UP-on-binary-value vs HALF_UP-on-shortest-decimal — FIXED
- Mechanism: `format()` (`src/core/klimt/drawing/svg/svg-graphics-core.ts`)
  rounded via JS `x.toFixed(4)`, which rounds a double's TRUE (long)
  binary expansion. Java's `%.4f` (`java.util.Formatter`/
  `FloatingDecimal`) instead rounds the value's SHORTEST ROUND-TRIP
  DECIMAL STRING — the same class of representation `Double.toString`
  produces. For a value whose shortest decimal sits exactly on a
  4th-decimal-place boundary but whose true binary double sits a hair
  below it (e.g. `10.7 * 0.8125` — JS literal `8.69375`, exact double
  `8.6937499999999996447...`), `toFixed(4)` rounds DOWN ("8.6937")
  while Java's `%.4f` rounds UP ("8.6938"): a systematic last-decimal-
  digit divergence. Affects every numeric SVG attribute `format()`
  emits, but only SURFACES as a visible diff for `textLength` (no
  tolerance/`NUMERIC_ATTRS` entry in `compare.ts` — exact-string
  compared); every tolerance-compared attribute (x/y/cx/cy/width/
  height/rx/ry, `d`/`points` numeric args) absorbs the 0.0001
  divergence well within its 0.01 tolerance band.
- Disposition: fixed — new `javaFixed4(x)` helper (`svg-graphics-
  core.ts`) rounds the value's shortest round-trip decimal (via JS's
  own `Number.prototype.toString()`, the same "shortest, correctly-
  rounded round-trip" algorithm class `Double.toString` uses) HALF_UP
  to 4 fractional digits via `BigInt` digit-string arithmetic; `format()`
  calls `trimTrailingZeros(javaFixed4(x))` instead of
  `trimTrailingZeros(x.toFixed(4))`. Pinned by 1 new
  `svg-graphics.test.ts` case (jar-verified against
  `component/luniju-97-tuja870`'s `text/@textLength="8.6938"`, TDD
  red-before-fix). Census: `text/@textLength` family 33 fixtures/55
  diffs -> 32/52 (2 fixtures' rounding-only diffs closed; neither
  reaches zero-diff overall — both carry separate, out-of-scope
  residuals, see decision-journal.md I4).
- Slugs: component/luniju-97-tuja870, usecase/xacaxe-43-bupe002 (the 2
  fixtures where this was the ISOLATED mechanism on a given `<text>`
  element; the same rounding fix applies wherever a jar value happens
  to sit on the same binary/decimal boundary, corpus-wide, but only
  these 2 fixtures exposed a diff from it in the current census).

### per-element-type FontSize skinparam/style override unwired for entity/cluster/stereotype text — NOT FIXED, needs-signoff
- Mechanism: `renderer-symbol.ts#textFont` computes
  `size: theme.fontSize + sizeDelta` — a single global constant (or
  I2's fixed per-role delta) — with no per-SNAME or per-style-selector
  font-size lookup. `resolveSkinparam` maps only a bare, diagram-wide
  `fontsize`/`defaultfontsize` key; the existing D4 per-element-type
  override bucket (`ELEMENT_BUCKET_SNAMES`/`matchElementColorKey`)
  covers only `backgroundcolor`/`bordercolor`/`fontcolor` for a
  7-SNAME allowlist (`database, component, node, actor, usecase,
  artifact, rectangle`) — no `fontsize` suffix, no `<style> <sname> {
  FontSize N }` selector routing, and no `StereotypeFontSize`/
  `<style>stereotype{}` routing at all. Jar-verified across 9 sampled
  fixtures, all matching a `ratio == jarFontSize/14` signature
  (proving font-SIZE is the defect, not textLength math):
  `component/kuciku-99-tedu217`, `mavicu-17-mago821`, `loroto-06-
  fano471` (+ its per-stereotype `<<bar>>` override diverging in the
  OPPOSITE ratio direction from `<<foo>>` in the SAME fixture — rules
  out a single constant-offset explanation), `toxine-81-xofo986`,
  `cukafa-49-fona812` (`componentFontSize`/`interfaceFontSize`),
  `fasave-91-jaka816`, `zonobi-55-zuna105` (`<style>` block per-type
  FontSize), `xagino-11-vazo768` (`skinparam package{FontSize}`),
  `revusu-28-pexi248` (`<style>actor{FontSize}`). Adjacent finding:
  `collections`/`database`/`label`/`package`/`interface`/`actor` are
  ALSO missing from `ELEMENT_BUCKET_SNAMES`, so `fasave-91-jaka816`'s
  `collections`/`database` labels get neither the FontSize NOR the
  FontColor override at all (a second, pre-existing gap in the same
  allowlist).
- Disposition: not fixed here — reach (9+ of 33 in-family fixtures,
  ~27%, likely wider corpus-wide) and shape (skinparam per-SNAME
  routing + style-block per-selector routing + a separate stereotype-
  specific variant of both + the adjacent SNAME-allowlist gap) make
  this a multi-file wiring/feature mechanism, not a targeted bug — same
  class of call as I2's deferred "per-diagram-type ArrowFont* skinparam
  family" (ledger.md I2). Needs-signoff for its own future iteration:
  extend the D4 `ElementColors`-style bucket with a parallel numeric
  `fontSize` field + widen `ELEMENT_BUCKET_SNAMES`; route stereotype
  FontSize separately (stereotype text uses `STEREOTYPE_STYLES`, not a
  per-SNAME bucket, today).
- Slugs: component/kuciku-99-tedu217, mavicu-17-mago821,
  loroto-06-fano471, toxine-81-xofo986, cukafa-49-fona812,
  fasave-91-jaka816, zonobi-55-zuna105, xagino-11-vazo768,
  revusu-28-pexi248 (9 jar-verified samples; reach beyond these not
  exhaustively surveyed).

### scale N directive entirely unimplemented for description diagrams — ruled out, not I4-scope
- Mechanism: `component/saveje-35-vumu271` (`scale 2`) and
  `component/berome-43-xini276` (`scale 10`, clamped to an effective
  x4 — clamp mechanism not investigated) show EVERY coordinate,
  dimension, AND font-size uniformly multiplied on the jar side while
  ours stays at scale=1 (e.g. saveje: `svg/@width 81->184`,
  `text/@font-size 14->28`, `rect/@stroke-width 1->2`) — grep-verified
  zero wiring anywhere in `src/diagrams/description`, `src/core/klimt`,
  or `SvgOption.ts` for the top-level `scale N` preprocessor directive.
- Disposition: not fixed here — a whole missing top-level directive
  affecting every drawn primitive, not a text-measurement/derivation
  bug; out of I4's `text/@textLength`-family scope entirely. Flagged
  for a future iteration/mission (feature, not this family's mechanism).
- Slugs: component/saveje-35-vumu271, component/berome-43-xini276.

### creole/entity-naming text-content bugs (textLength correctly derived for the WRONG string) — ruled out, not I4-scope
- Mechanism: several independent, unrelated parser/creole gaps produce
  a DIFFERENT rendered string than the jar measures, so the resulting
  textLength mismatch is a downstream symptom of wrong TEXT CONTENT,
  not wrong derivation: unresolved `<U+00B5>`/`<U+1F601>` HTML-unicode-
  escape placeholders left literal instead of resolving to `µ`/`😁`
  (`component/junoxu-15-gori632`, `lurupu-11-fubo915`); retained
  literal quote characters around a display name the jar strips
  (`component/xenusu-76-sabi405`, `xusuxe-62-guba767`); retained
  literal `==` creole-heading markers (`usecase/mutere-78-geko363`);
  retained literal `:actor:`-style colon wrapping (`usecase/
  fotisa-06-xipe681`, `saduja-80-goba120`); a literal two-character
  `\n` escape not converted to a real newline (`usecase/
  nenedo-78-fiva569`); multi-line note content collapsed to a single
  unrelated character (`component/gafico-37-cuma657`, `nujito-06-
  neca370` — a much deeper note-rendering gap).
- Disposition: not fixed here — each is its own distinct parser/creole
  mechanism, none is "textLength value derivation" under any
  reasonable reading of I4's charter. Flagged for future iterations
  (likely several, one per sub-mechanism) — not investigated further.
- Slugs: component/junoxu-15-gori632, lurupu-11-fubo915,
  xenusu-76-sabi405, xusuxe-62-guba767, gafico-37-cuma657,
  nujito-06-neca370, usecase/mutere-78-geko363, fotisa-06-xipe681,
  saduja-80-goba120, nenedo-78-fiva569.

### already-ledgered draw-order/parser-rule residuals re-confirmed — no new mechanism
- Mechanism: `usecase/dopova-50-digo290` ("Use"<->"Start") is I3b's
  ledgered paren-shorthand-usecase missing-parser-rule gap
  (decision-journal.md I3b "Ruled out", same slug, independently
  re-derived here as a cross-check, not re-diagnosed).
  `usecase/gogamo-72-pibo470` and `usecase/xacaxe-43-bupe002`'s
  off-by-one entity/edge-label position swaps are I3/I3b's ledgered
  residual node/edge draw-order gaps (I3's "mechanism C" / the
  edge-draw-order note on xacaxe specifically) — xacaxe's "cancel"/
  "switch()" pairs (the rounding mechanism above) coexist in the SAME
  fixture as this SEPARATE, already-ledgered ordering residual on its
  OTHER labels.
- Disposition: not fixed here — already ledgered under I3/I3b, no new
  mechanism found, no action needed beyond this cross-check note.
- Slugs: usecase/dopova-50-digo290, usecase/gogamo-72-pibo470,
  usecase/xacaxe-43-bupe002 (structural-residual portion only).

## I4b — per-element FontSize/StereotypeFontSize skinparam + <style> wiring

### FontSize/StereotypeFontSize routing was entirely unwired for 24 of 25
### reachable SNames — FIXED
- Mechanism: `renderer-symbol.ts#textFont` computed `size: theme.fontSize +
  sizeDelta` unconditionally; upstream resolves entity title/stereotype
  font size through three separate `StyleSignatureBasic` queries per
  `EntityImageDescription.java:172-174` (title / body / stereotype), fed by
  a merged style sheet built from `<style>` blocks AND every skinparam key
  translated via `FromSkinparamToStyle.java`'s `addMagic(sname)` (registers
  both `<sname>FontSize` and `<sname>StereotypeFontSize` as independent
  style rules — no bare, sname-less `StereotypeFontSize` exists upstream).
  `addMagic` covers 24 SNames reachable from component/usecase diagrams;
  this port's `ELEMENT_BUCKET_SNAMES` (the shared skinparam+style-block
  routing allowlist) had only 7. Jar-verified against 9 sampled fixtures
  (see decision-journal.md I4b for full per-fixture syntax + Java
  citations): `component/kuciku-99-tedu217`, `mavicu-17-mago821`,
  `cukafa-49-fona812`, `fasave-91-jaka816`, `zonobi-55-zuna105`,
  `xagino-11-vazo768`, `revusu-28-pexi248` (7 of 9 — the remaining 2,
  `loroto-06-fano471`/`toxine-81-xofo986`, need the deferred
  per-stereotype-NAME sub-mechanism below).
- Disposition: fixed — `ElementColors` (`theme.ts`) gains additive
  `fontSize`/`stereotypeFontSize` fields + `resolveElementFontSize` (cascade
  helper, stereotype falls back to plain fontSize, CSS-cascade-consistent
  with upstream's style-merge architecture — not independently jar-verified
  against a fixture combining both on one element, no I4 sample does).
  `ELEMENT_BUCKET_SNAMES` widened 7 -> 25 (the 24-SName `addMagic` set
  restricted to `descriptive-keywords.ts`'s USymbol union, plus `label` for
  a style-block-only reason — see decision-journal.md I4b). `skinparam.ts`
  gains `matchElementFontSizeKey` (mirrors `matchElementColorKey`) wired
  into `resolveSkinparam`'s default branch. `style-map-element.ts
  #collectElementStyleBuckets` gains a `fontsize` prop read plus a new
  `<sname>.stereotype` selector-suffix branch. `renderer-symbol.ts#textFont`
  gains a `role: 'title'|'stereotype'` param; both renderers' stereotype
  call sites pass `role: 'stereotype'`. 19 new pinning tests across
  `skinparam.test.ts`, `style-map-element.test.ts`, `theme.test.ts`,
  `description/renderer.test.ts`. Census: `text/@font-size` 16->8 fixtures
  (26->11 diffs); `text/@textLength` 32->24 fixtures (52->37 diffs, a bonus
  closure — correct font-size fixes several entities' character-width
  measurement). Conformant held at 14/355 (same exact set) — every affected
  fixture also carries an out-of-scope geometry/color/creole gap.
- Slugs: component/kuciku-99-tedu217, mavicu-17-mago821, cukafa-49-fona812,
  fasave-91-jaka816, zonobi-55-zuna105, xagino-11-vazo768,
  revusu-28-pexi248 (7 jar-verified fixed samples); reach beyond these 9
  sampled fixtures not exhaustively surveyed (font-size skinparams are
  common corpus-wide).

### per-stereotype-NAME sub-override (`StereotypeFontSize<<bar>> N` /
### nested `.bar { FontSize N }`) — NOT FIXED, needs-signoff
- Mechanism: upstream checks a stereotype-LABEL-qualified key
  (`getFirstValueNonNullWithSuffix("fontsize" + stereotype.getLabel(...),
  param)`) before the plain sname key. This port's preprocessor
  `RE_SKINPARAM_BLOCK_ENTRY` (`preprocessor.ts:54`, `/^\s*(\w+)\s+(.+)$/`)
  cannot match `StereotypeFontSize<<bar>> 10` at all — `\w+` cannot cross
  the `<` characters and there is no whitespace before `<<bar>>` — the
  line is silently dropped before `resolveSkinparam` ever sees it.
  Separately, `resolveSkinparam`'s existing `rawKey.includes('<<')` guard
  (`skinparam.ts:180-183`) blanket-rejects every stereotype-qualified key
  as `unknown` even if the preprocessor did forward it. The `<style>`
  equivalent (`.bar { FontSize 10 }` nested inside `stereotype {}`)
  technically already parses via `parseStyleBlock`'s pre-existing dot-led
  selector branch into a selector path with a literal double-dot
  (`"<sname>.stereotype..bar"`, a pre-existing quirk, not introduced here)
  — `collectElementStyleBuckets`'s new `.stereotype`-suffix check does NOT
  match that path (correctly left unrouted rather than silently
  misrouted, since it ends in `..bar` not `.stereotype`).
- Disposition: not fixed here — requires (a) a preprocessor block-entry
  regex change to preserve `<<...>>` tokens, (b) `resolveSkinparam`'s
  blanket stereotype-key rejection to be narrowed to actually resolve
  per-stereotype-label overrides instead of discarding them, and (c) a
  THIRD selector-parsing tier in `collectElementStyleBuckets` for the
  double-dot `.bar` path — three separate, non-trivial changes across the
  preprocessor/skinparam/style-map layers, out of this iteration's
  "additive only" scope guard. Needs-signoff for its own iteration.
- Slugs: component/loroto-06-fano471, toxine-81-xofo986.

### 'note' FontSize/FontColor (`addConFont("note", SName.note)`) — ruled
### out, not evidenced this iteration
- Mechanism: upstream registers `noteFontSize`/`noteFontColor` via
  `addConFont`, a real but non-`addMagic` mechanism. `drawNoteFallback`
  (`renderer-entity.ts`) already uses a separate, non-`resolveElementPaint`
  background path (`theme.colors.noteBackground`/`.border` literals),
  so wiring note's font through the SAME `ELEMENT_BUCKET_SNAMES` allowlist
  as the 24 `addMagic` snames would mix two not-yet-unified mechanisms
  without a sampled fixture to verify against.
- Disposition: not fixed here — no I4/I4b sample fixture exercises it;
  deferred rather than guessed.
- Slugs: none sampled this iteration.

### 'circle'/'action'/'process'/actor-business/usecase-business SName
### mapping — ruled out, not investigated
- Mechanism: no confirmed upstream `SName` mapping traced for these five
  `descriptive-keywords.ts` USymbols; left out of the widened
  `ELEMENT_BUCKET_SNAMES` rather than guessed at.
- Disposition: not fixed here — no I4/I4b sample fixture exercises them.
- Slugs: none sampled this iteration.

## I4c — creole text-CONTENT bugs (textLength/x/y correctly derived for the
##      WRONG string), resuming I4's ruled-out list

### mechanism 1: `<U+XXXX>` unicode-codepoint / `&#NNN;` HTML numeric-entity
### escapes left literal instead of resolved — FIXED
- Mechanism: `AtomText.manageSpecialChars` (klimt/creole/legacy/
  AtomText.java:89-163) resolves `<U+[0-9a-fA-F]{4,5}>` and `&#[0-9]+;`
  inline, INSIDE a single text run (no atom-splitting), at draw time. This
  port had no equivalent — `node.display`/`node.stereotype` are drawn as
  raw strings (`renderer-entity.ts`, `renderer-cluster.ts`,
  `leaf-sizing.ts`), so `<U+00B5>Service` rendered literally instead of
  resolving to `µService`. Jar-verified on component/junoxu-15-gori632
  (TIM `!define MICRO(foo='') <U+00B5>` expands to a stereotype containing
  the raw escape) and the first two lines of usecase/lurupu-11-fubo915
  (`<U+1F601> <U+1F680> Implement the changes` / `this is &#8734; long` —
  both SIMPLE, no other creole markup).
- Disposition: fixed — `resolveTextEscapes` (parse-helpers.ts), a faithful
  single-pass char-scanner port of the two evidenced branches (the
  `~@start`/bare-`\t` branches are not ported — unreached by any I4c
  sample). Wired into `extractNodeStereotype`'s returned `stereotype` and,
  via `finalizeDisplay`, into every branch of `parseNameSection`'s
  `display`.
- Slugs: component/junoxu-15-gori632 (both stereotype occurrences),
  usecase/lurupu-11-fubo915 (lines 1-2 of 3 — line 3 mixes `<b>`/`<font
  Segoe UI Emoji>` creole markup with the same escapes and stays broken,
  see the E2-remainder entry below).

### mechanism 2: link-label quote retention when the WHOLE post-colon label
### is a single quoted string — FIXED
- Mechanism: `Labels.java#init` (descdiagram/command/Labels.java:78-103)
  tries three embedded-qualifier regexes (`"1"x"2"`, `"1"x`, `x"2"`) and,
  if NONE match, unconditionally falls through to `StringUtils
  .eventuallyRemoveStartingAndEndingDoubleQuote(labelLink, "\"")` (java:102,
  OUTSIDE the `firstLabel==null && secondLabel==null` guard that wraps the
  three branches — it runs regardless of whether those qualifiers were
  already set via a separate pre-arrow group). This port's
  `applyEmbeddedQualifiers` (link-grammar.ts) had the three branches but no
  fallback — a label that IS itself one whole quoted string (`: "stereotype
  bold"`) matches none of the three, so quotes were retained verbatim.
  Jar-verified on component/xenusu-76-sabi405 (`"stereotype bold"`,
  `"stereotype bluebold"`, `"line bluebold"`) and xusuxe-62-guba767
  (`"Edit Slides"`).
- Disposition: fixed — `applyEmbeddedQualifiers` restructured to mirror
  Java's exact control flow (the three branches inside the null-guard,
  falling through to an unconditional `stripOuterQuotes(raw)` after it,
  matching `eventuallyRemoveStartingAndEndingDoubleQuote`'s double-quote-
  only format, not the broader `stripFullWrap`).
- Slugs: component/xenusu-76-sabi405, xusuxe-62-guba767 (both fixtures
  carry SEPARATE, unrelated, unfixed content gaps too — xenusu's
  `#PRIMARY_COLOR`/`#BORDER_COLOR` named-skinparam-variable-in-color-token
  syntax is entirely unwired elsewhere in this port, out of I4c scope;
  xusuxe's DOGU_* TIM-macro-generated entity names have their own
  stereotype-formatting divergence, also out of scope).

### mechanism 3: colon/paren-wrapped DISPLAY before "as CODE" never
### stripped — FIXED
- Mechanism: `CommandCreateElementFull.executeArg:311`
  (`display = StringUtils.eventuallyRemoveStartingAndEndingDoubleQuote
  (display)`) runs UNCONDITIONALLY on the final `display`, regardless of
  which regex alternative (CODE2/CODE3/CODE4, i.e. `DISPLAY as CODE` OR
  `CODE as DISPLAY`) captured it. This port's `parseAliasForms`
  (parse-helpers.ts) has a pattern for `CODE as WRAPPED-DISPLAY`
  (`RE_ID_AS_WRAPPED`, cleans the display) but none for the REVERSE order
  `WRAPPED-DISPLAY as CODE` — that shape fell through to the generic
  `RE_PLAIN_ALIAS` ("ID as ID"), which cleans only the id side, leaving
  the wrapping delimiters (here, colons) in the display verbatim. Jar-
  verified on usecase/fotisa-06-xipe681 and saduja-80-goba120, both
  `actor :Alice: as user` → ours `:Alice:`, jar `Alice`.
- Disposition: fixed — new `finalizeDisplay` (parse-helpers.ts) applies
  `stripFullWrap` unconditionally to whichever `display` value
  `parseNameSection` produces (any branch), mirroring java:311 exactly;
  applied BEFORE the mechanism-1/newline-escape steps in the same
  function, matching upstream's temporal order (parse-time quote-strip
  first).
- Slugs: usecase/fotisa-06-xipe681, saduja-80-goba120.

### mechanism 4: literal two-character `\n`/`\r`/`\l` escape not converted
### to a real embedded newline — FIXED
- Mechanism: `Display.getWithNewlines` (klimt/creole/Display.java:259-343)
  is called on every entity's `display` immediately after the java:311
  quote-strip (java:321/324, unconditional, same call site) and converts a
  raw `\n`/`\r`/`\l` two-char escape into a real line break (suppressed
  inside a `[[...]]`/`<math>`/`<latex>` "raw mode" span). This port already
  splits `node.display` on REAL newlines at render time
  (`renderer-entity.ts:212`, `node.display.split('\n')`) but had no
  mechanism to CONVERT the literal escape into one first, so a display
  like `"==P4\na\nb\nc\nd\e"` rendered as one line containing literal
  backslash-n runs instead of five separate lines. Jar-verified on
  usecase/mutere-78-geko363 (`person "==P4\na\nb\nc\nd\e" as p4`, jar text
  set `{P4, a, b, c, d\e}` vs ours' single un-split string) and (as an
  incidental confirmation, not a new sample) usecase/vivido-49-nisu863's
  `"something\nclick the image:[[...]]"`, whose `\n` sits BEFORE the
  `[[...]]` span (outside raw mode) and is correctly split by the jar.
- Disposition: fixed — `resolveNewlineEscapes` (parse-helpers.ts), a
  faithful port of the reachable branch of `Display.getWithNewlines`
  (backslash-escape handling only; the `BLOCK_E1_*` internal-sentinel
  branches are unreachable from raw declaration text in this port and are
  not ported). `\r`/`\l`'s upstream natural-horizontal-alignment side
  effect is NOT wired (no per-entity-text-block alignment infra exists in
  this port, and no I4c sample exercises it) — only the newline-split
  itself is reproduced. Wired into `finalizeDisplay`, AFTER
  `stripFullWrap`, BEFORE `resolveTextEscapes` (mirrors upstream's
  parse-time-then-draw-time temporal order as closely as a single
  synchronous pipeline allows). Two pre-existing tests that had pinned the
  OLD (unconverted) behavior on fixtures that happen to contain a literal
  `\n` were corrected, not just extended (`tests/unit/description/parse-
  helpers.test.ts`'s vivido-49-nisu863 case, `tests/unit/description/
  parser.test.ts`'s `b\n====\ncan be used by a` container-open case) — see
  diagnosis.md ("fix the mechanism, update tests that pinned the old wrong
  behavior", same precedent as I3's `renderer.test.ts` correction.
- Slugs: usecase/mutere-78-geko363 (the `\n` portion only — the fixture's
  `==` heading markers are a SEPARATE, unfixed mechanism, see below).

### mechanism 5: `==` creole-heading marker retained as literal text —
### ruled out, blocked-on-E2-remainder
- Mechanism: `CreoleStripeSimpleParser` (klimt/creole/legacy/
  CreoleStripeSimpleParser.java:66-158) classifies EACH already-split
  display LINE via a cascade of patterns (`^==([^=]*)==$` section title,
  `^===*==$` separator, `^--([^-]*)--$` section header, `^(=+)(.+)$`
  heading) BEFORE the line is drawn — a heading line's LEADING `=+` run is
  stripped from the content (`this.line = m3.group(2)`) but ALSO drives a
  real style change (`fontConfigurationForHeading`: `order 1` → `bigger(2)
  .bold()`) applied to that one line's `FontConfiguration`, independent of
  the entity's own font. This port draws every display line with ONE
  uniform per-entity font (`renderer-entity.ts`/`renderer-cluster.ts`
  call `textFont(...)` once, not per split line) — there is no per-line
  font-styling seam to plug a content-only marker-strip into without either
  (a) a content-only partial fix that would leave `text/@font-size`/
  `@font-weight` wrong on that line (a real, but distinct and untracked,
  divergence this iteration doesn't introduce a mechanism for), or (b)
  building the per-line font-cascade infrastructure itself — genuinely the
  "full char-atom subsystem" this iteration's charter excludes. Jar-
  verified on usecase/mutere-78-geko363 (`"==P2"`, `"==P3 with a long
  name"`, `"==P4\n..."` — jar strips the `==` AND bolds+enlarges that
  line; not investigated further).
- Disposition: not fixed here — needs a per-line creole font-styling
  subsystem (StripeSimple-equivalent), out of I4c's narrow-text-content
  scope; needs-signoff for its own iteration (likely paired with `--`
  section-header and `..` dotted-line, the same cascade's siblings).
- Slugs: usecase/mutere-78-geko363 (P2/P3/P4 lines specifically — the
  fixture's OTHER content, `p1`/`usecase`/`foo`, is unaffected and
  already correct).

### mechanism 6: multi-line note / nested creole markup (`<b>`, `<font>`,
### `<color:>`, `<size:>`, `<u:>`, TIM `$var` string interpolation with
### embedded `<U+000A>`) collapsing to a single unrelated character — ruled
### out, blocked-on-E2-remainder
- Mechanism: component/gafico-37-cuma657 and nujito-06-neca370 both define
  a TIM string variable (`!$var=" aaa <U+000A> bbb <U+000A> <u:blue>ccc
  ..."` / the `\n`-escaped variant) then reference it inside a plain node
  display, a `[ ... ]` multi-line body, AND a `<code>...</code>`-wrapped
  body — each context requiring the FULL creole engine (nested inline
  tags, per-run color/underline/size overrides, `<U+000A>`-as-embedded-
  newline resolution INSIDE a TIM-interpolated string, `<code>` verbatim-
  block semantics) to reproduce even approximately; the jar's oracle
  splits this into many independently-styled/colored text runs this port
  has no atom model for at all. usecase/lurupu-11-fubo915's third line
  (`<b>this is also <U+221E> <font Segoe UI Emoji><U+1F680><U+263A></font>
  long`) and usecase/nenedo-78-fiva569's sprite-heavy `!procedure`-
  generated rectangles (`<color:red><$Batch></color>`, `==label`,
  `//<size:12>[...]</size>//` combined on one line) are the SAME class of
  gap — confirmed via the broader I4c corpus text-content-set scan (not
  just the originally-named suspects): dozens of additional fixtures
  (bold/italic/color/size/font/img/sprite/latex-tagged displays, word-
  wrapped long single-line text, embedded `[[url]]` splitting into
  separate atoms) show the identical signature and are the SAME root
  mechanism, not enumerated individually here.
- Disposition: not fixed here — requires the full char-atom/creole
  rendering subsystem (nested inline style runs, per-tag color/size
  overrides, TIM-string-then-creole interaction, `<code>` blocks, `[[...]]`
  atom-splitting, CommonMark-word-wrap). A narrow content-only patch is not
  possible without producing WRONG (differently-wrong) output. Genuinely
  blocked-on-E2-remainder; needs its own dedicated mission-scale effort,
  not an I4c iteration.
- Slugs: component/gafico-37-cuma657, nujito-06-neca370 (named suspects),
  plus usecase/lurupu-11-fubo915 (3rd line only — lines 1-2 fixed by
  mechanism 1 above), usecase/nenedo-78-fiva569 (named suspect, confirmed
  same class). Broader corpus reach (same mechanism, not individually
  diagnosed): component/{tuliba-37-liza126,turasu-73-zoni468,sunuju-01-
  pote718,vimulo-11-buni641,zarabi-01-koka785,zaraze-24-vixi421,zosaxo-93-
  nici652,zosuje-43-zebi775}, usecase/{bivira-53-boja685,camevo-41-suki094,
  cuzuci-92-dugi933,fariba-82-xolu802,fumitu-00-reji589,fuvosu-10-lixu251,
  jecici-56-bimu826,kafexo-72-xupa679,kijufe-84-colu239,kofuca-08-pafi749,
  kolibo-58-rata251,kovaxi-11-reti348,malumi-33-safu797,nixura-77-bina738,
  pecupa-75-zote612,ridola-99-jija391,seneso-72-cuje674,sotine-10-lore970,
  sumata-59-zavu229,tanuna-53-neko979,xixaca-96-nene831,zavitu-69-cemu013,
  zidebi-71-nocu387,zilisi-99-rate911,zotiru-33-legi180,funeme-74-tenu200}
  (word-wrap for long single-line text — a related but distinct sub-case
  of the same "no full creole atom model" root cause) and the already-
  separately-ledgered `<latex>` (sunuju-01-pote718, vimulo-11-buni641) /
  broken-image-decode-message (nobiza-91-fimo741, togeke-15-zala124) /
  named-CSS-color (I2) gaps, which overlap this reach but have their own
  entries elsewhere.

## I-scale — `skinparam handwritten true` unimplemented (ruled out, not fixed)
- Mechanism: `component/cumofi-94-lixe862` (`scale 3` + `skinparam
  handwritten true`) shows a root height/width/viewBox gap that is NOT a
  clean 3x-scale-ratio mismatch (747x195 vs jar's 795x255) plus a
  `svg/g[1][childCount]` mismatch (5 vs jar's 4) — both isolated to the
  note box the fixture draws, before any scale multiplication. Java:
  `UgDiagram#isHandwritten` (`TitledDiagram.java`) routes the whole
  `TextBlock` through `UGraphicHandwritten`
  (`klimt/drawing/hand/UGraphicHandwritten.java`), which redraws every
  shape with a jittered/hand-drawn stroke via a different geometry
  generator entirely (not merely a stroke-style flag) — a different
  drawing BACKEND, not a numeric attribute. This port has no
  `UGraphicHandwritten` (grep-verified: no `handwritten` hits anywhere
  under `src/core/klimt/`), so `skinparam handwritten true` is silently
  ignored (same disposition every other unwired skinparam key already
  gets) and the note box is measured/drawn with the ordinary straight-line
  geometry instead — a pre-existing, unrelated gap the scale fix's
  faithful factor computation cannot mask or repair (the factor itself is
  provably correct — see `berome-43-xini276` below).
- Disposition: not fixed here — a whole missing drawing backend
  (`UGraphicHandwritten`), out of I-scale's narrow parse+wiring scope;
  needs-signoff for its own iteration if the corpus reach ever justifies
  it (currently 1 known census fixture).
- Slugs: component/cumofi-94-lixe862.

## I-scale — `scale N width` residual on a `<latex>` fixture (ruled out, downstream of an already-ledgered gap)
- Mechanism: `component/vimulo-11-buni641` (`scale 1000 width`) shows a
  large root-dimension gap (113x1001 vs jar's 312x1272, not a clean ratio)
  plus `text[1]` actual="text" expected="image" — the SAME already-
  ledgered `<latex>...</latex>` gap I4c's mechanism 6 named this exact
  slug under (`ledger.md`'s I4c section: "the full creole/char-atom
  subsystem... `<latex>` tag... not fixed here"). Since our unscaled
  natural width never includes the real embedded LaTeX-image dimensions
  (we draw the raw tag text instead), `ScaleWidth`'s factor computation
  (`target / ourUnscaledWidth`) is mechanically correct but resolves
  against the WRONG unscaled width — a downstream symptom of the
  pre-existing latex gap, not a new I-scale defect. `resolveScaleFactor`
  itself is unit-tested directly (`tests/unit/scale-command.test.ts`) and
  is provably correct in isolation.
- Disposition: not fixed here — already covered by I4c's `<latex>` ledger
  entry; no new mechanism, no new slug added to that entry (already
  listed there).
- Slugs: component/vimulo-11-buni641 (cross-reference only — see I4c's
  ledger entry for the primary disposition).

## I-scale — small (~1px) interior residual on a `scale N height` + url-link fixture (not investigated further)
- Mechanism: `component/givape-84-xano421` (`scale 200 height`, plus `url
  of APP is [[http://tomcat.apache.org/]]`) reaches EXACT root
  width/height/viewBox parity (proving the `ScaleHeight` factor
  resolution itself is correct — the diff list contains zero
  `svg/@width`/`@height`/`@viewBox` entries) but carries 24 small (≤~6px
  post-scale, so ≤~1.5px pre-scale) interior offsets on the `actor`
  entity's ellipse/path/text geometry. Not diagnosed further this
  iteration (out of I-scale's charter — the scale MECHANISM is proven
  correct by the exact root-dimension match; this residual is some other,
  pre-existing small actor-geometry or url-wrapper gap). Ruled OUT as
  scale-related: a scale-factor bug would produce a proportionally large,
  uniform-ratio error across every coordinate (as seen pre-fix on every
  scale fixture), not an isolated ~1px offset on one entity while the
  root dims match exactly.
- Disposition: not fixed here — needs its own diagnosis.md pass to find
  the actual mechanism (candidate suspects, NOT verified: the `url of X
  is [[...]]` per-entity link wrapper, or ordinary actor-entity sizing
  drift already tracked by another iteration's family).
- Slugs: component/givape-84-xano421.

## I5 — `g[childCount]` structural family: sub-classification + drill

### Sub-classification table (pre-fix baseline: 187 distinct fixtures / 340
### childCount diff instances across `svg/g/g[childCount]` (99 fixtures/249
### diffs) + `svg/g[childCount]` (64 fixtures/64 diffs) + `svg[childCount]`
### residue). Built via a temporary classifier (`scripts/_tmp-i5-classify.ts`,
### deleted before finishing) that resolves each `[childCount]` diff's XPath
### back into both normalized trees and diffs their children's tag
### multisets. Nine named sub-families, in reach order:

| # | Sub-family | Reach | Missing/extra signature | Disposition |
|---|---|---|---|---|
| A | chrome sibling-`<g>` nesting | 18-19 | `svg[childCount]` extra `+1<g>` | already ledgered (I1 residual, prior-mission G0b/T4 decision) — excluded, re-verified unchanged |
| B | port fallback (`EntityImagePort`) never drew its label text | ~20 | `svg/g/g[childCount]` missing `+1<text>` | **drilled + fixed this iteration** (below) |
| C | entity/link multi-stereotype: only the FIRST `<<tag>>` renders | 12 | `svg/g/g[childCount]` missing `+1<text>`..`+8<text>` (mamase-39-buto560 alone: 6 separate diffs, `component 3..9 <<1>>..<<9>>`) | queued I5b |
| D | bracket-body `[Line1\nLine2]` literal `\n` unsplit | 2+ | `svg/g/g[childCount]` missing `+1<text>` (same signature as B/C, disambiguated by content read) | queued I5c |
| E | transparent/near-zero-alpha color draws instead of eliding | ~14 fixtures / 37 diff instances | `svg/g/g[childCount]` extra `+1<text>` (25) + `svg/g[childCount]` extra `+1<rect>` (12) | queued I5d |
| F | link-endpoint auto-create stereotype misdrawn as the link's own label | ~6 | `svg/g/g[childCount]` extra `+1<text>` on `class="link"` groups | queued I5e |
| G | lollipop/interface decor missing ellipse+path | 9 (5+4) | `svg/g/g[childCount]` missing ellipse+path pairs on `class="link"` | already ledgered (I-scale ledger) — excluded, re-verified unchanged |
| H | sprite/icon multi-path glyphs collapsed to fewer `<path>` | 9 diff instances / ~6 fixtures | `svg/g/g[childCount]` missing `+1<path>`/`+2<path>` on entity groups (bootstrap sprite icons) | queued I5f |
| I | content-level `<g>` wrapper count mismatch, unexplained | ~20 fixtures combined | `svg/g[childCount]`, both extra and missing, several `+N<g>` shapes | queued I5g |
| J | `<linearGradient>` def count mismatch | 4 | `svg/defs[childCount]` `+1`/`+4<linearGradient>` | queued I5h |
| K | nested-creole text-run splitting | 3 | `svg/g/g/text[childCount]` `+1<text()>` | already ledgered (I4c mechanism 6, blocked-on-E2-remainder) — excluded |
| L | already-ledgered creole/word-wrap corpus reach re-observed | ~8 | various (`xusuxe-62-guba767`, `usecase/{kijufe-84-colu239,nenedo-78-fiva569,tanuna-53-neko979}`, …) | already ledgered (I4c mechanism 6) — excluded, no new mechanism |
| M | one-off: `#red\|green;line.dashed;line:blue` multi-modifier color-spec token followed by a bracket body swallows literal text as the display | 1 (`component/balomu-94-kegi822`) | `svg/g/g[childCount]` extra `+1<text>` (raw unparsed tokens rendered as one line) | not queued (single-fixture reach) — noted for a future parser-gap sweep, not its own iteration |

Every sub-family's reach and signature above was jar-verified against 2-6
representative fixtures each (raw `.puml` source + jar-cached `in.svg`
diffed directly) before being placed in the table — none is a guess from
the tag-multiset signature alone.

### mechanism B: `EntityImagePort.drawU` never drew the port's label — FIXED
- Mechanism: `renderer-entity.ts#drawPortFallback` (pre-fix) drew only a
  filled square (`drawFallbackBox`), no text at all, and used
  `theme.colors.border` for BOTH fill and border (visibly wrong — jar's
  ports are light-filled with a dark border, `#F1F1F1`/`#181818`). Upstream
  `EntityImagePort.drawU` (svek/image/EntityImagePort.java:99-137) draws
  the entity's own display text (`getDesc()`, CENTER-aligned, from
  `leaf.getDisplay()`) FIRST — positioned above or below the fixed
  `RADIUS*2` (12×12) box per `upPosition()` (java:76-80: `true` when the
  port's graphviz-assigned top edge sits above its parent cluster's
  vertical center) — THEN the box itself, at `getUStroke()`'s FIXED 1.5
  thickness (java:139-141, independent of the regular-entity default 0.5
  and of any per-entity `line:`/`line.dashed` override, which upstream's
  `drawU` never reads for a port). Jar-verified byte-for-byte against
  `component/bijoko-90-riro507`'s three ports (`p1`/`p2`/`p3`: `<text>`
  then `<rect fill="#F1F1F1" ... stroke-width:1.5>`, text position
  flipping above/below per the up/down half of the `node` cluster each
  port sits in) and confirmed as the SAME mechanism across all 20
  port-bearing fixtures (`grep`-confirmed corpus scan for bare
  `port`/`portin`/`portout` keyword usage) — every one appears in either
  the `missing +1<text>` or a `svg/g[childCount] extra +1<rect>`/`+1<g>`
  childCount family (the latter two are DIFFERENT, unrelated sub-families
  — I/H above — that happen to co-occur on a couple of the same
  fixtures; not conflated with this mechanism).
- Disposition: fixed. `DescriptionNodeGeo.portLabelAbove?: boolean`
  (layout-helpers.ts, additive) is computed once by a new
  `layout.ts#applyPortLabelPositions`, called from `buildGeoNode`'s
  container branch right after `computeContainerBbox(children)` — the one
  point in the recursive geo-tree build where a port's own resolved `y`
  and its parent's just-computed bbox are both in scope together; mirrors
  `upPosition()`'s exact `node.getMinY() < clusterCenter.getY()` check.
  `renderer-entity.ts#drawPortFallback` rewritten to build the label via
  the ALREADY-EXISTING `EntityImageDescriptionSupport.ts#buildTextBlock`
  (no new text-construction code — same multi-line/atom-aware primitive
  every other entity type already uses), center it horizontally
  (`x = -(dimDesc.width - node.width) / 2`), position it above/below per
  `portLabelAbove`, draw it, THEN draw the box with fill/border resolved
  through `resolveElementPaint(theme, 'port', 'background'/'border')`
  (falls back to the shared `theme.colors.nodeBackground`/`.border`
  defaults, since `'port'` has no per-sname override in any sampled
  fixture — jar-verified `#F1F1F1`/`#181818`) and a new
  `PORT_STROKE_WIDTH = 1.5` constant, replacing the old
  `theme.colors.border`-for-both. TDD: one pre-existing test that pinned
  the OLD wrong fill (`renderer.test.ts`, "port renders a small box filled
  with theme.colors.border") corrected, not just extended, per
  diagnosis.md precedent (same judgment call as I3/I3b/I4c); 2 new
  `renderer.test.ts` cases (label drawn before the box in child order;
  label position flips per `portLabelAbove`) plus 2 new `layout.test.ts`
  cases (`portLabelAbove` matches the `upPosition()` formula exactly
  against real computed geometry; a non-port sibling never gets the field
  set). Re-measured: `svg/g/g[childCount]` family 99 fixtures/249 diffs ->
  89/214 (10 fixtures fully clear their childCount diff at this specific
  node; the rest of the 20 port-bearing fixtures still carry OTHER,
  out-of-scope diffs — x/y coordinate precision from this port's own
  graphviz-ts layout numbers differing from the jar's, not this
  mechanism). Census conformant HELD at 15/355 (expected — no port
  fixture was blocked ONLY by this). Full census bucket movement: 11-30
  56 (was 59), 31+ 157 (was 154) — a masking-artifact shift (I3's own
  documented pattern: fixing a structural mismatch lets `compareNodes`
  recurse further and unmask pre-existing, unrelated, already out-of-scope
  geometry diffs), not a regression — verified via the same zero-diff-set
  identity check I3/I3b/I4/I4b/I4c each used (15-fixture set unchanged).
  DOT gate re-verified frozen EXACT: component 262/262, usecase 90/90,
  class 708/708, object 78/80, state 267/267 (touched files are
  description-engine-only). Full suite: 309/309 files, 8339/8339 tests (4
  new: 2 renderer.test.ts + 2 layout.test.ts).
- Slugs: reach not individually enumerated beyond the corpus-scan count
  (20 fixtures grep-confirmed to use bare `port`/`portin`/`portout`);
  jar-verified sample: component/bijoko-90-riro507 (3 ports, up/middle/down
  split), component/cuxelu-66-zopu195, component/dugovi-24-kupu658,
  component/bujige-52-gase998.


## I5b — entity/link multi-stereotype

### mechanism A: entity multi-stereotype (component/usecase leaves + container titles) — FIXED
- Mechanism: `extractNodeStereotype` (parse-helpers.ts) consumed every
  consecutive `<<tag>>` token from the declaration remainder but returned
  only the FIRST tag's text. Jar (`Stereotype#getMultipleLabels()`,
  `EntityImageDescription.java:200-201`/`ClusterHeader.java:197-207`) draws
  one guillemet `<text>` line per tag; `buildStereo`
  (EntityImageDescriptionSupport.ts) was already multi-line-capable once
  fed an array — only `DescriptiveNode.stereotype: string` (single) and its
  callers blocked it.
- Disposition: fixed — `DescriptiveNode.stereotype` widened to `readonly
  string[]` (ast.ts), propagated through parse-helpers.ts/
  element-grammar.ts, `renderer-entity.ts`/`renderer-cluster.ts` draw N
  lines, `leaf-sizing.ts#measureBox`/`#measureUsecase` size for N lines
  (widest-tag width, `lineH * N` height). `measureUsecase` also gained an
  entirely NEW stereotype-footprint contribution (previously zero, even for
  a single tag — `EntityImageUseCase.java:96-109`'s `mergeTB`, unwired
  before this fix). `element-grammar.ts#removeMatching`'s `remove
  <<stereotype>>` node branch widened from exact-string match to
  `.includes(pattern)`, mirroring `HideOrShow#isApplyableStereotype`'s own
  multi-label loop (a free correctness fix required by the type change).
  10 new pinning tests (parser.test.ts, renderer.test.ts, layout.test.ts).
- Slugs: component/mamase-39-buto560 (9-tag stress fixture, childCount
  family fully closed), component/juvucu-92-bugo434 (2-tag leaves,
  childCount family fully closed), usecase/mopimi-10-jaco443 (partially —
  see mechanism D below, a co-occurring separate gap on the SAME fixture).

### mechanism B: auto-created link-endpoint stereotype misrouted to the link — ruled out, deferred to I5e (sequenced next)
- Mechanism: `Participant1011<<v1.0>><<v1.1>>` as a link's second entity
  token — the stereotype never even reaches the auto-created entity today
  (misrouted to the LINK's own `stereotype` field at parse time). Full
  mechanism diagnosed and fixed under I5e (below) — I5b's array-widening
  work is a prerequisite these fixtures consume once I5e's routing lands.
- Disposition: not fixed here — see I5e's ledger section.
- Slugs: component/golati-24-xika861, kokodo-61-dano461, koxeca-82-mese950,
  minulo-12-bare186, vaseda-71-suje167.

### mechanism C: archimate sprite-decorated stereotype — ruled out, unimplemented subsystem
- Mechanism: `<<$archimate/technology-function>>` (a stereotype whose
  decoration resolves a sprite) makes jar draw a `<path>` glyph INSTEAD of
  ANY guillemet text — `EntityImageDescription.java:190-198`: `if
  (stereotype.getSprite(skinParam) != null) stereo = sprite`, the sprite
  branch entirely replaces the label-text branch for every tag in the run,
  not just the sprite-bearing one. `EntityImageDescriptionSupport.ts
  #buildStereo`'s own doc comment already excludes this branch ("minus the
  sprite branch"). Jar-verified against component/turasu-73-zoni468's
  cached SVG (`<path>` where we draw `<text>`); co-occurring, unrelated
  `#TECHNOLOGY` custom-archimate-color-token resolution gap on the same
  fixtures (`rect/@fill actual="technology" expected="#C9FFC9"`).
- Disposition: not fixed here — a whole unimplemented archimate-icon-sprite
  subsystem, out of a text-metric iteration's scope; needs-signoff for its
  own iteration if the corpus reach justifies it.
- Slugs: component/lesori-32-zeve057, ravodu-50-siso430, tuliba-37-liza126,
  turasu-73-zoni468.

### mechanism D: `hide <<label>> stereotype` per-label visibility filter — ruled out, unbuilt command
- Mechanism: `usecase/mopimi-10-jaco443` combines multi-stereotype entities
  WITH `hide <<stereo1>> stereotype` / `hide <<stereo2>> stereotype` —
  PlantUML's PER-LABEL stereotype-visibility filter
  (`CucaDiagram#getVisibleStereotypeLabels`/`isStereotypeLabelShown`,
  net/atmp/CucaDiagram.java:574-590), which hides ONE named tag across
  every entity carrying it while leaving other tags visible — distinct
  from this port's existing whole-entity `hide <sname>`/`remove
  <<stereotype>>` commands. Entirely unbuilt (grep-verified: no
  `PortionShower`-equivalent filtering exists in this port's `hide`/`show`
  command handling). Jar-verified: our post-mechanism-A output over-draws
  relative to jar (all tags shown vs jar's filtered remainder), confirmed
  via the fixture's `svg/@width`/`@height` and `[childCount]` diffs.
- Disposition: not fixed here — a distinct, unbuilt command-grammar
  feature (per-label stereotype hide/show), out of I5b's multi-line-
  rendering charter; needs-signoff for its own iteration.
- Slugs: usecase/mopimi-10-jaco443.

## I5c — bracket-body `[Line1\nLine2]` literal `\n` unsplit

### mechanism: bracket-shorthand declaration path never called finalizeDisplay — FIXED
- Mechanism: `command-table.ts` rule 10 (`^\[([^\]]+)\](.*)?$`) feeds
  `parseBracketDeclaration`'s `decl.id`/`decl.display` straight into
  `makeNode` with no `cleanId`/`finalizeDisplay` wrapping anywhere on the
  path — unlike every `parseNameSection` branch, which routes through
  `finalizeDisplay` (I4c's `resolveTextEscapes`+`resolveNewlineEscapes`+
  `stripFullWrap` pipeline). `Display.getWithNewlines`
  (klimt/creole/Display.java:259-343, unconditional on every entity's
  display, java:321/324) never reached this path, so `[Component\nABC]`'s
  literal 2-char `\n` stayed literal instead of becoming a real newline.
- Disposition: fixed — `finalizeDisplay` (parse-helpers.ts) exported (pure
  visibility change, no new logic); `parseBracketDeclaration`'s single
  return wraps `id` in `cleanId(id)` and the bracket body in
  `finalizeDisplay(bracketName)`. 2 new pinning tests. Census: both named
  fixtures reach exact zero-diff on the childCount family; a THIRD,
  previously-unnamed fixture with the identical shape
  (`component/zarabi-01-koka785`) reaches FULL zero-diff and is ratchet-
  backfilled. Residual diffs on saxosu/seguci are a pre-existing, already-
  I2-ledgered `skinparam DefaultFontName`/`<style>root{FontName}` quoting-
  convention gap (double-vs-single-quote / entirely-unresolved font list)
  cascading into y-offset diffs via different font metrics, PLUS a
  masking-artifact reveal of a NEW component-container-cluster default-
  border-style gap (see below).
- Slugs: component/saxosu-09-nodi002, seguci-13-zure968,
  zarabi-01-koka785 (bonus, ratchet-backfilled).

### component-container-cluster default border/stroke gap — NOT FIXED, needs-signoff (newly observed)
- Mechanism: `renderer-cluster.ts#buildStyleDefaults` applies ONE
  hardcoded package-style default (`#999999`-ish stroke, `CLUSTER_STROKE_
  WIDTH=1.5`, no `rx`/`ry` rounding) to EVERY container regardless of its
  actual USymbol type. Jar draws a `component`-type container's border at
  `#181818`/`stroke-width:1`/`rx="2.5" ry="2.5"` (matching the leaf-entity
  default, not the package/frame default this port's `buildCluster` always
  applies). Jar-verified against component/saxosu-09-nodi002,
  seguci-13-zure968 (both `frame "Frame" { card Card }`) and
  component/catari-10-xiza828 (nested `component X { component Y {...} }`)
  — unmasked as a downstream reveal by BOTH I5c's and I5d's own fixes
  (childCount closures let `compareNodes` recurse into the cluster rect's
  attributes).
- Disposition: not fixed here — real, but a distinct, not-previously-
  observed default-styling mechanism unrelated to newline resolution or
  transparency; needs its own diagnosis.md pass (candidate: `buildCluster`
  needs a per-USymbol style-default table instead of one hardcoded
  package-style constant). Cross-referenced from I5d's ledger section too
  (same mechanism, same first-observation point).
- Slugs: component/saxosu-09-nodi002, seguci-13-zure968,
  catari-10-xiza828 (jar-verified samples; reach beyond these not
  exhaustively surveyed — any `frame`/`node`/`component`-as-container
  fixture likely shares this gap).

## I5d — transparent/near-zero-alpha color elision

### mechanism: raw color strings never canonicalized before the transparent-exclusion checks — FIXED
- Mechanism: jar's `HColorSimple#isTransparent()` (`getAlpha()==0`, EXACT,
  not fuzzy) drives TWO independent draw guards: `DriverTextSvg#draw`
  (klimt/drawing/svg/DriverTextSvg.java:92-94) elides `<text>` entirely for
  a transparent font color; `SvgGraphics#setupBackcolor`/
  `#finalizeRootAttributes` (svg/SvgGraphics.java:176-183,755) elide the
  background `<rect>`/`background:` style. Upstream's `HColor#toSvg`
  (HColor.java:74-76) canonicalizes ANY transparent color to `"#00000000"`
  BEFORE these checks run — this port has no HColor class hierarchy (raw
  strings throughout, I2's pre-existing gap), so `theme.colors.background`/
  `theme.colors.elements[sname].font` carried the LITERAL word `transparent`
  unconverted, missing both a pre-existing `font.color === null` guard
  (nothing ever produced `null`) and a pre-existing `!== '#00000000'`
  strict-string exclusion (didn't recognize the named spelling).
- Disposition: fixed — new `isTransparentColor(value): boolean`
  (`src/core/paint.ts`, the shared leaf color-utility module) recognizes
  the named keyword (case-insensitive) and an explicit 8-digit zero-alpha
  hex. `svg-graphics-core.ts#setupBackcolor` canonicalizes to `'#00000000'`
  before its existing exclusion check (no change needed to
  `finalizeRootAttributes`, already correctly shaped). `renderer-symbol.ts
  #textFontColor` returns `null` (not the raw string) for a transparent
  override — `FontConfiguration.color: string | null` and
  `driver-text-svg.ts`'s `null` guard were already correctly shaped. 8 new
  pinning tests (paint.test.ts, svg-graphics.test.ts, renderer.test.ts).
  Census: cobadu-43-gabi397's extra-text-per-entity family fully closed;
  catari-10-xiza828's extra background-rect + `svg/@background` diff fully
  closed. Residuals on both are pre-existing/unrelated (cobadu: an
  already-present, unaffected-by-this-fix `svg/@height` gap, before/after
  confirmed byte-identical; catari: the SAME component-container-cluster
  default-border-style gap I5c's ledger section names, cross-referenced).
- Slugs: component/cobadu-43-gabi397, catari-10-xiza828.

## I5e — link-endpoint auto-create stereotype misdrawn as link label

### mechanism: pre-colon link stereotype conflated with the post-colon-embedded (real) label stereotype — FIXED
- Mechanism: `CommandLinkElement.getGroup("ENT2")`'s regex (java:182-197)
  is byte-identical in shape to this port's `LINK_ENT_ALT` — neither
  includes `<`/`>` in the bare-identifier alternative, so
  `Participant1011<<v1.0>><<v1.1>>`'s trailing tags fall to the SAME
  `STEREOTYPE` regex group upstream uses for a genuine pre-colon link
  stereotype (`A --> B <<tag>> : label`), NOT a parse-routing bug. The real
  divergence: `executeArg` (java:331-333) calls `link.setStereotype(...)`
  unconditionally for ANY matched STEREOTYPE run, but that value feeds
  ONLY `getDefaultStyleDefinition(stereotype)` (arrow style-selector
  resolution, svek/SvekEdge.java:289,817,875 — I2's already-ledgered
  unbuilt "ArrowFont*" feature) and `Link.isRemoved()`'s removal match —
  `Labels.java` (which builds the link's REAL drawn text) never reads the
  STEREOTYPE group at all, and `getDummy` (the auto-create path) never
  reads it either. Upstream draws this PRE-colon form NEITHER on the link
  NOR the entity. This port's `SvekEdge.ts#drawLabels` drew
  `«${input.stereotype}»` unconditionally, conflating this NEVER-drawn
  pre-colon case with the genuinely-drawn POST-colon-embedded case
  (`: <<include>>`, jar-verified via usecase/cevuji-49-bile305) — both fed
  the SAME `DescriptiveLink.stereotype` field with no discriminator.
- Disposition: fixed — new `DescriptiveLink.stereotypeIsLinkLabel?: true`
  discriminator (ast.ts), set only by the post-colon-embedded branch of
  `resolveStereotypeAndLabel` (link-grammar.ts), threaded through
  `DescriptionEdgeGeo`. `renderer-edge.ts#buildInput` and
  `link-edge-attrs.ts#mainLabelText` (DOT-emission + graph-spacing dzeta)
  both gate stereotype inclusion on the flag; `SvekEdge.ts` itself needed
  no change (it only ever draws whatever its ONE caller sets).
  `removeMatchingLinks` deliberately unchanged — `remove <<stereotype>>`
  still matches on `.stereotype` regardless of origin, faithfully
  mirroring `Link.isRemoved()`'s syntax-origin-blind match. 6 new pinning
  tests + 5 pre-existing tests corrected (each now explicitly sets
  `stereotypeIsLinkLabel: true` to keep exercising the genuinely-visible
  post-colon-embedded shape they were built for). Census: the
  `svg/g[N][childCount]` extra-`<text>`-on-link-groups family (the exact
  I5e signature) fully closed on all 5 fixtures — zero `[childCount]` and
  zero stereotype-text diffs remain anywhere in any of the 5. Large
  diffCount increases are a masking-artifact reveal of a co-occurring,
  already-I2-ledgered named-CSS-color gap (`#Green`->`#008000`/`#FF0000`)
  present on every one of these 5 fixtures' many relationship arrows, plus
  ordinary layout-offset residue on their entities. DOT gate re-verified
  frozen EXACT despite this iteration's own explicit nodesep/ranksep-
  strictness caution (mainLabelText feeds `computeGraphSpacing`) — the
  max-dzeta-driving edge in every affected diagram is dominated by a
  different edge's real label, unaffected by this fix.
- Slugs: component/golati-24-xika861, kokodo-61-dano461,
  koxeca-82-mese950, minulo-12-bare186, vaseda-71-suje167.

## I5g — content-level `<g>` wrapper count mismatch (`svg/g[childCount]`)

### remove/restore of a nested entity was silently a no-op in the render geometry tree — FIXED
- Mechanism: `element-grammar.ts#removeMatching`/`effectiveRemovedIds`
  (parse-time marker) were already correct for nested entities — confirmed
  via a temporary parse-level debug script before touching layout.ts.
  `layout.ts#buildGeoNode`/`buildGeoTree` (the RENDER geometry walk, a
  SEPARATE tree traversal from `classifyAst`'s DOT/cluster classification
  walk) used the raw, removal-blind `isClusterNode(node)` to decide
  leaf-vs-cluster rendering and never filtered `astNode.children` at all —
  a container demoted-by-emptying (upstream: `GraphvizImageBuilder
  .printGroups` java:415-418, `isEmpty(g) && getGroupType()==PACKAGE` →
  `muteToType(LeafType.EMPTY_PACKAGE)`) still recursed into its removed
  children instead of taking the leaf branch `classifyAst`'s OWN
  `isEffectiveCluster` already correctly computed for DOT purposes; a
  container REMOVED OUTRIGHT (upstream: `if (g.isRemoved()) continue;`,
  java:411-413 — skipped entirely, no leaf substitution) still rendered via
  a (0,0)-positioned fallback leaf box. Jar-verified against 6 minimal
  probes rendered through the real jar (`oracle/capture.sh`) to disambiguate
  "emptied" vs "removed outright" outcomes before writing the fix.
- Disposition: fixed — `buildGeoNode`/`buildGeoTree` (layout.ts) now take a
  `removed: ReadonlySet<string>` param, use `isEffectiveCluster(node,
  removed)` (not raw `isClusterNode`) to pick the leaf/cluster branch, and
  filter `!removed.has(child.id)` before recursing into a cluster's
  children. `buildGeoAndEdges`/`layoutDescription` thread the
  already-computed `removed` set through. 4 new pinning tests in
  `layout.test.ts`. `svg/g[childCount]` family 52→42 fixtures; 16
  jar-verified fixtures fully closed at this level (see decision-journal.md
  I5g for the full list); `component/zijase-36-cice967` reaches FULL
  zero-diff (ratchet-backfilled).
- Slugs: component/sobobi-72-miri289, sodoza-93-nanu557,
  zijase-36-cice967 (ratcheted), renita-52-jazi848, gezemu-34-kamu453,
  gogosu-37-mipe918, cenoja-47-rodu998, fanija-24-xogo706,
  jebovo-64-rasa849, jolaru-18-dofi669, kokebo-27-vafi688,
  lopite-93-vevo106, radiga-95-junu817, xadaji-25-cufe655,
  venoti-11-seza115, zodare-91-rira454 (16 total).

### `hide <id>` / `hide $tag` — NOT FIXED, unbuilt command
- Mechanism: `command-table.ts` unconditionally `/* ignore */`s every
  `hide`/`show` line — a whole, separate, unbuilt upstream visibility
  list (`HideOrShow`'s `hides2`, distinct from the `removed` list this
  iteration's fix operates on). Jar-verified `component/mavuxi-16-jafi782`
  (`hide a`; `hide b_sub`): jar leaves `b` alone as a full 1-entity
  cluster, a shape structurally impossible to reach via the `removed`
  mechanism — confirms this is genuinely a different upstream command, not
  a variant of the one this iteration fixed.
- Disposition: not fixed here — unbuilt command-grammar feature (bare
  `hide`/`show`, entity visibility distinct from removal), needs its own
  iteration.
- Slugs (bare `hide`/`show`, corpus-wide, 13 total):
  component/{ciboso-93-romi495,favega-89-rado990,lufiba-62-dubi670,
  mavuxi-16-jafi782,tusugu-95-geju398,sufedi-40-baki261,
  zanibo-14-sami874}, usecase/{berufi-69-dara369,jecici-56-bimu826,
  bobije-35-nigi914,mopimi-10-jaco443,seline-83-vifi756,
  xoculo-95-fuvi894}; 7 of these co-occur in the `svg/g[childCount]`
  family specifically (mavuxi-16-jafi782, ciboso-93-romi495,
  sufedi-40-baki261, usecase/berufi-69-dara369, bobije-35-nigi914,
  seline-83-vifi756, xoculo-95-fuvi894).

### remaining `svg/g[childCount]` family (26 fixtures) — sub-classified, not drilled
- Mechanism: after excluding the fixed mechanism above, the already-hide
  unbuilt-feature slugs, and already-ledgered families (I4c word-wrap/
  creole: kovaxi-11-reti348/zavitu-69-cemu013/zidebi-71-nocu387/
  zotiru-33-legi180/nobiza-91-fimo741; I5b archimate sprite:
  tuliba-37-liza126; I-scale handwritten: cumofi-94-lixe862; I3 uid-order
  residual: dikexa-30-jobu917), the remaining ~26 fixtures each show a
  DIFFERENT small (1-3-fixture-reach) signature: transparent-link elision
  (`-[#transparent]-`, nujove-77-xiva558 — an I5d-adjacent gap for LINKS,
  not text/background), a never-declared-with-children empty container
  (`cloud {}`, vogefo-33-xeve917 — `isClusterNode` returns false from
  declaration alone, a different code path than this iteration's fix),
  `!pragma layout elk` fixtures (dirofi-81-cuga514 — a whole different
  layout engine), note+port+`!pragma kermor on`/`svek_trace on` combos
  (gurive-62-ricu497, repite-70-vabe533, zubujo-87-xaxa087), `set
  separator`-driven namespace-phantom-group interaction with many
  same-namespace components (fidati-41-kofe029, tojitu-03-ruto643),
  `!define`-macro-generated duplicate circle/control entities
  (kizobu-64-rozo458, tacixe-99-gesi489), `!definelong`-macro repeated-body
  idempotency (silito-78-vubi253), and a `<style>root{BackgroundColor}`
  root-level background `<rect>` gap (banatu-09-koce254). None reaches a
  scale that would justify forcing them into one shared narrative.
- Disposition: not fixed here — queued as named, not-yet-diagnosed leads
  for a future iteration; each would need its own diagnosis.md pass.
- Slugs: component/{banatu-09-koce254,basetu-75-xevi153,dirofi-81-cuga514,
  dozudi-14-sevu997,dujodu-23-viba393,fidati-41-kofe029,
  fojamu-08-veku866,gekato-87-lisi598,gurive-62-ricu497,
  gutute-00-gaki684,jegure-48-cesi766,kizobu-64-rozo458,nujove-77-xiva558,
  repite-70-vabe533,repoge-41-demu604,silito-78-vubi253,
  siseda-71-napu395,tacixe-99-gesi489,tijexo-10-zipo222,
  tizuza-93-xeto109,tojitu-03-ruto643,tujica-34-tire129,vogefo-33-xeve917,
  xufexu-38-fola855,ziniso-08-damu446,zubujo-87-xaxa087},
  usecase/zacute-55-zece399.

## I5f — sprite/icon multi-path glyphs collapsed to fewer `<path>` elements

### embedded-SVG sprite declaration (`sprite NAME <svg>...<path/></svg>`) — NOT FIXED, unbuilt subsystem
- Mechanism: bootstrap-icon fixtures (`<$bi-globe>`, `<$bi-bootstrap-fill>`,
  …) draw NOTHING where the jar draws 1-2 `<path>` elements per icon —
  confirmed via a direct `<g>` child-list dump against the jar's cached
  golden. Traced to `assets/stdlib/bootstrap1.13.1/bootstrap.puml:5080`:
  bootstrap icons declare via `sprite bi-globe <svg width="16"
  height="16"><path d="..."/></svg>` — an EMBEDDED-RAW-SVG declaration,
  syntactically and semantically distinct from the `sprite $name
  [WxH/Nz] <base64>` pixel-grid format this port's entire sprite pipeline
  (`sprite-commands.ts#matchSpriteCommand`, `SpriteGrayLevel`) exclusively
  handles — `matchSpriteCommand`'s multiline regex requires the body to
  open with a literal `{`, which `sprite bi-globe <svg ...>` never matches,
  so `getSprite`/`getSpriteMonochrome` return `undefined` and
  `resolveSpriteAtom` silently draws nothing (its own doc comment already
  states this consequence for an "unknown name"). Upstream Java confirms a
  WHOLE separate command family: `CommandSpriteSvg.java`/
  `CommandSpriteSvgMultiline.java` (embedded-`<svg>`-body sprites, via
  `svg/parser/SvgNanoParser.java` into a `klimt/sprite/SpriteImage`/
  `SpriteSvg`) and `CommandSpriteFile.java` (`sprite NAME jar:...`/file-path
  forms — `component/ruciga-77-ruja233`'s `sprite Netw
  jar:archimate/network`, a THIRD distinct sprite-loading command, same
  downstream `SpriteImage`/`SpriteSvg` target) — all draw natively as
  `<path>` elements, a genuinely different rendering path from this port's
  ONLY sprite kind (pixel-grid, rasterized to a PNG data URI, a deliberate,
  already-documented divergence for THAT format).
- Disposition: not fixed here — a whole missing sprite-declaration grammar
  + SVG-native rendering path (`CommandSpriteSvg`/`CommandSpriteSvgMultiline`/
  `CommandSpriteFile`/`SpriteImage`), out of a targeted-fix iteration's
  scope; needs its own mission-scale effort if the corpus reach justifies
  it.
- Slugs: usecase/ruziru-69-xixo434, usecase/bootstrap-0 (duplicate
  fixtures, same source), component/ruciga-77-ruja233 (`jar:` form, also
  entangled with the I5 ledger's "M" one-off finding on the same fixture).

## I5h — `<linearGradient>` def count mismatch (`svg/defs[childCount]`)

### per-entity inline color override never gradient-parsed — FIXED
- Mechanism: `renderer-entity.ts#parseColorOverride`'s bare (BACK-type)
  token was stored as a raw, un-gradient-parsed string (`result.back =
  token`) — `paint.ts#parseColor` was never called at that call site, so
  `#red|green` flowed straight to `fill="red|green"` (literal, invalid),
  producing zero `<linearGradient>` defs. The gradient MATH infrastructure
  itself (`paint.ts`'s `Paint`/`Gradient`/`parseColor`/`paintToSvg`,
  `theme.ts`'s `ElementColors.background?: Paint`, `skinparam.ts`'s
  `<sname>BackgroundColor` → `parseColor` wiring,
  `EntityImageDescriptionPaint.backcolor: Paint`) was already fully built
  and already working for the SKINPARAM-level gradient path (confirmed:
  `raxata-43-buni314`'s `skinparam componentBackgroundColor #FEFECE-red`
  already produced 1 real def pre-fix) — this was a narrow wiring gap, not
  an unbuilt subsystem.
- Disposition: fixed — `ColorOverride.back` widened `string` → `Paint`;
  `parseColorOverride`'s bare-token and `back:`-keyed branches both call
  `parseColor(...)` before storing, mirroring the already-working
  `skinparam.ts` call convention. 1 new pinning test in `renderer.test.ts`.
- Slugs: component/balomu-94-kegi822, titona-45-jile471 (both fully close
  their `svg/defs[childCount]` diff).

### `isPlainColor`'s named-color branch tested the un-stripped string — FIXED
- Mechanism: `paint.ts#isPlainColor`'s alphabetic (named-color) branch
  tested the ORIGINAL string `s` (which may still carry a leading `#`)
  instead of the already-`#`-stripped `hex` variable the HEX branch
  computes just above it — so a compound gradient token with a NAMED color
  immediately after the leading `#` (`#red|green`, `#yellow\FFFFFF`) never
  validated as a gradient split. Upstream `HColorSet.java#parseSimpleColor`
  (java:122-124) strips a leading `#` UNCONDITIONALLY per segment, before
  EITHER the hex or the named-color-trie attempt — not conditionally, only
  for the hex attempt, as this port's pre-fix code did.
- Disposition: fixed — `isPlainColor`'s alphabetic test now checks `hex`
  (the pre-stripped value), not `s`. 2 new pinning tests in `paint.test.ts`.
  Census: `svg/defs[childCount]` family 5→2 fixtures (balomu/raxata/titona
  all reach exact def-COUNT parity — 1/5/1 matching jar exactly; a bonus
  4th fixture, `component/levuxi-16-fotu885`, also reaches parity via the
  same skinparam-gradient path, now correctly counted corpus-wide).
- Slugs: component/balomu-94-kegi822, raxata-43-buni314,
  titona-45-jile471, levuxi-16-fotu885 (bonus, not in the original
  4-fixture estimate).

### `<filter>` shadow def gap — ruled out, NOT this iteration's mechanism
- Mechanism: `component/malado-53-noso561` (`skinparam databaseShadowing
  true`) shows `svg/defs[childCount]` actual=0 expected=1, but the missing
  def is a `<filter>` (drop-shadow: `feGaussianBlur`/`feColorMatrix`/
  `feOffset`/`feBlend`), NOT a `<linearGradient>` — confirmed by reading
  the golden's actual `<defs>` contents before assuming it was in scope.
  Shares the `svg/defs[childCount]` XPath family with the 4 gradient
  fixtures purely by coincidence.
- Disposition: not fixed here — a separate, unrelated drop-shadow/filter
  feature, out of I5h's `<linearGradient>`-specific scope; not re-ledgered
  under a new name here, just excluded.
- Slugs: component/malado-53-noso561.

### `rectangle`-as-container skinparam gradient background — NOT FIXED, single-fixture reach
- Mechanism: `component/ruciga-77-ruja233`'s `skinparam
  rectanglebackgroundcolor red/yellow` applies to a `rectangle`-as-CONTAINER
  (`rectangle "..." as netw { ... }`), whose background-fill code path
  (`renderer-cluster.ts`) does not route through `resolveElementPaint` the
  same way leaf entities do — real, but single-fixture reach, entangled
  with I5f's already-ledgered sprite gap AND the I5 ledger's already-noted
  "M" one-off color-spec-swallows-text finding on the SAME fixture.
- Disposition: not fixed here — single-fixture reach, not chased further
  this iteration; needs-signoff if a future iteration's reach justifies it.
- Slugs: component/ruciga-77-ruja233.

## I-hideshow — `hide`/`show` command family (unconditionally ignored)

### corpus form inventory (13 fixtures, jar-verified before any fix)
- `hide <id>` (bare-identifier entity hide): component/ciboso-93-romi495
  (`hide comp2`), component/mavuxi-16-jafi782 (`hide a`, `hide b_sub` --
  nested, one a top-level container, one a nested leaf).
- `hide *` / `show $tag`: component/tusugu-95-geju398 (`hide *`, `show
  $tag2`, `show $tag1`).
- `hide $tag`: component/sufedi-40-baki261 (`hide $tag1`).
- `hide stereotype` (gender=all, PORTION=STEREOTYPE): component/
  favega-89-rado990, component/lufiba-62-dubi670, usecase/berufi-69-dara369,
  usecase/jecici-56-bimu826, usecase/bobije-35-nigi914, usecase/
  seline-83-vifi756, usecase/xoculo-95-fuvi894 (7 fixtures).
- `show <<label>> stereotype` (paired with `hide stereotype`): component/
  lufiba-62-dubi670 (`show <<shared lib>> stereotype`).
- `hide <<label>> stereotype` (per-label hide, I5b's own "mechanism D"):
  usecase/mopimi-10-jaco443 (`hide <<stereo1>> stereotype`, `hide
  <<stereo2>> stereotype`).
- `hide empty attributes` (PORTION=FIELD, non-STEREOTYPE): component/
  zanibo-14-sami874 -- the diagram's entities (`actor`/`[Name]`) never
  declare a field/attribute body, so this is a jar-verified no-op
  regardless of disposition (see below).

### mechanism A: `hide|show <id|$tag|*|<<stereotype>>>` entity-visibility -- FIXED
- Mechanism: `CommandHideShow2.java` (`hide|hide-class|show|show-class
  WHAT`) -> `CucaDiagram#hideOrShow2` -> an ORDERED `hides2:
  List<HideOrShow>` list, folded per-entity via `HideOrShow#apply`
  (java:129-134, "last matching rule wins" -- `isApplyable` dispatches on
  `*`/`$tag`/bare-id/`<<stereotype>>`, HideOrShow.java:53-69). Consumed by
  `Entity#isHidden()` (abel/Entity.java:429-441): folds `hides2` for the
  entity's OWN match, THEN a hidden-ancestor SHORT-CIRCUITS to `true`
  before even consulting the entity's own rules (java:437-438) -- a
  `show`'d descendant of a `hide`'d container can never become visible.
  Draw-time-only: `SvekResult#drawU` (svek/SvekResult.java:82-101) wraps
  a hidden node/edge's `UGraphic` with `UHidden.HIDDEN`, gated inside
  `AbstractUGraphic#draw(shape)`'s `getParam().isHidden() &&
  manageHiddenAutomatically()` check (klimt/drawing/AbstractUGraphic.java
  :141) -- position/size are NEVER touched (dot/svek lays the entity out
  at full size regardless). A CONTAINER's own `Cluster#drawU` additionally
  early-returns entirely when hidden (svek/Cluster.java:298-300) -- no
  border, no title, not even a comment. `SvekEdge#isHidden()`
  (svek/SvekEdge.java:1283-1284) folds `Link#isHidden()` (abel/Link.java
  :458-459: `hidden || cl1.isHidden() || cl2.isHidden()`) -- an edge
  touching a hidden entity draws nothing even if the edge itself was
  never explicitly hidden.
  DOT-gate evidence (per the mission's own instruction to verify before
  deciding where to implement): jar-verified against
  component/mavuxi-16-jafi782's cached `in.svg` -- `a`'s cluster produces
  ZERO output (no `<!--cluster a-->` comment, no rect) while `b`'s cluster
  (only its CHILD `b_sub` hidden) draws its FULL border/title normally;
  `component/ciboso-93-romi495`'s cached `in.svg` shows `comp1`'s box
  drawn but `comp2` and the `comp1--comp2` edge both reduced to a bare
  `<!--...-->` comment with no shape at all. This confirms hide is
  DRAWING-only: the frozen DOT gate (component 262/262 unchanged
  throughout, jar-verified BEFORE touching any code) is consistent with
  this, not evidence against it -- no gated fixture's graph topology
  changes, since `hide` never reaches the DOT/svek pipeline at all.
- Disposition: fixed. `element-grammar.ts#effectiveHiddenIds` (new,
  mirrors `effectiveRemovedIds`'s hierarchical-walk shape but is LAZY,
  not parse-time-incremental -- several fixtures declare a `hide`/`show`
  rule before any entity exists, impossible to satisfy with
  `removeMatching`'s eager-marker approach). `command-table.ts` rule 2h
  (`RE_HIDE_SHOW_ENTITY`) pushes `{what, show}` onto `DescriptionDiagramAST
  .hideShowRules` (new, ordered array). `layout.ts#buildGeoNode`/
  `#buildGeoTree` thread the resulting `hidden: ReadonlySet<string>`
  (computed once in `buildGeoAndEdges`) alongside the pre-existing
  `removed` set -- SAME threading pattern, OPPOSITE effect: `removed`
  filters geo-tree membership, `hidden` only sets
  `DescriptionNodeGeo.hidden = true` (new field), position/size
  computation is completely untouched. `layout-geo-post.ts#assembleEdgeGeo`
  sets the new `DescriptionEdgeGeo.hidden` from `hidden.has(link.from) ||
  hidden.has(link.to)` (the `cl1.isHidden()||cl2.isHidden()` disjunct
  ONLY -- the pre-existing, separate `-[hidden]-` arrow-keyword mechanism,
  `DescriptiveLink.hidden`, is NOT folded in; it already has its own,
  unrelated `style=invis` DOT-emission path and is out of this
  iteration's scope). `renderer.ts#drawClusters`/`#drawEntities`/
  `#drawEdges` skip a `.hidden === true` node/edge entirely.
  SECOND mechanism discovered mid-fix (instrument-before-hypothesize):
  the ink-extent/document-dimension pass (`renderer-ink-extent.ts
  #computeDocumentDims`, a `LimitFinder` walk over the SAME `draw`
  closure used for the real pass) initially inherited the SAME hidden-skip
  gate, which is WRONG -- jar's own `LimitFinder extends UGraphicNo`,
  whose `getParam()` is a hardcoded `UParamNull` (`isHidden()` always
  `false`, klimt/UParamNull.java:56) -- `ug.apply(UHidden.HIDDEN)` has
  ZERO effect on that pass, so the ink walk measures a hidden entity's
  FULL extent even though the real draw never paints it (jar-verified:
  ciboso-93-romi495's canvas height is 169, not 65 -- the space
  `comp2`'s full box + the `comp1--comp2` edge would occupy is still
  reserved). Fixed via a `respectHidden: boolean` parameter threaded
  through `drawClusters`/`drawEntities`/`drawEdges`/the shared `draw`
  closure in `renderer.ts` -- `false` for the `computeDocumentDims` call,
  `true` for the real `UGraphicSvg` pass -- reproducing jar's structural
  split (LimitFinder cannot see hidden at all) without building the full
  `UHidden`/`UParam.isHidden()` apply-chain machinery this port's
  `UGraphicNo`/`LimitFinder` never had to begin with.
  TDD, red-then-green: `element-grammar.ts` gained `isApplyableEntity`
  (private) + `effectiveHiddenIds` (exported), tested via `layout.test.ts`
  (7 new cases: bare-id, container-propagates-to-descendant-but-not-
  sibling, `hide *`+`show $tag`, edge-hidden-via-endpoint,
  edge-NOT-hidden-when-both-visible, hidden-ancestor-short-circuits-childs-
  own-show-rule). `parser.test.ts` gained 5 new cases (H-1..H-5) pinning
  `hideShowRules` parsing for every corpus-observed WHAT shape.
  `renderer.test.ts` gained 5 new cases: hidden-leaf-paints-nothing,
  hidden-cluster-paints-nothing (no border/title), visible-sibling-
  unaffected, hidden-edge-paints-nothing, and the ink-extent/
  `respectHidden` regression itself (document dimension IDENTICAL whether
  the second entity is hidden or visible, content differs).
- Slugs (mechanism-A-bearing, all now correct): component/
  ciboso-93-romi495 (reaches FULL zero-diff, ratchet-added),
  component/mavuxi-16-jafi782 (mechanism verified correct via direct
  diff-dump -- zero diffs attributable to `a`/`b_sub`; residual 21 diffs
  are the ALREADY-ledgered "component-container-cluster default
  border/stroke gap", see I5c's ledger section, unrelated),
  component/tusugu-95-geju398 (mechanism verified correct -- comp5
  correctly dropped along with its 1 edge, comp1/2/3/4/6 and their 4
  edges all correctly kept and positioned within ~1px of jar; residual 3
  diffs are a title-chrome `<g>`-nesting divergence, unrelated, same
  family as I1's g-transform-vs-baked-coords note),
  component/sufedi-40-baki261 (reaches FULL zero-diff, ratchet-added).

### mechanism B: `hide|show [<<label>>] stereotype` per-label visibility -- FIXED (closes I5b's mechanism D)
- Mechanism: `CommandHideShowByGender.java`'s PORTION===STEREOTYPE branch
  -> `CucaDiagram#hideOrShow(gender, STEREOTYPE, show)` -> an ORDERED
  `hideOrShows: List<EntityHideOrShow>` list. Folded PER LABEL, not per
  entity, by `CucaDiagram#getVisibleStereotypeLabels`/
  `#isStereotypeLabelShown` (net/atmp/CucaDiagram.java:574-598): for each
  of an entity's OWN stereotype labels, walk `hideOrShows` in order,
  `result = cmd.show` whenever `cmd.gender.getGender() == null` (GENDER
  omitted -- `EntityGenderUtils.all()`) OR `cmd.gender.getGender() ==
  thisLabel` (`<<label>>`-decorated -- `EntityGenderUtils.byStereotype`)
  -- last matching rule wins, SAME "ordered fold" shape as mechanism A's
  `HideOrShow#apply`, but keyed on the LABEL STRING, not the entity.
  Consumed by `EntityImageDescription.java:190-201`/`EntityImageUseCase
  .java:96-109`/`ClusterHeader.java:197-207` -- ALL THREE call
  `portionShower.getVisibleStereotypeLabels(entity)` BEFORE building the
  guillemet `Display`, so the FILTERED (not raw) label list is what feeds
  BOTH the rendered text AND the entity's own size/DOT-node-width
  computation (`EntityImageUseCase`'s `mergeTB(stereo, desc)` merge runs
  on the filtered list). `executeDescriptionDiagram` (java:169-213) never
  reads the regex's EMPTY capture group at all -- `hide empty attributes`
  is EQUIVALENT to `hide attributes` (ALL entities, not just empty ones)
  for a description diagram, a faithfully-preserved upstream quirk. This
  port has no field/member/circled-character rendering subsystem for
  description diagrams at all (grep-confirmed, zero hits), so a non-
  STEREOTYPE portion form is a genuine, jar-verified no-op regardless of
  whether it is "implemented" -- zanibo-14-sami874's entities never
  declare attributes, matching jar's own effectively-invisible outcome.
- Disposition: fixed. `element-grammar.ts#visibleStereotypeLabels` (new,
  pure per-label filter over `DescriptionDiagramAST
  .stereotypeVisibilityRules`, new ordered `{pattern?, show}[]` field) +
  `#nodeWithVisibleStereotype` (new, shallow-clones a `DescriptiveNode`
  with its filtered stereotype for the ONE consumer -- `measureLeafNode`
  -- that needs a whole node, not a bare array; normalizes an
  all-filtered-out result to `undefined`, preserving `DescriptiveNode
  .stereotype`'s own "never an empty array" invariant, I5b). Applied at
  THREE call sites so sizing and rendering always agree (all pre-existing
  `astNode.stereotype ->  geo.stereotype`/`measureLeafNode(node, ...)`
  assignment points, per-file): `layout.ts#buildGeoNode` (leaf AND
  cluster branches) and `#buildDotNodes` (DOT-node-size measurement,
  BEFORE svek/graphviz ever runs); `layout-helpers.ts
  #degenerateSingleLeaf` (the single-root-leaf fast path, untested by
  this iteration's corpus -- no fixture hits it -- included for
  structural consistency, same helper, same pattern as the other two).
  `command-table.ts` rule 2g (`RE_HIDE_SHOW_PORTION`) recognizes the full
  upstream PORTION alternation (members/attributes/fields/methods/
  circles/circled/stereotypes) but only STEREOTYPE pushes a rule; every
  other portion (`hide empty attributes` included) is caught, matched,
  and explicitly no-op'd with a citation, rather than silently falling
  through to the generic ignore-everything fallback.
  A genuine bug caught by TDD before it could reach a fixture: the first
  cut of `nodeWithVisibleStereotype`/the geo-assignment sites treated
  "every label filtered out" (`[]`, a real, valid, non-undefined array)
  as "set `geo.stereotype = []`" -- violating the established "never an
  empty array" invariant. Two new `layout.test.ts` cases caught it
  (`toBeUndefined()` where `[]` was actually returned) before any fixture
  measurement; fixed by normalizing `[]` to `undefined` at all three
  assignment points (the SAME fix, once per site, not a shared branch --
  each site already had its own `if (x !== undefined)` guard needing the
  `.length > 0` addition).
  TDD: 4 new `parser.test.ts` cases (H-6..H-9, plus H-10 for the
  non-STEREOTYPE-portion no-op) pinning `stereotypeVisibilityRules`
  parsing; 5 new `layout.test.ts` cases (global hide, show-override with a
  multi-word `<<label>>`, mechanism-D per-label filtering keeping the
  unmatched label, a no-stereotype node is untouched by any rule, and a
  direct sizing-consistency check that a fully-hidden stereotype block
  contributes ZERO extra width/height vs a bare node with none).
- Slugs: component/favega-89-rado990, component/lufiba-62-dubi670 (both
  mechanism-verified correct via direct diff-dump -- zero diffs
  attributable to stereotype guillemet presence/absence; residual diffs
  are the ALREADY-ledgered per-stereotype-NAME color-override gap, I4b,
  PLUS an unrelated `package`-vs-`component` cluster icon-shape divergence
  on favega, single-fixture, not chased), usecase/berufi-69-dara369,
  usecase/bobije-35-nigi914, usecase/seline-83-vifi756, usecase/
  xoculo-95-fuvi894 (all 4 mechanism-verified correct -- zero guillemet-
  text diffs anywhere in any of the 4 fixtures' full diff dumps; residual
  `svg[1][childCount]` structural gap (106 vs 73, identical across the
  two near-duplicate diagram pairs) is a NOT-diagnosed-here, unrelated
  chrome/`together{}`/multi-note nesting divergence -- queued as a named,
  not-yet-diagnosed lead, not chased further this iteration),
  usecase/jecici-56-bimu826 (mechanism verified as a correct NO-OP -- zero
  entities carry any stereotype at all, confirmed by source read; its 146
  residual diffs are entirely pre-existing, unrelated: custom skinparam
  colors/rounding/thickness, `<img:...>` atoms, colored dashed arrows --
  none stereotype-related), usecase/mopimi-10-jaco443 (I5b's own
  "mechanism D" fixture -- CLOSES that entry: multi-stereotype rendering
  now correctly shows ONLY the non-hidden remainder per entity, e.g. `D
  <<stereo1>><<stereo2>><<stereo3>>` now draws just `«stereo3»`, matching
  jar exactly; residual 26 diffs are small, uniform sub-pixel ellipse/text
  coordinate offsets across all 5 use cases, a separate not-diagnosed
  sizing-formula nuance, NOT a hide/show defect -- no wrong label is ever
  shown or hidden), component/zanibo-14-sami874 (`hide empty attributes`
  verified as a correct, jar-matching no-op; its 28 residual diffs are a
  uniform ~1.5px vertical offset across every element, an unrelated,
  pre-existing font-metric/baseline gap).

### unbuilt forms — ledgered, zero corpus reach for `hide`/`show`
- `hide <<stereotype>>` (mechanism A's OWN `<<label>>` branch, entity-level
  -- hides the WHOLE entity, distinct from `hide <<label>> stereotype`'s
  guillemet-only suppression): implemented in `isApplyableEntity`
  (mirrors `removeMatching`'s identical branch) but zero corpus fixture
  exercises it for `hide`/`show` specifically (only for `remove`/
  `restore`, already covered).
- `hide @unlinked` / `show @unlinked` (`HideOrShow#isAboutUnlinked`,
  `Entity#isAloneAndUnlinked`): NOT built for `hide`/`show` (the
  `remove @unlinked` sibling already exists, `ast.removeUnlinked`) --
  zero corpus reach, `@unlinked` never appears with a bare `hide`/`show`
  verb anywhere in the 355-fixture corpus.
- `hide-class` / `show-class` command verb variants (CommandHideShow2's
  own regex accepts them, `explainArg`'s own comment: "the '-class' suffix
  has no specific effect" -- behaviorally identical to plain `hide`/
  `show`): zero corpus reach, not built (would fall through to the
  generic ignore fallback if ever encountered -- indistinguishable from a
  silent no-op, not a crash).
- `hide|show <type-keyword>` gender (`class`/`object`/`interface`/`enum`/
  .../`stereotype`-as-a-TYPE-filter) and `hide|show <entity-name>
  stereotype` (a bare entity NAME as GENDER, not a `<<label>>`) on the
  PORTION form: zero corpus reach for description diagrams specifically
  (`RE_HIDE_SHOW_PORTION`'s GENDER capture only recognizes `<<label>>` or
  absence) -- would currently fall through unmatched to the generic
  ignore fallback (silent no-op) rather than being misinterpreted as
  something else, since the regex requires the line to literally end in a
  PORTION keyword either way.
- `hide|show members|fields|methods|circle(d)` (non-STEREOTYPE PORTION
  keywords): recognized and explicitly no-op'd (see mechanism B above) --
  this port has no field/member/circled-character rendering subsystem for
  description diagrams at all; genuinely unbuilt, but PROVABLY zero-effect
  for every corpus fixture using them (only `hide empty attributes`,
  zanibo-14-sami874, and that entity set has no fields to hide either
  way).

### supersedes/closes
- I5g's own `hide <id>` / `hide $tag` ledger entry ("NOT FIXED, unbuilt
  command") above is now CLOSED by mechanism A.
- I5b's own "mechanism D: `hide <<label>> stereotype` per-label
  visibility filter -- ruled out, unbuilt command" ledger entry above is
  now CLOSED by mechanism B.

## I6 — `text/@x` + `text/@y` sub-classification (206+203 fixtures)

### delta-pattern sub-classification table (residual = textDelta - same-group box delta)

| Class | Reach | Signature | Disposition |
|---|---|---|---|
| A: box-position-inherited (dominant) | ~99%+ of family (1235/1358 rect/ellipse-matched records residual=0; +752 polygon/path/line-outlined records, same downstream pattern) | text offset == its box's own offset, exactly | NOT an I6 mechanism — belongs to I7 (`rect/@x@y`, `ellipse/@cx@cy`, `line/@x1y1x2y2`, `path/@d`, `polygon/@points`, already queued). Re-measure text/@x,@y AFTER I7 lands, not in parallel. |
| B: port-label above/below tie-break (container has ONLY port children) | 13 diff instances / 4 jar-verified fixtures (component/gafegu-06-nito976, gocexi-61-biso565, rapaji-98-xato067, kanute-77-lacu414-partial); reach beyond these not exhaustively surveyed | residual exactly 38 (constant across all 4×4 instances) | diagnosed to root cause, NOT fixed — see below |
| C: ellipse-leaf (actor/usecase) uniform position drift | 18 fixtures directly observed via uniform-boxDelta scan (~1.5px actor-topology, ~1.0px usecase-topology) | rx/ry match jar exactly; only cx/cy (or node.y) translate by a small shape-type-dependent constant | diagnosed to symptom, root cause NOT pinned — see below |
| D: truly isolated text-only (no co-moved geometry anywhere in group) | 3 of 2113 records (0.14%) | each its own single-fixture snowflake | not pursued — negligible reach, distinct unrelated causes per fixture |

Sub-mechanisms (a) font-baseline and (b) centering-arithmetic from the
mission prompt's candidate list are RULED OUT for this census (not
guessed — verified): `DeterministicMeasurer`'s `height = font.size` /
`descent = font.size / 4.5` formulas are byte-identical to jar's
`StringBounderFromWidthTable.calculateDimension`
(`~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/drawing/
font/StringBounderFromWidthTable.java:64-80`) and `StringBounder
#getDescent`'s default (`klimt/font/StringBounder.java:47-50`) —
single-line baseline math is provably correct already, which is WHY
class A's residual is exactly 0 in the overwhelming majority of cases.
The prompt's cited `ascent = size*11.6016/12` ratio is `jarMeasurer`'s
AWT/production formula (`error-renderer.ts`, mission SI6) — a DIFFERENT
measurer subsystem this census's `DeterministicMeasurer` path never
uses. (d) multiline line-advance is subsumed the same way: multi-line
records show the identical residual=0 pattern as single-line (every
line in a group shares that group's one box-anchor offset, applied by
`layout-geo-post.ts`'s margin-normalize/shift pass that moves box+text
together as one unit — this is WHY text can never independently drift
from its box in this port's architecture).

### mechanism B: port-only-container label tie-break — diagnosed, NOT fixed
- Mechanism: `layout.ts#applyPortLabelPositions`'s `child.y < centerY`
  (mirroring `EntityImagePort.upPosition()`, `svek/image/
  EntityImagePort.java:76-80`: `node.getMinY() < clusterCenter.getY()`)
  produces an exact algebraic TIE for a container whose ONLY children
  are ports: `computeContainerBbox`'s `centerY = bbox.y + bbox.height/2`
  reduces to exactly `minY` of the port row whenever the ports' shared
  height (fixed `RADIUS*2 = 12`, `layout-helpers.ts`) equals
  `CONTAINER_TOP_PAD(28) - CONTAINER_PADDING(16) = 12` — a coincidence of
  this port's own padding constants, not upstream's. Strict `<` then
  resolves to `false` (below), while jar draws the label ABOVE. Jar-
  verified `component/gafegu-06-nito976`: our geo has `comp.y=18.319,
  height=56` (children all at `y=46.319`, exactly `centerY`); jar's real
  cluster rect is `y=39.6111 height=99` (nearly double our height) even
  though it has NO non-port entity children — jar gives a port-bearing
  `component` cluster its own component-icon MINIMUM body size, which
  this port's `computeContainerBbox` (a pure padded-union-of-children
  formula, no minimum-body floor for port-only containers) does not
  replicate. `EntityImagePort.upPosition()`'s real comparison is against
  `Cluster.getRectangleArea()` — the ACTUAL dot-computed cluster
  rectangle — not this port's synthetic padded bbox.
- Ruled out: a simple `<=` comparison-operator fix — would patch the
  TIE-BREAK SYMPTOM without correcting the true origin (container
  minimum body size for a port-only cluster), and risks flipping
  already-correct up/down decisions for OTHER port+entity topologies
  (e.g. `component/bijoko-90-riro507`'s 3-port up/middle/down split,
  I5's own reference fixture) that may rely on the exact strict-`<`
  semantics at a non-tied boundary — not verified safe, not applied.
- Disposition: not fixed here — needs a dedicated investigation into
  jar's default `component`/container minimum body dimensions when a
  cluster has zero non-port entity children (paired with I7's container-
  sizing work), then `computeContainerBbox` gains a port-only-container
  minimum-height floor; only THEN does `applyPortLabelPositions`'s
  existing `<` comparison need re-verification (it may turn out to be
  correct once centerY is computed against a jar-faithful body height).
- Slugs: component/gafegu-06-nito976, gocexi-61-biso565,
  rapaji-98-xato067, kanute-77-lacu414 (partial — 1 of its diffs); reach
  beyond these 4 not exhaustively surveyed (any `component X { port a;
  port b; ... }` with no other entity children is a candidate).

### mechanism C: ellipse-leaf (actor/usecase) uniform position drift — diagnosed, NOT fixed
- Mechanism: actor and usecase leaf entities (ellipse-shaped, not
  rectangular) receive a small, uniform, per-fixture-topology position
  offset vs jar, while rectangular entities in the SAME fixture position
  exactly (jar-verified `component/zanibo-14-sami874`: `APP` rect
  `x=7` matches jar's `x=7` exactly; only Y drifts, and only by
  `+1.5px`, ruling out a document-wide margin-constant bug). Magnitude is
  SHAPE-TYPE-DEPENDENT, not one shared constant: ~1.5px for pure-actor
  topologies (component/zanibo-14-sami874 — `EMP` node.y=7 ours vs jar's
  implied top 5.5; mifuvu-23-kalu239; xevidu-92-texu148; usecase/
  komivo-22-toki497) vs ~1.0px for pure-usecase topologies (usecase/
  fubaje-48-xaje065, mofuba-79-came821 — jar-verified: ellipse `rx`/`ry`
  IDENTICAL both sides (16.7355/12.8995 for `foo`), only `cx`/`cy` drift
  by exactly 1.0 in BOTH x and y, proving the shape's own size formula
  is correct and only its TRANSLATION differs; component/cedosa-23-
  nini915, zijaro-25-kufa588, usecase/cizolo-88-lake154). This is the
  SAME recurring symptom the I-scale ledger already observed and left
  unchased on `component/givape-84-xano421` ("ordinary actor-entity
  sizing drift already tracked by another iteration's family") — I6 is
  the first iteration to root-trace it this far, but the two magnitudes
  (1.5 vs 1.0) do not yet reduce to one shared formula/constant.
- Ruled out: a document-wide margin constant (`LAYOUT_MARGIN_LEADING=7`)
  being simply wrong — `APP`'s rect x in zanibo matches jar's x exactly,
  so the shared margin constant itself is correct; only ellipse-shaped
  leaves drift. Also ruled out: an ellipse SIZE-formula bug — `rx`/`ry`
  match jar byte-for-byte in every sampled fixture, only `cx`/`cy`
  differ.
- Disposition: not fixed here — candidate suspects (graphviz-ts's own
  px↔inch node-size-to-position rounding for ellipse-shaped dot nodes,
  vs jar's Smetana/real-graphviz rounding) were NOT verified against
  jar's dot/SVEK internals; `tests/oracle/svek-dot.ts`'s own doc comment
  confirms node `width`/`height` are explicitly TOLERANT metrics in the
  DOT gate, so a small numeric divergence here is invisible to "DOT gate
  frozen" and is not a DOT-gate violation — but pinning the exact origin
  needs a dedicated diagnosis pass on graphviz-ts's node-size-to-
  position conversion for ellipse leaves, paired with I7.
- Slugs: component/zanibo-14-sami874, mifuvu-23-kalu239,
  xevidu-92-texu148, usecase/komivo-22-toki497 (actor, ~1.5px);
  usecase/fubaje-48-xaje065, mofuba-79-came821, component/
  cedosa-23-nini915, zijaro-25-kufa588, usecase/cizolo-88-lake154
  (usecase/mixed, ~1.0px); component/bokumi-45-pupo531,
  givape-84-xano421, kacite-73-sobe773, saveje-35-vumu271,
  zeteze-09-kuno793, zugofa-47-risi694, usecase/cimare-47-deke334,
  usecase/fotisa-06-xipe681 (uniform boxDelta observed, magnitude/shape
  correlation not yet triaged per-fixture).

### class A (box-position-inherited) and class D (isolated snowflakes) — not queued as their own iterations
- Class A is not a distinct mechanism: it IS I7's own family
  (`rect/@x@y`, `ellipse/@cx@cy`, `line/@x1y1x2y2`, `path/@d`,
  `polygon/@points`), already queued in the README's iteration table.
  Re-measure `text/@x`/`text/@y` AFTER I7 lands rather than chasing it
  here.
- Class D (3 records, 0.14% of the family) is not queued — each
  instance is its own unrelated, single-fixture cause
  (component/zonobi-55-zuna105's `HorizontalAlignment right` style
  property is entirely unwired, a distinct unbuilt-feature gap;
  usecase/cizolo-88-lake154 is ~1px noise on one label, not chased).
- Slugs: not enumerated (class A is the ~200-fixture family itself,
  minus B/C/D; class D is component/zonobi-55-zuna105, usecase/
  cizolo-88-lake154).

## I7 — rect/ellipse/line geometry (`rect@x/y/w/h`, `ellipse@cx/cy/rx/ry`, `line@x1/y1/x2/y2`)

### sub-classification methodology
- Instrumented via a temporary `scripts/_tmp-i7-classify.ts` (deleted
  before finishing) that re-renders every component/usecase fixture,
  filters diffs to the `rect|ellipse|line` family under
  `svg/g(\[\d+\])?/g(\[\d+\])?/...`, buckets by attribute name, and
  flags per-fixture "uniform translate" (all x-like/y-like deltas equal
  within 0.05) vs "width/height-only" signatures. 236 of 355 fixtures
  carry at least one geometry diff pre-fix. Two named sub-mechanisms
  drilled to full root cause this iteration (one fixed, two — B and C
  from I6 — advanced from "candidate, unverified" to "confirmed
  mechanism, fix requires a subsystem out of this iteration's safe
  scope").

### mechanism: cluster border/stroke/roundCorner used ONE hardcoded
### package-style default for every container USymbol — FIXED
- Mechanism: `renderer-cluster.ts#buildStyleDefaults` (pre-fix) applied
  `CLUSTER_STROKE_WIDTH=1.5` + `theme.colors.graph.packageBorder`
  (`#999999`) + `roundCorner=0` to EVERY container regardless of its
  USymbol keyword. Upstream's `Cluster.java#getStyle`
  (`getDefaultStyleDefinition(diagramType, uSymbol, groupType)`, java
  :385-391) resolves border/stroke/corner-rounding through a STYLE
  lookup keyed by the group's OWN `USymbol` — only `USymbolFolder`
  (`package`/`folder` keywords, `PackageStyle.FOLDER` decoration) has a
  style distinct from the generic element default; every other
  container-capable USymbol (`component`, `frame`, `node`, `cloud`,
  `card`, …) falls back to the SAME border default a LEAF entity uses.
  Jar-verified (unstyled, no color/style override present) across 5
  distinct symbol types, all `stroke:#181818;stroke-width:1` with
  `rx="2.5" ry="2.5"` wherever the shape draws a plain rounded rect:
  `component/catari-10-xiza828` (nested `component` containers),
  `component/saxosu-09-nodi002` (`frame`), `component/bijoko-90-riro507`
  (`node`, polygon-cut-corner shape, same stroke/width), `component/
  detona-13-ziko113` (`cloud`, custom cloud-puff path, same stroke/
  width), `component/temufu-00-rira888` (`card`). Cross-checked
  `package`/`folder`'s OWN unstyled default separately (`component/
  dujodu-23-viba393`, `package Xxxxxx { ... }` no override): `stroke:
  #000000;stroke-width:1.5` — CONFIRMS `#999999` was never correct for
  ANY sampled symbol (grep-verified: zero fixtures in either corpus emit
  `stroke:#999999` in their cached golden), and further confirms
  `stroke-width:1.5` is folder-specific, not a shared default. This is
  the SAME mechanism I5c/I5d each independently first-observed and
  deferred ("component-container-cluster default border/stroke gap",
  ledger.md I5c) — re-derived and drilled to full root cause here rather
  than re-diagnosed from scratch.
- Disposition: fixed. `renderer-cluster.ts` gains `isFolderStyled(symbol)`
  (`symbol === 'package' || symbol === 'folder'`) plus 5 new named
  constants (`FOLDER_BORDER_DEFAULT='#000000'`, `NON_FOLDER_BORDER_
  DEFAULT='#181818'`, `NON_FOLDER_STROKE_WIDTH=1`, `NON_FOLDER_ROUND_
  CORNER=5.0` — halved to `rx="2.5"` by `URectangle.ts`'s existing
  `roundCorner/2` convention, matching leaf entities' own `ENTITY_ROUND_
  CORNER` — `CLUSTER_STROKE_WIDTH=1.5` kept, now folder-only).
  `buildStyleDefaults` takes the node's `USymbol` and branches on
  `isFolderStyled`. Deliberately does NOT touch `theme.colors.graph.
  packageBorder` (`theme.ts`) — that shared field is also read by
  `src/diagrams/class/renderer.ts` (out of G1 scope, DOT-gate-frozen
  class engine); a description-local constant avoids any risk to class's
  conformant output. Census: `svg/g/g/rect/@stroke` 56→17 fixtures
  (251→115 diffs), `@stroke-width` 52→7 (197→45), `@rx`/`@ry` 54→9 each
  (83→17 each), `svg/g/g/line/@stroke` 54→14 (206→62), `line/@stroke-
  width` 35→6 (145→14) — every affected fixture also carries an
  out-of-scope residual (port color-override wiring, width-computation
  gaps, mechanisms B/C below, named-CSS-color resolution, …), so none
  newly reaches zero-diff. Full census: conformant HELD at 19/355 (same
  19-fixture set, verified by identity comparison), buckets 11-30 54→57,
  31+ 177→174 (net improvement — fixtures graduating out of the largest
  bucket as this one mechanism's contribution closes). DOT gate
  re-verified frozen EXACT: component 262/262, usecase 90/90, class
  708/708, object 78/80, state 267/267 (single touched file is
  description-engine-only, no DOT-emission-layer dependency). Full
  suite: 309/309 files, 8404/8404 tests (no new test needed — no
  pre-existing test pinned the old wrong defaults; full suite passing
  unchanged confirms no regression). Ratchet: unchanged (0 new zero-diff
  fixtures this iteration — every one of the 19 already-conformant
  fixtures was already unaffected by this mechanism, or already correct
  before it).
- Slugs: reach not individually enumerated (56-fixture `rect/@stroke`
  family pre-fix, corpus-wide — any container USymbol other than
  `package`/`folder` without a `line:`/`BorderColor` override); jar-
  verified samples as above.

### mechanism B: port-only-container min body size — CONFIRMED ROOT
### CAUSE (deeper than I6 left it), still NOT FIXED
- Mechanism: re-derived I6's finding with jar Java in hand this
  iteration. `Cluster.java#manageEntryExitPoint` (java:410-430) splits a
  cluster's member `SvekNode`s into `insides` (normal-position entities
  — their full `RectangleArea` merges into the cluster's boundary
  directly) vs `points` (entry/exit-point entities, i.e. ports — only
  their CENTER point is added, via `isNormalPosition(sh)==false`). A
  `FrontierCalculator` (svek/FrontierCalculator.java) then computes the
  cluster's real drawn rectangle: when `insides` is EMPTY (a port-only
  container, exactly `gafegu-06-nito976`'s `component comp { port ...
  ×4 }` shape), `core` falls back to a tiny 2×2 box centered on the
  CLUSTER'S OWN GRAPHVIZ-ASSIGNED `initial` rectangle (`getRectangleArea
  ()` — i.e. graphviz DOES allocate the empty/port-only cluster a
  non-trivial size as a dot subgraph, independent of any member
  entity), then merges in each port's center point, then — critically —
  a "push" step (`DELTA = 3 * EntityPosition.RADIUS = 18`, java:47,97-
  146) EXPANDS the boundary by 18px on whichever edge a port's center
  sits within `DELTA` of, UNLESS that port is a rankdir-perpendicular
  corner case. This `FrontierCalculator` push/merge algorithm is NOT
  ported anywhere in this codebase (grep-verified: no `FrontierCalculator
  .ts`, no `manageEntryExitPoint` equivalent) — `computeContainerBbox`
  (`layout-helpers.ts`) is a pure padded-union-of-children formula with
  no graphviz-cluster-size floor and no port-edge-push logic at all.
- Ruled out (per I6, re-confirmed): a bare `<=` flip on
  `applyPortLabelPositions`'s `child.y < centerY` tie-break patches the
  SYMPTOM (which side the label draws on) without fixing the ORIGIN
  (the cluster's own body rectangle is the wrong SIZE to begin with,
  which is what makes `centerY` land exactly on the tie in the first
  place) — confirmed still correct to avoid, now with the exact
  jar mechanism in hand rather than a hypothesis.
- Disposition: not fixed here — `FrontierCalculator`'s push/merge
  algorithm is a real, previously-unported subsystem (needs: (1) the
  cluster's own graphviz-assigned "initial" rectangle threaded through
  from the dot layout result, not just the padded-union bbox this port
  computes independently; (2) the `insides`/`points` split by
  `isNormalPosition`; (3) the DELTA=18 edge-push logic, including its
  rankdir-perpendicular corner exclusion). Out of a single-iteration
  "fix at origin" scope without risking the ALREADY-CORRECT majority of
  container fixtures that have normal (non-port) children and never hit
  this fallback path at all. Needs-signoff for its own iteration,
  paired with the min-body-size floor `computeContainerBbox` needs.
- Slugs: component/gafegu-06-nito976, gocexi-61-biso565,
  rapaji-98-xato067, kanute-77-lacu414 (partial) — unchanged from I6
  (same reach, deeper mechanism, not independently re-surveyed this
  iteration beyond re-verifying `gafegu-06-nito976`'s exact numbers
  against the newly-read Java).

### mechanism C: document-wide translate on actor/ellipse-topmost
### diagrams — CONFIRMED root cause (graphviz-ts ruled out with direct
### evidence), still NOT FIXED
- Mechanism: I6 left this as "candidate suspects... NOT verified
  against jar's dot/SVEK internals." This iteration verified it
  directly and RULED OUT graphviz-ts: for `component/zanibo-14-sami874`
  (`actor "Employee" as EMP` / `[Tomcat] as APP` / `[Oracle] as DB`,
  chain topology), the jar's OWN cached `svek-1.dot` (`test-results/
  dot-cache/component/zanibo-14-sami874/svek-1.dot`) was run through
  BOTH the real `dot` binary (`dot -Tplain`, graphviz 15.1.0, installed
  at `/opt/homebrew/bin/dot`) AND `layoutGraph()` (this port's own
  graphviz-ts seam, `src/core/graph-layout.ts`) with the IDENTICAL
  node/edge/nodesep/ranksep values read from that same `.dot` file.
  Both produce the SAME raw positions to 4 decimal places (e.g. the
  actor node's post-shift-to-origin top: real graphviz `0.0000`,
  graphviz-ts `0.0000`; component nodes' y: real graphviz `134.0024`/
  `238.0021`, graphviz-ts `134.0000`/`238.0000`) — graphviz-ts is
  PROVABLY faithful to real graphviz for this exact input, so the
  divergence is NOT inside graphviz-ts (per the mission's own
  instruction to verify before concluding that). The real mechanism:
  jar's `SvekResult.java:125-136#calculateDimension` computes `minMax =
  TextBlockUtils.getMinMax(this, stringBounder, false)` — an ACTUAL
  drawn-INK bounding box (a LimitFinder-style walk over the assembled
  render tree), NOT the raw graphviz node-box minimum — then shifts the
  whole diagram via `moveDelta(6 - minMax.getMinX(), 6 - minMax.getMinY
  ())` (constant **6**, not a flat margin applied uniformly to both
  axes the way this port's `computeGlobalShift`
  (`layout-geo-post.ts:41-56`, `LAYOUT_MARGIN_LEADING=7`) does against
  the raw NODE-BOX minimum). Worked the actor's own ink offset
  analytically: `ActorStickMan.drawU` (`skin/ActorStickMan.ts`/`.java`,
  faithfully ported, confirmed identical formula both sides) draws the
  head ellipse at LOCAL y = `thickness + headDiam/2` = `0.5 + 8 = 8.5`
  from the entity box's own top — for jar's actual golden `cy=14` (`ry
  =8`, top=6), the entity box top must be `14 - 8.5 = 5.5`; for this
  port's flat `LAYOUT_MARGIN_LEADING=7`, box top = 7, giving `cy=15.5`
  (the observed, exact `+1.5` diff). `6 - minMax.getMinY()` = `6 - 0.5
  = 5.5` (the actor's own ink-top sits 0.5px, i.e. exactly `thickness`,
  below the STAGE-1 graphviz-normalized box top of 0) MATCHES jar's
  real 5.5 exactly. The X-axis reconciliation is NOT fully closed
  (jar's real X margin, verified `APP` rect `x=7`, does not cleanly
  reduce to `6 - <sh0007's own ink-left>` under the same formula without
  a further, unverified contribution — flagged as an open sub-question,
  not guessed at). Also confirmed (new evidence, not in I6): the uniform
  translate is NOT actor-exclusive — `component/nevuzi-33-duna992`
  (plain `component fooA1`/`fooA2`, no actor, no ports) shows the SAME
  `+1.5` Y-only shift on ITS topmost entity's rect/text, meaning the
  ink-extent-vs-node-box-margin gap is a GENERAL mechanism (this port's
  flat node-box margin vs jar's ink-extent margin), not narrowly
  "ellipse-leaf" as I6's title suggested — I6's ~1.0px usecase-topology
  magnitude is a DIFFERENT per-shape ink offset under the SAME general
  mechanism (usecase ellipses have their own local ink-vs-box geometry,
  not yet worked out numerically).
- Ruled out (this iteration, with direct evidence): graphviz-ts /
  layout-engine rounding (real-`dot`-vs-graphviz-ts comparison above,
  bit-for-bit match). Ruled out (re-confirmed): a document-wide margin
  CONSTANT being simply the wrong number — the constant itself (jar's
  `6`) is knowable and cited above; what's missing is the INK-EXTENT
  computation it's subtracted from, which this port has no equivalent
  of anywhere (`computeGlobalShift` uses `g.x`/`g.y`, the padded NODE
  BOX, not drawn ink).
- Disposition: not fixed here — implementing jar's real mechanism needs
  a genuine ink-extent/LimitFinder subsystem (per-shape "how far does
  this shape's actual paint sit from its own logical box edge," walked
  across the WHOLE assembled tree to find the true min/max, not just
  each node's box) to replace `computeGlobalShift`'s node-box-based
  margin — a substantially larger, cross-cutting change (touches every
  leaf/cluster renderer, not a single call site) than a targeted fix,
  and the X-axis formula isn't fully closed yet either. Root cause is
  now PROVEN and PRECISELY located (`SvekResult.java:125-136`,
  `TextBlockUtils.getMinMax`, constant `6`) rather than "candidate,
  unverified" — unblocks a future dedicated iteration significantly,
  but implementing it here risks either an incomplete/wrong ink-extent
  formula (only the actor case is numerically closed) or unintended
  bucket movement across the ~40+ fixtures whose topmost/leftmost
  element would newly route through it. Needs-signoff for its own
  iteration, explicitly scoped to "port a minimal ink-extent walk,
  starting with the actor/rect/ellipse cases already numerically
  verified here."
- Slugs: unchanged from I6's list (component/zanibo-14-sami874,
  mifuvu-23-kalu239, xevidu-92-texu148, usecase/komivo-22-toki497,
  usecase/fubaje-48-xaje065, mofuba-79-came821, component/
  cedosa-23-nini915, zijaro-25-kufa588, usecase/cizolo-88-lake154,
  component/bokumi-45-pupo531, givape-84-xano421, kacite-73-sobe773,
  saveje-35-vumu271, zeteze-09-kuno793, zugofa-47-risi694, usecase/
  cimare-47-deke334, usecase/fotisa-06-xipe681) plus one NEW slug this
  iteration confirms shares the SAME general (non-actor-specific)
  mechanism: component/nevuzi-33-duna992 (also carries an unrelated
  `[[url]]` edge-label-anchor gap — `text` vs jar's `a` element — not
  part of this mechanism, not investigated further).
