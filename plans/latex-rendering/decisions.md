# Architecture Decisions

## D1 — Parse LaTeX spans at layout + render time (not stored in AST)

`UCNode.display` stays as `string`. Layout detects `<latex>` with a regex
to select the heuristic sizing path. Renderer calls `parseLatexLabel()` at
render time. No change to `UCNodeGeo` interface.

Rejected: storing `LabelSpan[]` in `UCNodeGeo.display` — changes the shared
interface and forces all diagram types to handle the union type.

## D2 — KaTeX `output: 'mathml'`, embedded in `<foreignObject>`

KaTeX's MathML output requires no DOM. The MathML string is wrapped in an
SVG `<foreignObject>` with explicit width/height. Native MathML support covers
Chrome 109+, Firefox, Safari — the browser baseline of all target viewers.

Rejected: MathML polyfill — same `<img>` tag limitation, larger bundle.
Rejected: MathJax server-side — non-starter; library must run client-side
for markdown viewer plugin environments.

## D3 — Heuristic sizing (pre-acknowledged approximation)

`measureLatex(expr)` estimates dimensions from expression length and
structural markers (`\frac`, `\sum`, `\int`, `\prod`, `\sqrt`):

```
base height = 40px
+20px per structural marker (capped at 80px)
width = max(120, expr.length * 5.5)
```

The reference fixture (`\frac{c_1}{\lambda^5 ...}`) produces ~170×60px,
matching upstream's ~170×55px. Exact sizing requires a future mission.
