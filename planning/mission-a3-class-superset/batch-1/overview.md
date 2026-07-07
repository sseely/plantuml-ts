# Batch 1 — Routing: class engine owns mixed class+descriptive blocks

**Prereq:** ADR-2 Accepted (Batch 0). This is the load-bearing structural change
and the highest-risk batch for the DESCRIPTION corpus.

## Goal
Replace the `class/index.ts:53` blanket decline with the ADR-2 discriminator, so
mixed class+descriptive blocks route to class and pure-descriptive blocks stay
description. Mirror upstream's single selection point — one shared function, not
duplicated heuristics in both plugins.

## Tasks

| id | task | gate |
|----|------|------|
| T1.1 | Implement the ADR-2 discriminator as a shared function (e.g. in `core/descriptive-keywords.ts` or a new `core/diagram-select.ts`). `class/index.ts` `accepts()` and `description/index.ts` `accepts()` both call it so the split is defined in ONE place. | typecheck + unit |
| T1.2 | Wire class `accepts()` to own the mixed case; description `accepts()` to yield the mixed case and keep pure descriptive. Add unit tests: a conija/xosiza/cacoma block → class; a pure `component`+`node`+`-->` deployment block → description. | full dual-corpus gate |
| T1.3 | Re-measure. Land whichever Tier-1 fixtures Batch 0 flagged flips-on-routing. Record the exact class/description EQUAL deltas. | dual-corpus diff = 0 REGRESSED on description |

## Exit criterion
Routing discriminator lives in one place; class owns mixed, description owns pure;
Tier-1 routing wins landed; **zero description-corpus regression**. If any
description fixture regressed, the discriminator is too greedy — narrow it before
committing (do not commit a class gain that costs a description fixture).

## Note
Tier-1 fixtures that Batch 0 flagged "needs-work" (structure gap even under class)
are NOT expected to flip here — they wait for their tier's feature batch. Do not
force them by widening scope in this batch.
