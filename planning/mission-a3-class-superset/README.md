# Mission A3 — Class-engine descriptive-element consolidation

Make the plantuml-ts class engine own the descriptive elements the way upstream's
`ClassDiagramFactory` does, so mixed `class` + `interface`/`entity`/`enum`/
`circle`/`package`/`component`/lollipop diagrams stop being misdispatched to the
description engine. This is the **(A-full)** path chosen after the
`mission-desc-routed` Batch 0 investigation proved the description-routed tail is a
routing/engine-boundary bug, not a description-engine fidelity bug.

> **Read this whole file + `decisions.md` before writing code.** The recurring
> lesson from A2/A2b/desc-routed: every ungrounded brief was falsified by the
> oracle. This mission is grounded in the 18-fixture inventory below and the
> upstream factory evidence in `../mission-desc-routed/decisions.md` ADR-1 —
> keep it grounded. Batch 0 re-verifies per element before any code.

## Status
- **Batch 0 COMPLETE (2026-07-07).** Shape table + Tier-1 classification +
  ADR-2 (Accepted, corpus-safe: flip&EQUAL=0 / 314 fixtures) + allow_mixing note
  in `decision-journal.md`. **STOPPED for sign-off before Batch 1** on a scope
  finding: routing-alone wins **~1** Tier-1 fixture (taxemo), not 5 — the other 4
  need a namespace qualified-endpoint edge fix orthogonal to descriptive elements.
  Baselines: class **274/680 (40%)**; DESCRIPTION (at-risk) component 234/259,
  usecase 59/87.
- Drafted 2026-07-07 after `mission-desc-routed` Batch 0 resolved ADR-1 to (A)
  and the user chose (A-full).

