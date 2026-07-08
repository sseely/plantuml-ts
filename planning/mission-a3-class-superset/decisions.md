# Decisions — Mission A3 (class descriptive-element consolidation)

---

## ADR-1: Extend the existing class engine, not a greenfield cucadiagram rebuild

### Status
Accepted (2026-07-07).

### Context
`mission-guide.md` G-2/G-5 describe the ideal end-state: Track SI-1
(`src/core/cucadiagram/`) as a shared entity base, then greenfield class /
component / usecase engines on top of it. That is a large, not-yet-started track.
Meanwhile the class engine has had four missions of parity work (L1–L4,
association-class) and sits at 40% class DOT parity. The user chose (A-full):
make the class engine own the descriptive elements now.

### Decision
Extend the existing class engine to mirror `ClassDiagramFactory`'s command set
(`CommandCreateElementFull2` family + lollipop + `allow_mixing`). Do **not**
attempt the cucadiagram rebuild here.

### Consequences
- Parity moves now; the codebase stays coherent with the four prior class missions.
- The cucadiagram convergence is deferred, not cancelled. To keep it possible,
  new parser code lives in the class engine's own helper modules and must not
  entangle with description-engine internals. When SI-1 eventually lands, this
  work is refactored onto it — the *behaviour* (keyword→kind→shape) ported here
  is the reusable part and survives the refactor.
- Divergence from the guide is deliberate and documented here.

---

## ADR-2: The class/description routing discriminator (the load-bearing design)

### Status
**ACCEPTED (2026-07-07, Batch 0).** Finalized against `~/git/plantuml`
(`PSystemBuilder.java` trial-parse order + `CommandCreateElementFull2` allowmixing gate +
`CommandCreateClass`/`CommandPackageWithUSymbol` native command sets) and corpus-safety
probed over 314 oracle-having DESCRIPTION fixtures. See `decision-journal.md` T0.3 for the
full evidence. Summary: **flips=1, flip&currently-EQUAL=0** (the 1 flip, `gutute-00`, is
correctly class per upstream and currently not-EQUAL); **18/18** target class fixtures
route to class. ADR-3 gate satisfied → PROCEED.

### Context
Today: `description/index.ts` accepts any block with a descriptive element;
`class/index.ts:53` declines any block with a descriptive signal. After this
mission both engines can render descriptive elements, so "who wins" must be a
real discriminator, not two overlapping `accepts()`. Upstream resolves this by
factory trial order + which commands parse the whole block — NOT by keyword
presence. Getting this wrong regresses the DESCRIPTION corpus (the primary hazard).

### Candidate discriminator (to confirm in Batch 0)
A block routes to **class** when it carries class-specific signal that the
description factory cannot parse:
- `allow_mixing` present (class-only command), OR
- a `class`/`abstract`/`enum`/`annotation`/`interface`-with-members declaration
  (`{ ... }` body with typed members / visibility markers `+ - # ~`), OR
- a class-only relationship form (extension `<|--`, composition `*--`,
  aggregation `o--`, or a qualified `::`/generic `<T>` endpoint).
Otherwise (pure descriptive elements + plain links) → **description**.

Batch 0 verifies this against: (a) upstream's actual factory-selection order and
trial-parse for a conija/xosiza/cacoma block; (b) the description corpus — the
discriminator must NOT pull any currently-EQUAL description fixture into class.

### Decision (final)
Adopt the trial-parse-faithful discriminator (full design in `decision-journal.md`
T0.3). It mirrors upstream's "class wins iff the class factory parses every line" as
class-plugin `accepts()` logic: `allow_mixing`→class (Δ1); else decline only on a
`hasDescriptiveSignal` computed over declLines with note-bodies (Δ2), member lines (Δ3),
native-class decls (Δ4: incl. entity/circle/protocol/…), and container-openings (Δ4b)
removed; else accept on native class signal. Implement the Δ2–Δ4b filtering **inside the
class engine** (class-local, not by mutating the shared `descriptive-keywords.ts`, which
the sequence/description guards also use).

### Consequences
- If the discriminator can be made faithful and corpus-safe → proceed.
- If Batch 0 finds no discriminator that both wins the 18 and spares the
  description corpus → STOP and escalate; the routing may require the cucadiagram
  unification (ADR-1's deferred track) to be correct.

---

## ADR-3: Dual-corpus regression gate — DESCRIPTION corpus is now the at-risk side

### Status
Accepted (carried from `mission-desc-routed` ADR-3, inverted).

### Context
desc-routed worried about the description engine breaking while chasing class.
Here it is sharper: we are *removing* blocks from the description engine's remit.
A greedy discriminator silently steals real deployment/component/usecase diagrams.

### Decision
Every code-touching task runs class AND description parity plus a before/after
EQUAL-set diff on BOTH corpora. **A description-corpus regression blocks the
commit regardless of class gains.** Net EQUAL across both corpora must be ≥ 0; by
policy the description corpus must not drop at all.

### Consequences
Doubles measurement cost per task. Non-negotiable given the blast radius.

---

## ADR-4: Faithful full-keyword acceptance, corpus-scoped verification

### Status
Accepted.

### Context
CLAUDE.md: YAGNI does not apply; the port mirrors upstream. `CommandCreateElementFull2`
accepts the full `ALL_TYPES` keyword set. Trimming to just the 18 fixtures'
keywords would drop special cases that surface later.

### Decision
The parser accepts the complete upstream `ALL_TYPES` keyword set (component, node,
cloud, database, folder, frame, storage, agent, artifact, card, control, boundary,
collections, queue, stack, actor, usecase, interface, entity, circle, rectangle,
package, …) mapped to the upstream `LeafType`/`USymbol` for each. Batches are
*verified* against the element types the 18 fixtures use; the rest are accepted
faithfully but not individually oracle-checked here (they surface in future
component/usecase missions).

### Consequences
Broader parser than the 18 strictly need — intentional, per porting discipline.
The shape table (Batch 0) is the authority for keyword→shape; do not guess shapes.
