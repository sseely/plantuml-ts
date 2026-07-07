# Batch 4 — Lollipop + special shapes

**Prereq:** Batches 2-3 landed; Batch-0 shape table for lollipop/ellipse.

## Goal
The remaining special shapes: `()` and `--(` lollipops (plaintext connector +
edge), `usecase` → ellipse, and crow's-foot relationship endpoints as rect.

## Targets
conija-14 (`()` lollipop → plaintext + `foo -- "..."` edge),
sijisi-94 (rectangle port → plaintext + point),
cacoma-43 (usecase → ellipse; actor/component → rect),
niduni-65 (the `--(` lollipop edge, completing Batch 2's structure),
xosiza-60 (crow's-foot `}o--o{` / `|o--o|` endpoints auto-created as rect leaves).

## Tasks

| id | task | gate |
|----|------|------|
| T4.1 | Port `CommandCreateElementParenthesis` (`() "label"`) and `CommandLinkLollipop` (`--(`, `)--`) into the class engine: the `()` element → the Batch-0 lollipop shape (plaintext per conija oracle); the lollipop link → its edge. Reuse `class-relationship-parser.ts` for the edge. | full dual-corpus gate |
| T4.2 | `usecase Name` → ellipse (Batch-0 table). `actor Name` → the Batch-0 actor shape (structural: confirm rect vs special). | gate |
| T4.3 | Crow's-foot links (`}o--o{`, `|o--o|`, `}--`): ensure endpoints auto-created by a relationship are rect leaves, not ports/plaintext. (This is the xosiza inversion — 10 endpoints wrongly plaintext today.) Verify against the current class endpoint-creation path. | gate |
| T4.4 | Re-measure; land Tier-4. Record deltas. | dual-corpus diff = 0 REGRESSED |

## Exit criterion
Lollipop/usecase/crow's-foot shapes match the oracle; Tier-4 fixtures match;
zero description regression. Any fixture that still diverges (deep/layout, not
shape) is documented for the residual ledger, not forced.
