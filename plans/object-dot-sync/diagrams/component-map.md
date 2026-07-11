# Engine boundary — before / after

```mermaid
graph LR
  subgraph before [Before — diverged]
    dispA[dispatcher] -->|"accepts: object …"| objP[objectPlugin<br/>own 272-line parser]
    dispA -->|"accepts: class …"| clsA[class engine<br/>43-command mirror]
    objP -->|reuses| layA[class layout+renderer]
    clsA --> layA
  end
```

```mermaid
graph LR
  subgraph after [After — mirrors ClassDiagramFactory]
    dispB[dispatcher] -->|"accepts: class object map …"| clsB[class engine<br/>+ CommandCreateEntityObject<br/>+ …Multilines + AddData<br/>+ CommandCreateMap]
    clsB --> layB[class layout+renderer<br/>+ object/map sizing & render]
    layB --> dotB[class-dot-graph → graphviz-ts]
  end
```

Upstream reference: `ClassDiagramFactory.java:81-85,116-117` registers
the object commands; `objectdiagram/` holds only
`AbstractClassOrObjectDiagram` + commands. Object diagrams are
`DiagramType.CLASS` (SVG `data-diagram-type="CLASS"`).
