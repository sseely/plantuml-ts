# E2r ledger

## L1 — the atom-model core (creole stripe/atom pipeline + heading cascade)

### Port map

Upstream `klimt/creole/` (legacy engine — `CreoleParser implements SheetBuilder`
is the ONLY implementation `SkinParam#sheet` wires up; the top-level
`Sea`/`Fission`/`Neutron`/`Parser.java` engine is dead code for description
entity text, verified by grep — not ported) → this port's
`src/core/klimt/creole/`:

| Upstream | This port |
|---|---|
| `klimt/creole/StripeStyleType.java` | `src/core/klimt/creole/StripeStyleType.ts` |
| `klimt/creole/Stripe.java` | `src/core/klimt/creole/Stripe.ts` |
| `klimt/creole/atom/Atom.java` (+ `legacy/AtomText.java`) | `src/core/klimt/creole/atom/Atom.ts` (`CreoleAtom` — data-only union, not an OOP `Atom` hierarchy; see that file's doc comment) |
| `klimt/creole/legacy/CreoleStripeSimpleParser.java` | `src/core/klimt/creole/legacy/CreoleStripeSimpleParser.ts` (`classifyStripeLine`) |
| `klimt/creole/legacy/StripeSimple.java` | `src/core/klimt/creole/legacy/StripeSimple.ts` (`buildStripeAtoms`, `buildLiteralAtoms`, `fontConfigurationForHeading`) |
| `klimt/creole/command/Command.java` | `src/core/klimt/creole/command/Command.ts` |
| `klimt/creole/command/AddStyle.java` | `src/core/klimt/creole/command/AddStyle.ts` |
| `klimt/creole/command/CommandCreoleStyle.java` (minus `com.plantuml.ubrex` — see decision journal) | `src/core/klimt/creole/command/CommandCreoleStyle.ts` |
| `klimt/creole/legacy/CommandCreoleBuilder.java` (BOLD/ITALIC/UNDERLINE/STRIKE/WAVE only — see that file's doc comment) | `src/core/klimt/creole/legacy/CommandCreoleBuilder.ts` |
| `klimt/creole/StripeStyle.java` | NOT ported as a separate file — its 3 fields (type/order/style-char) live directly in `StripeClassification`'s discriminated union; `getHeader` (bullet-list atom) is out of L1 scope, so there was nothing left to justify a standalone wrapper class (YAGNI, journaled) |
| `klimt/creole/CreoleContext.java` | NOT ported — only consumed by `StripeStyle#getHeader` (list numbering), out of L1 scope |
| `klimt/creole/CreoleMode.java` | NOT ported as a type — this port has exactly one creole mode (always-FULL); see `CommandCreoleBuilder.ts`'s doc comment |
| `com.plantuml.ubrex.*` (~30 files) | NOT ported — a general-purpose pattern-matching engine, out of mission charter (same category as graphviz-ts); `CommandCreoleStyle.ts` reproduces its three challenge classes' OBSERVABLE semantics directly, see decision journal |

Cutover: `src/core/svek/image/EntityImageDescriptionSupport.ts#buildTextBlock`
(the single seam every descdiagram entity/cluster/stereotype text block goes
through) now classifies each `\n`-split line via `classifyStripeLine`, then
builds its atom sequence via `buildStripeAtoms`/`buildLiteralAtoms`, drawing
each atom as its OWN `UText` (or `UImage` for an already-integrated
`<img>`/`<$sprite>` atom) — one `<text>` SVG element per styled run, matching
the jar. File split: `EntityImageDescriptionSupport.ts` grew past this
project's 500-line complexity-hook ceiling; every private-instance-method
delegate (`buildDesc`, `buildStereo`, the three link-scanning helpers,
`computeShieldMargins`, `hideTextOffsets`, `requireGroups`) moved to a new
sibling, `EntityImageDescriptionDelegates.ts` (mechanical split, not an
upstream divergence).

`leaf-sizing.ts` (the DOT-layout node-sizing path) is DELIBERATELY left
UNTOUCHED — see decision journal. The DOT gate is therefore provably
unaffected by this iteration for any input.

### New mechanism discovered (I4c mechanism 5 follow-on): embedded-label
### horizontal-line — NOT built, jar-verified and reported

- Mechanism: a non-empty-captured separator-shaped line (`--Header--`,
  `==Header==`, `..Header..`) is `StripeStyleType.HORIZONTAL_LINE` upstream
  too (not a different classification from the bare/empty case) — but
  `CreoleHorizontalLine.create`'s label-drawing branch draws it as TWO SHORT
  `<line>` elements flanking a PLAIN, UNSTYLED `<text>` for the captured
  content, not a single continuous line and not literal delimiter text.
  Jar-verified 2026-07-15 (`-DPLANTUML_DETERMINISTIC_TEXT=true`, `queue
  "queue1\n--Header--\ntoto" as queue3`): `<line x1="7" y1="31"
  x2="10.3938" y2="31"/><text ...>Header</text><line x1="56.3313" y1="31"
  x2="59.725" y2="31"/>`.
- Disposition: not built — out of L1's bold/italic/underline/wave/strike +
  `==`-heading charter (a NEW atom-composition shape, not a style-run
  concern). This port's `classifyStripeLine` reports this shape as `LITERAL`
  (a scoped stand-in, not an upstream classification value) — one plain,
  unmodified, unstyled text run, matching the line's PRE-EXISTING (pre-L1)
  fallback behavior exactly (G1 I9b's own test pin, kept green). Needs its
  own signoff if corpus reach ever justifies it.
- Slugs: component/butebe-90-dozo380-shaped inputs (direct probe only, not
  a corpus fixture at this exact shape — no census fixture currently
  exercises a non-empty-captured separator line in a DOT-frozen or
  census-tracked entity display).

### Corrected pre-existing test pin (diagnosis.md precedent)

- `tests/unit/core/svek/entity-image-description-separator.test.ts`'s "a run
  of 5 dashes ('-----') ... stays literal text" test PINNED A WRONG belief
  written before any creole engine existed in this port (G1 I9b had no
  style-command chain to reach at all — the old `classifySeparatorLine`
  simply never ran the new engine). Jar-verified 2026-07-15: `"-----"`
  reaches the creole style engine as ordinary `NORMAL` text (it matches NO
  separator pattern — `[^-]*` excludes the delimiter char itself), where the
  creole STRIKE syntax (`--...--`, non-greedy) matches `"--" + "-" + "--"`
  and strikes the sandwiched single dash — jar output: one struck-through
  `<text text-decoration="line-through">-</text>`, textLength 4.6375. This
  port's new pipeline reproduces that exact structure. Test corrected to
  assert the jar-verified reality, not the old approximation (diagnosis.md:
  "fix the mechanism, update tests that pinned the old wrong behavior").

### Run-by-run verification (5 points, jar cached SVGs / direct jar probes,
### `-DPLANTUML_DETERMINISTIC_TEXT=true`)

1. **Synthetic minimal fixture** (`rectangle "**bold //and italic// text**\n
   ==Heading One\nplain __underline__ and --strike-- and ~~wave~~" as R1`,
   direct jar probe): 10 `<text>` elements, EXACT structural match both
   sides (element order, `font-weight`/`font-style`/`text-decoration`
   attributes, text content) — bold, nested bold+italic, restore-to-bold,
   `==` heading (font-size 16 + font-weight 700, order 1 → bigger(2)+bold),
   underline, strike, wave. Only x/y/textLength differ (a pre-existing,
   already-documented jarMeasurer-vs-DeterministicMeasurer-under-rectangle
   baseline gap, unrelated to this mechanism).
2. **`component/lurupu-11-fubo915`** line 3 (`<b>this is also <U+221E>
   <font Segoe UI Emoji><U+1F680><U+263A></font> long`, no closing `</b>`):
   our output correctly applies `font-weight="700"` to the entire remaining
   line (legacyEol form); the L2-scope `<font>` tag stays literal text
   WITHIN the bold run rather than crashing or being misrecognized —
   verified against the jar cached SVG's 3-way split (which additionally
   applies the `<font>` family change, L2 scope, not yet built).
3. **`usecase/nenedo-78-fiva569`** (`==label`, `==mylabel` inside
   TIM-`!procedure`-expanded rectangles): both headings render at
   `font-size="16" font-weight="700"` — BYTE-IDENTICAL styling to the jar
   cached SVG's own `==label`/`==mylabel` text runs (order 1 → bigger(2)
   +bold). Verified the I4c mechanism 5 named-suspect slug directly.
4. **`usecase/fepuvo-06-rugi981`** (`__foo1__`, `--foo2--` inside a usecase
   parenthetical display): `__foo1__` correctly recognized as
   `text-decoration="underline"`, `--foo2--` correctly recognized as
   `text-decoration="line-through"` — matches the jar's OWN interpretation
   of these markers (confirmed against the jar cached SVG's separately-split
   `foo1`/`foo2` runs). The surrounding fixture is NOT byte-conformant
   overall: a pre-existing, SEPARATE parser gap (usecase-parenthetical
   `\n`-escape sequences are not converted to real newlines before creole
   processing, unlike `actor X as "..."` forms which already route through
   `finalizeDisplay`/`resolveNewlineEscapes`, I4c mechanism 4) prevents the
   physical-line splitting the jar's multi-line rendering depends on —
   reported here as a newly-observed, OUT-OF-SCOPE gap, not fixed (not a
   style-run or heading concern; would need its own diagnosis pass to find
   which grammar rule builds a usecase's parenthetical display text).
5. **Direct jar probe, `queue "queue1\n-----\ntoto" as queue3`**: confirms
   the corrected test pin above (single struck-through `-`, textLength
   4.6375) and `"queue1\n--Header--\ntoto"` (embedded-label mechanism,
   new-and-reported above).

### Sub-classification note (mission's "sub-classify first" instruction)

`component/tuliba-37-liza126` and `component/turasu-73-zoni468` (named in
the mission's acceptance-surface list) were inspected and found to carry NO
bold/italic/underline/wave/strike/heading markup in their entity display
text at all — their I4c mechanism 6 reach comes from sprite resolution
(`jar:archimate/...` scoped sprite names) and skinparam/note/tooltip
content, unrelated to L1's style-run charter. Excluded from the L1
verification set as mis-classified reach (not sub-classified as "L1-pure"
by this iteration; their actual gap is out of L1 scope entirely).

### Stubs / deferred (all journaled in `plans/e2r-creole/decision-journal.md`)

- `<size:>`/`<back:>`/`<color:>`/`<font>`/`<u:color>`/`<U+NNNN>`/`<code>`/
  `[[url]]` atom-splitting/`<latex>` — L2, mission brief NOT-in-scope list.
- Word-wrap, multi-line note bodies — L3.
- Bullet lists (`LIST_WITHOUT_NUMBER`/`LIST_WITH_NUMBER`) — not classified,
  not rendered, zero L1 acceptance-fixture reach.
- `FontStyle.PLAIN`/`FontStyle.BACKCOLOR` commands — not registered in
  `CommandCreoleBuilder.ts`'s L1 command map.
- The embedded-label horizontal-line mechanism (new finding, above).
- `leaf-sizing.ts` box/actor/usecase/note sizing formulas do not yet account
  for creole-style-markup-stripped width or heading-font-driven height
  growth (deliberately left byte-identical to pre-L1 — decision journal).

### Census (`npx tsx scripts/svg-conformance-census.ts`, DeterministicMeasurer)

Baseline (mission brief, pre-L1): 48/355, 1-3:28, 4-10:81, 11-30:62, 31+:135,
errors:1.

L1 (post-cutover): 48/355, 1-3:28, 4-10:84, 11-30:62, 31+:132, errors:1.

- 0-diff (ratchet-pinned) set: UNCHANGED, verified byte-identical to
  `oracle/goldens/svg-description/ratchet.json`'s 48 pinned slugs (diffed
  programmatically — zero difference).
- 4-10 bucket: +3 (81→84). 31+ bucket: -3 (135→132). Net: 3 fixtures moved
  from the highest-divergence bucket into a much-lower one — a magnitude
  IMPROVEMENT, not a regression (some previously badly-broken fixtures now
  partially render their creole markup correctly). Not individually
  re-diagnosed this iteration (out of L1's charter — full re-diagnosis of
  every moved fixture is an L2/L3-scale accounting pass); no fixture moved
  INTO a worse bucket.
- Tripwire (48 conformant + 48 ratchet pins intact): CONFIRMED.

### DOT gate (`npx tsx scripts/dot-sync-report.ts component usecase class
### object state`)

component 262/262 · usecase 90/90 · class 708/708 · object 78/80 ·
state 267/267 — EXACTLY the frozen baseline, unchanged. Provably guaranteed
by `leaf-sizing.ts` being byte-untouched this iteration (see decision
journal).

## L2 — the inline directives on top of L1's atom-model core

### Sub-classification (mission's "sub-classify first" instruction)

Built a temporary classifier (`/tmp` scratchpad, not committed) that scanned
the full mechanism-6 slug list plus a full-corpus `.puml` grep for each
directive's marker (`<size:`, `<back:`, `<color:`, `<font `, `<u:`, `<U+`,
`<code>`, `[[...]]`, `<latex>`), giving per-directive corpus reach:

| Directive | Corpus reach (component+usecase) | Priority basis |
|---|---|---|
| `[[url]]` | 13 fixtures | highest single-directive reach |
| `<color:>` (usually paired with `<size:>` around a sprite/tech label) | ~17, mostly the `//<size:N>[tech]</size>//` procedure-generated pattern | 2nd |
| `<size:>` | ~11 (near-total overlap with `<color:>`) | tied |
| `<back:>` | 4 — **100% overlap with `<latex>` reach** (every `<back:>` fixture also has `<latex>` inside it) | low marginal value |
| `<latex>` | 4 (2 named acceptance: sunuju-01-pote718, vimulo-11-buni641) | named acceptance |
| `<u:color>` | 3 | low |
| `<U+NNNN>` (still-unresolved TIM-string-interpolation case) | 4 | named acceptance (gafico-37-cuma657, nujito-06-neca370) |
| `<code>` | 2 (SAME 2 fixtures as the U+ case) | named acceptance |
| `<font size=/color=>` / `<font:family>` | 1 (lurupu-11-fubo915, already partly ledgered by L1) | low |

Built (jar-verified before implementation, per fixture below): `<size:>`,
`<color:>`, `<font size=/color=>`, `<font:family>`, `<latex>`, `[[url]]`
atom-splitting. Deferred with mechanism notes (see below): `<back:>`,
`<u:color>`, `<U+NNNN>`-inside-TIM-strings, `<code>`.

### Architecture correction: unified atom+command scan (prerequisite,
### discovered via jar-verifying `<color:>` against its dominant reach shape)

- Mechanism: L1's `buildStripeAtoms` ran `scanLineForAtoms` (T6's img/sprite
  recognizer) as a PRE-PASS over the whole line, splitting it into
  text/atom/text segments, THEN ran the style-command engine on each
  resulting TEXT segment independently. This is provably wrong whenever a
  color/size/font command's captured inner text itself CONTAINS an atom
  (`<color:red><$Batch></color>` — **10 of the corpus's 17 `<color:>`
  fixtures wrap a sprite this way**, not an edge case): the pre-pass splits
  the activation tag into one segment and the deactivation tag into a LATER
  segment (the atom sits between them), so the command's "shortest run up to
  the deactivation tag" search never sees its own closing tag (not in the
  same segment) and falls through as literal, unstyled text — differently
  wrong from the jar. Jar-verified 2026-07-15 (`usecase/nenedo-78-fiva569`,
  entities "0"/"1"/"2": `<color:red><$Batch></color>` renders as ONE sprite
  `<image>`, no literal `<color:red>`/`</color>` text anywhere in the jar's
  own SVG). Root cause: upstream's REAL architecture is a single unified
  per-character scan — `CommandCreoleImg`/`CommandCreoleSprite` are
  registered in the exact SAME `searchCommand` starter map as the
  style/size/color commands (`CommandCreoleBuilder.java` :106,114); there is
  no separate "atom pass" upstream at all.
