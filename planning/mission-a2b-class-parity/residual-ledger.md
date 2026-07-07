# Residual Ledger — Class DOT Parity (paused 2026-07-06 at 20%)

Mission paused after banking a verified **20% EQUAL (137/680, up from 1%)** and
merging to `main`. This ledger lets a future session resume precisely. Every
entry is grounded in instrumented evidence (`evidence.md`) + the execution
findings (`decision-journal.md`). The recurring lesson: **each lever is a
parser/AST feature a layer deeper than the distance-to-EQUAL histogram implies,
usually gated behind a per-function CCN "unblock" refactor. Verify against
`~/git/plantuml` + the oracle cache before coding — the briefs assumed and were
wrong repeatedly.**

## What is DONE and merged
- **nodesep=35** (ADR-6): the 1%→20% lever. Load-bearing, do not touch.
- **Parser gaps** (`Class::member` ports, `note as`, `[Qualifier]` parse),
  **association-class misroute** fix, **parser.ts split** under 500 lines.
- **B0**: `layoutClass`/`measureClassifier` decomposed under CCN 10 → `layout.ts`
  is editable. New `class-layout-helpers.ts` holds measurement helpers.
- **B1 groundwork** (`3cd5cf6`): class `layout.ts buildDotClusters` populates
  `DotInputGraph.clusters` from `ast.namespaces`; svek-dot-emit emits recognized
  `subgraph cluster<N>`. Correct but inert until the parser produces namespaces.

## Remaining levers (ranked by single-check-fail count; true cost noted)

### L1 — Clustering (clusterOk): mostly DONE — EQUAL 20%→24%, clusterOk 106→61
Worked in session 2026-07-06 (branch `refactor/l1-parseclass-decompose`, 6
commits `a5db217`..`6e4b823`). The ledger's "34 single-fail" was really FIVE
interlocking sub-features, not one; landed as gated increments:
- **DONE** parseClass/ensureClassifier decompose (unblocked CCN/NLOC/500-line
  hooks — three gates, not just parseClass CCN 12 as recorded). `a5db217`
- **DONE** `package` rule (159 fixtures, no rule existed). 20%→22%. `57b45de`
- **DONE** empty-package skip in buildDotClusters — oracle drops member-less
  subgraphs (mujopi-30-zadi566). clusters-over 5→0. `830c756`
- **DONE** color/stereotype decoration on pkg/ns lines (`#DDDDDD`). `e57c756`
- **DONE** dotted-name nesting: `parentId` on Namespace, split dotted ids
  (namespace decls + class decls + relationship endpoints) via the single
  `ensureClassifier` choke point; `set [namespace]separator` (default `.`,
  `none` disables); `!pragma useIntermediatePackages false`; subtree-aware
  empty filter; a guard rejecting decoration-polluted ids so URL/style dots
  don't spawn spurious clusters. 22%→24%, clusters-over 14→1. `6e4b823`

- **DONE** qualified classifier identity + namespace-aware resolution
  (`aa3bf71`). Classes keyed by fully-qualified id; every reference (decl,
  relationship endpoint, body opener) routed through `resolveReference`
  (class-namespace.ts). Rule (verified against all 4 oracle trees): not dotted
  → local to active ns; dotted + first segment is an existing namespace →
  absolute; dotted otherwise → relative. bivevo/paziji/lozijo/pukuzu all EQUAL.
  Guard no longer rejects whitespace (quoted pkg names with spaces);
  `set separator none` keeps raw id in active ns. Verified before/after
  EQUAL-set diff: +11, **−0 regressions**. 24%→25%, clusterOk 61→51.

**L1 clustering is essentially exhausted at 25% EQUAL / clusterOk 51.** The
remaining 51 clusterOk fails co-occur with other checks (nodeCount/shape/edge)
— broad parse divergences, not pure clustering. Do NOT chase them under L1;
move to L4 (minlen) / L2 (labels).

