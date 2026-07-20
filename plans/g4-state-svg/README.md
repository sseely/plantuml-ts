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

## Gates (S0, final)

- `state` census: **0/271** zero-diff (`1-3:0, 4-10:1, 11-30:270, 31+:0,
  errors:0`) — this IS the TRUE baseline (harness stand-up iteration,
  nothing fixed).
- Class census 294-set: **intact**, unchanged (re-run, byte-identical
  bucket counts: `0:294, 1-3:25, 4-10:102, 11-30:29, 31+:268, errors:0`).
- Object census 22-set: **intact**, unchanged (re-run:
  `0:22, 1-3:5, 4-10:11, 11-30:11, 31+:31, errors:0`).
- Description census 48-set: **intact**, unchanged (re-run:
  `0:48, 1-3:26, 4-10:73, 11-30:67, 31+:140, errors:0` across 355
  component+usecase fixtures).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — EXACTLY unchanged (verified BOTH before and
  after every change this iteration made).
- `npm test -- --run`: 9916/9918 passing (2 intentionally-skipped
  `describe.skipIf` blocks in the new state ratchet suite, matching every
  other 0-fixture-baseline ratchet suite's own precedent), 363 files (+1
  vs pre-S0's 362).
- `npm run typecheck` / `npm run lint`: both clean.

## Mission status (S0, 2026-07-20)

**OPEN.** Harness stood up, TRUE baseline established, four mechanisms
named and jar-verified (not fixed — none met the "cheap, clearly
bounded, single-fixture-scale" bar this iteration's own instruction set
for a stretch fix). All four are queued for S1. The `svg[childCount]`
short-circuit (mechanism 2) is the highest-priority item for S1: until
state's renderer wraps its output in the outer/per-entity `<g>` shape
jar expects, `compareSvg` cannot see PAST the root level for any
fixture, so no per-feature (fork/join, composite, history, concurrent,
notes) diff can be measured or fixed independently — mechanisms 1+2
together are the prerequisite unlock for every subsequent iteration's
own family-classification work, not just another item in the queue.
