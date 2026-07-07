# Decisions — Description-routed class fixtures mission

ADRs for the class↔description boundary work. ADR-1 is the load-bearing one and
is **UNRESOLVED** — Batch 0 must resolve it against `~/git/plantuml` + the oracle
before any shape code is written.

---

## ADR-1: Fix in the description engine (B), not routing+class-features (A)

### Status
**PROPOSED — must be confirmed or overturned by Batch 0.** Do not treat as
accepted. Record the Batch-0 evidence here and flip to Accepted/Superseded.

### Context
The 18 oracle-having description-routed fixtures show `rect` where our
description engine emits `plaintext`. Either upstream renders them as a class
diagram (rect) and we misroute (A), or upstream renders them via
DescriptionDiagram producing rect and our engine is infidelic (B).

Evidence gathered so far (mission-a2b recon):
- Forcing the class engine on all 57 guard-tripping fixtures → only **3 EQUAL**.
  The class engine does not model `entity`/`interface`/`circle`/`()`/`rectangle`,
  so path (A) is a multi-feature build, not a reroute.
- `symbolBaseShape('class'|'entity')` already returns rect; the plaintext is from
  a port/shield/lollipop path — i.e. a *localised* over-emission, consistent with
  a fidelity bug (B).

### Decision (proposed)
Prefer **(B): a surgical description-engine shape fix.** Lower blast radius per
change, reuses the description engine we already have, and improves real
description/deployment parity as a side effect. Path (A) is deferred to its own
mission and requires human sign-off (it is large and the L3b experiment shows
low immediate yield).

### Batch-0 confirmation procedure (REQUIRED before coding)
1. In `~/git/plantuml`, determine which factory claims a block like conija
   (`allow_mixing` + `class` + `interface` + `()` + a `--` link) and xosiza
   (`entity {…}` + crow's-foot `}o--o{`). Grep the factory `accepts`/trial-parse
   order; identify whether ClassDiagramFactory or DescriptionDiagramFactory wins.
2. Determine what SHAPE that factory's svek emission produces for a bare
   `class`/`entity`/`interface` leaf (rect vs plaintext HTML table).
3. Cross-check: the cached oracle DOT shows rect → whichever factory produced the
   oracle emits rect for these. Confirm it is the description path (→ B) or the
   class path (→ A).
4. Record the answer + the exact upstream file:line evidence here. If (A): STOP,
   escalate — this brief covers (B) only.

### Consequences
- If B: the fix must be **surgical** — only the verified over-firing condition,
  never a blanket "class→rect", or real deployment diagrams regress.
- If A: this mission does not apply; a new "class-engine descriptive elements +
  routing" mission is needed (large).

---

## ADR-2: Surgical, per-element-type shape changes — never blanket

### Status
Accepted (conditional on ADR-1 = B).

### Context
The description engine correctly emits plaintext for genuine shielded interfaces,
wide-label ports, and group anchors in REAL deployment diagrams. A blanket change
("class-content node → rect") would regress those.

### Decision
Each shape fix targets ONE verified condition (e.g. "an `interface` leaf with no
lollipop link is rect, not shielded-plaintext", or "a crow's-foot relationship
endpoint auto-created as a leaf is rect, not a port"). Batch 1 produces the exact
condition per element type from the oracle; Batch 2 implements each as an
independent, independently-gated change.

### Consequences
More, smaller commits; each with its own before/after diff. Slower but safe.

---

## ADR-3: The description corpus is the regression oracle, not just class

### Status
Accepted.

### Context
This is the first mission that edits the description engine to move the CLASS
metric. The natural failure mode is tunnel-vision on class parity while silently
breaking deployment/component/use-case.

### Decision
Every gate runs the class AND description parity reports plus a before/after
EQUAL-set diff on BOTH corpora. A description regression blocks the commit
regardless of class gains. Net EQUAL across both corpora must be ≥ 0, and by
policy the description corpus must not drop at all.

### Consequences
Roughly doubles the measurement cost per batch. Non-negotiable given the blast
radius.

---

## ADR-4: Oracle-blind fixtures are out of scope

### Status
Accepted.

### Context
36 of 54 description-routed fixtures have no cached oracle (`!pragma layout`
smetana/elk, or capture failures). They cannot be validated by the DOT metric.

### Decision
Exclude them. Do not tune behaviour toward fixtures we cannot measure — that is
how prior briefs went wrong. The measurable target is the 18 oracle-having
fixtures only.

### Consequences
The headline "54 fixtures" is misleading; the real target is ≤18, realistic flip
~6–10. Size and justify the mission on that, not on 54.
