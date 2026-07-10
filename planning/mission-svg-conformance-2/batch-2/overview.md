# Batch 2 — Jar measurer ∥ USymbol families

Six parallel tasks. T4 needs T2's table; T5–T9 need T3's base. Write-sets
are disjoint (one symbol family per task, one file per upstream class).

| ID | Description | Agent | Writes | Depends On | Done |
|----|--------------|-------|--------|------------|------|
| T4 | measurer-jar.ts + DOT-parity impact probe | typescript-pro (sonnet) | src/core/measurer-jar.ts, tests/unit/core/measurer-jar.test.ts | T2 | [x] |
| T5 | Box family: Rectangle, Card, Action, Agent, Label, Collections, Stack | typescript-pro (sonnet) | src/core/decoration/symbol/USymbol{Rectangle,Card,Action,Label,Collections,Stack}.ts, tests/unit/core/decoration/symbols-box.test.ts | T3 | [x] |
| T6 | Component family: Component1, Component2, Node, Artifact, File, Frame | typescript-pro (sonnet) | src/core/decoration/symbol/USymbol{Component1,Component2,Node,Artifact,File,Frame}.ts, tests/unit/core/decoration/symbols-component.test.ts | T3 | [x] |
| T7 | Container-solids: Database, Queue, Storage, Hexagon, Process | typescript-pro (sonnet) | src/core/decoration/symbol/USymbol{Database,Queue,Storage,Hexagon,Process}.ts, tests/unit/core/decoration/symbols-solids.test.ts | T3 | [x] |
| T8 | Path-heavy: Cloud, Folder | typescript-pro (sonnet) | src/core/decoration/symbol/USymbol{Cloud,Folder}.ts, tests/unit/core/decoration/symbols-paths.test.ts | T3 | [x] |
| T9 | Figures: Actor, ActorBusiness, Person, Boundary, Control, EntityDomain, Interface, Usecase | typescript-pro (sonnet) | src/core/decoration/symbol/USymbol{Actor,ActorBusiness,Person,Boundary,Control,EntityDomain,Interface,Usecase}.ts, tests/unit/core/decoration/symbols-figures.test.ts | T3 | [x] |

Note: upstream has no `USymbolAgent.java` — `agent` maps to a rectangle
variant; T5 verifies against `USymbols.java` and journals the mapping.
`circle` likewise maps via `USymbolInterface`/registry — T9 verifies.

## Common task spec (applies to T5–T9)
See `symbols-common.md` in this directory — one shared spec; each family
task takes it plus its class list. Port each `USymbolX.java` verbatim:
draw sequences through klimt `UGraphic` (URectangle/UPath/UEllipse/
UPolygon/ULine), `SymbolContext` application, `deltaShadow`, title/label
TextBlock placement math. Every symbol gets at least one
harness-verified conformance assertion against a jar fragment
(cached `test-results/dot-cache/{component,usecase}/*/in.svg`, or
jar-generated with provenance noted).

## Quality gates
Mission-level gates from `../README.md`. T4's parity probe result is
journaled; any count decrease is a STOP before Batch 3.

## Next
Mark T4–T9 `[x]` here and in `../README.md`, commit (one per task),
proceed to Batch 3.
