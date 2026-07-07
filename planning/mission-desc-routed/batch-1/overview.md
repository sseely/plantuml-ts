# Batch 1 — Diagnose the plaintext source per element type

**Prereq:** ADR-1 = (B). No behavioural change in this batch — pure diagnosis.
Output is a per-element-type table that Batch 2 implements against.

## Goal
For each element type that the oracle wants as `rect` but we emit `plaintext`,
pin the exact code path that sets plaintext and the exact condition that should
instead leave it rect. Verify against the oracle per fixture — never guess.

## The close fixtures (targets)
- **conija** [shapeOk]: `class foo`, `interface dummy`, `() "Does work now"`,
  `foo -- "Does work now"`. Oracle 1 plaintext + 2 rect; we emit 3 plaintext.
- **niduni** [shapeOk]: `class P/C1/C2`, `interface A1`, `circle A2`, links incl.
  `--(` lollipop. Oracle 6 rect + 1 plaintext; we emit (inverted) 6 plaintext + 1
  rect.
- **xosiza** [shapeOk]: `entity Entity {…}` (already rect), crow's-foot links
  `A |o--o| B`, `}o--o{`, `foo1 }-- foo2`. Oracle 11 rect; we emit 1 rect + 10
  plaintext (the crow's-foot endpoints).

## Tasks

| id | task | output |
|----|------|--------|
| T1.1 | For each close fixture, dump per-node (id, symbol, shape, isPort) via `setLayoutInputObserver`, and map each plaintext node to its source: `buildPortNode` (isPort), `shapeForNode` shielded-interface, or another. | node→path map |
| T1.2 | conija: why are `class foo` and `interface dummy` plaintext? (foo is a class — `shapeForNode` returns rect, so a DIFFERENT path fires. Likely the lollipop link makes them ports/shielded.) Pin it. | condition |
| T1.3 | niduni: why the near-total plaintext↔rect inversion? Check `circle A2`, `interface A1`, and the `--(` lollipop's effect on endpoint typing. | condition |
| T1.4 | xosiza: why do crow's-foot endpoints (A–H, foo1/2) become plaintext? They are auto-created relationship endpoints — check whether they are typed as `port`/`interface` or hit `isPortLabelWide`. | condition |
| T1.5 | Assemble the table: `element type × trigger × current path × oracle shape × fix site × affected fixtures`. Note for each fix site whether real deployment diagrams rely on the current behaviour (grep the description corpus for the trigger). | Batch-2 spec |

## Exit criterion
A verified per-element fix table where every row cites the oracle shape and the
description-corpus impact of changing it. If any row's fix would clearly regress
real deployment diagrams and cannot be narrowed, mark it "do not fix" and remove
its fixtures from the target.

## Anti-pattern to avoid
"Class-content node → rect" as a single switch. Each row must be a specific
condition (e.g. "an interface leaf with a lollipop `--(` link on the class side
is rect"), verified to leave genuine shielded interfaces / wide-label ports /
group anchors untouched.
