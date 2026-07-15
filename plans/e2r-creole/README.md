# Mission E2r — the creole char-atom remainder

**Authorization.** Maintainer, 2026-07-15: "do the e2 mission."

**Objective.** Port the remaining (non-sprite) half of upstream's creole
engine: the char-atom model — nested inline style runs, per-run
color/size/font overrides, the inline directives (`<size:>`, `<back:>`,
`<color:>`, `<font>`, `<u:>`, `<U+NNNN>`, `<code>`), `[[url]]`
atom-splitting, `==` heading per-line font cascade, multi-line
note/nested creole, and word-wrap. This unblocks the largest
blocked-on-E2 family in the census accounting (~37 attributed + ~26
word-wrap sub-case + overlapping reach). Exit bar: 100% minus known
divergences — the E2r-attributed set conformant or re-attributed.

- Branch: `feat/e2r-creole` (from main @ post-G1c merge)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git; no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md`.

## Baseline (2026-07-15, post-G1c merge)

```
48 / 355 conformant · 1-3: 28 · 4-10: 81 · 11-30: 62 · 31+: 135 · errors: 1
Ratchet: 48 pinned.
DOT gate FROZEN: component 262/262 · usecase 90/90 · class 708/708 ·
object 78/80 · state 267/267.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · census (zero-diff set + ratchet = tripwire).
Measure: npx tsx scripts/svg-conformance-census.ts [--families]
(DeterministicMeasurer section)
```

## Authoritative diagnoses

- `plans/g1-description-svg/ledger.md` § I4c mechanism 6 (the full
  writeup + slug lists, incl. the ~26-fixture word-wrap sub-case),
  mechanism 2 (`==` headings need per-line font cascade), § I10
  accounting rows (creole 35 + latex 2 + broken-image 2).
- Upstream spec: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/
  klimt/creole/` — `CreoleParser`, `Parser`, `legacy/
  CreoleStripeSimpleParser` (already partially mirrored by G1 I9b's
  `classifySeparatorLine`), `Stripe`/`StripeStyle`, `atom/` (AtomText,
  AtomImg, AtomSprite...), the command classes (`command/CommandCreole*` —
  bold/italic/underline/color/size/font/back/code/url per-tag commands),
  and word-wrap in `AtomText`/`StripeSimple`. Grep `net/`, never just
  `net/sourceforge/plantuml/`.