- Disposition: fixed. Per this project's "upstream architecture is
  authoritative — rewrites are allowed" rule (L1's own composition choice
  was a deliberate, journaled divergence that this fixture-reach evidence
  now falsifies for the L2 directive-command corpus): `StripeSimple.ts`'s
  `modifyStripe` now tries a creole command first, then an inline-atom match
  at that exact position (`creole-atoms.ts#matchAtomAt`, a NEW additive
  export reusing T6's already-tested img/sprite regex recognizers rather
  than re-deriving them), then falls back to plain-text accumulation.
  `buildStripeAtoms` now calls the builder ONCE on the raw line instead of
  pre-segmenting. Behavior-preserving for every input with no atom/command
  boundary crossing — proven both by the pre-existing 87-test
  `StripeSimple.test.ts`/`CreoleStripeSimpleParser.test.ts`/
  `entity-image-description*.test.ts` suites staying green UNCHANGED, and by
  the census zero-diff (48) + ratchet (48) sets being byte-identical before
  and after this refactor, measured in isolation before any new command was
  registered.
- An observed consequence, NOT a defect (see "unmasking" findings below):
  fixing this composition means creole tags are now correctly CONSUMED
  (not rendered as literal garbage text) on fixtures that previously had a
  `svg/g[N][childCount]` structural mismatch masking whatever lay beneath —
  once childCount matches, `compareSvg` recurses further and surfaces
  pre-existing, unrelated, out-of-scope diffs that were previously hidden.
  Same masking-artifact pattern as I5's mechanism B (G1 ledger).

