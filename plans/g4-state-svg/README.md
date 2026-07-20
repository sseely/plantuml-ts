# Mission G4 — state diagram SVG conformance

**Authorization.** Maintainer, 2026-07-20: "start G4."

**Objective.** Drive the state SVG census to **100% minus known
divergences** (2026-07-14 ruling: every non-conformant fixture carried by
a named DIVERGENCES.md/ledger entry — no anonymous misses). State
diagrams have a DEDICATED upstream engine
(`net/sourceforge/plantuml/statediagram/`, `StateDiagram extends
AbstractEntityDiagram extends CucaDiagram` — `net/atmp/CucaDiagram.java`)
and a dedicated port pipeline (`src/diagrams/state/`), unlike G3's object
mission, which rides the class engine verbatim. So this mission starts
from TRUE zero rather than inheriting a G2/G3 head start, and every
mechanism found is new work, not cross-attribution.

- Branch: `feat/g4-state-svg` (from main @ post-G3 merge 1445bd9).
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean in this repo — NO
  EXCEPTIONS (disposable `git worktree` or the ratchet.json manifest are
  the snapshot methods); no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md`; G2's ledger
  (plans/g2-class-svg/ledger.md) and G3's ledger
  (plans/g3-object-svg/ledger.md) are precedent for shared mechanisms
  (SVG root shell, `<g>`-wrapping, document-margin/ink-extent) — check
  those before re-deriving.

## Corpus & oracle (verified fresh 2026-07-20)

```
test-results/dot-cache/state/ — 271 fixture dirs (captured 2026-07-11,
POST-deterministic-text-patch, same batch G3 verified fresh; NEVER pass
--rebuild).
DOT gate baseline: state 267/267 STRUCTURALLY EQUAL among jar-classified
STATE fixtures (frozen gate, unchanged since G0 — the gate FREEZES at
EXACTLY these five counts: component 262/262 · usecase 90/90 · class
708/708 · object 78/80 · state 267/267 — ANY movement = stop condition).
The SVG CENSUS corpus is the FULL dot-cache/state/ bucket (271), not the
267-subset — same "count every cache-dir fixture" convention
svg-conformance-census.ts already used for object's 80 (G3/O0's
gizini-87-vuve916 precedent: a corpus bucket can contain fixtures the
jar itself classifies as a DIFFERENT diagram type; census counts the
bucket, not the tag-filtered subset).
CLASS SVG GATE: the 294-fixture class ratchet
(tests/oracle/svg-conformance/class.golden.ratchet.test.ts) must stay
green and the class census zero-diff set identical.
OBJECT SVG GATE: the 22-fixture object ratchet
(tests/oracle/svg-conformance/object.golden.ratchet.test.ts) must stay
green and the object census zero-diff set identical.
DESCRIPTION SVG GATE: the 48-fixture set identical + ratchet green.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · class census (294 set intact) · object census
(22 set intact) · description census (48 set intact) · state census
(non-dropping).
```

## Iteration queue

| Iter | Scope | Status |
|---|---|---|
| S0 | Harness: `scripts/svg-conformance-census.ts`'s `renderFixtureFor` dispatches `state` through a NEW `render-fixture-state.ts#renderFixtureState` helper (state's own dedicated `parseState -> layoutState -> renderState` pipeline — genuinely new, not a reuse like G3's object-through-class dispatch); `svg-parity-survey.ts` needed NO code change (already generic via `renderSync`'s production registry dispatch, additive `--out`/positional-type args from G2/N0). State ratchet harness stood up (`oracle/goldens/svg-state/` + `state.golden.ratchet.test.ts` + `parity-state.json`, 271/271 surveyed, 267/271 dotEqual=true). TRUE baseline: **0/271 zero-diff** — every fixture, including the single-state zero-transition trivial case, fails on the SAME root-level SVG shell family. Diagnosed and named FOUR independent, jar-verified mechanisms (none individually a bounded/cheap fix; stretch fix explicitly SKIPPED per this iteration's own instruction — see `plans/g4-state-svg/ledger.md` S0 for the full writeup): (1) generic `svgRoot()` shell instead of the CucaDiagram-family `assembleDocumentShell`; (2) no outer/per-entity `<g>` wrapping (renderState emits flat markup, `svg[childCount]` mismatch at 271/271, which short-circuits `compareSvg`'s recursion so NO deeper diff is currently measurable for ANY fixture); (3) inline-`<polygon>`-per-edge arrowheads (jar) vs `<marker>`-def arrowheads (port); (4) a document-margin/ink-extent gap (canvas dims differ even on the zero-transition trivial fixture). Ratchet stands up EMPTY (0 pinned) — first mission iteration to genuinely exercise every ratchet suite's "0 fixtures" graceful-degradation branch. | done |
| S1 | Landed all four S0-named mechanisms TDD-first (SVG root shell `renderer-shell.ts`; outer/per-entity `<g>` wrap + uid plan `renderer-uid.ts`/`renderer-group.ts`; inline-`<polygon>` arrowheads `renderer-arrowhead.ts`; `SvekResult`-style document margin `layout-ink-extent.ts`), each jar-verified against S0's sampled fixtures. Census: `0/271` -> `0/271` but histogram shifts hard toward smaller diff counts (`1-3:0->30, 4-10:1->192, 11-30:270->32, 31+:0->17`) -- mechanism 2's own `childCount` short-circuit unblocking exactly as S0 predicted, immediately surfacing a FIFTH, newly-diagnosed mechanism (state box/shape content fidelity -- missing divider line, wrong `rx`/stroke-width/fill color, wrong text-layout convention, circle-vs-ellipse tag choice) that independently blocks every fixture from zero regardless of mechanisms 1-4's own correctness -- diagnosed per diagnosis.md, explicitly NOT forced this iteration (unbounded per-shape rewrite, comparable in scope to G2's own multi-iteration classifier-box work), queued for S2. 0 pins (expected, matches S0's own 0-pin baseline). See `plans/g4-state-svg/ledger.md` S1 for the full mechanism writeups (including two named remainders: composite `entity`-vs-`cluster` wrap split, composite ink-rule gap) and the S2+ queue. | done |
| S2 | Landed mechanism 5 (state box/shape content fidelity) TDD-first, both scoped items: the simple-state box (`renderer-box.ts`, rx=12.5/stroke-width=0.5/fill-resolution/divider-line/header+body text) and every pseudostate shape (`renderer-pseudostate.ts`, `state-render-colors.ts` -- initial/final/fork/join/syncBar/choice/history/deepHistory), each jar-verified against dedicated samples (jocela/votoki/gefefe for the box; gefefe/bajelo/cekolo for pseudostates). Two small adjacent bugs fixed while verifying (`javaRound4` textLength rounding; NBSP substitution for an empty body line, matching class's own precedent) plus a companion fix surfaced by mechanism 5 (S1 mechanism 3's own `[*]`-endpoint-id resolution was broken in the flat pipeline, `layout.ts#buildFlatTransitionGeos` -- fixed by reusing `state-dot-graph.ts`'s own `endpointId`). Census: `0/271` -> `9/271` zero-diff (`1-3:30->18, 4-10:192->187, 11-30:32->37, 31+:17->20`), all 9 pinned (`conformant && dotEqual`, ratchet now 11 tests). Investigating S1's own items 3/4 (composite entity/cluster split, composite ink rule) surfaced a SIXTH, much larger mechanism -- composite states are NOT a dashed rect at all, jar draws a 3-4-layer half-rounded-header-path + solid-outline + divider + centered-text composition (reusing class's own already-ported `headerBackgroundPath` math) -- explicitly NOT forced this iteration (unbounded, comparable in scope to mechanism 5 itself), queued for S3. See `plans/g4-state-svg/ledger.md` S2 for the full mechanism writeups and the S3+ queue. | done |

## Standing rules

Upstream spec: jar cached SVGs + `~/git/plantuml/src/main/java/net/`
(grep `net/`, never just `net/sourceforge/plantuml/`; state model lives
in `statediagram/` + the shared `net/atmp/CucaDiagram`/`svek/` machinery
class/object already ported). Fix at origin; G2's and G3's named
mechanisms are precedent — if a state diff matches an ALREADY-LANDED
G2/G3 mechanism (SVG shell shape, document margin, style cascades), check
whether the SAME code path is reachable from state before re-deriving a
parallel implementation. graphviz-ts findings go in
`docs/graphviz-issues/`. SVG-channel standing rule (maintainer
2026-07-17, geometry extraction stays on the SVG-text/regex channel, not
`getLayout()`) applies. Complexity playbook, TDD, ledger:
`plans/g4-state-svg/ledger.md`.

## Gates (S2, final)

- `state` census: **9/271** zero-diff (`1-3:18, 4-10:187, 11-30:37,
  31+:20, errors:0`) — up from S1's `0/271` (`1-3:30, 4-10:192, 11-30:32,
  31+:17`); 9 pinned to the ratchet (`conformant && dotEqual`).
- Class census 294-set: **intact**, unchanged.
- Object census 22-set: **intact**, unchanged.
- Description census 48-set: **intact**, unchanged (1 pre-existing,
  unrelated error).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — EXACTLY unchanged (verified BOTH before and
  after every mechanism landed this iteration).
- `npm test -- --run`: 9925/9925 passing (363 files), `npm run
  typecheck` / `npm run lint` / `npm run build`: all clean.

## Mission status (S2, 2026-07-20)

**OPEN.** Mechanism 5 (state box/shape content fidelity) landed in full —
the simple-state leaf box AND every pseudostate shape are now jar-verified
byte-exact where no other, unrelated mechanism blocks them. 9/271 fixtures
reached genuine zero-diff (up from S1's 0/271) and are pinned to the
ratchet. Investigating S1's own two named remainders (composite `entity`-
vs-`cluster` wrap split, composite ink-rule gap) surfaced that BOTH were
mis-scoped: the real blocker is a SIXTH mechanism (composite box rendering
convention — jar draws a 3-4-layer half-rounded-header-path + solid-outline
+ divider + centered-text composition, not a dashed rect), diagnosed
per diagnosis.md and explicitly NOT forced this iteration (unbounded,
comparable in scope to mechanism 5 itself). This is the expected next
"unmasking" layer (mechanism 5's own fix on `bajelo-54-dixe684` reduced its
diff count from 11 to 5, ALL 5 now attributable to mechanism 6 alone).
See `plans/g4-state-svg/ledger.md` S2 for full mechanism writeups and the
S3+ queue.
