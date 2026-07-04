# Component map

Affected components and how they relate before/after the merge.

```mermaid
graph TD
  subgraph core[src/core]
    DISP[dispatcher.ts resolve]
    BE[block-extractor.ts DiagramType]
    KW[descriptive-keywords.ts NEW]
    SEAM[graph-layout.ts seam]
  end

  subgraph before[Before - diverged]
    COMP[diagrams/component/*]
    UC[diagrams/usecase/*]
    CLS[diagrams/class/index accepts]
    SEQ[diagrams/sequence/index accepts]
  end

  subgraph after[After - one engine]
    DESC[diagrams/description/*]
  end

  KW -->|hasDescriptiveSignal| CLS
  KW -->|hasDescriptiveSignal| SEQ
  KW -->|USymbol + KEYWORD_TO_SYMBOL| DESC
  DISP --> CLS
  DISP --> SEQ
  DISP --> DESC
  DESC --> SEAM
  BE -.->|type description| DISP
  COMP -.->|deleted batch-8| DESC
  UC -.->|deleted batch-8| DESC
```

- `descriptive-keywords.ts` is the single source consumed by both the Phase-1
  guards (`class`, `sequence`) and the Phase-2 engine (`description`).
- `component/*` and `usecase/*` are deleted in Batch 8 once `description/*` is
  proven and registered.