### Per-directive table

| Directive | Upstream class | This port | Jar-verified fixture | Status |
|---|---|---|---|---|
| `<size:N>...</size>` / EOL | `CommandCreoleSizeChange` | `command/CommandCreoleSizeChange.ts` | `usecase/nenedo-78-fiva569` (`//<size:12>[technology]</size>//` → `font-size="12" font-style="italic"`, byte-match) | built |
| `<color:name-or-hex>...</color>` / EOL | `CommandCreoleColorChange` | `command/CommandCreoleColorChange.ts` | same fixture; `<color:red><$Batch></color>` → sprite atom, tags consumed (jar draws the sprite untinted too — see OBSERVATION below) | built |
| `<font size=N color=X>...</font>` / EOL | `CommandCreoleColorAndSizeChange` | `command/CommandCreoleColorAndSizeChange.ts` | direct probe (no isolated corpus fixture; reach overlaps `<font Segoe UI Emoji>` in `usecase/lurupu-11-fubo915`, still not byte-conformant — that fixture also needs `<U+221E>`/multi-attr `<font family>` support) | built |
| `<font:family>` / `<font Family>` / EOL | `CommandCreoleFontFamilyChange` | `command/CommandCreoleFontFamilyChange.ts` | direct probe; disambiguated from ColorAndSizeChange by registration order (a bare `<font:X>` has no `size=`/`color=` attr, so ColorAndSizeChange's stricter pattern fails to match first) | built |
| `<latex>expr</latex>` | `CommandCreoleLatex` | `command/CommandCreoleLatex.ts` + `latex.ts#renderLatexAsImage` (new export) | `component/sunuju-01-pote718`, `vimulo-11-buni641` (both structurally present now — an `<image>` element exists where none did before — but NOT byte-conformant: jar embeds a JLaTeXMath-rendered `data:image/svg+xml` payload, this port a KaTeX one; see `renderLatexAsImage`'s doc comment) | built, structurally-only (can never be byte-conformant, documented) |
| `[[url]]` / `[[url label]]` / `[[url {tooltip}]]` atom-splitting | `CommandCreoleUrl` | `command/CommandCreoleUrl.ts` | `usecase/bivira-53-boja685` (jar: resolved label as its own `<text fill="#0000FF" text-decoration="underline">`, wrapped in `<a href>`) | built: label-splitting + hyperlink text styling (`#0000FF` + underline, matches the jar's OWN attrs). NOT built: the `<a href>` SVG wrapper element itself — shares a pre-existing, whole-missing subsystem with entity-level `url of X is [[...]]` (`EntityImageDescription.ts`'s own "entity hyperlinks (Url) are not supported" gap, confirmed still present) — out of this directive's narrower charter, needs its own signoff |
| `<back:color>...</back>` | `CommandCreoleStyle.createLegacy(FontStyle.BACKCOLOR)` | not built | `component/sunuju-01-pote718` (`<back:gray><latex>...</latex></back>`) — **100% of this directive's 4-fixture corpus reach also contains `<latex>`**, so its jar effect is entirely baked into an opaque embedded image byte-stream this port cannot reproduce regardless; zero marginal conformance value this iteration | deferred — no corpus fixture isolates `<back:>` from `<latex>`; needs its own signoff if reach ever appears independently (would need a new `FontConfiguration.backColor` field + `driver-text-svg.ts` background-rect emission, both currently absent) |
| `<u:color>...</u>` | `CommandCreoleStyle` underline w/ extended color | not built | `usecase/camevo-41-suki094` (`<u:red>Transparent: KO`) — jar-verified: draws the underline as a SEPARATE `<line stroke="#FF0000" stroke-width="0.5">` element positioned under PLAIN BLACK text, NOT a CSS `text-decoration` color — a genuinely different rendering primitive than this port's current `UNDERLINE` flag (CSS `text-decoration:underline`, inherits `fill`) | deferred — needs an `extendedColor` field threaded through `AddStyle`/`FontConfiguration`/`CreoleAtom`, plus a NEW draw-time `<line>` emission in `drawAtoms` (`EntityImageDescriptionSupport.ts`); 3-fixture reach, ledgered for signoff |
| `<U+NNNN>` inside a TIM-interpolated string | already fixed at a HIGHER layer for the non-TIM case (L1 decision journal) | not built for the TIM-string case | `component/gafico-37-cuma657`/`nujito-06-neca370` (`!$var=" aaa <U+000A> bbb ..."`) — `resolveTextEscapes`/`finalizeDisplay` (G1 I4c mechanism 1) runs on the FINAL assembled `node.display` string; a TIM `!$var=` STRING LITERAL is stored and later interpolated via `$var` reference WITHOUT ever passing back through that escape-resolution pass — confirmed via direct read: TIM string assignment/interpolation (`src/core/tim/`) has no `resolveTextEscapes` call anywhere in the substitution path | deferred — needs a TIM-layer fix (run escape resolution at variable-interpolation time, or at the point a `$var`-substituted value re-enters `node.display`), out of E2r's creole-engine charter entirely (a TIM subsystem gap, not a creole gap); the SAME 2 named fixtures also need `<code>` and `<u:color>` before they can be byte-conformant — genuinely multi-mechanism, not a single fix |
| `<code>...</code>` verbatim block | **mission brief's characterization was wrong — corrected here** | not built | `component/gafico-37-cuma657` entity "c" — jar-verified 2026-07-15: renders the ENTIRE captured content as ONE literal, UNPROCESSED `<text font-family="monospace">` run, with EVERY nested creole marker (including `<U+000A>`, `<u:blue>`, `<color:green>`) shown as raw escaped text (`&lt;U+000A&gt;`, etc.) — `<code>` is NOT a `StripeStyleType`/`CreoleStripeSimpleParser` classification (verified: `StripeStyleType.java`'s enum has no CODE value, and no `CommandCreoleCode` exists in `CommandCreoleBuilder.java`'s registration list at all — the mission brief's "CreoleStripeSimpleParser's CODE handling" premise does not exist upstream). The real mechanism lives OUTSIDE the legacy creole engine entirely (upstream's dead `klimt/creole/Parser.java`, per L1's own verified "not ported" finding — grep confirms no live `<code` handling anywhere in the reachable engine either, meaning this may be a preprocessor/display-string special case this port has not yet located) | deferred, mechanism CORRECTED (not "genuinely blocked", contra the old I4c note) but ORIGIN NOT YET LOCATED — needs its own diagnosis.md pass to find where upstream actually intercepts `<code>` before the creole engine runs, then a simple "detect tag, mark verbatim + monospace, skip creole" span, much simpler than the multi-line-block model the mission brief assumed |

### OBSERVATION: `<color:>` wrapping a sprite has NO visual effect in the
### jar (verified, not a bug in this port)

`usecase/nenedo-78-fiva569`'s own embedded comment says it plainly:
"OBSERVATION 1: the next line does not work - sprite is white - not red" for
`<color:$colour><$Batch*$scale></color>`. Confirmed independently: the jar's
`CommandCreoleColorChange`/`CommandCreoleSprite` are two SEPARATE commands
sharing no state — color only ever mutates `FontConfiguration`, which
`AtomSprite`'s OWN rendering never reads (a sprite's fill color comes ONLY
from its own `<#RRGGBB$name>` forced-prefix or `{color=X}` block param).
This port's fix (the tag is now CONSUMED, the sprite drawn with no color
effect) matches this exactly — do NOT "improve" this by tinting the sprite
from the surrounding `<color:>` in a future iteration; that would be a new
divergence from the jar's own (admittedly counter-intuitive) behavior.

