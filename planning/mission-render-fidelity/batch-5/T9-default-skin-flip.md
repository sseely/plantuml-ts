# T9 — Default-skin flip: yellow → grey

## Context
The port's default color is `#FEFECE` fill / `#A80036` border — upstream's
*legacy* `ColorParam` default. Upstream's authoritative Style-system default,
which the QA reference jar (`plantuml-1.2026.7beta3`) actually renders, is
`#F1F1F1` fill / `#181818` border / black font (gap #3). This is `decisions.md#D2`
— a deliberate, acknowledged project-wide recolor, isolated to this final
batch so every prior batch (T1–T8) stays green under the old default while
gradient/per-element/geometry machinery lands and is validated independently.

## Task
1. Change the default color **values** in `src/core/theme.ts` to fill
   `#F1F1F1`, border `#181818`, font black — the root/graph defaults and any
   per-element default that inherited the old yellow. Do not change the
   `Theme` type shape or any non-default value — this is a values-only edit.
2. Refresh every test whose expectation asserts the old `#FEFECE`/`#A80036`
   default to the new `#F1F1F1`/`#181818`/black values.
3. Add a `DIVERGENCES.md` entry documenting the change: legacy yellow
   default superseded by upstream's authoritative Style-system grey default;
   cite `decisions.md#D2`.
4. Re-run the visual gap harness on the `cacoma-43` and `lojiga-09` fixtures
   (default-colored, no explicit skinparam) to confirm the default-colored
   icons now match the jar.

Per the mission's porting stance, this is a deliberate, maintainer-approved
divergence-correction, not an inline bug fix — it is documented rather than
silently applied.

## Write-set
- `src/core/theme.ts` (default color values only)
- `DIVERGENCES.md`
- Every test file across `src/**` and `tests/**` that asserts the old
  `#FEFECE`/`#A80036` default (this task owns all of them)

## Read-set
- `decisions.md#D2` and its "Default colors" citation
  (`skin/ColorParam.java`, `resources/skin/plantuml.skin`)
- Failing test output after step 1 — it enumerates every baseline needing a
  refresh; do not grep for the old hex values as the sole discovery method

## Architecture decisions
D2 — adopt `#F1F1F1` fill / `#181818` border / black font as the default
skin; acknowledged project-wide recolor, reversible by revert.

## Acceptance criteria
1. Given the `cacoma-43` and `lojiga-09` fixtures (default-colored, no
   skinparam), when rendered, then icons/boxes fill `#F1F1F1` with
   `#181818` borders, matching the reference jar.
2. Given the full test suite, when run, then it is green under the new
   defaults (no lingering `#FEFECE`/`#A80036` assertions).
3. Given the DOT-parity probe, when run after this change, then the counts
   are unchanged (350/221/41) — a default color value must never move DOT.
4. Given `DIVERGENCES.md`, when inspected, then it records the yellow→grey
   default change with rationale and a `decisions.md#D2` reference.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` green;
coverage 90/90/90. DOT-parity probe unchanged (350/221/41). Visual gap
harness confirms cacoma/lojiga default-colored icons now match the jar.

**STOP condition:** if the set of test files requiring edits exceeds ~20
files, stop and re-scope — the surface exceeding a mechanical baseline
refresh signals more than color assertions are affected.

## Commit
`fix(T9): adopt upstream grey default skin, refresh baselines`
