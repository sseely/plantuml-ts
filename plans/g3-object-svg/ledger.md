# G3 ledger

## O0 — harness stand-up, TRUE baseline, family classification, header-row fix

### Harness

`scripts/svg-conformance-census.ts`'s `renderFixtureFor` now dispatches
`object` (alongside `class`) to `render-fixture-class.ts#renderFixtureClass`
— object diagrams have no separate engine upstream (`ClassDiagramFactory`
registers the object/map commands alongside the class ones; confirmed via
`tests/unit/object/renderer.test.ts`'s own doc comment and
`src/diagrams/class/class-object-commands.ts`/`class-object-map-sizing.ts`),
so this is a literal reuse, not a new render path — mirrors the G2/N0
precedent exactly (that iteration's own bug was routing class fixtures
through the WRONG description-engine pipeline; verified here that object
genuinely IS the class pipeline before wiring the dispatch, not assumed).

`oracle/goldens/svg-object/` stood up (`ratchet.json` + `README.md`,
mirrors `svg-class`'s layout: no `<type>` dimension, every slug flat under
the root). `tests/oracle/svg-conformance/object.golden.ratchet.test.ts`
mirrors `class.golden.ratchet.test.ts` procedurally, reusing
`renderFixtureClass` VERBATIM (no dedicated object render helper needed).
`parity-object.json` generated via `svg-parity-survey.ts --out
tests/oracle/svg-conformance/parity-object.json object` (additive N0/G2
args, default invocation/shared `parity.json`/`parity-class.json`
untouched).

### TRUE baseline (before any fix)

`svg-conformance-census.ts object` (DeterministicMeasurer):
`1/80 -- 1-3:4 -- 4-10:19 -- 11-30:20 -- 31+:36 -- errors:0`. The single
zero-diff fixture (`gizini-87-vuve916`) is NOT genuine object-kind
evidence — it declares zero `object`-keyword entities (an `Object <|--
Foo` RELATIONSHIP where "Object" is a plain class entity NAME), riding
G2's already-fixed class engine entirely. Object-kind rendering itself
started at TRUE zero conformance.

### Diagnosis: `headerRows()` centering/baseline/textLength (class-object-
### map-sizing.ts)

