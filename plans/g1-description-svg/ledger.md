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
