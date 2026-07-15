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
