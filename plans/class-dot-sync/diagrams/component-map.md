# Component map — what this mission touches

```mermaid
graph TD
  subgraph class engine [src/diagrams/class — primary write-set]
    P[parser.ts] --> CC[class-commands.ts<br/>T1 new, T6 newpage]
    P --> AST[ast.ts<br/>T6 pages]
    L[layout.ts<br/>T5 T7] --> CDG[class-dot-graph.ts<br/>T2 new, T5 T8]
    L --> R[renderer.ts<br/>T7 stacked pages]
    HLX[class-html-label.ts]:::dead
  end
  subgraph shared [src/core — additive only, D3]
    GLT[graph-layout.types.ts]
    EMIT[svek-dot-emit.ts]
  end
  subgraph harness [parity harness]
    RPT[scripts/dot-sync-report.ts<br/>T4 jar unification]
    CMP[tests/oracle/svek-dot.ts<br/>read-only comparator]
    RAT[tests/oracle/class-dot-parity.test.ts<br/>T9 ratchet]
    GOLD[(oracle/goldens/class/**)]
  end
  CDG --> GLT
  GLT --> EMIT
  EMIT --> CMP
  RPT --> CMP
  RAT --> GOLD
  RAT --> CMP
  classDef dead stroke-dasharray: 5 5
```

`class-html-label.ts` (dashed) is deleted in T3. The description engine's
files are out of write-set entirely; its ratchet is the shared-file
regression gate.
