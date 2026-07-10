# T3 — Delete class-html-label.ts (mis-modeled, dead)

## Context
`src/diagrams/class/class-html-label.ts` builds a compartment `<TABLE>` DOT
label upstream never emits (decisions.md#d2 — normal classes are
`shape=rect,label=""`, `svek/SvekNode.java#appendShape:132-166`). It is
never imported by production code; only its own unit test references it.

## Task
Delete `src/diagrams/class/class-html-label.ts` and
`tests/unit/class/class-html-label.test.ts`. Verify zero remaining
references (`grep -r class-html-label src tests`). Approved by maintainer
2026-07-10.

## Write-set
- Deletions only (the two files above).

## Acceptance criteria
- Given `grep -rn 'class-html-label\|buildClassHtmlLabel' src tests`, then
  zero matches.
- Given all four gates (incl. coverage thresholds — deleting a fully-tested
  file must not drop coverage below 90/90/90), then all pass.

## Observability
N/A.

## Rollback
Reversible (git revert restores both files).

## Commit
`chore(class): delete mis-modeled class-html-label module`
(body MUST carry the Java citation from decisions.md#d2 so the module is
not rediscovered and rewired later)
