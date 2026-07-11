# Architecture decisions (approved 2026-07-11)

## D1 — Absorb object into the class engine (mirror upstream)

Upstream `ClassDiagramFactory` (DiagramType.CLASS) registers
`CommandCreateEntityObject`, `CommandCreateEntityObjectMultilines`,
`CommandAddData`, `CommandCreateMap` among its 43 commands
(`ClassDiagramFactory.java:81-85,116-117`); `objectdiagram/` holds only
`AbstractClassOrObjectDiagram` (which `ClassDiagram` extends) and those
commands. Port the commands into the class command engine at upstream's
registration positions; `classAccepts` gains `object`/`map` keyword
patterns (preserving the A2 name-start guard so `Object <|-- Foo`
stays a class relationship). The 13 mixed class+object fixtures and 28
map fixtures are unreachable any other way. Piecemeal extension of the
separate object parser was rejected — it would re-implement class
commands inside a parser upstream doesn't have.

## D2 — Delete the object plugin

Nothing keys on plugin type `'object'` (verified: theme, skinparam,
dispatcher typed-routing — object sources only arrive via `accepts()`
scanning). Once `classAccepts` covers object/map, `src/diagrams/object/`
is dead code: delete `index.ts` + `parser.ts`, drop the
`registry.register(objectPlugin)` line, re-point its unit tests at the
class engine (behavior preserved via the ported commands).

## D3 — Map support is a full port (DOT sizing + SVG rendering)

DOT parity asserts node sizes, so map tables need real measured sizing
regardless; rendering the `key => value` rows in SVG on top is
incremental and the fixtures are user-visible. DOT-only with
placeholder SVG rejected (long-tail rule: the render IS the product).

## D4 — Exit bar and oracle handling per A2 precedent

100% of comparable fixtures EQUAL minus maintainer-validated ledgered
divergences; node sizes asserted from the start; ratchet pins goldens
in `oracle/goldens/object/` via a `tests/oracle/object-dot-parity.test.ts`
mirroring the class one. The 3 fixtures with no canonical SVG (jar
crashes incl. a `DecorateEntityImage` NPE) are excluded as
oracle-blind with one ledger entry each. `EXPECTED_TAG` object →
`'CLASS'` in `scripts/dot-sync-report.ts` (T0).

---

# Operational notes (from readiness review)

- **Rollback:** Reversible — plain commit reverts; no migrations.
- **Detection:** class ratchet (687 goldens) is the regression alarm
  while the shared engine changes; object ratchet grows as fixtures
  turn EQUAL; the report's comparable denominator is pinned by stop
  condition 6.
- **Dispatch risk:** after `classAccepts` learns `object`/`map`, verify
  description/component/usecase report numbers unchanged (T5
  acceptance criterion).
