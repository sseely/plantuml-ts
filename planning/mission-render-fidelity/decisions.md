# Architecture decisions — settled (do not relitigate)

All six approved by the maintainer 2026-07-08 during `/plan-mission`.

## Porting stance (overrides "don't refactor while porting" for this mission)
**Fidelity to the upstream Java is the highest priority.** The existing TS rendering
code is an unfaithful approximation (that is *why* this mission exists) — it is **not**
sacred and carries no preservation claim. When an existing function diverges from the
cited Java, **delete it and rewrite it from scratch to mirror the Java**, rather than
patching the approximation. This applies to the internal rendering code
(`svg.ts` primitives, `usymbol-shapes.ts` geometry, the descriptive renderers,
theme color internals). The one thing that stays stable is the **public API**
(`renderSync`/`render` signatures and the `Theme` type's string-compatibility per D1) —
that is a deliberate contract, not legacy cruft. Everywhere else: match the Java, discard
the divergence. Maintainer directive, 2026-07-08.

## D1 — Color value type
- **Context:** `Theme.colors.*` is typed `string`; 21 non-test files read it; the public
  `RenderOptions.theme?: Partial<Theme>` exposes the type. Gradients need a value that is
  solid *or* gradient.
- **Decision:** `type Paint = string | Gradient`. `svg.ts` primitives and descriptive
  renderers accept `string | Paint`. A bare string stays a valid solid paint.
- **Consequences:** Non-breaking public API; churn bounded to the primitive layer +
  descriptive renderers; any color key can carry a gradient (matches upstream). Latent
  risk: a renderer that manually string-interpolates a color would stringify a Gradient as
  `[object Object]` — but gradients only flow to in-scope descriptive elements; the other
  ~17 renderers receive strings in practice.

## D2 — Default skin color ⚠️ project-wide recolor (acknowledged)
- **Context:** Port defaults to `#FEFECE`/`#A80036` (upstream's *legacy* `ColorParam`
  default). Upstream's authoritative Style default is `#F1F1F1`/`#181818`; the QA jar
  renders grey.
- **Decision:** Adopt `#F1F1F1` fill / `#181818` border / black font as the default skin.
- **Consequences:** Every class/object/descriptive diagram recolors yellow→grey. Reversible
  by revert. Requires a `DIVERGENCES.md` entry and a suite-wide baseline refresh (T9,
  isolated last). Maintainer explicitly acknowledged the project-wide baseline move.

## D3 — Gradient `<def>` placement
- **Context:** Gradients are created deep inside `rect()`/`ellipse()`; the renderer is a
  pure string builder with no shared state.
- **Decision:** Emit the `<linearGradient>` **inline** immediately before the referencing
  shape; dedup by a deterministic **content-hash id** `g<hash(color1,color2,policy)>`.
- **Consequences:** Preserves the pure-function, no-shared-state pipeline; SVG resolves
  `url(#id)` regardless of def position; repeats collapse to one def. Diverges from
  upstream's seed-counter id scheme (`g<seed>0,1,…`) — ids differ textually but are
  functionally equivalent; DOT/structure unaffected.

## D4 — Per-element color resolution
- **Context:** Descriptive icons must resolve their own element's color; today `database`
  falls back to `classBackground`.
- **Decision:** Add `resolveElementPaint(theme, sname, role)` backed by an element-keyed
  bucket map, cascade **element-specific → root default** (mirrors upstream's SName→Style).
  Existing flat `colors.graph.*` fields remain the fallback layer.
- **Consequences:** Renderers call the resolver, not a hard-coded field. Mirrors upstream
  architecture (per porting rules). `sname` values follow upstream `SName` (`database`,
  `component`, `node`, `actor`, `usecase`, …).

## D5 — Geometry scope
- **Decision:** Faithful exact-geometry port for the **four measured USymbols** only —
  database, component, actor, usecase. Others (node/cloud/folder/…) stay as rects.
- **Consequences:** Matches the evidence; mission stays 1–4h. Broader USymbol geometry is a
  logged follow-up.

## D6 — Edge-semantics fix
- **Decision:** Include the plain-`--`-association fix (no arrowhead) in T8; it is a
  faithfulness bug in `class/renderer.ts`, already in the write-set.
- **Consequences:** Small, same-file, no new scope.

---

## Upstream citations (authoritative — port verbatim)

### Gradient model — `klimt/color/HColorSet.java:109-116`, `HColorGradient.java`
Separators `-  \  |  /` (first one found splits `color1`/`color2`); the char is the
gradient **policy**, stored verbatim, interpreted at emission.

### Gradient SVG emission — `svg/SvgGraphics.java:357-399`
`<linearGradient>` with two stops (`offset 0%`/`100%`), referenced via `fill="url(#id)"`.
Policy → vector:

| policy | x1 y1 → x2 y2 | direction |
|---|---|---|
| `\|` | 0% 50% → 100% 50% | horizontal |
| `\` | 0% 100% → 100% 0% | diagonal BL→TR |
| `-` | 50% 0% → 50% 100% | vertical |
| `/` (and any other) | 0% 0% → 100% 100% | diagonal TL→BR |

### Per-element scoping — `skin/ColorParam.java`, `decoration/symbol/USymbol*.getSNames()`
Element type declared by SName; resolution element-specific → diagram-scoped → `element` →
`root`. Modern default (`resources/skin/plantuml.skin` root): fill `#F1F1F1`, line
`#181818`, font black.

### USymbol geometry
- **Database cylinder** `decoration/symbol/USymbolDatabase.java:61-87`: one `UPath`, cubic
  (`C`) caps, **fixed 10px** cap depth. Body `moveTo(0,10); C(0,0,w/2,0,w/2,0);
  C(w/2,0,w,0,w,10); L(w,h-10); C(w,h,w/2,h,w/2,h); C(w/2,h,0,h,0,h-10); L(0,10)`. Front
  mouth arc `moveTo(0,10); C(0,20,w/2,20,w/2,20); C(w/2,20,w,20,w,10)` (front lip y=20).
  Content margin top **24**, `suppHeight` **15**.
- **Component (UML2)** `USymbolComponent2.java:59-75`: rounded rect + right-edge tabs —
  outer `15×10` at `(w-20, 5)`; inner ticks `4×2` at `(w-22, 7)` and `(w-22, 11)`.
- **Actor** `skin/ActorStickMan.java:51-96`: head Ø16 at top; body translated `(cx, 16)`:
  spine `(0,0)→(0,27)`; arms `(-13,8)→(13,8)`; legs `(0,27)→(∓13,42)`.
- **Usecase** `USymbolUsecase.asSmall` + `klimt/shape/TextBlockInEllipse.java:50-66`:
  ellipse = text footprint `.bigger(6)` (+6px); text centered `dy-2`.

<a id="dot-parity"></a>
## DOT-parity probe (the scope canary)
Rendering must not move DOT. Baseline: **350 class / 221 component / 41 usecase** EQUAL vs
cached oracle. Re-run the A3 parity measurement (see `mission-a3-class-superset` tooling /
`test-results/dot-cache/`) after each batch. Any drop = STOP (a color change touched
layout — scope leak).
