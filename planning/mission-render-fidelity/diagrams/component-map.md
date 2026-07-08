# Component map — module dependencies

Arrows point from consumer to dependency. `paint.ts` is the root; the descriptive
renderers are the leaves. Task ownership in parentheses.

```mermaid
graph TD
  paint["core/paint.ts<br/>Paint, Gradient, parseColor, paintToSvg (T1)"]
  svg["core/svg.ts<br/>primitives accept Paint, emit defs (T2)"]
  theme["core/theme.ts<br/>colors: Paint, buckets, resolveElementPaint (T3/T9)"]
  skin["core/skinparam.ts<br/>parse gradient + per-element keys (T4)"]
  stylemap["core/style-map-theme.ts<br/>element-scoped routing (T5)"]
  usym["core/usymbol-shapes.ts<br/>faithful 4-USymbol geometry (T6)"]
  desc["diagrams/description/renderer-helpers.ts (T7)"]
  cls["diagrams/class/renderer.ts (T8)"]

  svg --> paint
  theme --> paint
  skin --> paint
  skin --> theme
  stylemap --> theme
  stylemap --> paint
  usym --> svg
  usym --> theme
  desc --> usym
  desc --> theme
  cls --> usym
  cls --> theme
```

## Batch → module

```mermaid
graph LR
  B1["Batch 1<br/>T1 paint"] --> B2["Batch 2<br/>T2 svg · T3 theme"]
  B2 --> B3["Batch 3<br/>T4 skin · T5 stylemap · T6 usymbol"]
  B3 --> B4["Batch 4<br/>T7 description · T8 class"]
  B4 --> B5["Batch 5<br/>T9 default flip + baselines"]
```
