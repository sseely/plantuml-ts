# Decision Journal — Mission A2

Append one row per non-trivial judgment call during execution (see
`~/.claude/rules/autonomous-execution.md`). T1 and T8 write structured findings
here (edge diagnosis; final conformance + residual ledger).

| Date | Task | Decision / Finding | Rationale |
|------|------|--------------------|-----------|
| 2026-07-06 | startup | Branched `feat/a2-class-dot-sync` from `feat/dot-oracle-sync`, not literal `main`. | The mission brief + T3's `WidthTableMeasurer` dependency + the DOT-parity goldens live only on `dot-oracle-sync` (76 commits ahead of the old `main`). Branching from the literal old `main` would drop the brief itself; "from main" meant the effective mainline. |
| 2026-07-06 | startup | Option B integration (user-approved, interactive): merged `feat/dot-oracle-sync` → `main` (`--no-ff`, merge `1a21d24`), then rebased a2 onto `main` (ff, no unique commits). Not pushed. | User chose to land the base mission on `main` first so A2 is a clean descendant and the two missions' history stays separable. dot-oracle-sync was 0 behind main → conflict-free. |
| 2026-07-06 | startup | Baseline confirmed before any code: `dot-sync-report class` = 9/680 (1%) EQUAL; `npm run typecheck` exit 0. Batch-1 dispatched (T1 debugger, T2+T3 typescript-pro) in parallel — disjoint write-sets. | Green baseline required before building; metric matches brief's stated 1% start. |
| 2026-07-06 | T4 / ADR-1 | **STOP — ADR-1 & ADR-2 FALSIFIED by evidence.** Oracle renders every ordinary class (with or without members/stereotype) as `shape=rect,label=""` (compartment text painted in a later SVG post-pass, not via Graphviz). `shape=plaintext` appears in only 43/544 cache files, ALL for three specific triggers: qualified-association shield targets (`EntityImageClass.getShapeType`→`RECTANGLE_HTML_FOR_PORTS`/`SvekNode.isShielded`), `Class::member` port targets, and lollipop-interface circles — never "has members/stereotype." Verified independently: `02-members/svek-1.dot` 3-member class = `shape=rect,label=""`; corpus 501 rect vs 43 plaintext. T4-as-written (plaintext for non-bare) would REGRESS shapeOk. Agent correctly changed nothing; escalated to human for re-scope. | Brief's objective + ADR-1/ADR-2 premise ("class svek nodes are HTML-table plaintext compartment nodes") is factually wrong. Ref: EntityImageClass.java:255-260, SvekNode.java:132-166/327-350/383-396. The real parity levers are the T1 parser-gap + misrouting fixes (edges/nodes) plus a NARROW plaintext rule for the 3 triggers — not a broad compartment-table shape change. |
| 2026-07-06 | measurement | Verified `structurallyEqual` gates on **all 10** checks incl. `nodesepOk`/`ranksepOk` (`svek-dot.ts:284-294`). Baseline `nodesepOk` fails 475/680 → ≥90% arithmetically impossible without a global nodesep fix (none was in the brief). Traced: class `layout.ts:347` hard-codes `nodeSep=40` (0.5556in); oracle emits `nodesep=0.486111in` (35px) in 511/515 files; `rankSep=60` already matches. | Diagnosis-first re-scope: don't re-plan on assumptions (the T4 lesson). Reading the actual gate revealed a second brief gap (nodesep) beyond the ADR-1 shape error. |
| 2026-07-06 | T4 (re-scoped) | Changed `nodeSep` 40→35 (ADR-6). `nodesepOk` 475→4; structural parity **9/680 (1%) → 136/680 (20%)** from one constant. Added a graph-attr-parity unit test (observer captures nodeSep===35/rankSep===60). Full suite green, ratchet 16/16. Commit `18cb4c5`. Did it directly (not dispatched) — trivial once diagnosed; PUSH-FORWARD per brief (simpler than estimated). | The single largest lever in the mission, entirely absent from the original plan. Complexity hook flagged pre-existing `layoutClass`(CCN 16)/`measureClassifier`(CCN 14) — my one-constant edit was inside `layoutClass`; noted as a wall for T7 (see below), not resolved now (porting discipline discourages refactoring load-bearing port code without cause). |
| 2026-07-06 | re-scope | ADR-1/ADR-2 revised, ADR-6 added; README objective + batch table re-pointed. Batches: 2=nodesep (done), 3=parser gaps+misrouting (T5, per T1), 4=newpage (T6, ADR-3 unchanged), 5=narrow plaintext+qualifier/port/lollipop (T7), 6=measure (T8). User approved "re-scope & continue autonomously." | The verified levers (nodesep, parser/misrouting, newpage, narrow plaintext) replace the falsified "broad plaintext compartment" plan. T3's compartment builder retained for the future SVG gate, decoupled from DOT parity. |
| 2026-07-06 | batch-1 gate | Batch 1 CLOSED. Commits: T1 `9ce9b93`, T2 `1b86a56`, T3 `7926e2a` (one each, write-sets respected — T3's 1-line `formatMemberText` export in layout.ts was spec-permitted). Combined-tree gate: typecheck 0, lint 0, class-parity 16/16, `npm test` 0 (coverage 90/90/90 met, 3563 tests). Metric unchanged at 9/680 by design (T3 helper not yet wired; T4 wires it). | Authoritative gate re-run on the merged tree (agents' individual runs raced on a shared tree). Foundation is green; proceed to T4. |

