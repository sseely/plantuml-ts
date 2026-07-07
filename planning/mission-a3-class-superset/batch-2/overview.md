# Batch 2 — Leaf classifiers (interface / entity / enum / abstract / annotation / circle)

**Prereq:** Batch 1 landed; Batch-0 shape table.

## Goal
Teach the class **parser** to accept descriptive leaf-classifier declarations and
create classifiers of the right kind, so `layout.ts:buildDotNodes` (which already
defaults to rect) emits the oracle shapes. Most → rect; `circle` → its special
shape per the Batch-0 table.

## Targets
lilura-67, tepazu-23, xidura-26 (abstract/annotation/entity/enum/interface → rect),
niduni-65 (circle + interface; lollipop part is Batch 4).

## Tasks

| id | task | gate |
|----|------|------|
| T2.1 | In `class-declaration-parser.ts` (or a new sibling), accept `interface`/`entity`/`enum`/`abstract [class]`/`annotation` `Name [as alias] [stereotype] [{ body }]` → classifier with the matching kind. Members inside the body parse via the existing member parser. Faithful to `CommandCreateClassMultilines`/`CommandCreateEntityObject`. | full dual-corpus gate |
| T2.2 | Accept `circle Name` (and `()`-free circle element) → the Batch-0 shape (NOT the assoc-circle path — that is `(A,B)..C`). Add a distinct classifier kind if needed. | gate |
| T2.3 | Re-measure; land lilura/tepazu/xidura/niduni(non-lollipop structure). Record deltas. | dual-corpus diff = 0 REGRESSED |

## Exit criterion
Leaf classifier keywords parse to the correct kinds; Tier-2 fixtures' node/shape
multisets match the oracle (modulo Tier-4 lollipop edges). Zero description
regression. Watch the 500-line/CCN/NLOC hooks on the parser — extract as needed.
