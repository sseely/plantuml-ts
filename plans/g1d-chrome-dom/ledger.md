# G1d ledger

## M1 — chrome DOM shape unification (jar's shape)

### Design summary

Two mechanisms closed, both in `src/core/annotations/chrome.ts`:

1. **Sibling composition → single content `<g>`.** `applyChrome` now wraps
   the fully-composed result (every active annotation slot + the original
   body, all already flattened) in exactly ONE bare `<g>` (no class, no
   transform) instead of relying on each `decorateEntityImage` step to add
   its own wrapper. `decorateEntityImage` no longer wraps "original" in a
   `<g transform>` at all — it splices the (now coordinate-shifted) body
   directly. A `decorated` flag guards this: a mainframe-only annotations
   bag (D9 escape hatch, nothing actually drawn) still returns `fragment`
   byte-identical, no new wrapper — `tests/unit/annotations-mainframe.test.ts`
   pins this.

2. **Transform wrappers → baked coordinates.** New module
   `src/core/annotations/coord-shift.ts#shiftFragmentBody(body, dx, dy)` is
   the eager-arithmetic equivalent of upstream's
   `UGraphic.apply(new UTranslate(dx, dy))` coordinate-context threading:
   it shifts every coordinate-bearing attribute (`x`/`y`/`cx`/`cy`/`x1`/
   `y1`/`x2`/`y2`/`points`/path `d` M-L-C-Q-A-Z commands/`transform=
   "translate(...)"`/`transform="rotate(...)"`) in an already-serialized
   SVG fragment string by (dx,dy), leaving dimensions (`width`/`height`/
   `rx`/`ry`/`r`) and relative nudges (`dx`/`dy` on `<text>`) untouched.
   Fast path: `dx===0 && dy===0` returns the input unchanged (byte-
   identical) — the common case whenever no TOP-positioned slot is active.
   `decorateEntityImage` calls this on both the "original" body (shift
   `xImage,yImage`) and each text slot's `AnnotationBlock.body` (shift
   `xText,yText`/`xText,0`), so `<g class="title">` etc. never carry a
   `transform` — matching jar exactly (grep-verified: zero `transform=`
   occurrences across all 19 I1 chrome fixtures' cached jar SVGs).

   `buildAnnotationBlock` (`blocks.ts`) itself was widened to match: margin
   is now baked via `shiftFragmentBody(borderedBody, margin.left,
   margin.top)` instead of a `group(borderedBody, {transform: "translate(
   margin.left,margin.top)"})` wrapper — required so chrome.ts's OWN later
   `shiftFragmentBody(block.body, xText, yText)` call doesn't DOUBLE-shift
   text nested inside a pre-existing `<g transform>` (caught by a failing
   test during development: title text landed at `x="0"` alongside a
   `translate(44.5,0)` wrapper instead of `x="44.5"` — a real correctness
   bug in the naive "shift everything uniformly" approach when the target
   string has its own nested transforms; fixed by eliminating ALL nested
   transforms at the source rather than teaching `shiftFragmentBody` to
   understand DOM nesting).

   `description/renderer.ts#unwrapKlimtSvg` gained a new step,
   `unwrapContentG`: it strips klimt's own leading `<?plantuml ...?>` PI
   AND its bare content `<g>...</g>` wrapper (`SvgGraphicsCore#getG`'s
   `gRoot`, always attribute-less — `simpleElement('g')`'s own doc
   comment), leaving `RenderFragment.body` flat — the SAME "no wrapping
   element" shape every other engine's fragment already has. Without this,
   `applyChrome`'s new single outer `<g>` would double-nest around klimt's
   own pre-existing content `<g>` for the description engine specifically.
   This ALSO incidentally fixes a duplicate-PI bug: before this mission,
   `unwrapKlimtSvg`'s body retained klimt's own `<?plantuml?>` PI, and
   `assembleKlimtShell` prepended a SECOND one — the old sibling-`<g>`
   shape masked this (PIs are stripped by `normalizeSvg` at every depth, so
   it never showed up as a census diff), but it was real, invalid-shaped
   output. Not separately ledgered before this mission since it was never
   independently discovered.

### Ratchet-annotation pre-check (per mission brief, before touching code)

Checked all 48 ratchet `in.puml` files (`oracle/goldens/svg-description/
**/in.puml`) for `title`/`caption`/`legend`/`header`/`footer` directives:
zero matches (one false positive — `component/zarabi-01-koka785`'s
component LABEL literally contains the word "title" inside `[component
title\n more component info]`, not a directive). **No ratchet fixture
carries annotations** — safe to proceed without further investigation.

### Per-engine verification table

| Engine | Test surface | Outcome |
|---|---|---|
| description (component/usecase) | `tests/unit/description/renderer.test.ts` (119, +2 new pinning `unwrapContentG`), `description.golden.ratchet.test.ts` (51), census (below) | pass, byte-identical ratchet |
| description (shared chrome core) | `tests/unit/annotations-chrome.test.ts` (16, 7 assertions updated to jar shape), `tests/unit/annotations-blocks.test.ts` (18, 5 updated), `tests/unit/annotations-coord-shift.test.ts` (17 new) | pass |
| description (mainframe D9 escape hatch) | `tests/unit/annotations-mainframe.test.ts` (4, 1 fixed — see design summary) | pass |
| every engine, integration | `tests/integration/annotations.e2e.test.ts` (8, 4 assertions updated: `chromeSlotX`/new `chromeSlotY`/`localSlotX` helpers replace the `<g transform="translate(...)" class="...">` regex) | pass |
| dot | `tests/unit/dot/annotations.test.ts` (5) | pass, unchanged |
| board | `tests/unit/board/annotations.test.ts` (3) | pass, unchanged |
| activity | `tests/unit/activity/annotations.test.ts` (6) | pass, unchanged |
| chart | `tests/unit/chart/annotations.test.ts` (5) | pass, unchanged |
| json | `tests/unit/json/annotations.test.ts` (5) | pass, unchanged |
| hcl | `tests/unit/hcl/annotations.test.ts` (3) | pass, unchanged |
| files | `tests/unit/files/annotations.test.ts` (3) | pass, unchanged |
| yaml | `tests/unit/yaml/annotations.test.ts` (4) | pass, unchanged |
| packetdiag | `tests/unit/packetdiag/annotations.test.ts` (3) | pass, unchanged |
| chronology | `tests/unit/chronology/annotations.test.ts` (3) | pass, unchanged |
| full suite | `npm test -- --run` | 322/322 files, 8635/8635 tests pass |

Every non-description engine's own annotations test suite passed WITHOUT
modification — those tests assert text/relation presence and stacking
order (`svg.indexOf('class="title"')` etc.), not the exact `<g transform>`
shape, so they were shape-agnostic already. Only `annotations-chrome.test.ts`
(chrome.ts's own unit tests, which DID pin the exact old wrapper string),
`annotations-blocks.test.ts` (margin-transform pin), and
`annotations.e2e.test.ts` (full-pipeline `<g transform>` regex helpers)
needed updates — all cited "G1d" inline per the instruction not to weaken
assertions, only replace shape-pins with new shape-pins.

### Jar element-by-element verification (4 of the 19 fixtures)

1. **`component/balopu-66-jagu236`** (title only). Jar: `<g><g
   class="title" data-source-line="2"><text x="103.2094" y="20.8889"
   .../></g><!--entity foo--><g class="entity" ...>...` — ONE outer `<g>`,
   title's `<text>` has no transform, entities/links are direct siblings.
   Ours (after): `<g><g class="title"><text x="70.66357416800003"
   y="23.5352" .../></g><!--entity foo--><g class="entity" ...>...</g>` —
   same shape: one outer `<g>`, title flat, entities/links flat siblings.
   `compareSvg` diffs: `svg/@height`/`@viewBox`/`@width` (pre-existing
   geometry-cascade gap, unrelated) + `svg/g[1][childCount]: actual 14,
   expected 13` — traced to I-hideshow (below), NOT a shape regression.
2. **`component/bagoze-78-lada681`** (legend only, bottom-default). Jar:
   `<g><!--entity a-->...<!--link a to b-->...<g class="legend"
   data-source-line="11">...` — legend LAST (bottom position, matches
   `decorateEntityImage(original, null, slot)`'s text2 ordering). Verified
   our output has the identical top-level ordering; `svg[childCount]`
   family closed for this fixture too.
3. **`component/zosuje-43-zebi775`** (title + caption). Jar: title FIRST
   (`<g class="title" ...>`), caption LAST (`<g class="caption"
   ...>`), matching `decorateEntityImage`'s text1(top)/text2(bottom)
   composition — same ordering confirmed in our output; remaining diffs
   (197 total) are ALL pre-existing (font-family/fill/tspan on chrome
   text, `svg/g/g`/`svg/g/rect` geometry — I5/I6/I7 families).
4. **`usecase/lizutu-99-mapa855`** (title + header + footer, all four
   slots). Jar order: `header, title, [entities/links], footer` — matches
   upstream's D9 stacking (header/footer outermost, header top). Our
   output: identical order. `svg[childCount]` closed; residual diffs are
   the same pre-existing text-style/font-family family (below).

### Newly-surfaced residuals (unmasked by closing `svg[childCount]`)

Closing the ROOT-level `svg[childCount]` diff let the structural-diff
walker descend into what it previously bailed on — exactly the "childCount-
bail unmasking" precedent the mission brief named. Every unmasked family
below is a PRE-EXISTING mechanism this mission did not touch (confirmed:
none of the code paths producing these diffs — `blocks.ts#drawLine`'s text
styling, klimt's `drawEntities`/`drawClusters`/`drawEdges` geometry, the
hidden-link draw-suppression check — were modified by this mission beyond
the margin-baking line in `buildAnnotationBlock`, which does not touch text
styling or entity/link geometry at all):

- **Chrome-block text styling gap (NEWLY NAMED, not previously ledgered).**
  `blocks.ts#drawLine` emits `font-family="SansSerif"` (not `sans-serif`),
  `fill="black"` (not `#000000` hex), wraps content in `<tspan>` (jar's
  chrome `<text>` has no tspan for plain, non-Creole content), and omits
  `lengthAdjust="spacing"`/`textLength="..."` — all present on every jar
  chrome-block `<text>`. Reach (per-fixture family drill-down, all 19):
  9 of 19 show this family — `gevaje`, `misube`, `tilexe`, `tusugu`,
  `vajaxu`, `zosuje` (as `@font-style`/`@font-size`/`@font-weight`/`@fill`,
  same underlying gap), `zozutu`, `gigofe`, `lizutu`. The other 10
  (`bagoze`, `balopu`, `josoxo`, `saroje`, `sugaca`, `nipapu`, `pivudu`,
  `sprite-SVG-fill-management-3`, `tatori`, `vivido`) show NO font-family/
  fill/tspan diff at all — their chrome text apparently already matches
  (single-word plain-color legend/title text where the style default
  happens to already resolve identically) or the fixture has no visible
  chrome TEXT diff to surface (e.g. `vivido`'s only new family is
  `svg/g/g/image`, a separate sprite gap; `nipapu`/`sprite-SVG-fill-
  management-3`/`tatori` show only rect/text POSITION diffs, not styling).
  Out of G1d's DOM-shape scope (a content-fidelity gap, not a shape one) —
  needs-signoff for a future iteration; likely an extension of G1's I2
  ("text style constants") to chrome annotation blocks specifically
  (I2 fixed entity/edge/cluster text, never touched `blocks.ts`).
- **I-hideshow (already ledgered, `plans/g1-description-svg/ledger.md`).**
  `balopu`'s `svg/g[childCount]: 14 vs 13` traces to the hidden link
  (`foo -[hidden]-> bar4`) still emitting a full `<g class="link">` with a
  drawn path/polygon — jar omits it entirely. Confirmed pre-existing:
  identical in a from-`HEAD` worktree render (git-archive baseline
  technique) before ANY of this mission's changes.
- **I5/I6/I7 geometry-cascade families (already ledgered).** `path/@d`,
  `polygon/@points`, `ellipse/@cx`/`@cy`, `line/@x1..y2`, `rect/@x`/`@y`
  diffs on ENTITY/LINK content (not chrome text) — the same pre-existing
  ink-extent/geometry gap already tracked for the broader corpus.
- **Sprite/image rendering (new, 1 fixture).** `usecase/vivido-49-nisu863`
  shows `svg/g/g/image` — a pre-existing sprite-icon gap, out of scope,
  not previously named; flagged for future triage.

### Census (component + usecase, 355 fixtures)

Before (2026-07-15 baseline, post-E2r):
```
48 / 355 conformant · 1-3: 28 · 4-10: 82 · 11-30: 61 · 31+: 135 · errors: 1
```
After (M1):
```
48 / 355 conformant · 1-3: 23 · 4-10: 72 · 11-30: 66 · 31+: 145 · errors: 1
```
The 0-diff SET is byte-identical (48 fixtures, verified via sorted-list
diff against a `HEAD`-worktree baseline run — not just the same count).
`errors: 1` unchanged — the same pre-existing `usecase/fepuvo-06-rugi981`
jar-golden-malformed-XML-comment error (`RESOLVED 2026-07-14` ledger entry
already documents this fixture; unrelated to G1d). Bucket movement (1-3:
-5, 4-10: -10, 11-30: +5, 31+: +10) is the childCount-bail unmasking:
family-level diff comparing before/after shows `svg[childCount]` (19
fixtures) fully replaced by newly-visible pre-existing families (chrome
text styling, I-hideshow, I5/I6/I7 geometry) at deeper diff paths — no
family appears in the "after" list that isn't traceable to one of the 19
named fixtures per the per-fixture drill-down above.

Ratchet: 48/48 pinned, byte-identical (`description.golden.ratchet.test.ts`,
51 tests pass). No new fixture reached zero-diff this iteration (none of
the 19 chrome fixtures close ALL their diffs — only the shape-family), so
ratchet growth is not applicable this iteration.

### Gates (verbatim)

```
npm test -- --run    322 files / 8635 tests pass
npm run typecheck     clean (tsconfig.json + tsconfig.node.json)
npm run lint          clean
npm run build         clean (vite + dts)
dot-sync-report component usecase class object state:
  component 262/262 · usecase 90/90 · class 708/708 ·
  object 78/80 · state 267/267  (FROZEN — unchanged, chrome is render-side)
```

### Files changed

- `src/core/annotations/coord-shift.ts` (new)
- `src/core/annotations/chrome.ts`
- `src/core/annotations/blocks.ts`
- `src/diagrams/description/renderer.ts`
- `tests/unit/annotations-coord-shift.test.ts` (new)
- `tests/unit/annotations-chrome.test.ts`
- `tests/unit/annotations-blocks.test.ts`
- `tests/unit/description/renderer.test.ts`
- `tests/integration/annotations.e2e.test.ts`

Temp scripts and the disposable baseline worktree used for before/after
comparison were removed before finishing; nothing committed by this agent
(orchestrator owns all commits).