## T1 edge diagnosis

Method: instrumented via `setLayoutInputObserver` (same harness as
`scripts/dot-sync-report.ts`), diffed our `DotInputGraph` (via `toSvekDot` +
`parseSvekDot`) against the cached oracle svek DOT
(`test-results/dot-cache/class/<slug>/svek-*.dot`) for the 295 fixtures where
`edgeCountOk` fails (of 680 total; reproduced exactly via
`npx tsx scripts/dot-sync-report.ts class`). For each candidate cause, grepped
markup across all 295 failing fixtures for the triggering syntax, then
confirmed the mechanism with a direct `parseClass`/`renderSync` probe on ≥1
concrete fixture per category (not grep alone — every count below is backed by
an instrumented run, not a pattern match). Overall: `nodeCount` fails 187/680,
`edgeCount` 295/680, `degree` 321/680; node/edge deltas skew heavily *under*
(candidate produces fewer nodes/edges than oracle in the great majority of
mismatches), consistent with all three categories below (each *drops* or
*misroutes* real diagram content rather than emitting spurious extras).

| Rank | Category | Freq (of 295 edgeCount-fail) | Example (oracle→ours edges / nodes) | Mechanism |
|------|----------|-------------------------------|--------------------------------------|-----------|
| 1 | Member/port relationship syntax (`Class::member`) unsupported | 29 | `cidepu-54-bemo048`: edges 3→0, nodes 3→2 | `REL_RE` in `src/diagrams/class/parser.ts:225` requires both relationship endpoints to match `\w+\|"[^"]+"` (no `::`). Lines like `ClassB::b <-- pack.ClassA::a` never match the arrow regex at all → relationship silently dropped. Worse, when the leftover after a truncated `\w+` match happens to start with a lone `:` (as in `A::ID -- B`, matched instead by the unrelated "standalone member" rule at `parser.ts:640`, `^(\w+)\s*:\s*(.+)$`), the classifier is created with **no edge and no member** (member text `:ID -- B` fails `parseMemberLine`); and for lines like `helper -- lib::longnamedfunctionbutdifferent`, `REL_RE`'s trailing optional label group `(?:\s*:\s*.+)?$` (parser.ts:225, tail) greedily swallows the second half of `::` as a **label**, so the edge is emitted but its `to` id is silently truncated to `lib` (the wrong, or a phantom, node) instead of the real port target. Net effect: dropped edges, and where not dropped, wrong endpoints. No oracle Java source needed — this is a parser gap in our own code, not a divergence from a documented upstream behavior we chose differently. |
| 2 | Association-class shorthand `(A,B) op X` misclassifies the whole diagram | 15 (line starting `(...)` in first 20 lines — the actual dispatcher trigger; 10 of these are the narrower `(A,B) ..`-anchored form) | `bunuce-10-vere519`: edges 7→3, nodes 6→5, oracle shape multiset `[circle,circle,rect,rect,rect,rect]` vs candidate `[ellipse,rect,rect,rect,rect]` | `src/core/descriptive-keywords.ts:180` (`ELEMENT_SHORTHAND_PATTERNS`, the `/^\(.+\)/` "`(Use Case)`" shorthand) matches association-class lines like `(A,B) .. R1` because they also start with a parenthesized group. `hasDescriptiveSignal` (descriptive-keywords.ts:211) returns true, so `classPlugin.accepts()` (`src/diagrams/class/index.ts:45`) declines the whole block, and the description/use-case engine renders it instead — an oval/actor diagram, not a class diagram. Confirmed directly: candidate's own `DotInputGraph` for `bunuce-10-vere519` contains an `ellipse`-shaped node, a shape that never appears in real class-diagram svek DOT (oracle's association-class connector node is `shape=circle`, not `ellipse`) — hard proof the *entire diagram*, not just one relationship, is misrouted. This is upstream-authoritative-architecture territory (CLAUDE.md "Upstream architecture is authoritative"): the fix belongs in the class/sequence dispatch guard (D3 exclusions in descriptive-keywords.ts), not in the class parser itself. |
| 3 | Freestanding `note as ALIAS ... end note` (no `of <Entity>`) unsupported | 9 (anchored `note as \w+$` form); cascades to extra phantom nodes/edges beyond the missing note itself | `befasi-62-vimu310`: edges 31→25, nodes 27→23 (4 of 6 notes dropped; 1 phantom classifier `"and the simulator."` created from note prose) | `src/diagrams/class/parser.ts` rules 6b/6c (lines 612-635) only match `note <pos> of <Entity>`; there is no rule for the freestanding `note as <alias>` form used to declare an unattached note later referenced by a connector (`N4 .> DrawableAdapter`). No dispatch rule matches `note as N3`, so (a) the note is never added to `ast.notes` (missing node — oracle keeps *every* note, attached or not, as a DOT node inside its enclosing package cluster), and (b) `state.pendingNote` is never set, so the note's body lines fall through to be independently re-parsed by unrelated rules — one body line, `interface and the simulator.`, spuriously matches the classifier-decl dispatch pattern (`parser.ts:575`, `^(?:abstract\s+class\|class\|interface\|enum\|annotation)\s+`) because it happens to start with the word "interface", creating a bogus classifier `"and the simulator."`. Separately, connector arrows with a single dot (`N4 .> DrawableAdapter`) aren't in `REL_RE`'s alternation (only `..`/`..>`/`...` variants some of which are missing too — triple-dot `...>` also unmatched), compounding dropped edges for these same fixtures. |

