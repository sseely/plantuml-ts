# Component map — what this mission touches

```mermaid
graph LR
  subgraph harness["Batch 1 (harness)"]
    SD["tests/oracle/svek-dot.ts (T1)"]
    RP["scripts/dot-sync-report.ts (T2)"]
    RT["tests/oracle/*-parity.ratchet.test.ts (T3)"]
    GO["oracle/goldens/&lt;type&gt;/ (T3, grows each iteration)"]
  end

  subgraph loops["Phases 2–5 (fix targets, per diagnosis)"]
    DP["diagrams/description/{parser,layout,ast}"]
    CP["diagrams/class/layout.ts (+model)"]
    SP["diagrams/state/layout.ts (+model)"]
    EM["core/svek-dot-emit.ts"]
    GT["core/graph-layout.types.ts (additive attrs only)"]
  end

  RO["READ-ONLY: core/graph-layout.ts seam,<br/>~/git/plantuml Java, graphviz-ts"]

  DP --> RT
  CP --> RT
  SP --> RT
  EM --> SD
```

Not touched: renderers (geometry consumption unchanged), graphviz-ts,
sequence/activity/timing and other non-svek types, the visual-QA SVG tools
(parked until DOT syncs).