### NEW finding (out of L2 scope, reported): `paint.fontStereo` incorrectly
### carries `ITALIC` for at least one corpus shape

- Mechanism: `usecase/seneso-72-cuje674`/`fuvosu-10-lixu251`/
  `cuzuci-92-dugi933` all declare a stereotype containing creole italic
  markup around a TIM variable (`<<//$alias//>>`). Once L2's architecture
  fix lets `buildStereo`'s "«" + creole-processed-content + "»" split reach
  full structural correctness (jar-verified: only the MIDDLE run is
  italic — `«`/`»` are plain), this port's OWN output shows ALL THREE runs
  italic. Instrumented directly (temporary `console.error`, removed):
  `paint.fontStereo` (the font `buildStereo` is CALLED with) already carries
  `ITALIC` in its base `styles` set BEFORE any creole processing runs — so
  `//...//`'s "add ITALIC" is a no-op and the SAVED/RESTORED font (still
  italic) leaves the surrounding "«"/"»" italic too. This is a font
  RESOLUTION bug (wherever `paint.fontStereo` is computed for a usecase
  stereotype, unrelated to `EntityImageDescriptionDelegates.ts#buildStereo`
  or any L2 creole command) — NOT a defect in this iteration's new code.
- Disposition: not fixed here — out of L2's directive-command charter,
  needs its own diagnosis.md pass to find where `paint.fontStereo` gets its
  (wrong) initial style set for a usecase stereotype context. Newly exposed
  by L2's architecture fix (previously masked by a `[childCount]` structural
  mismatch on the same fixtures — see the "unmasking" pattern below), not
  newly introduced.