## The decision that created this mission (settled — do not relitigate)
`mission-desc-routed` Batch 0 established, with `~/git/plantuml` file:line
evidence (see that mission's `decisions.md` ADR-1 "Batch-0 findings"):
- `allow_mixing` is a **class** command (`ClassDiagram.java:57`;
  `ClassDiagramFactory.java:123`), absent from `DescriptionDiagramFactory`.
- `ClassDiagramFactory` is a **superset**: `CommandCreateElementFull2`
  (`(state|`+`CommandCreateElementFull.ALL_TYPES`+`)`), `CommandCreateEntityObject`,
  `CommandCreateElementParenthesis` (`()` lollipop), `CommandLinkLollipop`,
  `CommandDiamondAssociation`, `CommandPackage`, `CommandNamespace`.
- Oracle rect provenance is the class factory (plain leaves → rect; only genuine
  lollipops → plaintext).

Conclusion: these fixtures are upstream **class diagrams**. plantuml-ts misroutes
them because `class/index.ts:53` does `if (hasDescriptiveSignal(declLines))
return false` — it *declines* exactly the keywords the class factory *owns*. The
faithful fix (per CLAUDE.md "consolidation to match upstream's engine boundary,
not more accepts() patterns on the diverged structure") is to make the class
engine accept and render the descriptive elements.

## The two crux mechanisms (verified in code, not assumed)
1. **Dispatch decline — `src/diagrams/class/index.ts:41-53`.** `accepts()`
   returns false for any block with a descriptive signal. This is the misroute.
   Batch 1 replaces it with a discriminator that mirrors upstream (class factory
   owns mixed class+descriptive; description owns pure descriptive).
2. **Leaf shape already defaults rect — `src/diagrams/class/layout.ts:274-286`.**
   `buildDotNodes` maps `association`→diamond, `assoc-circle`→circle,
   port/qualifier→plaintext, everything else→**rect**. So a classifier of kind
   `interface`/`entity`/`enum`/`class` already renders rect once it exists in the
   AST. The missing work is the **parser** creating those classifiers from the
   descriptive keywords + the **lollipop/usecase** special shapes.

## Target inventory — the 18 oracle-having fixtures (Batch-0 measured)
Grouped by the tier that unlocks them. `{kw}` = descriptive keywords present;
`→` = oracle node-shape multiset. This is the work queue and the measurable target.

**Tier 1 — routing-dominant (pure/near-pure class, misrouted):**
```
dudimi-83  {class}                    → rect=5
duvuti-29  {class}                    → rect=5
pareli-69  {class}                    → rect=5
taxemo-34  {class}                    → rect=3
xodopa-41  {class}                    → rect=5
```
These carry a descriptive *signal* (a keyword somewhere) but the diagram is
class content. If today's class engine already produces their structure, they
flip on the routing change alone. (Recon caveat: forcing class on all 57 gave
only **3 EQUAL** — so not all Tier-1 flip for free; Batch 0 checks each.)

**Tier 2 — leaf classifiers (interface/entity/enum/abstract/annotation/circle):**
```
lilura-67  {abstract,annotation,class,entity,enum,interface}  → rect=10
tepazu-23  {abstract,annotation,class,entity,enum,interface}  → rect=6
xidura-26  {abstract,annotation,class,entity,enum,interface}  → rect=6
niduni-65  {circle,class,interface}                           → rect=6 plaintext=1
```

**Tier 3 — containers (package/rectangle/database/component/stack):**
```
rakuci-96  {class,package,rectangle}   → rect=3
xenere-07  {class,package,rectangle}   → rect=3
givofi-11  {allow_mixing,class,database} → rect=2
popesa-39  {allow_mixing,class,database} → rect=2
lojiga-09  {class,component,stack}     → rect=4 point=1
```

**Tier 4 — lollipop + special shapes:**
```
conija-14  {allow_mixing,class,interface}       → plaintext=1 rect=2   (() lollipop)
sijisi-94  {allow_mixing,class,rectangle}       → plaintext=1 point=1 rect=1
cacoma-43  {actor,allow_mixing,class,component,usecase} → rect=3 ellipse=1  (usecase→ellipse)
xosiza-60  {circle,class,entity}                → rect=11              (crow's-foot endpoints)
```

## Scope & realistic target
- **Faithful acceptance, corpus-scoped verification (ADR-4):** the parser should
  accept the full upstream `ALL_TYPES` keyword set (do not trim it — CLAUDE.md
  YAGNI-does-not-apply), but batches are *verified* against the element types the
  18 fixtures exercise. Do not tune toward the 36 oracle-blind fixtures (ADR-4 of
  desc-routed still holds — they are unmeasurable and out of scope).
- **Grounded target:** up to ~**+12 EQUAL** of the 18 if all four tiers land
  cleanly. Realistically fewer — Tier 4's lollipop/point/ellipse specifics and
  any deep-divergence fixtures may resist. Frame progress per-tier, not on 18.
  This is a genuine multi-batch build, not a lever; the recon's "3 EQUAL from
  forcing class" is the floor, and the feature work is what raises it.

## The primary hazard (read twice)
This mission moves descriptive elements **into** the class engine. The inverse
risk of desc-routed: if Batch 1's routing discriminator is too greedy, genuine
**deployment/component/use-case diagrams regress** (stolen from the description
engine into a class engine that renders them wrong). The DESCRIPTION corpus is
now the at-risk corpus. ADR-3's dual-corpus gate is non-negotiable and is the
main thing standing between this mission and a large silent regression.

## Batches
- **Batch 0** — investigation only. Per-element upstream shape table; the 5
  Tier-1 fixtures' current class output; the routing discriminator design. No code.
- **Batch 1** — routing: class `accepts()` owns mixed class+descriptive; pure
  descriptive stays description. Land Tier-1 routing wins.
- **Batch 2** — leaf classifiers: parser accepts interface/entity/enum/abstract/
  annotation/circle → rect (circle special). Land Tier 2.
- **Batch 3** — containers: package/rectangle/database/component/stack → clusters
  /boxes. Land Tier 3.
- **Batch 4** — lollipop + special: `()`/`--(`, usecase→ellipse, crow's-foot
  endpoints. Land Tier 4.
- **Batch 5** — re-measure, residual ledger, merge.

## Quality gates (every batch that touches code)
Per ADR-3 (dual-corpus). After each change:
1. `npx tsx scripts/dot-sync-report.ts class` — class EQUAL delta.
2. `npx tsx scripts/dot-sync-report.ts description` (or the description parity
   report) — **description EQUAL must not drop**.
3. Before/after EQUAL-set diff on BOTH corpora (git stash the change, re-measure,
   unstash, `comm`) — **zero REGRESSED on either**.
4. `npm test` + `npm run typecheck` + `npm run lint` green.
5. One commit per task; merge `--no-ff` at Batch 5 (per pr-workflow).
Mind the 500-line / CCN-10 / NLOC-30 hooks — extract helpers as the class engine
already does (`class-declaration-parser.ts`, `class-namespace.ts`, etc.).

## Divergence from the mission guide (documented, deliberate)
`planning/mission-guide.md` G-2/G-5 frame the *ideal* as Track SI-1
(`src/core/cucadiagram/`) + a greenfield class rebuild that shares the entity
base with component/usecase. This mission does **not** do that — it extends the
existing class engine to mirror the class factory's command set, to move parity
now. The cucadiagram convergence remains a separate future track; this mission
must not block it (keep new parser code in the class engine's helper modules, not
entangled with description internals). Recorded in `decisions.md` ADR-1.
