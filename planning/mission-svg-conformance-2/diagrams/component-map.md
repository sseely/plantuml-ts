# Component map — Brief 2 module graph

```mermaid
graph TD
  subgraph existing["Existing (Brief 1 + core)"]
    klimt["src/core/klimt/**<br/>UGraphic model + shapes + SvgGraphics + drivers"]
    harness["tests/oracle/svg-conformance/<br/>normalizeSvg / compareSvg"]
    measurer["src/core/measurer.ts<br/>StringMeasurer DI"]
    layout["src/diagrams/description/layout*.ts<br/>(NOT touched)"]
  end

  subgraph new["New in Brief 2"]
    seed["T1 bigint seed<br/>(svg-graphics-core.ts)"]
    metrics["T2/T4 jar metrics<br/>measurer-jar.data.ts + measurer-jar.ts"]
    symbols["T3,T5–T10 src/core/decoration/symbol/<br/>USymbol* complete set + registry"]
    svek["T11–T13 src/core/svek/<br/>DecorateEntityImage, Cluster, SvekEdge draw + extremities"]
    eid["T14 src/core/svek/image/<br/>EntityImageDescription"]
    renderer["T17 src/diagrams/description/renderer*.ts<br/>(rewritten: klimt draw sequences)"]
    ratchet["T18/T19 oracle/goldens/svg-description/<br/>ratchet.json + goldens + ratchet test"]
    tooling["T15/T16 scripts/<br/>svg-parity-survey, dashboard, overlay"]
  end

  seed --> klimt
  metrics --> measurer
  symbols --> klimt
  svek --> klimt
  svek --> symbols
  eid --> symbols
  eid --> svek
  renderer --> eid
  renderer --> svek
  renderer --> klimt
  renderer --> metrics
  layout --> renderer
  ratchet --> harness
  ratchet --> renderer
  tooling --> harness
  tooling --> renderer
```

Retired at the end (T20): `tests/visual/{compare.spec.ts,
playwright-visual.config.ts, capture-reference.ts, reference/**}`,
`scripts/visual-qa-svg.ts`, `visual:compare` script.