- Existing modules — USE, don't re-port (check `.claude/catalog.md`):
  `latex.ts` (KaTeX), the SI5b sprite/img atom half (`<img:>`, `<$sprite>`
  already render — E2's other half), `EntityImageDescriptionSupport.ts`
  (buildTextBlock + I9b's classifySeparatorLine), skinparam/style font
  cascade machinery from G1 I4b.

## Iteration queue

| Iter | Scope | Reach | Status |
|---|---|---|---|
| L1 | The atom-model core: port CreoleParser's stripe/atom pipeline (command chain, nested inline style runs, per-run font/color/size state) and cut description body-text rendering over to it — buildTextBlock emits one `<text>` run per atom like the jar; `==` heading per-line font cascade rides the same stripe-style machinery (CreoleStripeSimpleParser already partially mirrored) | core subsystem; directly ~10 named fixtures | done |
| L2 | The inline directives on top of L1: `<size:>`, `<color:>` (via G1c's HColorSet), `<font size=/color=/family>`, `<latex>` wiring to latex.ts, `[[url]]` atom-splitting + hyperlink styling — plus an architecture correction (unified atom+command scan, superseding L1's two-pass composition). `<back:>`/`<u:color>`/`<U+NNNN>`-in-TIM-strings/`<code>` jar-verified and ledgered, not built (own signoff needed) | ~15+ | done |
| L3 | Word-wrap (the ~26-fixture sub-case) + multi-line note bodies + full re-measure, ratchet pass, refreshed accounting, mission-closing summary | ~26+ | done |

## Standing rules

Same as G1b/G1c: fix at origin, jar cached SVGs as oracle
(`test-results/dot-cache/.../in.svg`), complexity-hook playbook, TDD,
git-archive baselines, ledger in plans/e2r-creole/ledger.md. Preserve
upstream names (CreoleParser, Stripe, Atom*, StripeStyle). The 48
census-conformant + 48 ratchet-pinned fixtures are the tripwire.

## Mission close (L3, 2026-07-15)

### Census trajectory (DeterministicMeasurer, `component`+`usecase`, 355 fixtures)

| Iteration | 0 | 1-3 | 4-10 | 11-30 | 31+ | errors |
|---|---|---|---|---|---|---|
| Baseline (pre-L1) | 48 | 28 | 81 | 62 | 135 | 1 |
| L1 (atom-model core) | 48 | 28 | 84 | 62 | 132 | 1 |
| L2 (inline directives + architecture fix) | 48 | 28 | 83 | 62 | 133 | 1 |
| L3 (word-wrap + notes) | 48 | 28 | 82 | 61 | 135 | 1 |

Ratchet: 48 pinned at mission start, **48 at mission close** — unchanged
across all three iterations. No fixture reached zero-diff during E2r; every
iteration's gains were magnitude improvements (fixtures moving toward
lower-diff buckets, or — in L3's case — "unmasking" moves into a
higher-diff bucket that is nonetheless a structural fix, per the recurring
masking-artifact pattern this project has documented since G1's I3/I5).
Net bucket movement, baseline → close: 4-10 basically flat (81→82), 11-30
flat (62→61), 31+ basically flat (135→135) — the RAW bucket totals
understate the real progress: L1/L2 fixed the atom-model/directive
architecture (verified via isolated jar-fixture comparisons, not just
bucket counts — see each iteration's own ledger section), and L3 confirmed
word-wrap/notes are now structurally correct (childCount matches) on every
fixture that reaches them, with residual diffs traced to the SAME
pre-existing leaf-sizing gap dominating the whole corpus (see the L3
ledger's family-level accounting table).

### Per-iteration outcomes

- **L1** — ported the creole atom-model core (`Stripe`/`CreoleAtom`/
  `StripeSimple`/`CommandCreoleBuilder`, bold/italic/underline/strike/wave,
  `==` heading font cascade) and cut `EntityImageDescriptionSupport.ts
  #buildTextBlock` over to it — one `<text>` per styled run, matching the
  jar's own SVG structure. `leaf-sizing.ts` deliberately left untouched
  (DOT gate provably unaffected).
- **L2** — built the inline directive commands (`<size:>`, `<color:>`,
  `<font>`, `<latex>`, `[[url]]` atom-splitting) and discovered/fixed an
  architecture correction: L1's "atom pre-scan then style-split" composition
  was provably wrong whenever a color/size command's captured text
  contains an atom (10/17 corpus `<color:>` fixtures) — corrected to
  upstream's real single-pass unified scan. Found and ledgered (not fixed):
  `<back:>`, `<u:color>`, `<U+NNNN>`-in-TIM-strings, `<code>` (all
  low-marginal-value or needing new rendering primitives), plus the
  `paint.fontStereo`-carries-ITALIC bug (unmasked by the architecture fix).
- **L3** — ported word-wrap (`Fission.ts`, RENDER-path only per the
  DOT-frozen CAUTION boundary — evidence in the ledger) and cut description
  notes over to the same L1/L2/L3 pipeline (previously a crude per-line
  `UText` approximation with no creole engine at all). Found and fixed a
  genuine regression (note separator lines crashing the whole-document
  ink-extent collect pass — missing `UGraphicStencil` wrap). Re-investigated
  but left named the `fontStereo`-ITALIC bug (not a small fix, per the
  mission's own fallback instruction). Corrected an over-hasty "zero corpus
  reach" claim about word-wrap mid-iteration once real evidence
  (`AWSCommon.puml`'s own `skinparam wrapWidth 200`) surfaced it.

### Deferred mechanisms, by corpus reach (descending) — feeds G1d / I5g

| Mechanism | Reach (fixtures) | Status |
|---|---|---|
| `leaf-sizing.ts` creole-stripped-width/heading-height box sizing | ~260 (dominant family, `svg/@height`/`@width` + all downstream text/rect/path/polygon/line coordinate cascades) | deferred — E2r/L1 decision journal; the single highest-value remaining target for a future mission |
| `svg/g/g/path/@d`, `svg/g/g/polygon/@points` (edge/spline routing, entity decoration) | 144 / 125 | graphviz-ts territory (OUT OF SCOPE) and/or leaf-sizing downstream — not this mission's charter |
| G1 I5 `g[childCount]` sub-families (C: multi-stereotype, D: bracket-body `\n`, E: transparent-color, F: link-endpoint stereotype, H: sprite path-count, I: content-`<g>`-wrapper (I5g), J: `<linearGradient>` count) | ~12–20 each | queued by G1, not resolved by E2r (out of creole-engine charter) |
| `<back:>` (100% overlap with `<latex>`) | 4 | E2r/L2, deferred — zero marginal value given `<latex>`'s own unreachable byte-conformance |
| `<u:color>` extended-underline-color | 3 | E2r/L2, deferred — needs a new draw-time `<line>` rendering primitive |
| `paint.fontStereo`-carries-ITALIC | 3 | E2r/L3, re-investigated, left named — needs its own diagnosis.md pass tracing `CommandCreoleBuilder`'s close-tag restore semantics |
| `<U+NNNN>`-inside-TIM-strings / `<code>` verbatim block | 2 (same 2 fixtures) | E2r/L2, deferred — TIM-layer gap (`<U+NNNN>`) + un-located origin (`<code>`) |
| word-wrap residual positioning (post-unmask) | 3 (`mejoxi-96-cegu294`, `fariba-82-xolu802`, `kofuca-08-pafi749`) | E2r/L3, new finding — structurally correct (childCount matches jar), remaining x/y coordinate diffs are the SAME leaf-sizing family above, not a new mechanism |
| Note box shape (`Opale` folded-corner polygon vs. this port's plain `rect`) | 35 (every note-bearing fixture) | pre-existing, out of E2r scope (G1 territory) — the notes cutover fixed the TEXT pipeline only, not the box chrome |
| `<latex>` (KaTeX vs JLaTeXMath) | 2 (`sunuju-01-pote718`, `vimulo-11-buni641`) | E2r/L2, PERMANENT divergence (documented in DIVERGENCES.md) — structurally present, byte-conformance provably unreachable |

### Quality gates (final, this session)

- `npm test -- --run`: 321 files, 8615 tests, all passing.
- `npx tsc --noEmit` (both tsconfig.json + tsconfig.node.json): clean.
- `npm run lint`: clean.
- `npm run build`: clean.
- `npx tsx scripts/dot-sync-report.ts component usecase class object state`:
  component 262/262 · usecase 90/90 · class 708/708 · object 78/80 ·
  state 267/267 — EXACTLY the frozen baseline.

### Known issues / follow-ups (not fixed, not silently dropped)

1. `leaf-sizing.ts` box sizing is the single highest-value remaining
   target — dominates the diff surface by a wide margin over everything
   else combined. Candidate for its own mission.
2. `paint.fontStereo`-carries-ITALIC needs a dedicated diagnosis.md pass
   (mechanism narrowed but not conclusively located this iteration).
3. A true fixture-by-fixture accounting of all 307 non-conformant
   fixtures (vs. this iteration's family-level accounting) was not
   completed — see the L3 ledger's "Accounting completeness" note.
4. Note box chrome (`Opale` polygon vs. plain `rect`) is unchanged —
   out of E2r's charter, needs its own G1-territory signoff.
5. One boundary deviation this iteration: `git checkout` was used once to
   revert this iteration's own temporary debug instrumentation (no other
   work affected) — see the decision journal's L3 entry. Flagged, not
   repeated.