**Known pre-existing bugs surfaced (separate from clustering, NOT fixed):**
- `note <pos> of X::Y` BLOCK notes: rule 6c's entity capture `(\w+|"…")` fails
  on `::`, so pendingNote is never set and the note text leaks to dispatch
  (jiceke-84 `i.e. DD.MM.YYYY` → spurious clusters; the sole clusters-over=1).
- Relationship endpoints with a leading-dot root anchor (`.BaseClass <|-- X`)
  don't parse at all (rel dispatch drops them), so pareli/dudimi/duvuti
  over-emit nodes. A leading-dot resolver branch was written then removed as
  unreachable until the relationship parser forwards such endpoints.
- Decl-parser leaves decoration in ids (`class Mamal [[url]]` → id includes the
  link); the resolver's decoration guard contains the fallout for clustering
  but the node ids stay polluted.

### L2 — Edge labels — DONE (labelOk 89→31, EQUAL 28%→33%, `189457d`)
`labelOk` = 4-tuple count [label, taillabel, headlabel, xlabel] over edges
(presence, size-tolerant). buildDotEdges (layout.ts) now emits `label` from
rel.label, `taillabel` from fromMultiplicity, `headlabel` from toMultiplicity
(measured). Verified +31/−0. The count metric is swap-agnostic (1 tail + 1 head
either way), so the from/to swap needed no special handling.
- **Remaining labelOk (31):** asymmetric tail/head (puvono/sekame oracle
  [2,3,4]) and labels on composition PORT/ANCHOR edges (bejusa label=13 for 6
  rels) — both tied to the extra edge/node structure the oracle emits for
  compositions/association-classes. That is **L3 territory** (shapeOk +
  association-class node emission), not more label work.

### L3 — plaintext shapes — L3a DONE (shapeOk 197→167, EQUAL 33%→37%, `1347f78`)
The dominant trigger (verified: 28 of 33 single-fails) is **qualifier-shield +
`::member` port** → `shape=plaintext`. buildDotNodes (layout.ts) marks any
classifier bearing a `[Qualifier]` (now sided fromQualifier/toQualifier) or a
`::` port as plaintext; `isPort` for ports (port table) vs shield table — both
`shape=plaintext`, so the shape multiset matches. Verified +28/−0.
- **L3b MISDISPATCH — investigated + root-caused + partial fix (2026-07-07).**
  The "over-emit plaintext" cases were class fixtures rendering via the
  DESCRIPTION engine (emits plaintext for interfaces/ports,
  description/layout-helpers.ts:368), so `class`-engine buildDotNodes never ran.
  - **Scope: 57 of 768** class fixtures trip `hasDescriptiveSignal` → description.
    Trigger LINE breakdown: **3 relationship false-positives**, 48 element
    declarations (`entity`/`interface`/`circle`), 6 `()` shorthand.
  - **Decisive experiment:** forcing the class engine on all 57 → only **3 EQUAL**.
    So rerouting is NOT the lever for the 48 — they need feature work (entity
    compartments, lollipops, circle shapes), not a dispatch change. Don't chase
    them as misdispatch.
  - **FIXED (`04876fa`, +2 EQUAL, 37%):** the 3 false-positives — a class NAMED
    like a keyword in a relationship (`Queue "1" -- "*" QueueEntry` matched
    `^queue`). class.accepts now filters relationship lines (REL_DISPATCH_RE)
    before the guard. Surgical: `entity`/`()` decls still correctly decline.
  - **Association diamond — DONE (`113b5fb`, +1 EQUAL, 37%).** It was `<> name`
    (CommandDiamondAssociation → LeafType.ASSOCIATION), NOT the `(A,B)` couple.
    New ClassifierKind 'association'; parser `<> name` command; buildDotNodes →
    shape=diamond. Only 2 corpus fixtures use it (cukaze EQUAL; luzive fails
    other checks).
  - **`zaent [shape=point]` anchors — DONE (`ffcd43a`, +4 EQUAL, 38%).** It was
    NOT generic "composition port structure": the trigger is a package/namespace
    (cluster) used as a relationship ENDPOINT → svek routes to a point anchor
    inside that cluster and draws no package node (ClusterDotString). Fix:
    packageEndpointAnchors (non-empty cluster + endpoint) → suppress the package
    node, append a point node, route the edge to it, add it as a cluster member.
    Gated on endpoint presence → no-op elsewhere. Flipped bajotu/mujopi/runane/
    vusute (the 4 shapeOk+clusterOk-only cases). The OTHER ~12 zaent fixtures
    fail 4-6 checks — not resolved by anchors alone.
  - **`(A,B)` association-class COUPLE** (shape=circle connector + edges) is
    still unbuilt — distinct from the `<>` diamond and the zaent anchor.

