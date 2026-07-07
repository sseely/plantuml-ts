# Mission — Description-routed class fixtures

Raise class DOT parity past the ~40% plateau by resolving the **class↔description
engine boundary**: 54 class-corpus fixtures render via the DESCRIPTION engine and
diverge from their (class-content) oracle. This is the last structural block after
the L1–L4 + association-class levers exhausted the clean single-mechanism wins.

> **Read this whole file + `decisions.md` before writing code.** The prior
> sessions' recurring lesson (every ledger brief was falsified by the oracle)
> applies double here — this is an architecture area, not a mechanism. The
> mission is INVESTIGATION-FIRST: Batch 0 picks the path, and getting it wrong
> wastes the whole mission.

## Status
- **NOT STARTED.** Drafted 2026-07-07 from the recon in
  `../mission-a2b-class-parity/residual-ledger.md` (the "DESCRIPTION-ROUTED TAIL"
  entry). Baseline: **274/680 EQUAL (40%)** on `main`.

## The problem (instrumented, not assumed)
- `hasDescriptiveSignal(lines)` is true for **54** class.json fixtures (a
  descriptive keyword — `entity`/`interface`/`circle`/`()`/`node`/… — appears at
  a line start). The dispatcher (`src/core/dispatcher.ts`, class registered
  before description) then routes them to the **description** engine.
- Of the 54: **36 are oracle-blind** (no cached `svek-*.dot` — `!pragma layout`
  or oracle capture failures; cannot be validated, OUT OF SCOPE), **18 have an
  oracle**, of which only **1 is EQUAL**.
- Fail-set histogram of the 18 (from the recon script): 5× fail ALL six
  structural checks, 3× graph-count mismatch, 3× degree+edge+minlen+node+shape,
  2× cluster+degree+node+shape, **3× shapeOk-only**, **1× labelOk-only**.
- **Root symptom:** the description engine emits `shape=plaintext` where the
  class-content oracle emits `rect`. Verified: conija (`class foo`,
  `interface dummy`, `() "Does work now"` → all 3 plaintext; oracle 1 plaintext +
  2 rect); xosiza (`entity Entity {}` correctly rect, but the crow's-foot
  endpoints A–H/foo1/foo2 → plaintext; oracle all 11 rect); niduni (6 plaintext +
  1 rect; oracle inverted: 6 rect + 1 plaintext).
- **Where the plaintext comes from** (`src/diagrams/description/layout.ts`):
  `buildPortNode` (259-212, `isPort` + wide label → plaintext) and `shapeForNode`
  (264, shielded interface → plaintext). NOTE `symbolBaseShape('class'|'entity')`
  already returns rect (`layout-helpers.ts:369-378`), so a bare class/entity is
  NOT the direct culprit — the plaintext arrives via a port/shield/lollipop path
  that a Batch-1 dive must pin per element type.

## THE decision this mission must make first (Batch 0)
The oracle shows **rect**. Two mutually-exclusive explanations, and everything
downstream depends on which is true:

- **(A) Upstream renders these via a CLASS-like path** (rect boxes), and our
  dispatch mis-sends them to description. → Fix is ROUTING + teaching the class
  engine `entity`/`interface`/`circle`/`()`/`rectangle`. BUT: forcing the class
  engine on all 57 in the L3b experiment gave only **3 EQUAL** — the class engine
  does not handle these elements, so this path is a large multi-feature build.
- **(B) Upstream renders them via DescriptionDiagram producing rect**, and OUR
  description engine over-emits plaintext (a fidelity bug). → Fix is SURGICAL in
  the description engine, and also improves real description/deployment parity.

**Batch 0 resolves A vs B by reading `~/git/plantuml`** (which factory claims a
`@startuml … entity/interface/class … @enduml` block, and what shape that factory
emits) and cross-checking against the oracle DOT. Do NOT write shape code until
A/B is decided and recorded in `decisions.md`. See `decisions.md` ADR-1.

Working hypothesis (to be confirmed, not assumed): **(B)** — the oracle is
description-engine output and our engine's port/shield/lollipop plaintext logic
is over-firing for class-content nodes. This path is lower-risk and higher-reuse,
but the risk it carries is real (see Quality Gates).

