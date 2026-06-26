# Component Map

```mermaid
graph TD
    IF[StringMeasurer interface<br/>+measure()<br/>+getDescent()]
    FM[FormulaMeasurer<br/>WIDTH table port<br/>height=size<br/>getDescent=size/4.5]
    CM[CanvasMeasurer<br/>Canvas API<br/>LRU cache 8192<br/>getDescent=size/4.5]
    FX[FixedMeasurer<br/>deterministic tests<br/>getDescent=lineHeight/4.5]
    W[WIDTH: readonly number[]<br/>96 values, raw px @ 12px<br/>from StringBounderFixed.java]

    IF --> FM
    IF --> CM
    IF --> FX
    FM --> W
    CM -->|fallback| FM

    DL[diagram layouts<br/>sequence / class / activity<br/>state / usecase / component]
    DL -->|inject| IF
```