Not in the top 3 but confirmed and worth flagging for T5: bracket-qualifier
relationship syntax (`class1 [Qualifier] <-- class2`, e.g. `baneru-00-kuro607`)
hits 13/295 fixtures — `REL_RE`/dispatch pattern 8 requires the left endpoint
to be a bare `\w+`/quoted string, so a bracketed qualifier suffix breaks the
match entirely and the whole relationship (and its qualifier box, rendered by
oracle as a `shape=plaintext` TABLE node) is dropped. Oracle:
`baneru-00-kuro607` edges 1→0, nodes 2→2 (shape multiset
`[plaintext,rect]`→`[rect,rect]`).

These four categories are not mutually exclusive (a fixture can hit more than
one), so the frequencies don't sum to 295, but together they account for the
large majority of inspected edgeCount failures in the ~30-fixture sample drawn
from the 4 categories above. T5 can act on each independently: category 1 is a
`REL_RE`/dispatch fix in `parser.ts`, category 2 is a guard-exclusion fix in
`descriptive-keywords.ts` (add an association-class exception to
`ELEMENT_SHORTHAND_PATTERNS`/`hasDescriptiveSignal` before the `/^\(.+\)/`
check fires), category 3 is a new `note as <alias>` dispatch rule (plus
`ast.ts`'s `ClassNote.target` needs to become optional to represent unattached
notes), and the bracket-qualifier finding is a `REL_RE` extension parallel to
category 1.
