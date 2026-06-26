# Component map — before / after

## Before (in-house engines, scattered consumers)
```mermaid
graph TD
  subgraph diagrams
    C[class]; CO[component]; S[state]; U[usecase]; D[dot]; J[json]
  end
  C --> AL[core/auto-layout]
  CO --> AL
  S --> DOT[core/dot]
  U --> DOT
  D --> DOT
  J --> DOT
  AL --> DOT
  AL --> NE[core/neato]
  AL --> FD[core/fdp]
  AL --> SF[core/sfdp]
  AL --> TW[core/twopi]
  AL --> CI[core/circo]
  AL --> OS[core/osage]
  DOT --> PP[core/pathplan]
  DOT --> LB[core/label]
  PA[core/pack]:::dead
  PW[core/patchwork]:::dead
  classDef dead stroke-dasharray: 4
```

## After (single chokepoint, engines gone)
```mermaid
graph TD
  subgraph diagrams
    C[class]; CO[component]; S[state]; U[usecase]; D[dot]; J[json]
  end
  C --> GL[core/graph-layout.ts]
  CO --> GL
  S --> GL
  U --> GL
  D --> GL
  J --> GL
  GL -->|throws PendingGraphvizError| STUB[(stub — this mission)]
  GL -.->|adapter mission| GVT[graphviz-ts.getLayout]
```

Deleted: `core/{dot,circo,fdp,neato,osage,pack,patchwork,pathplan,sfdp,twopi,label}`
and `core/auto-layout.ts`. Born: `core/graph-layout.ts` + `core/graph-layout.types.ts`.