**Mechanism**: `class-object-map-sizing.ts#headerRows` (shared by
`measureObjectClassifier`, `measureMapClassifier`, and
`class-json-sizing.ts#measureJsonClassifier` — the SAME header formula per
that file's own doc comment) drew the name/stereotype header text
flush-left (`indent: 0`) with a naive half-height Y (`stereoH + nameH/2`)
and set NO `width` field at all (so `renderRowText`'s `row.width !==
undefined` gate never emitted `lengthAdjust`/`textLength`).

**Origin**: `src/diagrams/class/class-object-map-sizing.ts`, `headerRows`
(pre-fix, ~line 86).

**Causal chain**: jar's `EntityImageObject#getLayout` builds a
`ULayoutGroup` (`PlacementStrategyY1Y2`) over `[stereo?, name]` and draws
it via `header.drawU(ug, dimTotal.getWidth(), dimTitle.getHeight())` —
`PlacementStrategyY1Y2#getPositions` (klimt/geom) CENTERS every block at
`x = (width - blockWidth) / 2` against the classifier's FULL final box
width (post member/field/row-area sizing, NOT the pre-max title width
alone) and stacks each block at its own ascent-from-top baseline (`y =
cellTop + baselineOffset`, the SAME `fontSize - descent` convention every
other class text row already uses). The pre-O0 port never centered at all
and never computed a baseline — it just used the block's own half-height,
which coincides with jar's centering ONLY when a block has zero descent
(never, for real text).

**Ruled out**: NOT a DOT-emission bug (object DOT gate already 78/80,
unaffected by this render-only change, re-verified unchanged after the
fix). NOT a box-WIDTH bug (the affected fixtures' `rect`/`viewBox`
dimensions already matched jar exactly before this fix — isolated to the
header `<text>` element's own `x`/`y`/`textLength` attributes only, via 6
independent jar-sample derivations before writing any code: `niloru-34-
nuve651`/`pagidu-67-doxa131`/`sobosi-40-xuda813`/`vozomu-86-rodo657`
(plain, no stereo), `majake-62-pero492`'s `foo3` + `fafozi-27-reja300`'s
`node2` (single stereotype), `bepafe-03-teda035`'s `CapitalCity` (map) and
`A` (json). Excluded `tenalu-53-meri239` from verification: it combines
this bug with a SEPARATE, unbuilt `<<tag>> { FontSize }` cascade override
for object headers (jar-verified absent from the port entirely — a
different, larger, unrelated feature gap, named but not fixed here).

**Fix**: `headerRows` now takes `(classifier, theme, measurer, boxWidth,
namePadding)` — centers each row at `(boxWidth - rowRawWidth) / 2`
(`rowRawWidth` = `javaRound4`'d raw measured text width, matching jar's
`%.4f`-serialized `textLength` and reused for both `indent` and `width`,
same "round once, reuse" precedent as `class-stereotype.ts`'s own
`rawTextWidth`), draws the name row at `y = stereoHeight + namePadding +
(theme.fontSize - descent)` and the (unmargined) stereo row at `y =
STEREO_FONT_SIZE - descent(12pt)`, and sets `width`/`fontSize: 12` on the
stereo row so `renderRowText` emits `lengthAdjust`/`textLength`/`font-
size="12"` correctly. All 3 call sites (`measureObjectClassifier`,
`measureMapClassifier`, `class-json-sizing.ts#measureJsonClassifier`)
updated to pass their own already-computed final `width` and their own
independently-named-but-equal margin constant (`OBJECT_NAME_PADDING`,
`MAP_NAME_MARGIN`, `JSON_NAME_MARGIN`).

**Tests**: `tests/unit/class/class-object-map-sizing.test.ts` (+3 describe
blocks / 5 tests: plain-object indent/y/width, stereotype indent/y/width
for BOTH rows incl. `fontSize`, map header indent/y/width — all against
hand-verified jar numbers). `tests/unit/class/class-json.test.ts` (+1 test,
json header centering against `bepafe-03-teda035`'s `A`). All pre-existing
tests in both files unaffected (they assert box width/height and row TEXT
only, never indent/y/width).

**Census delta**: object `1/80 -> 5/80` zero-diff (+4: every plain
single-object, no-stereotype, no/minimal-field fixture in the corpus --
`niloru-34-nuve651`, `pagidu-67-doxa131`, `sobosi-40-xuda813`,
`vozomu-86-rodo657`). Full-corpus regression check: class census
re-run **unchanged** (`292/718`, identical bucket counts) — `headerRows`
is exclusively reached by `kind: 'object'|'map'|'json'` classifiers, zero
overlap with the class ratchet's `kind: 'class'|'interface'|'enum'`
population. Description census (48-set) + ratchet unaffected (different
engine entirely). DOT gate unchanged (`component 262/262 - usecase 90/90
- class 708/708 - object 78/80 - state 267/267`) — this is a render-only
fix, `headerRows` never touches DOT node-size math.

**Ratchet**: 5 fixtures pinned (`oracle/goldens/svg-object/ratchet.json`),
all `dotEqual: true` per `parity-object.json`. 7 ratchet tests green (5
AC1 + 1 AC2 + 1 AC3).

### Family classification (post-fix, `svg-conformance-census.ts object
### --families`) — the O1+ queue

| # | Family (mechanism) | Reach (fixtures/80) | Tractability | G2 cross-attribution |
|---|---|---|---|---|
| 1 | Header row centering/baseline/textLength (object/map/json name + single stereo) | was ~40-64, now 0 (FIXED O0) | done | none — object-specific, new mechanism |
| 2 | **DATA-row (object field / map cell / json entry) baseline+textLength** — SAME missing-`width`/wrong-half-height-Y pattern as #1, in `measureObjectFields`/`buildMapRowGeo`/`class-json-sizing.ts#buildJsonRows` (3 sibling functions, NOT touched by O0's fix). Jar-verified formula already derived (O0 triage): `y = cellTop + marginY + (fontSize - descent)` per row, `width = javaRound4(rawWidth)`. `x`/`indent` already correct (unaffected). | ~35-45 (post-O0 family scan: `text/@y` 50, `text/@lengthAdjust` 37, `text/@textLength` 39 reach, mostly this family now that #1 is fixed) | **HIGH — single largest O1 target**, same mechanism shape as #1, 3 call sites, formula pre-derived | none — object-specific, new mechanism |
| 3 | `svg/g/g/path/@d` edge/spline geometry (graphviz-ts numeric divergence) | 41/80 (1346 individual diffs) | OUT OF SCOPE, no in-repo fix without the ADR-1 engine cutover | **= G2's `gvts-blocked`** (`plans/g2-class-svg/ledger.md` N67, ~288/718 in class) — same root mechanism, cross-attributed not re-drilled |
| 4 | Downstream canvas-dims (`viewBox`/`width`/`height`) | 48-62/80 | Mostly downstream of #3 (G2's own caveat: "not a 1:1 subset" — some fixtures combine a real structural/width bug). ≥1 CONFIRMED independent case: `gatefi-65-curu360` (`map0`/`map1`, both empty-body maps side-by-side — each map's OWN box width formula verified correct in isolation, yet the SECOND node's rendered X position is off by 16px; mechanism NOT yet root-caused, likely a DOT-node-size-vs-render-width rounding drift specific to zero-row maps) | Mostly OUT OF SCOPE (#3); the `gatefi` case needs dedicated instrumentation | Mostly `gvts-blocked`; `gatefi`'s own sub-case is UNRESOLVED, not yet attributable either way |
| 5 | Multi-stacked-stereotype rendering split (`object X <<Bar>> <<Foo>>` draws as TWO stacked guillemet lines upstream, jar's `Stereotype#getLabels()`) — the PARSER already captures the correct raw blob (`class-object-stacked-stereo.test.ts`, upstream's own greedy-regex-collision quirk faithfully ported), but `headerRows`/`measureStereo` only ever wrap+draw it as ONE line | >=1 (`fafozi-27-reja300`), likely more with 2+ stacked stereotypes on object/map | Medium — well-scoped (parser output already correct; needs `Stereotype#getLabels()`-equivalent splitting + a 2nd/3rd stacked-line header layout, generalizing O0's now-single-stereo-line `headerRows`) | none — object-specific, new mechanism |
| 6 | `<<tag>> { FontSize }` skinparam cascade for object/map/json headers | >=1 (`tenalu-53-meri239`, EXCLUDED from O0's own fix verification for this exact reason) | Medium-large — entirely unbuilt feature (no tag-cascade FontSize threading exists anywhere in `class-object-map-sizing.ts`/`class-json-sizing.ts`, unlike the generic class header's `row.fontSize` N23/N32 mechanism) | none — object-specific, new mechanism (analogous in SHAPE to class's N23/N32, but a fresh port for the object/map/json code path) |
| 7 | DOT-topology-awaiting-maintainer (`package`/`namespace` nesting) | 4/80 fixtures USE package/namespace syntax (raw grep, unconfirmed as the SAME structural mechanism as G2's `groupInheritance`) | Awaits maintainer scoping decision (same as G2) | Possible overlap with G2's `DOT-topology-awaiting-maintainer` (N27) — UNCONFIRMED, not drilled this iteration |
| 8 | mode-dark ColorMapper | 1/80 fixture uses monochrome/color-adjacent syntax (raw grep, unconfirmed) | Awaits (same as G2, `zirori-93-jefo337`) | Possible overlap with G2's mode-dark item — UNCONFIRMED, not drilled this iteration |

**O1 recommendation**: drill family #2 (data-row baseline+textLength)
first — same mechanism SHAPE as O0's own fix, formula already jar-derived
during O0 triage, highest reach of any in-scope (non-gvts) family, and the
3 call sites (`measureObjectFields`, `buildMapRowGeo`,
`class-json-sizing.ts#buildJsonRows`) are independent/parallelizable if a
future iteration wants to split them.

### Gates (O0, final)

- `object` census: `5/80` zero-diff (`1-3:5, 4-10:19, 11-30:15, 31+:35,
  errors:0`) — TRUE baseline was `1/80`.
- Class census 292-set: **intact**, unchanged (re-run, byte-identical
  bucket counts).
- Description census 48-set: **intact** (ratchet re-run green, 51/51
  tests).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — EXACTLY unchanged.
- `npm test -- --run`: 9829/9829 passing, 360 files (+1 vs pre-O0's 359).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.

## O1 — data-row mechanism, skinparam object/map/json background cascade, 10 fixtures pinned

### Mechanism 1 (priority 1): data-row baseline/textLength (object field / map cell / json entry rows)

**Mechanism**: the SAME missing-`width`/wrong-Y pattern O0 fixed for
HEADER rows (`headerRows`) was still present, unfixed, in the sibling
DATA-row builders: `measureObjectFields` (object field lines),
`class-map-sizing.ts#buildOneMapRow` (map key/value cells — moved into a
new sibling file this iteration, see "File split" below), and
`class-json-sizing.ts#buildJsonRows` (json entry key/scalar-value cells).
Every row drew at a naive half-height Y (`i*fontSize + fontSize/2` for
object; `rowTop + height/2` for map/json) and set no `width` field at all
(no `textLength`/`lengthAdjust`). Map additionally had a genuine
ALIGNMENT bug beyond the shared pattern: every key was drawn at a flat
`MAP_CELL_MARGIN_X` indent (never centered), when jar's own
`TextBlockMap#drawU` CENTERS the key within colA
(`style.getHorizontalAlignment()` = `plantuml.skin`'s `map {
HorizontalAlignment center }`) while drawing the value flush-left at
`colA + margin`.

**Origin**: `src/diagrams/class/class-object-map-sizing.ts` `measureObjectFields`
(pre-fix, was co-located with `headerRows` in the same file);
`src/diagrams/class/class-map-sizing.ts#buildOneMapRow` (new file, was
`buildMapRowGeo` inline in the old combined file);
`src/diagrams/class/class-json-sizing.ts#buildScalarRows`/`buildObjectRows`.

**Causal chain** (jar-verified against 4 independent samples spanning all
three kinds — worked numbers in this task's own return):
- Object field rows: `MethodsOrFieldsArea`'s per-row block draws at the
  SAME "ascent-from-row-top" `y = OBJECT_FIELD_MARGIN_Y(4) + i*fontSize +
  (fontSize - descent)` convention every other class text row uses (same
  formula shape as `headerRows`'s own name-row baseline, O0). Verified
  against `figeze-77-fozi735`'s "user" (`name = "Dummy"` -> textLength
  101.4125 @ y=32.8889 rel; `id = 123` -> textLength 42.525 @ y=46.8889
  rel — visibly DIFFERENT per-row textLength values, ruling out a
  shared-block-width hypothesis) and `nukera-08-dige359`'s p1 (4
  IDENTICAL-text visibility-icon rows, baseline stride exactly `fontSize`
  regardless of the icon reserve — rules out the icon column perturbing
  the baseline).
- Map rows: `TextBlockMap#drawU` — `horizontalAlignment.getPosition
  (keyWidth, widthColA)` for a plain row (CENTER: `(colA - keyWidth)/2`)
  vs `horizontalAlignment.getPosition(keyWidth, trueWidth)` for a POINT
  (`key *-> dest`) row (centers against the classifier's FULL final box
  width instead, since a Point row has no value column to share). The
  VALUE cell is always flush-left at `colA + MAP_CELL_MARGIN_X`
  (`value.drawU(ug.apply(UTranslate.dx(widthColA)))`, the value
  TextBlock's own text is itself left-margined,
  `HorizontalAlignment.LEFT`, never centered/stretched against colB).
  Verified against `bepafe-03-teda035`'s CapitalCity (UK/USA/Germany
  keys centered within colA=67.4875 exactly per `(colA-rawWidth)/2`;
  London/Washington/Berlin values ALL share the same x=colA+5 despite
  different widths) and `diveje-52-xefe514`'s Point row (`UK *->
  London`: key centers at `(151.425-19.5125)/2=65.95625` against the
  FULL box width 151.425, NOT colA=67.4875).
- Json entry rows: `TextBlockCucaJSon#getTextBlock` uses
  `HorizontalAlignment.LEFT` UNCONDITIONALLY for both key and scalar
  value (never centered, unlike map's key column) — same
  ascent-from-row-top baseline. A nested object/array member's key/first
  row aligns to the TOP of its own (possibly much taller) sub-table row,
  not its vertical center — verified against `bepafe-03-teda035`'s "A":
  "user" key row and its nested "age" key/value share the EXACT same y
  despite "user"'s combined row spanning two nested members.

**Ruled out**: NOT a DOT-emission bug (object DOT gate unchanged, 78/80,
re-verified after the fix — this is a render-only change). NOT an indent/x
bug for object fields or json cells (both were already correct pre-fix,
confirmed independently before touching code). Map's indent WAS wrong
(flat margin, not centered) — this is the one place O0's "x/indent already
correct" family-table note (family #2) was inaccurate for map specifically;
re-verified via 6 independent worked numbers before writing code.

**Fix**: `measureObjectFields` now computes a `baselineOffset` once and
sets `y: OBJECT_FIELD_MARGIN_Y + i*theme.fontSize + baselineOffset` +
`width: javaRound4(rawWidth)` per row. `class-map-sizing.ts#buildOneMapRow`
(new, extracted from the old combined file's `buildMapRowGeo` to keep both
under the 500-line/30-NLOC caps — see "File split" below) computes
`indent: (isPoint ? boxWidth : colAWidth - rawKeyWidth) / 2` for the key,
`indent: colAWidth + MAP_CELL_MARGIN_X` (unchanged) for the value, both at
`y: rowTop + MAP_CELL_MARGIN_Y + baselineOffset`, both carrying their own
`width`. `class-json-sizing.ts#buildScalarRows`/`buildObjectRows` thread a
`baselineOffset` parameter through the recursion and set
`y: rowTop + JSON_CELL_MARGIN_Y + baselineOffset` + each cell's own
`javaRound4`'d raw width. A new shared `baselineOffsetFor(fontSpec,
measurer)` helper (exported from `class-object-map-sizing.ts`) replaces 3
independent re-derivations of the same `fontSize - descent` formula.

**Tests**: `tests/unit/class/class-object-map-sizing.test.ts` (+4 tests:
object field row baseline/textLength on figeze-77-fozi735, the
nukera-08-dige359 4-icon-row baseline-stride discriminator, map data-row
centering/flush-left/baseline on bepafe-03-teda035, map Point-row
full-box-width centering on diveje-52-xefe514).
`tests/unit/class/class-json.test.ts` (+1 test: json entry row
baseline/textLength incl. the nested-object top-alignment case on
bepafe-03-teda035). All pre-existing tests in both files/the new
class-map-sizing.ts unaffected.

**Census delta**: object `5/80 -> 10/80` zero-diff (+5:
`febadi-87-zozu271`, `lalizo-85-paxe277`, `lapato-45-neje847`,
`rotele-89-cuva650`, `zagodo-28-ranu153`). Full-corpus regression check:
class census re-run **unchanged** (`292/718`, identical bucket counts) —
these functions are exclusively reached by `kind: 'object'|'map'|'json'`
classifiers, zero overlap with the class ratchet's `kind:
'class'|'interface'|'enum'` population. Description census (48-set) +
ratchet unaffected (different engine entirely, re-verified). DOT gate
unchanged (`component 262/262 - usecase 90/90 - class 708/708 - object
78/80 - state 267/267`).

### File split: `class-object-map-sizing.ts` -> + `class-map-sizing.ts`

The O0 file (376 lines pre-O1, header-only) would have exceeded the
500-line cap once the O1 data-row doc comments + map's own centering
mechanism landed in the SAME file. Split `map`'s sizing (measure/build
functions + `MAP_*` constants) into a new sibling
`src/diagrams/class/class-map-sizing.ts`, mirroring this project's
existing `class-lollipop.ts`/`class-magma.ts` precedent for a
synthesising-helper split. `object`'s own sizing + the header math SHARED
by object/map/json (`titleDimension`/`measureStereo`/`headerRows`/the new
`baselineOffsetFor`) stays in `class-object-map-sizing.ts`.
`class-map-sizing.ts` imports the shared helpers from there.
`renderer-classifier-box.ts` and `class-layout-helpers.ts` (the only two
real importers of `measureMapClassifier`/`MAP_CELL_MARGIN_X`, besides
doc-comment-only references) updated to import from the new file.
`buildMapRowGeo`/`measureMapRow` further split internally
(`buildOneMapRow`, `measureMapCell`) to stay under the 30-NLOC/5-param
per-function caps — pure mechanical extraction, no behavior change (see
`.agent-notes/O1-lizard-forgive-call-consumption.md` for a complexity-hook
quirk encountered and worked around during this split, unrelated to
behavior).

### Mechanism 2 (priority 3, near-zero harvest): `skinparam {object,map,json}BackgroundColor`

**Mechanism**: `renderer-classifier-box.ts#classifierFill` unconditionally
returned the CLASS-family background cascade
(`classCascadeBackground ?? classBackground`) for EVERY classifier kind,
including `object`/`map`/`json`. Upstream's `EntityImageObject`/`Map`/
`Json#getStyleSignature()` each declare their OWN, INDEPENDENT
StyleSignature (`SName.object`/`map`/`json` under `SName.objectDiagram`)
— genuinely distinct from class's `SName.class_` — unlike class/interface/
enum, which upstream coincidentally SHARE one signature (this function's
own pre-existing doc comment, G2 N12). So `skinparam
objectBackgroundColor` (or `mapBackgroundColor`/`jsonBackgroundColor`) had
NO effect anywhere in this port; object/map/json boxes only ever showed
the class default or an explicit per-classifier `#color`.

**Origin**: `src/diagrams/class/renderer-classifier-box.ts#classifierFill`
(pre-fix); `src/core/skinparam.ts#ELEMENT_BUCKET_SNAMES` (missing
`object`/`map`/`json` entries).

**Causal chain**: jar-verified against `majake-62-pero492`: `skinparam
objectBackgroundColor red` (plain, no stereotype) tints `foo1`'s box red
(`#FF0000`) but our port drew the class default (`#F1F1F1`). This port
already has a proven GENERIC mechanism for exactly this shape — the
`ELEMENT_BUCKET_SNAMES` per-element `skinparam <sname>BackgroundColor`
bucket `note`/`spot<Kind>` already ride (`theme.colors.elements[sname]
.background`, decision D1/D4) — `object`/`map`/`json` were simply never
added to that allowlist.

**Ruled out**: NOT a box-sizing bug (widths/heights already matched jar
exactly for this fixture pre-fix — isolated to the `<rect fill>` attribute
only). The explicit `#purple` override on `foo2` already worked correctly
pre-fix (that's a SEPARATE, already-built mechanism,
`resolveBareOrBackColor`) — confirms the gap is specific to the
SKINPARAM-cascade tier, not overrides generally.

**Fix**: added `'object'`, `'map'`, `'json'` to `skinparam.ts
#ELEMENT_BUCKET_SNAMES` (the plain `skinparam <sname>BackgroundColor` form
now populates `theme.colors.elements['object'|'map'|'json'].background`
for free, the SAME generic mechanism `note` already used — zero new
parsing code). `classifierFill` now branches on `geo.kind` before the
class-only `.tagname` cascade: for `object`/`map`/`json`, resolves
`theme.colors.elements[geo.kind]?.background` first, falling through to
the SAME terminal class default (`classCascadeBackground ??
classBackground`) ONLY because all three coincidentally default to jar's
shared `#F1F1F1` — NOT because they share class's cascade. A new
`resolveElementBackground`/`classDefaultBackground` pair of tiny helpers
factor the shared logic (also reused by the pre-existing class-only tail
of the function, zero behavior change there).

**OUT OF SCOPE (named, not silently dropped)**: the LEGACY
STEREOTYPE-qualified form (`objectBackgroundColor<<azerty>>`,
`majake-62-pero492`'s `foo3`) is a genuinely SEPARATE, larger upstream
mechanism — `SkinParam#getHtmlColor`/`#getColors(ColorParam, Stereotype)`
(`SkinParam.java:355-406`) try `<param><<tag>>` for EVERY tag on the
entity's stereotype BEFORE the plain key, for EVERY `ColorParam`-based
color anywhere in the engine (not `classifierFill`-specific, not
object-specific) — a materially different, broader lookup than this
port's own `classBorderThicknessByStereo` precedent (which is a narrow,
single-key, `LineParam`-thickness-specific stereotype lookup, not a
generic `ColorParam` mechanism). Implementing full parity would mean
threading a NEW stereotype-qualified-color-lookup subsystem through
however `entity.getColors()` gets populated upstream (not yet traced to
its populating call site), well beyond this iteration's near-zero-harvest
scope. `majake-62-pero492` therefore moved from 2 diffs to 1 diff
(`foo1`'s plain-skinparam fill now correct; `foo3`'s tag-scoped fill is
the sole remaining diff) — logged here as a named, deferred divergence,
not a silent partial fix.

**Tests**: `tests/unit/object/renderer.test.ts` (+5 tests: plain
`objectBackgroundColor` tint, `mapBackgroundColor` tint independent of
object's, `jsonBackgroundColor` tint independent of object's, NO tint on a
plain `class` classifier (buckets are independent of class's own
cascade), explicit `#color` override still wins over the skinparam
cascade — unaffected precedence).

**Census delta**: no NEW zero-diff fixture this mechanism alone (
`majake-62-pero492` moved 2 diffs -> 1 diff, still short of zero — see
"out of scope" above). Full-corpus regression check: class census
re-run **unchanged** (`292/718`) — `ELEMENT_BUCKET_SNAMES`'s new entries
only match `object`/`map`/`json`-prefixed skinparam keys, and
`classifierFill`'s new branch is gated on `geo.kind`, zero overlap with
class/interface/enum classifiers. Description/DOT gates unaffected.

### Near-zero-harvest triage (priority 3, remaining 1-3-diff fixtures)

Re-triaged the post-fix 1-3-diff bucket (6 fixtures, unchanged COUNT from
pre-O1 — `majake-62-pero492` improved in-place per above, the other 5 were
not attempted this iteration, time-boxed):

- `linuxu-41-cogo780` (3 diffs, `text/@textLength,@x,text()`): jar strips
  a LEADING visibility character (`~`) from an object's own DISPLAY name
  before drawing it (`object "~#1: Person" as p1` renders `#1: Person`,
  this port renders `~#1: Person` verbatim) while apparently still using
  the UN-stripped string for width purposes in some path (box width
  matched jar exactly, dominated by the field row in this fixture so
  inconclusive either way). Traced `VisibilityModifier.isVisibilityCharacter`
  + `Display#manageGuillemet(boolean)` (the only real stripping call site
  found, used solely for LINK labels via `LinkArg.java`, not entity
  display names) and `CommandCreateEntityObject.java`'s parse path (no
  stripping there either) without locating the actual mechanism — NOT
  root-caused. Named, not fixed.
- `fafojafu-44-cuve930`/`fafozi-27-reja300`/`nufoju-44-dabi767`/
  `soxufi-98-nita528` (3 diffs each, `viewBox`/`width-or-height` +
  `g[N][childCount]`): `fafozi-27-reja300` is the corpus's ONE
  multi-stacked-stereotype fixture (O0's family #5, `<<Bar>> <<Foo>>` ->
  2 stacked guillemet lines upstream, this port draws 1) — the
  `childCount` diff is consistent with a missing second stereo `<text>`
  row. The other three were not triaged for their specific
  childCount-causing element this iteration.

Not fixed this iteration (time-boxed against the mission's priority
order — data-row mechanism first, family-table items second, near-zero
harvest third with remaining budget). Left named for O2+ rather than
silently dropped.

### Gates (O1, final)

- `object` census: `10/80` zero-diff (`1-3:6, 4-10:18, 11-30:12, 31+:34,
  errors:0`) — O0 baseline was `5/80` (`1-3:6, 4-10:19, 11-30:15,
  31+:35`).
- Object ratchet: **12 tests** (10 AC1 + 1 AC2 + 1 AC3), +5 vs O0's 7 (5
  newly-pinned fixtures: `febadi-87-zozu271`, `lalizo-85-paxe277`,
  `lapato-45-neje847`, `rotele-89-cuva650`, `zagodo-28-ranu153`).
- Class census 292-set: **intact**, unchanged (re-run, byte-identical
  bucket counts).
- Description census 48-set: **intact** (ratchet re-run green, 51/51
  tests; description-parity ratchet 351/351).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — EXACTLY unchanged.
- `npm test -- --run`: 9844/9844 passing, 360 files (unchanged file
  count vs O0's 360; +15 tests: 5 data-row unit tests, 5
  skinparam-BackgroundColor unit tests, 5 newly-pinned ratchet AC1
  cases).
- `npm run typecheck` / `npm run lint` / `npm run build`: all clean.

### Files changed (O1)

- `src/diagrams/class/class-object-map-sizing.ts` — data-row fix (object
  fields) + shared `baselineOffsetFor` helper; map sizing extracted out.
- `src/diagrams/class/class-map-sizing.ts` — NEW (map sizing, split out).
- `src/diagrams/class/class-json-sizing.ts` — data-row fix (json entries).
- `src/diagrams/class/class-layout-helpers.ts` — import path update
  (`measureMapClassifier` now from `class-map-sizing.ts`).
- `src/diagrams/class/renderer-classifier-box.ts` — import path update
  (`MAP_CELL_MARGIN_X`); `classifierFill` object/map/json cascade branch.
- `src/core/skinparam.ts` — `ELEMENT_BUCKET_SNAMES` +
  `object`/`map`/`json`.
- `tests/unit/class/class-object-map-sizing.test.ts` — +4 tests.
- `tests/unit/class/class-json.test.ts` — +1 test.
- `tests/unit/object/renderer.test.ts` — +5 tests.
- `oracle/goldens/svg-object/{febadi-87-zozu271,lalizo-85-paxe277,
  lapato-45-neje847,rotele-89-cuva650,zagodo-28-ranu153}/` — NEW (5
  pinned goldens, copied from `test-results/dot-cache/object/`).
- `oracle/goldens/svg-object/ratchet.json` — +5 entries.
- `oracle/goldens/svg-object/README.md` — "Current state" O1 section.
- `.agent-notes/O1-lizard-forgive-call-consumption.md` — NEW (2
  observations: the lizard-forgive placement quirk; the pre-existing
  `renderer-classifier-box.ts` file-size overage).
