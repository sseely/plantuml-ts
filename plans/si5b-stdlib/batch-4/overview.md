# Batch 4 — fixture drill + close-out

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T9 | Drill the 6 SI5b fixtures to DOT-EQUAL (loop-protocol iterations) | typescript-pro (sequential iterations) | test harness store wiring (tests/helpers + the conformance render paths gain a stdlib store built FROM assets/stdlib — tests read assets directly, not the packages), src/** only per diagnosed mechanisms, oracle/goldens/description/** additions, plans/si5b-stdlib/decision-journal.md | T7, T8 | [x] |
| T10 | Close-out (ORCHESTRATOR): gates, DIVERGENCES, ledgers, index, merge | orchestrator | DIVERGENCES.md (img re-encode pass-through entry; retire/annotate the `!include <bundle>` typed-error entry — now conditional on store), plans/description-dot-100/ledger.md (retire SI5b entries), planning/mission-index.md (SI5b done, E2 partial, G1 UNBLOCKED, D15 unblocked), plans/si5b-stdlib/*, merge to main | T9 | [x] |

T9 protocol = plans/dot-oracle-sync/loop-protocol.md (diagnose → journal
mechanism → TDD → fix at origin → ratchet → orchestrator commits per
iteration). The 6 fixtures: component xusuxe-62-guba767 (cloudogu, 7
includes); usecase fariba-82-xolu802 (awslib alias), kofuca-08-pafi749
(awslib14 incl. `BusinessApplications/all` — a big transitive-include file),
ruziru-69-xixo434 + bootstrap-0 (bootstrap alias), vivido-49-nisu863
(tupadr3 font-awesome). Expect NEW mechanisms beyond include-resolution
(sprite dims in node sizing, `all.puml` transitive volume, macro-heavy
AWSCommon skinparam side effects). Each is its own iteration if mechanisms
differ. SANCTIONED DOT movement: component 261→262/262, usecase 85→90/90
target; anything NOT reaching EQUAL gets a journal row + ledger entry with
the mechanism (no silent misses). Other three types FROZEN exact.

T10 additionally re-measures the mission-index Phase G snapshot and states
the G1-unblock condition result (the "MAINTAINER RULING REQUIRED" note at
the G1 row is RESOLVED by this mission — remove it).