- Slugs: usecase/{seneso-72-cuje674,fuvosu-10-lixu251,cuzuci-92-dugi933}
  (3 fixtures moved from the 4-10 bucket to the 11-30 bucket — diagnosed,
  confirmed NOT a regression in the code this iteration wrote, see below).

### Regression diagnosis (per diagnosis.md — 4 fixtures crossed a census
### bucket boundary; all 4 traced to the SAME "unmasking" mechanism, not a
### defect in this iteration's commands)

Before/after per-fixture diff-path comparison (git-worktree baseline vs
this branch, both measured with the SAME `svg-conformance-census.ts`):
`usecase/cuzuci-92-dugi933` (5→19, 4-10→11-30),
`usecase/fuvosu-10-lixu251` (5→22, 4-10→11-30),
`usecase/seneso-72-cuje674` (5→22, 4-10→11-30),
`usecase/nenedo-78-fiva569` (19→70, 11-30→31+).

- Mechanism: in EVERY case, the pre-L2 diff list contained a blanket
  `svg/g[N][childCount]` entry (a whole-subtree structural mismatch —
  `compareSvg` does not descend further once childCount disagrees). L2's
  architecture fix makes the creole engine correctly CONSUME `<color:>`/
  `<size:>`/stereotype-italic markup instead of emitting extra literal-tag
  text nodes, so childCount now MATCHES on these fixtures — which lets
  `compareSvg` recurse into the subtree and surface whatever OTHER,
  unrelated diffs already existed underneath (verified via
  `git worktree add` of the pre-L2 commit + a patched, disposable
  `--diffpaths`/`--dump` instrumentation of `svg-conformance-census.ts`,
  reverted before finishing — not committed).
- Root causes surfaced (both pre-existing, both out of L2 scope, both
  confirmed via direct value comparison against the jar SVG, not guessed):
  1. `leaf-sizing.ts`'s box-sizing formulas measure raw markup text
     (untouched, per this mission's DOT-frozen boundary and L1's own
     already-ledgered residual) — `usecase/nenedo-78-fiva569` entity "3":
     our rect is 115.46×152.31 vs the jar's 97.875×146.9231, a PRE-EXISTING
     gap (confirmed: this same box was ALREADY oversized before L2, just
     masked by the childCount mismatch).
  2. The `paint.fontStereo`-carries-ITALIC bug documented above.
