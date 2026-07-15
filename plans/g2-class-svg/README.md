# Mission G2 — class diagram SVG conformance

**Authorization.** Maintainer, 2026-07-15: "Go" (following the G1-family
completion report). Second Phase-G depth pass; same protocol as G1/G1b.

**Objective.** Drive the class SVG census to **100% minus known
divergences** (2026-07-14 ruling: every non-conformant fixture carried by
a named DIVERGENCES.md/ledger entry — no anonymous misses, no percentage
slack). Class DOT is already 708/708; this mission is render-side only.

- Branch: `feat/g2-class-svg` (from main @ 9d9f17b, post-G1d)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git; no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md` (one mechanism per
  iteration, diagnosis.md discipline, fix at origin, grow a class SVG
  ratchet, ledger the unfixable).

## Baseline (2026-07-15, raw first run)

```
0 / 718 conformant · 1-3: 2 · 4-10: 548 · 11-30: 53 · 31+: 84 · errors: 31
Measure: npx tsx scripts/svg-conformance-census.ts class [--families]
(DeterministicMeasurer section; script already accepts type args)
Oracle: test-results/dot-cache/class/<slug>/in.svg (718 fixtures cached)
The 548-fixture 4-10 bucket implies a FEW universal mechanisms — find
them first (G1's I2 font-constants / I3 id-conventions precedent).

DOT gate FROZEN THROUGHOUT: component 262/262 · usecase 90/90 · class
708/708 · object 78/80 · state 267/267 (ANY movement = stop condition).
DESCRIPTION SVG gate: the 48-fixture description ratchet
(tests/oracle/svg-conformance/description.golden.ratchet.test.ts) must
stay green — class fixes to SHARED code (klimt, svek, annotations,
creole, colors) must not regress description conformance. Re-run the
description census (component usecase) each iteration; its 48/355
zero-diff set must not shrink.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · class census (non-dropping) · description
census (48 zero-diff set intact).
```

## Assets inherited from G1/G1b/G1c/E2r/G1d (shared code — reuse!)

Creole atom engine (klimt/creole/), HColorSet canonical colors
(klimt/color/), chrome DOM shape (annotations/ — already jar-shaped for
every engine), javaFixed4 %.4f formatting (svg-graphics-core), ink
primitives (LimitFinder/MinMax/TextBlockUtils), image-href normalize
rule, SvekEdge/extremity machinery. Class-SPECIFIC territory: the class
renderer (src/diagrams/class/), member compartments, visibility icons,
generics, EntityImageClass and friends upstream
(~/git/plantuml/.../svek/image/EntityImageClass.java, classdiagram/).
NOTE: description's ink-shift (layout-ink-shift.ts) and draw-sequence
are description-local — class likely needs its own equivalent wiring;
check how class computes its document margin before assuming.

## Iteration queue (re-derive from --families each iteration)

| Iter | Family | Reach | Status |
|---|---|---|---|
| N0 | errors 31 → triage (crashes vs jar-side); `--families` classification; identify the universal mechanisms behind the 548-fixture 4-10 bucket; establish the class ratchet harness (oracle/goldens/svg-class/ + ratchet test, mirroring description's) | 31 + all | todo |
| N1+ | drill the largest universal mechanisms (from N0's table) | TBD | todo |

## Standing rules

Upstream spec: jar cached SVGs + `~/git/plantuml/src/main/java/net/`
(grep `net/`, never just `net/sourceforge/plantuml/`; class model lives
in classdiagram/ + net/atmp/CucaDiagram). Fix at origin. graphviz-ts
OUT OF SCOPE. Complexity playbook, TDD, git-archive baselines. Ledger:
plans/g2-class-svg/ledger.md.
