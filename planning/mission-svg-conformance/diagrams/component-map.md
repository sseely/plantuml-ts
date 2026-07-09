# Component map — module dependencies

Arrows point consumer → dependency. Task ownership in parentheses.
Everything is NEW this brief; no existing module is modified.

```mermaid
graph TD
  subgraph harness [tests/oracle/svg-conformance]
    norm["normalize.ts (T1)"]
    cmp["compare.ts (T1)"]
    suite["emitter.golden.test.ts (T6)"]
  end
  subgraph klimt [src/core/klimt]
    model["UGraphic / AbstractCommonUGraphic /<br/>UParam / UTranslate / UStroke (T2)"]
    shapes["shape/UPath UEllipse ULine URectangle<br/>UPolygon UText UComment UGroup DotPath (T3)"]
    ser["drawing/svg: xml-writer + SvgGraphics (T4)"]
    drv["drawing/svg: driver-*-svg + UGraphicSvg (T5)"]
  end
  paint["core/paint.ts (existing, render-fidelity)"]

  cmp --> norm
  suite --> cmp
  suite --> drv
  shapes --> model
  ser --> shapes
  drv --> model
  drv --> shapes
  drv --> ser
  model --> paint
  drv --> paint
```

## Batch → module

```mermaid
graph LR
  B1["Batch 1<br/>T1 harness ∥ T2 model"] --> B2["Batch 2<br/>T3 shapes"]
  B2 --> B3["Batch 3<br/>T4 serializer"]
  B3 --> B4["Batch 4<br/>T5 drivers"]
  B4 --> B5["Batch 5<br/>T6 suite ∥ T7 docs+charter"]
  B1 --> B5
```

## Coexistence (program view)

```mermaid
graph LR
  renderers["18 diagram renderers"] -->|today| svgts["core/svg.ts (legacy emitter)"]
  desc["description engine"] -.Brief 2.-> klimt2["core/klimt (this brief)"]
  others["remaining renderers"] -.follow-up missions.-> klimt2
  svgts -.retired after last migration.-> gone(("✕"))
```