- Ruled out: a defect in this iteration's SIZE/COLOR/LATEX/URL command
  logic — the isolated-fixture jar comparisons above (`nenedo-78-fiva569`'s
  `<size:12>[technology]</size>` and `<color:red><$Batch></color>` spans)
  are BYTE-EXACT against the jar's own text runs; the census diff-count
  increase traces entirely to unmasking, matching G1 ledger's I5 mechanism
  B precedent ("fixing a structural mismatch lets compareNodes recurse
  further and unmask pre-existing, unrelated, already out-of-scope geometry
  diffs — not a regression").
- No fixture moved INTO the DOT-frozen structural set or off the 48-fixture
  ratchet; DOT gate re-verified EXACTLY frozen (below).

### Census (`npx tsx scripts/svg-conformance-census.ts`, DeterministicMeasurer)

L1 baseline (this iteration's start): 48/355, 1-3:28, 4-10:84, 11-30:62,
31+:132, errors:1.

L2 (final): 48/355, 1-3:28, 4-10:83, 11-30:62, 31+:133, errors:1.

- 0-diff (ratchet-pinned) set: byte-identical to
  `oracle/goldens/svg-description/ratchet.json`'s 48 pinned slugs (diffed
  programmatically both before AND after — zero difference; the exact same
  48 slugs).
- Net bucket movement is small (4-10: -1, 31+: +1) but MASKS a larger
  underlying churn: 9 fixtures changed diff count this iteration (5
  improved: `component/gafico-37-cuma657` 77→37, `usecase/jecici-56-bimu826`
  123→109, `usecase/kofuca-08-pafi749` 52→50, plus 2 more within-bucket
  improvements; 4 regressed within/across a bucket boundary, all diagnosed
  above as the SAME unmasking pattern, not new defects). Full-corpus
  before/after magnitude scan performed via a temporary `git worktree`
  baseline (removed) diffing every fixture's per-slug diff count, not just
  bucket totals.
- Tripwire (48 conformant + 48 ratchet pins intact): CONFIRMED.

### DOT gate (`npx tsx scripts/dot-sync-report.ts component usecase class
### object state`)

component 262/262 · usecase 90/90 · class 708/708 · object 78/80 ·
state 267/267 — EXACTLY the frozen baseline, unchanged. `leaf-sizing.ts` is
byte-untouched this iteration (grep-verified, zero diff against HEAD).

### Files changed

- `src/core/creole-atoms.ts` (additive: `matchAtomAt`, `AtomMatchAt`)
- `src/core/klimt/creole/atom/Atom.ts` (additive: `'latex'` CreoleAtom variant)
- `src/core/klimt/creole/command/Command.ts` (additive: `StripeBuilder#pushLatexAtom`)
- `src/core/klimt/creole/command/CommandCreoleSizeChange.ts` (new)
- `src/core/klimt/creole/command/CommandCreoleColorChange.ts` (new)
- `src/core/klimt/creole/command/CommandCreoleColorAndSizeChange.ts` (new)
- `src/core/klimt/creole/command/CommandCreoleFontFamilyChange.ts` (new)
- `src/core/klimt/creole/command/CommandCreoleLatex.ts` (new)
- `src/core/klimt/creole/command/CommandCreoleUrl.ts` (new)
- `src/core/klimt/creole/legacy/CommandCreoleBuilder.ts` (registers the six new commands, upstream order)
- `src/core/klimt/creole/legacy/StripeSimple.ts` (architecture fix — unified atom+command scan; `pushLatexAtom` impl)
- `src/core/latex.ts` (additive: `renderLatexAsImage`)
- `src/core/svek/image/EntityImageDescriptionSupport.ts` (measure/draw the new `'latex'` atom kind)
- `tests/unit/core/klimt/creole/command/CommandCreoleL2.test.ts` (new, 27 tests)

## L3 — word-wrap + multi-line note bodies + mission close

### Word-wrap: upstream mechanism (render-only vs sizing-coupled) — the
### evidence, per the mission's CAUTION boundary

- Mechanism located: `style.wrapWidth()` (`Style.java:292`, `PName
  .MaximumWidth`, mapped from the `wrapWidth` skinparam —
  `FromSkinparamToStyle.java:250`) is passed to `BodyFactory.create3`
  (`EntityImageDescription.java`'s `desc` ONLY — NOT `name`/title, NOT
  `stereo`) and to `EntityImageNote.java`'s own `textBlock`. Both feed a
  `SheetBlock1(sheet, maxWidth, ...)`, whose `initMap` calls `new
  Fission(stripe, maxWidth).getSplitted(stringBounder)` INSIDE
  `calculateDimension`/`drawU` — i.e. wrapping is computed as part of the
  SAME TextBlock both DOT-node-sizing (`EntityImageDescription
  .calculateDimensionSlow` reuses `desc`) and rendering read. **This is
  sizing-coupled, not render-only** — jar-verified: `EntityImageDescription
  .calculateDimensionSlow` calls `asSmall.calculateDimension()`, and
  `asSmall` wraps `desc` (the SAME wrapped `TextBlock`), so a real
  `skinparam wrapWidth` DOES change a wrapping entity's DOT node
  dimensions in the jar.
- Per the mission's explicit CAUTION instruction ("if matching the jar
  would move OUR frozen DOT counts, STOP and report — do not touch
  leaf-sizing without that report"): checked whether ANY fixture in the
  frozen `component`/`usecase`/`class`/`object`/`state` DOT-cache corpus
  (the literal set `dot-sync-report.ts` measures) sets `wrapWidth`
  (directly, via the `wrap_width` underscore alias, or transitively via
  `!include <awslib{10,14,20}/AWSCommon>`, which itself declares
  `skinparam wrapWidth 200` at its own top level — jar-verified,
  `assets/stdlib/awslib{10,14,20}/AWSCommon.puml`): exactly ONE
  DOT-frozen fixture does, `component/mejoxi-96-cegu294` (`skinparam
  wrapWidth 200` directly). Re-ran `dot-sync-report.ts` AFTER landing
  this iteration's full render-path word-wrap: component 262/262
  unchanged, EXACTLY the frozen baseline — because `leaf-sizing.ts` was
  left byte-untouched (grep-verified zero diff against HEAD) and
  `mejoxi-96-cegu294`'s DOT emission is computed entirely independently
  of `buildTextBlock`/`Fission.ts` (this port's `layout.ts`/
  `leaf-sizing.ts` never call into the render-path text-construction
  seam at all — same structural separation L1 already established and
  re-verified here). **Report, not a stop**: matching the jar's real
  sizing-coupled behavior in `leaf-sizing.ts` is real, deferred work
  (this port's box for `mejoxi-96-cegu294` is measured from raw,
  un-wrapped display text — a pre-existing gap, unchanged by this
  iteration) — but it provably does not move ANY currently-frozen count,
  so the STOP condition never triggers. Ported: RENDER PATH ONLY, per
  L1's own established precedent for the rest of the creole engine
  (`leaf-sizing.ts`'s own decision-journal entry).
- What was ported: `src/core/klimt/creole/Fission.ts` — `Fission.java` +
  `Neutron.java`/`NeutronType.java` (word-boundary Neutron scan +
  greedy line-packing, `getSplitted`), onto this port's plain-data
  `CreoleAtom[]` model (no header/bullet-list support, matching L1's own
  scope). Wired: `theme.wrapWidth?: number` (new top-level scalar,
  `theme.ts`/`skinparam.ts`, same pattern as `nodeSep`/`rankSep`) ←
  `skinparam wrapWidth`/`wrap_width` → `EntityImageDescriptionPaint
  .wrapWidth` (applied ONLY to `buildDesc`, matching upstream's own
  `desc`-only application) and to the note-body cutover (below).
  `buildTextBlock`'s new 5th param `maxWidth` (additive, default 0 —
  every pre-L3 call site unchanged) triggers `buildWrappedLines` inside
  `calculateDimension`/`drawU`.
- Fixture verification: an EARLIER version of this ledger claimed ZERO
  corpus reach (based on grepping only the literal strings
  `wrapwidth`/`maximumwidth` against the mission brief's own ~34-fixture
  candidate slug list) — WRONG, corrected here per diagnosis.md ("fix
  the mechanism, correct the record, don't let a stale claim stand").
  Real reach (exhaustive corpus-wide grep, 2026-07-15): 5 census
  fixtures — `component/mejoxi-96-cegu294` (direct `skinparam wrapWidth
  200`), `usecase/{kovaxi-11-reti348,zidebi-71-nocu387}` (`skinparam
  wrap_width 150`), `usecase/{fariba-82-xolu802,kofuca-08-pafi749}` (via
  the AWS `!include`). Jar-verified against `usecase/fariba-82-xolu802`'s
  cached oracle SVG directly: the `User(user, "Trusted user", "")`
  AWS-macro entity's `==Trusted user` heading (85.3px, nowhere near the
  200px limit — never visually wraps) STILL splits into 3 separate
  `<text>` runs in the JAR'S OWN SVG ("Trusted"/" "/"user", textLength
  54.2/4.4/31.1) — BYTE-IDENTICAL textLength to what this port's
  `getSplitted` now produces for the same input. Confirms `Fission
  .getSplitted` unconditionally decomposes into per-Neutron atoms once
  `maxWidth != 0`, regardless of whether any actual break occurs — a
  faithful, jar-verified port, not a bug.
