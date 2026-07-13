# Mission: description DOT → 100% (component 262/262, usecase 90/90)

**Objective.** Close the last non-EQUAL description fixtures so the
graphviz-routed DOT bar reads 100% of comparable fixtures — the maintainer's
prerequisite (ruling 2026-07-12 #4) for G1, the description SVG pass.
Protocol: `plans/dot-oracle-sync/loop-protocol.md` (this brief is its work
queue; iterations are SEQUENTIAL, one mechanism per iteration, diagnosis.md
discipline, fix at origin, ratchet newly-EQUAL slugs into
`oracle/goldens/description/`, ledger what cannot be fixed here).

- Branch: `feat/description-dot-100` (from main @ `c72d872`)
- Merge: merge commit. Orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git.

## Baseline (2026-07-13, main @ c72d872)

```
component 253/262 EQUAL · no-candidate 1 · oracle-blind 1 (elk)
usecase    84/90 EQUAL · no-candidate 5
7,929 tests · typecheck/lint/build clean · census 12/355
```

## Work queue (15 fixtures, classified 2026-07-13)

**Drillable — 9, in root-cause families (iterate biggest-first):**

| Iter | Family | Slugs | Evidence so far |
|---|---|---|---|
| I1 ✅ (fidati+tojitu EQUAL; bujige→I1b) | `set separator .` namespace nesting | component fidati-41-kofe029, tojitu-03-ruto643, bujige-52-gase998 | tojitu drill-down: we emit 0 clusters, oracle 5; edge 91 vs 88; 4 zero-degree oracle nodes missing (plans/g0-limitfinder/newcomer-triage.md) |
| I1b | container-scoped entity identity (flat nodesById id namespace collides same-named children of different explicit containers — proven set-separator-independent) | component bujige-52-gase998 | from I1 split |
| I2 | `!pragma kermor on` | component fojamu-08-veku866, siseda-71-napu395, zubujo-87-xaxa087 | A1-era ledger item "kermor pragma"; jar DOES dump svek-1.dot for these. Diagnose what kermor changes in svek emission; if it is an alternate-engine flag (smetana-class), STOP and draft a maintainer ruling instead of porting |
| I3 | stereotyped node | component radiga-95-junu817 | node ServC <<TypeA>>; nodeCount+shape+degree+minlen+label fails |
| I4 | node label | component zodare-91-rira454 | labelOk fail only |
| I5 | link markup in arrow label | usecase malumi-33-safu797 | nodesepOk fail; label carries `[[http://… CLICK]]` |

**Blocked — 6 (no-candidate: stdlib `!include <bundle>` → StdlibNotBundledError, needs SI5b which awaits the maintainer licensing sign-off):**
component xusuxe-62-guba767 (cloudogu); usecase fariba-82-xolu802 (awslib),
kofuca-08-pafi749 (awslib14), ruziru-69-xixo434 + bootstrap-0 (bootstrap),
vivido-49-nisu863 (tupadr3). NOTE for the maintainer: `bootstrap` and
`cloudogu` are NOT among the S4-audited top-5 bundles — SI5b sign-off as
scoped would still leave 3 of these 6 blocked pending a bundle-audit
extension. Final iteration ledgers all six (`needs-signoff`).

## Exit bar

Every drillable fixture EQUAL (component 256+…/262, usecase 85/90 minimum
achievable now) AND every remaining non-EQUAL fixture carried by a ledger
entry whose disposition is `blocked-on SI5b / needs-signoff`. Flag to the
maintainer at close: the G1 gate's "100% of comparable" needs either the
SI5b sign-off (+bundle-audit extension) or an explicit exclusion ruling for
stdlib fixtures (elk-style) — G1 must not start until one is chosen.

## Gates (per iteration)

npm test (≥90/90/90) · typecheck · lint · build ·
`npx tsx scripts/dot-sync-report.ts component usecase class object state` —
class 708/708, object 78/80, state 266/267 FROZEN; component/usecase may
only move UP, with the delta = the iteration's newly-EQUAL slugs exactly.
Ratchet additions per newly-EQUAL slug (goldens convention).

## Ledger

`plans/description-dot-100/ledger.md`, loop-protocol entry format.
Journal: `plans/description-dot-100/decision-journal.md`.
