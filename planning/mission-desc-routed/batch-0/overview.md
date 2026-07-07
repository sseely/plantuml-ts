# Batch 0 — Decide path A vs B (investigation only)

**No `src/` edits in this batch.** Output is a filled-in ADR-1 in `decisions.md`
and a go/no-go for the mission. If the answer is (A), STOP and escalate.

## Why this batch exists
The entire mission's approach forks on ADR-1 (does upstream render these via a
class path → routing+features, or a description path → surgical shape fix). The
oracle shows rect; we must learn which upstream factory produced that rect.

## Tasks

| id | task | output |
|----|------|--------|
| T0.1 | Rebuild the 3 recon scripts (README §Verification recon) and re-confirm baseline: 54 routed, 18 with oracle, 1 EQUAL, the 4 close fixtures. | numbers match README, else investigate drift |
| T0.2 | In `~/git/plantuml`, trace factory selection for a conija-shaped block (`allow_mixing` + `class`/`interface`/`()` + `--`) and an xosiza-shaped block (`entity {…}` + crow's-foot). Which factory (`ClassDiagramFactory` vs `DescriptionDiagramFactory`, and `allow_mixing`'s effect) claims it? | factory + file:line |
| T0.3 | For that factory, find the svek shape emitted for a bare `class` / `entity` / `interface` leaf (rect vs plaintext HTML). Cross-check against the cached oracle DOT node shapes. | shape + evidence |
| T0.4 | Decide A vs B; write the evidence + decision into `decisions.md` ADR-1; flip its status. | ADR-1 Accepted/Superseded |

## Exit criterion
ADR-1 resolved with upstream file:line evidence. If (B): proceed to Batch 1. If
(A): STOP, write a one-paragraph "why A" + rough size estimate, request human
sign-off before opening a separate mission.

## Note on `allow_mixing`
conija and sijisi use `allow_mixing`. Upstream `CommandAllowMixing` explicitly
lets class + descriptive elements coexist in ONE diagram. This is a strong clue
the intended engine is the mixed/description path (supports B) — but confirm the
emitted SHAPE, not just the routing.
