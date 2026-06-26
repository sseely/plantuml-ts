# Component Map

## Java Activity Diagram v3 Architecture

```mermaid
graph TD
    CMD["command/ (46 files)\nCommandActivity*"] -->|creates| INST
    INST["Instruction hierarchy\nInstructionList (root)\nInstructionIf\nInstructionWhile\nInstructionRepeat\nInstructionFork / Split\nInstructionSwitch\nInstructionGroup / Partition\nInstructionBreak / Goto / Label\nInstructionSimple / Start / Stop"]
    INST -->|createGtile()| GTILE
    GTILE["gtile/ (38 files)\nGtile (base)\nGtileTopDown / TopDown3\nGtileIf / IfAlone\nGtileWhile\nGtileRepeat\nGtileFork / Split\nGtileGroup / Partition\nGtileSwitch"]
    GTILE -->|GConnection*| CONN["Connection routing\nGConnectionVerticalDown\nGConnectionVerticalDownThenBack\nGConnectionSideThenVerticalThenSide\nGConnectionHorizontal\n..."]
    GTILE -->|paint()| UG["UGraphic layer\n(SVG/PNG output)"]
    SWIM["Swimlane model\nSwimlane\nMonoSwimable"] -.->|associated with| INST
    SWIM -.->|constrains x-position| GTILE
    SKIN["Style/Skinparam\nSkinParam\nStyleSignatureBasic"] -.->|colors/fonts| GTILE
```

## Our Current TypeScript Architecture

```mermaid
graph TD
    P["parser.ts\n~400 lines\nsingle-pass regex"] -->|ActivityDiagramAST| L
    L["layout.ts\n~1500 lines\nlayoutSequence (recursive)\nlayoutIf / layoutWhile\nlayoutRepeat / layoutFork\nlayoutSplit"] -->|ActivityGeometry| R
    R["renderer.ts\n~400 lines\nrenderNode / renderEdge"] -->|SVG string| OUT["SVG output"]
    AST["ast.ts\n~200 lines\nActivityNode union type"] -.->|typed by| P
    AST -.->|typed by| L
    THEME["src/core/theme.ts\nsrc/core/skinparam.ts"] -.->|Theme| L
    THEME -.->|Theme| R
```

## Gap at a Glance

```mermaid
graph LR
    subgraph "Java has, we don't"
        G1["InstructionGoto / Label\n(goto/label)"]
        G2["InstructionSwitch\n(switch/case/endswitch)"]
        G3["InstructionGroup\n(group blocks)"]
        G4["InstructionPartition\n(partition blocks)"]
        G5["backward in repeat"]
        G6["detach"]
        G7["GConnection routing\nprimitives"]
    end
    subgraph "We have, works"
        W1["start / stop / end / kill"]
        W2["if / elseif / else / endif"]
        W3["while / endwhile"]
        W4["repeat / repeatwhile"]
        W5["fork / join"]
        W6["split / end split"]
        W7["notes"]
        W8["swimlanes (basic)"]
    end
```