- Census impact: `mejoxi-96-cegu294` (component, 6→50 diffs, 4-10→31+),
  `fariba-82-xolu802` (usecase, 14→31, 11-30→31+), `kofuca-08-pafi749`
  (usecase, 50→73, stays 31+) all moved to a HIGHER raw diff count.
  Diagnosed per diagnosis.md (not assumed): each is the SAME
  "unmasking" mechanism L2 already documented (I5 mechanism B / this
  project's precedent) — a `svg/g/g[childCount]` structural mismatch
  FIXED (childCount now matches the jar exactly, confirmed via
  before/after diff-path set subtraction: `svg/g[1]/g[1][childCount]`
  is in the "FIXED" set for all 3), which lets `compareSvg` recurse
  deeper and surface PRE-EXISTING, unrelated, already out-of-scope
  leaf-sizing/positioning diffs (image/rect/text x/y coordinates, font
  metrics) that were always there, just hidden behind the blanket
  childCount mismatch. `mejoxi-96-cegu294` additionally FIXED
  `svg/@height`/`svg/@viewBox[3]` (its overall canvas height moved
  CLOSER to the jar's, not further) — more evidence this is progress,
  not regression. `kovaxi-11-reti348`/`zidebi-71-nocu387` (the 2
  `wrap_width` fixtures): NO diff-count change — their content never
  reaches a composite `<size:>`/`<color:>`/heading pattern that exposes
  new geometry. No fixture moved OUT of the 48-conformant/ratchet set.
  Not further drilled this iteration (the residual leaf-sizing/
  positioning gap under wrap is real, separate work — candidate for a
  future iteration once corpus reach is re-measured; out of L3's
  word-wrap-mechanism charter).

### Multi-line note bodies — cutover outcome

- Mechanism: `src/diagrams/description/renderer-entity.ts#drawNoteFallback`
  (the `node.symbol === 'note'` fallback — descdiagram notes have no
  `USymbol`/`EntityImageDescription` mapping in this port, a pre-existing,
  documented approximation) previously did its OWN manual `\n`-split and
  drew each line as ONE literal `UText` run at an approximated
  `theme.fontSize + 4` line-height offset — no creole engine at all, so
  nested inline style runs, `==` headings, `<img>`/`<$sprite>`/`<latex>`
  atoms, and (per this iteration) word-wrap never applied inside a note
  body. Upstream: `EntityImageNote.java`'s `textBlock` is built via the
  SAME `BodyFactory.create3` `EntityImageDescription.java`'s `desc` uses
  (`marginX1 = 6`, `marginY = 5`, `HorizontalAlignment.LEFT` — jar-verified
  against `component/basetu-75-xevi153`, single-line: box top-left
  (127.62,17.5), text (133.62,32.6111) → x offset 6.0, y offset 15.1111 =
  `marginY(5)` + this port's OWN already-correct font-baseline math; and
  `component/fojamu-08-veku866`, 3-line note: every line shares the SAME
  x=24.48 offset from its box's left edge, confirming LEFT alignment, not
  centered).
- Disposition: fixed. `drawNoteFallback` now calls `buildTextBlock
  (node.display, font, HorizontalAlignment.LEFT, resolveAtomImage,
  theme.wrapWidth ?? 0)` — the SAME L1/L2/L3 creole pipeline every other
  entity's text already routes through — then draws it via `NOTE_MARGIN_X
  = 6, NOTE_MARGIN_Y = 5` (named constants, jar-verified above), reusing
  `makeAtomImageResolverFor(sprites)` so notes can now also resolve
  `<$sprite>`/`<img>` atoms.
- **Regression found + fixed during this cutover** (per diagnosis.md — a
  genuine defect, not an unmasking artifact): a note body containing a
  bare creole separator line (`----`/`====`/`....`) now builds a
  `UHorizontalLine` atom (the SAME `HORIZONTAL_LINE` classification path
  entity descriptions already exercise) — but `UHorizontalLine#drawMe`
  REQUIRES an `AbstractUGraphicHorizontalLine`-derived wrapper (e.g.
  `UGraphicStencil`) to intercept it; entity descriptions get this for
  free from their own `USymbol#asSmall`'s per-symbol curved-cap wrapper
  (`USymbolQueue`/`USymbolNode`/`USymbolDatabase`'s own `MyUGraphicXxx`
  inner classes), but `drawNoteFallback` drew directly with no such
  wrapper. Root cause confirmed via instrumented repro (not guessed):
  `test-results/dot-cache/usecase/pivudu-29-pele178`
  (`note left\nC\n----\nD\nend note`) crashed with `LimitFinder.draw:
  unsupported shape UHorizontalLine` — thrown from `renderer-ink-extent
  .ts`'s document-wide "collect pass" (draws the ENTIRE diagram through a
  bare `LimitFinder`-wrapped `UGraphic` to compute final canvas bounds,
  `TextBlockUtils.getMinMax`'s own `LimitFinder` walk). Confirmed
  upstream's OWN `klimt/drawing/LimitFinder.java` has NO `UHorizontalLine`
  branch either (full method inspected) — this shape is UNCONDITIONALLY
  unmeasurable without the stencil wrapper in both codebases; the gap was
  latent (no note ever produced this shape before this cutover) not a
  new invention. Fixed at origin, matching `EntityImageDescription.ts
  #drawU`'s own identical pattern (`UGraphicStencil.create(ugDesc,
  dimDesc)` around its `desc` draw): `drawNoteFallback` now wraps its
  translated `ug` with `UGraphicStencil.create(translated, dim)` before
  calling `block.drawU(...)`. Re-verified: `npx vitest run` full suite
  green (8615/8615), `pivudu-29-pele178`'s DOT-parity ratchet test passes.
- Slugs (35 note-bearing census fixtures, corpus-scan-confirmed via
  `note`/`end note`/`note left`/`note right`/`note top`/`note bottom`
  grep): none of the 3 diff-count-changing fixtures from this cutover
  overlap with the word-wrap set above (no note fixture sets `wrapWidth`);
  no note fixture moved OUT of the 48-conformant/ratchet set (confirmed —
  zero note-keyword fixtures exist in the ratchet set at all, grep-verified
  against all 48 pinned `in.puml` sources). Full before/after diff-count
  comparison across all 355 fixtures (via a disposable `git worktree`
  baseline, removed) confirms exactly 3 fixtures changed diff count this
  iteration TOTAL (the word-wrap set above) — the notes cutover itself,
  in isolation, produced ZERO diff-count change on any of the 35
  note-bearing fixtures (their existing gaps — box shape being a plain
  `rect` instead of upstream's `Opale` folded-corner polygon, a
  pre-existing, separately-ledgered G1-territory divergence out of this
  cutover's scope — already dominate their diff counts before and after).

### `paint.fontStereo`-carries-ITALIC bug — investigated, NOT a small fix,
### left named (per the mission's explicit fallback instruction)

- Re-investigated (per diagnosis.md, before deciding disposition):
  confirmed `AddStyle.java#apply` (`initial.add(style)`) is an idempotent
  SET UNION for every `FontStyle` except `PLAIN` (which clears the whole
  set) — NOT a toggle. Confirmed a PLAIN literal stereotype with no
  creole markup (`component/betidu-24-xuku720`'s `«static lib»`) DOES
  render fully italic in the jar's own cached SVG
  (`font-style="italic"` on the WHOLE `<text>` run, including the
  guillemets) — meaning `fcStereo`'s BASE font genuinely does carry
  ITALIC by default upstream too, for the plain case. This means the
  fix cannot be "stop defaulting fontStereo to italic" (that would break
  every plain-stereotype fixture, including several already
  ratchet-conformant ones) — the real mechanism must be that the
  TIM-variable-containing composite case (`<<//$alias//>>`) reaches the
  creole engine with a DIFFERENT (non-italic) base font than the plain
  case, OR upstream's `CommandCreoleBuilder`'s close-tag "restore"
  operation for a `//../..//` pair does something other than a
  save/replay of the pre-activation `FontConfiguration` (which — if it
  literally restored the SAME italic base — would NOT explain the
  guillemets being plain either). Root cause NOT conclusively located
  within this iteration's remaining budget: would require tracing
  `CommandCreoleBuilder.java`'s registered close-tag command
  (`AddStyle`'s inverse / the deactivation `Command`) plus exactly which
  `Style`/`FontParam` resolution path a TIM-variable-bearing stereotype
  reaches vs. a literal one — genuinely a multi-mechanism investigation,
  not "a small origin fix", per the mission's own fallback instruction
  ("otherwise leave it named"). Disposition: left named, not fixed.
  Needs its own diagnosis.md pass.
- Slugs (unchanged from L2's own finding): `usecase/{seneso-72-cuje674,
  fuvosu-10-lixu251,cuzuci-92-dugi933}`.

### Refreshed accounting — family-level (see "Accounting completeness"
### note below for scope)

`--families` re-scan (`npx tsx scripts/svg-conformance-census.ts
--families`), post-L3, 355 fixtures, DeterministicMeasurer:

| Family | Fixture reach | Diff instances | Named mechanism |
|---|---|---|---|
| `svg/@height`, `svg/@width` | 260, 243 | 260, 243 | leaf-sizing.ts creole-stripped-width/heading-font-height gap — already ledgered (E2r/L1 decision journal: "box/actor/usecase/note sizing formulas do not yet account for creole-style-markup-stripped width or heading-font-driven height growth") |
| `svg/g/g/text/@x`, `@y` | 187, 175 | 940, 833 | downstream of the same leaf-sizing gap (text position is box-relative) |
| `svg/g/g/path/@d` | 144 | 6259 | edge/spline routing + entity decoration paths — graphviz-ts layout territory (OUT OF SCOPE, `CLAUDE.md`) and/or downstream box-size cascade |
| `svg/g/g/rect/@x,@y,@width,@height` | 132/107/60/59 | — | same leaf-sizing family |
| `svg/g/g/polygon/@points` | 125 | 3129 | decoration/shape geometry, same downstream cascade |
| `svg/g/g[childCount]` | 76 | 158 | G1 I5's sub-families A–M (already classified: chrome nesting, multi-stereotype, bracket-body `\n`, transparent-color, link-endpoint, lollipop decor, sprite path-count, content-`<g>`-wrapper (I5g, queued), `<linearGradient>` count) — re-verified unchanged this iteration (I5's own sub-classification still applies; no new childCount sub-family observed) |
| `svg/g/g/ellipse/@cx,@cy` | 74/72 | — | same leaf-sizing/downstream family (actor/ellipse entity sizing) |
| `svg/g/g/line/@x1,@x2,@y1,@y2` | 60/58/52/57 | — | separator-line/edge-line geometry, same downstream cascade |
| `svg/g[childCount]` | 39 | 39 | I5 sub-family A (chrome sibling `<g>` nesting) — already ledgered |
| `svg[childCount]` | 19 | 19 | top-level structural, I1 residual — already ledgered |
| (all remaining families, each ≤27 fixtures) | — | — | fill/stroke/font-attribute residue of the SAME leaf-sizing/I5 families above — no new unnamed family signature |

### Accounting completeness — scope of this pass

This is a **family-level** re-confirmation, not a fresh fixture-by-fixture
re-diagnosis of all 307 non-conformant fixtures: every diff-path family
observed in the post-L3 `--families` scan maps onto an ALREADY-NAMED
mechanism from this project's existing taxonomy (G1's I5 sub-families A–M,
I1/I-scale/I2's residuals, I4c mechanism 6's creole/word-wrap reach, this
iteration's own word-wrap-unmasking and fontStereo-italic findings) — no
NEW, unnamed diff-path SHAPE emerged this iteration beyond the two findings
above. A true fixture-by-fixture accounting (naming each of the 307
non-conformant slugs individually against a specific mechanism, not just
its family signature) was NOT completed within this iteration's remaining
budget — flagged here as an honest limitation, not silently passed over.
Candidate for the G1d/I5g backlog this mission was meant to feed (I5g
itself — the `<g>`-wrapper-count family — was already queued, not
resolved, by G1).

### Census (`npx tsx scripts/svg-conformance-census.ts`, DeterministicMeasurer)

L2 baseline (this iteration's start): 48/355, 1-3:28, 4-10:83, 11-30:62,
31+:133, errors:1.

L3 (final): 48/355, 1-3:28, 4-10:82, 11-30:61, 31+:135, errors:1.

- 0-diff (ratchet-pinned) set: byte-identical to
  `oracle/goldens/svg-description/ratchet.json`'s 48 pinned slugs
  (programmatic set diff, before AND after this iteration — zero
  difference, same 48 slugs). No new fixture reached zero-diff this
  iteration (word-wrap/notes both hit ALREADY-non-conformant fixtures) —
  ratchet.json unchanged at 48, nothing new to capture.
- Net bucket movement: 4-10 -1, 11-30 -1, 31+ +2 — entirely explained by
  the 3 word-wrap-unmasking fixtures above (2 crossed a bucket boundary
  into 31+, 1 stayed within 31+ but at a higher count); the notes cutover
  itself produced zero bucket movement in isolation.
- Full-corpus magnitude scan: performed via a disposable `git worktree`
  baseline (`git worktree add --detach <path> HEAD`, removed before
  finishing — `git worktree remove --force`) diffing every one of the 355
  fixtures' per-slug diff count before/after — exactly 3 fixtures changed
  (all named above); no fixture silently regressed without being
  accounted for.
- Tripwire (48 conformant + 48 ratchet pins intact): CONFIRMED.

### DOT gate (`npx tsx scripts/dot-sync-report.ts component usecase class
### object state`)

component 262/262 · usecase 90/90 · class 708/708 · object 78/80 ·
state 267/267 — EXACTLY the frozen baseline, unchanged. `leaf-sizing.ts`,
`layout.ts` byte-untouched this iteration (`git diff --name-only`
confirms no DOT-layer file in this iteration's write-set).

### Files changed

- `src/core/klimt/creole/Fission.ts` (new — word-wrap: `Fission`/`Neutron`/`NeutronType` port)
- `src/core/svek/image/EntityImageDescriptionSupport.ts` (`buildTextBlock`'s new `maxWidth` param, `buildWrappedLines`/`measureBuiltLine`/`measureSingleAtomWidth`)
- `src/core/svek/image/EntityImageDescription.ts` (additive: `EntityImageDescriptionPaint.wrapWidth`)
- `src/core/svek/image/EntityImageDescriptionDelegates.ts` (`buildDesc` threads `paint.wrapWidth` into `buildTextBlock`)
- `src/core/theme.ts` (additive: `Theme.wrapWidth`/`ThemeOverride.wrapWidth`, `OPTIONAL_SCALAR_KEYS`)
- `src/core/skinparam.ts` (additive: `wrapwidth` skinparam case)
- `src/diagrams/description/renderer-entity.ts` (`drawNoteFallback` cutover to `buildTextBlock` + `UGraphicStencil` wrap; `buildEntityParams` threads `theme.wrapWidth`)
- `tests/unit/core/klimt/creole/Fission.test.ts` (new, 7 tests incl. jar-verified integration case)
- `tests/unit/skinparam.test.ts` (+5 tests, `wrapWidth` skinparam parsing)
