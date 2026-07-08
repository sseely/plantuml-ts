# Data flow — color resolution at render time

How a `skinparam database BackgroundColor #FFd8f4\#FF92d1` reaches a rendered
`fill="url(#…)"` on the cylinder. This is the path the mission builds; the DOT/layout
path is untouched.

```mermaid
sequenceDiagram
  participant Src as source (skinparam + diagram)
  participant Skin as skinparam.ts (T4)
  participant Theme as theme.ts buckets (T3)
  participant Rend as description/class renderer (T7/T8)
  participant USym as usymbol-shapes.ts (T6)
  participant Svg as svg.ts primitive (T2)
  participant Paint as paint.ts (T1)

  Src->>Skin: "database BackgroundColor #FFd8f4\\#FF92d1"
  Skin->>Paint: parseColor("#FFd8f4\\#FF92d1")
  Paint-->>Skin: Gradient{c1,c2,policy:'\\'}
  Skin->>Theme: set database bucket.background = Gradient
  Rend->>Theme: resolveElementPaint(theme,'database','background')
  Theme-->>Rend: Gradient (element bucket, not class)
  Rend->>USym: renderDatabaseIcon(geo, Paint)
  USym->>Svg: path(d, { fill: Paint })
  Svg->>Paint: paintToSvg(Gradient)
  Paint-->>Svg: { fill:'url(#g<hash>)', def:'<linearGradient…>' }
  Svg-->>USym: <linearGradient…/><path fill="url(#g<hash>)"/>
```

## Solid-color path (the common case — unchanged output)

```mermaid
sequenceDiagram
  participant Rend as renderer
  participant Svg as svg.ts (T2)
  participant Paint as paint.ts (T1)
  Rend->>Svg: rect(x,y,w,h,{ fill:'#F1F1F1' })
  Svg->>Paint: paintToSvg('#F1F1F1')
  Paint-->>Svg: { fill:'#F1F1F1' }  %% no def
  Svg-->>Rend: <rect fill="#F1F1F1"/>  %% byte-identical to today
```
