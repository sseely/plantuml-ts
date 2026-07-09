# T9 — Figures: Actor, ActorBusiness, Person, Boundary, Control, EntityDomain, Interface, Usecase

Shared spec: [`symbols-common.md`](symbols-common.md).

## Classes
`USymbolActor.java`, `USymbolActorBusiness.java`, `USymbolPerson.java`,
`USymbolBoundary.java`, `USymbolControl.java`, `USymbolEntityDomain.java`,
`USymbolInterface.java`, `USymbolUsecase.java`.

## Family specifics
- Actor stick figure: head circle + body/arm/leg lines — exact
  proportions from the Java constants; ActorBusiness adds the slash.
  Upstream may delegate to a shared actor-drawing helper (`klimt/shape/`
  or similar) — if so, port that helper as part of this task (journal),
  keeping its upstream name.
- Person: rounded-figure variant (head + shoulders shape).
- Boundary/Control/EntityDomain: the robustness icons (circle+line
  combos) — small but exact.
- Interface: circle; `circle` keyword resolves via the registry — verify
  in `USymbols.java`, journal the mapping (no invented class).
- Usecase: ellipse with title layout — the ellipse itself is Brief 1's
  UEllipse; the symbol contributes placement math.

## Write-set
- `src/core/decoration/symbol/USymbol{Actor,ActorBusiness,Person,Boundary,Control,EntityDomain,Interface,Usecase}.ts` (+ ported shared actor helper if upstream has one, journaled)
- `tests/unit/core/decoration/symbols-figures.test.ts`

## Acceptance criteria
1. Per symbol: standalone render conformant vs jar fragment (usecase/
   actor fragments abound in `test-results/dot-cache/usecase/`).
2. Given Actor vs ActorBusiness, then the slash is the only delta.
3. Given the robustness trio, then icon geometry matches the Java
   constants exactly.
