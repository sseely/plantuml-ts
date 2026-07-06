# Batch 3 — Parser gaps + misrouting (RE-SCOPED 2026-07-06)

**Re-scoped from "relationship-edge topology."** T1's diagnosis (see
`decision-journal.md` "T1 edge diagnosis") proved the edge/degree failures are
**parser gaps** (edges dropped at parse time) and a **dispatch misroute** (whole
diagrams sent to the description engine), NOT edge-emission logic in `layout.ts`.
So T5's real write-set is `parser.ts`/`ast.ts` + the shared
`descriptive-keywords.ts` — not `layout.ts`. Split into two disjoint-write-set
sub-tasks, sequenced (T5a safe/class-local first, then T5b shared/risky):

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T5a | Class-local parser gaps: `Class::member` ports, `note as ALIAS`, `[Qualifier]` parse (T1 cats 1,3,4) | typescript-pro | `src/diagrams/class/parser.ts`, `src/diagrams/class/ast.ts`, `tests/unit/class/parser.test.ts` | T1 | [ ] |
| T5b | Dispatch misroute: keep `(A,B) op X` association-class diagrams in the class engine (T1 cat 2) | typescript-pro | `src/core/descriptive-keywords.ts`, `src/diagrams/class/index.ts`, `tests/unit/**` (dispatch tests) | T1 | [ ] |

**T1's ranked categories (authoritative work list) live in `decision-journal.md`.**

Boundaries:
- T5a & T5b have **disjoint write-sets** but are run **sequentially** so the
  shared-file routing change (T5b) is measured/reviewed in isolation.
- T5b touches **shared** `descriptive-keywords.ts` (affects component/usecase/
  deployment/description routing) → **full regression suite mandatory**; STOP if
  any other diagram type regresses (mirror upstream's engine boundary, per the
  "Upstream architecture is authoritative" rule — do not just bolt on an
  `accepts()` special-case).
- Node **shapes** are NOT in scope here (ordinary classes stay `rect`;
  plaintext for qualifier/port/lollipop is T7). T5 only restores dropped/
  misrouted **edges + nodes**.
- Per-function CCN ≤ 10 (hook): extract helpers rather than growing a function.
- STOP if a category resists 3 attempts (consecutive-fix rule).

Gate after each: full quality set + class ratchet; measure edgeCount/degree/
nodeCount drop vs baseline (edgeCount 295, degree 321, nodeCount 187).
