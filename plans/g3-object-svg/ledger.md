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