## Scope & realistic target
- **In scope:** the 18 oracle-having description-routed fixtures. Realistic
  flip: the 4 "close" (3 shapeOk-only + 1 labelOk-only) + a subset of the
  mid-tier as shape fixes cascade. Grounded ceiling **~+6–10 EQUAL** (→ ~41-42%).
  This is a SMALL numeric lever bought with architecture-level care — size the
  effort accordingly and STOP if the yield/​risk turns unfavourable.
- **Out of scope:** the 36 oracle-blind fixtures (unvalidatable); a full class
  engine rewrite; any change that regresses the description/deployment corpus.

## Batches
See each `batch-N/overview.md`. Summary:

- **Batch 0 — Decide A vs B (investigation only, no src edits).** Read upstream
  factory selection + shape emission for a representative fixture (conija /
  xosiza). Confirm against oracle DOT. Record the decision + evidence in
  `decisions.md` ADR-1. STOP for human sign-off before Batch 1 if the decision
  is (A) (large scope change).
- **Batch 1 — Diagnose the plaintext source per element type** (class,
  interface, entity-with-body, crow's-foot endpoint, lollipop `()`). For each of
  the 3 shapeOk-only fixtures, trace exactly which node → which code path →
  plaintext, and what the oracle wants. Output: a table (element → current path →
  oracle shape → fix site). No behavioural change yet.
- **Batch 2 — Surgical shape fix (path B) or routing+features (path A).** Under
  B: make the over-firing port/shield/lollipop path NOT mark class-content nodes
  plaintext when the oracle wants rect, keyed on the specific verified condition
  (NOT a blanket "class → rect"). One targeted change per element type, each
  gated independently.
- **Batch 3 — Re-measure + mid-tier + labelOk-only.** Re-run parity; pick up any
  mid-tier fixtures the shape fix cascaded; investigate sijisi (labelOk-only,
  mixed `class`+`rectangle`+`::port`). Update the residual-ledger.

## Quality gates (mandatory between batches)
The description engine renders REAL deployment/component/use-case diagrams. Any
shape change is high-blast-radius. Every batch that touches src MUST pass:
- `npm run typecheck` (both tsconfigs) — exit 0.
- `npm run lint` — exit 0.
- `npm test` (full vitest suite) — exit 0. Watch the description/deployment/
  component unit + integration tests specifically.
- **Class parity:** `npx tsx scripts/dot-sync-report.ts class` — EQUAL must not
  drop; target up.
- **Description parity (THE regression guard):**
  `npx tsx scripts/dot-sync-report.ts description` (+ deployment/component/
  usecase if separate corpora exist) — EQUAL must **not drop by even 1**.
- **Before/after EQUAL-set diff on BOTH class AND description corpora** (stash /
  compare, as used all through mission-a2b): REGRESSED must be empty. This is the
  non-negotiable gate — a description-engine change that flips 4 class fixtures
  but silently breaks 6 deployment fixtures is a net loss.

## Stop conditions (STOP and get human input)
- Batch 0 decides path (A) — routing + class-engine features is a different,
  larger mission; do not start it under this brief without sign-off.
- Any batch's before/after diff shows a description-corpus regression that cannot
  be made surgical in ≤2 tries.
- The realistic yield after Batch 1 diagnosis is < ~4 EQUAL — not worth the
  description-engine risk; record findings and stop.
- The same shape condition is edited 3× without resolving its check — signals the
  fix is not surgical enough (diagnosis.md consecutive-fix rule).

## Files this mission is likely to touch (path B)
- `src/diagrams/description/layout.ts` (`buildPortNode`, `buildDotNodes`,
  shape assignment ~209/259/264)
- `src/diagrams/description/layout-helpers.ts` (`shapeForNode`,
  `isInterfaceShielded`, `isPortLabelWide`, `symbolBaseShape`)
- Possibly the description parser (if a class-content node is mis-typed as
  `port`/`interface`)
- Tests: `tests/unit/description/*`, `tests/oracle/*` parity assertions
- `planning/mission-a2b-class-parity/residual-ledger.md` (status)

## Verification recon scripts (regenerate; do not commit — `scripts/tmp-*.ts`)
The recon that produced the numbers above:
1. Description-routed status + fail histogram (registry.resolve + compareStructural
   over hasDescriptiveSignal fixtures).
2. The shapeOk/labelOk-only close set + per-fixture shape multiset diff.
3. Per-node shape dump via `setLayoutInputObserver` for conija/xosiza.
Rebuild these first thing in Batch 1 to re-confirm the baseline before editing.