### L4 — minlen — L4a DONE (minlenOk 262→213, EQUAL 25%→28%, `4afa688`)
**The brief was WRONG** (per the recurring lesson): minlen is NOT per-relationship-
type. It is `link.getLength() - 1` (SvekEdge.java:421), where length is the arrow
BODY char count (`-`/`.`/`=`), and LEFT/RIGHT direction forces length=1
(CommandLinkClass:335). Oracle minlen distribution: 1×1433, 0×450, 2×54, 3×2.
- **L4a DONE:** relationship parser now records `length` (Relationship.length,
  ast.ts) = body char count before canonicalisation; buildDotGraph emits
  `minlen = (length ?? 2) - 1`. `->`→0, `-->`→1, `--->`→2. Contained to
  minlenOk (metric reads emitted DOT input, position-independent). Verified
  before/after EQUAL diff: +16, −0. Unit tests in parser.test.ts.
- **L4b DONE (EQUAL 188→192, `e5f61a4`):** `-left-`/`-right-`/`-up-`/`-down-`
  (+ abbrevs) previously did NOT parse at all → those edges were dropped. REL_ARROW
  now allows an optional orientation word per body run (non-capturing, no group
  shift); canonicalizeArrow strips it via ARROW_DIR (NOT all letters — the `o`
  aggregation head must survive); arrowLength forces length 1 for LEFT/RIGHT.
  Verified +4/−0. minlenOk 213→202; recovered dropped directional edges
  (edgeCount under 198→187).

**L4 fully done at 28% EQUAL (192).** Remaining minlenOk (202) are multi-check
fails / long-arrow edge cases — not a clean single lever. Next: L2 (labels).

### Not a lever — countMismatch (~158–192): mostly UNFIXABLE
Oracle-emits-0-DOT vs we-emit-1. Heterogeneous: genuine graphviz-skips + oracle
capture failures (`!include <tupadr3>`, `!pragma smetana`, `<style>`) + parser
divergence. No clean structural predicate (evidence.md). Largely a
harness-classification concern, not a feature gap. Do NOT spend a lever here.

## Ceiling
Fixing L1–L4 flips up to the 89 single-fail fixtures (+ some of the 42 two-fail)
→ **~33–40% EQUAL**. 90% is unreachable (the other 250 fixtures fail 3–7 checks;
much of countMismatch is oracle-side). Ledger, do not chase.

## Housekeeping / debt
- **Inert change to revert (optional):** `graph-layout.ts` cluster-naming in
  `3cd5cf6` (`cluster_${id}`→`cluster${n}`) does nothing for the metric (parity
  uses `svek-dot-emit.ts`, not `graph-layout.ts`). Harmless, green. Revert for
  tidiness when next touching that file.
- **CCN walls (hook blocks edits until fixed):** `parser.ts parseClass` CCN 12
  (blocks L1). `layout.ts` is clear (B0). Check others before editing.
- `.agent-notes/B1-class-cluster-parser-gap.md` (gitignored) has the B1 agent's
  detailed parser-gap notes.

## Resume recipe
1. Re-read `evidence.md` + this ledger. Re-measure: `npx tsx scripts/dot-sync-report.ts class`.
2. Start with **L1** (decompose parseClass → add package/dotted-namespace → nest
   clusters), since its groundwork is already in. Then L4 (cheap), L2, L3.
3. Verify each premise against oracle before coding. Gate: full suite + ratchet;
   confirm no cross-type regression on any shared-file change.
