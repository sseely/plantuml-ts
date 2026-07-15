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
| L1 | The atom-model core: port CreoleParser's stripe/atom pipeline (command chain, nested inline style runs, per-run font/color/size state) and cut description body-text rendering over to it — buildTextBlock emits one `<text>` run per atom like the jar; `==` heading per-line font cascade rides the same stripe-style machinery (CreoleStripeSimpleParser already partially mirrored) | core subsystem; directly ~10 named fixtures | todo |
| L2 | The inline directives on top of L1: `<size:>`, `<back:>`, `<color:>` (via G1c's HColorSet), `<font>`, `<u:>`, `<U+NNNN>` (incl. inside TIM-interpolated strings), `<code>` verbatim blocks, `[[url]]` atom-splitting, `<latex>` wiring to latex.ts | ~15+ | todo |
| L3 | Word-wrap (the ~26-fixture sub-case) + multi-line note bodies + full re-measure, ratchet pass, refreshed accounting, mission-closing summary | ~26+ | todo |

## Standing rules

Same as G1b/G1c: fix at origin, jar cached SVGs as oracle
(`test-results/dot-cache/.../in.svg`), complexity-hook playbook, TDD,
git-archive baselines, ledger in plans/e2r-creole/ledger.md. Preserve
upstream names (CreoleParser, Stripe, Atom*, StripeStyle). The 48
census-conformant + 48 ratchet-pinned fixtures are the tripwire.
