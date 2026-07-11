# Component map — state engine before/after

```mermaid
graph TD
  subgraph before [Before A4 — greenfield]
    P1[state/parser.ts] --> L1[state/layout.ts<br/>recursive layoutLevel<br/>COMPOSITE_PAD constants<br/>no shapes/clusters/labels]
    L1 --> GL1[core/graph-layout.ts]
    L1 --> R1[state/renderer.ts]
  end

  subgraph after [After A4 — svek-faithful]
    P2[state/parser.ts<br/>+T2: full StateDiagramFactory grammar] --> A2AST[state/ast.ts + new kinds]
    A2AST --> SDG[state/state-dot-graph.ts NEW<br/>shapes, minlen, HTML labels,<br/>cluster envelopes, autonom child passes]
    SDG --> SZ[state sizing module NEW<br/>EntityImageState family]
    SDG --> GL2[core/graph-layout.ts<br/>child passes in oracle dump order]
    SDG --> EMIT[core/svek-dot-emit.ts<br/>additive envelope support D3]
    GL2 --> R2[state/renderer.ts aligned]
  end

  CLASS[class engine A2/A3<br/>class-dot-graph patterns] -.mirrored, not shared — SI1 later.-> SDG
  RATCHETS[class 687 / object 78 / description ratchets] -.pin shared emitter.-> EMIT
```

Oracle comparison flow (unchanged from A2/A3): renderSync →
setLayoutInputObserver captures each layout() call → toSvekDot →
compareStructural vs cached `svek-N.dot` (pairing graph #i ↔ svek-(i+1),
so child-pass ORDER matters — D2).
