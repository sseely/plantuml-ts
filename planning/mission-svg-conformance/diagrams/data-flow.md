# Data flow — draw → serialize → compare

## Emitter path (what T2–T5 build)

```mermaid
sequenceDiagram
  participant R as caller (T6 suite; Brief 2: description renderer)
  participant UG as UGraphicSvg (T5)
  participant P as UParam state chain (T2)
  participant D as Driver*Svg (T5)
  participant SG as SvgGraphics (T4)
  participant XW as XmlWriter (T4)

  R->>UG: apply(UTranslate/UStroke/color) — immutable copies
  UG->>P: state accumulates
  R->>UG: draw(UShape)
  UG->>D: dispatch by shape class (shape, param)
  D->>SG: svgRectangle/svgEllipse/… (coords translated, stroke+Paint resolved)
  SG->>XW: element + attrs (upstream ordering, upstream number format)
  R->>UG: getSvgString()
  UG->>SG: finalize (preamble, defs, root g)
  SG-->>R: SVG document string
```

## Conformance check (T1 + T6; Brief 2 reuses on fixtures)

```mermaid
sequenceDiagram
  participant O as ours (emitter output)
  participant G as golden (jar-verified)
  participant N as normalizeSvg (T1)
  participant C as compareSvg walker (T1)

  O->>N: parse, style→attrs, strip data-*/comments/PI, 6-sig-fig numbers
  G->>N: same normalization
  N->>C: two NormalizedNode trees
  C->>C: positional walk; numeric attrs banded (±0.01); rest exact
  C-->>O: { pass, diffs[] (XPath-anchored, delta, tolerance) }
  Note over C: fully conformant = pass with zero diffs (D4′)
```
