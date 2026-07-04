# Data flow — oracle vs ours, and where parity is measured

```mermaid
graph TB
  subgraph oracle["PlantUML oracle (patched jar)"]
    P1[".puml fixture"] --> J1["parse → entities (cucadiagram)"]
    J1 --> J2["Svek: DotStringFactory<br/>emit svek DOT"]
    J2 --> J3["graphviz (native)"]
    J3 --> J4["read geometry → SVG"]
    J2 -. "-DPLANTUML_DUMP_DOT" .-> D1["svek-N.dot<br/>(test-results/dot-cache,<br/>oracle/goldens)"]
  end

  subgraph ours["plantuml-ts"]
    P2[".puml fixture"] --> T1p["parser → diagram model"]
    T1p --> T2p["diagrams/&lt;type&gt;/layout.ts<br/>build DotInputGraph"]
    T2p --> T3p["core/graph-layout.ts (seam)"]
    T3p --> T4p["graphviz-ts → geometry → SVG"]
    T3p -. "setLayoutInputObserver" .-> D2["DotInputGraph"]
    D2 --> E1["svek-dot-emit.ts<br/>toSvekDot()"]
  end

  D1 --> CMP["tests/oracle/svek-dot.ts<br/>parseSvekDot both sides<br/>compareStructural"]
  E1 --> CMP
  CMP --> R1["scripts/dot-sync-report.ts (discovery, needs jar)"]
  CMP --> R2["ratchet vitest (offline, in npm test)"]
```

The DOT gate compares the two dashed taps. graphviz-ts sits BELOW the tap —
its fidelity is a separate concern (measured in ~/git/graphviz-ts itself).
```
