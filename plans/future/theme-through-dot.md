# Future mission: let theming flow through the DOT (collapse the two-pass split)

**Status:** future — gated on "the port is faithful first." Not now. We copy
PlantUML's coloring/theming behavior in the renderers for the time being.

## Context — today's two-pass architecture

plantuml-ts splits layout from styling:

1. **Layout pass** — each diagram builds a *geometry-only* `DotInputGraph`
   (`shape=rect`, `label=""`, `fixedsize`, measured width/height) and the
   `graph-layout` adapter feeds that to graphviz-ts, reading back **positions
   only** (`LayoutSnapshot`).
2. **Style pass** — each diagram's `renderer.ts` draws its own SVG from scratch,
   re-applying all PlantUML theming: skinparam, `<style>` blocks, stereotypes,
   fills/gradients, fonts, line styles, arrowheads.

So visual styling lives entirely in per-type renderers, duplicated across
class/component/state/usecase/object/json/etc. graphviz never sees the colors;
we only use it to place boxes. This mirrors upstream PlantUML's Svek (it also
draws its own glyphs and feeds graphviz empty-label boxes for layout).

## The idea

When the port is correct, investigate **injecting resolved theme/style into the
DOT (or into a styled render path) so styling "just flows"** instead of being a
separate hand-rolled pass per renderer. Candidate shapes:

- Pass resolved theme colors/fonts/line-styles as graphviz node/edge attributes
  (`fillcolor`, `fontcolor`, `color`, `style`, `penwidth`, …) and lean on
  graphviz-ts's own SVG/draw-op output (`getDrawOps`/`render(g,'svg')`) for the
  styled result — shrinking or deleting the bespoke per-type SVG renderers.
- Or keep our renderer but drive it from a single resolved-style model attached
  to the layout result, so theming is computed once, not re-derived per type.

Goal: **fewer steps, one theming path**, less per-renderer drift.

## Why valuable

- Removes duplicated theming logic across ~8 renderers.
- One place to get skinparam/`<style>`/stereotype resolution right.
- Smaller surface to keep faithful as upstream theming evolves.

## Why not now

PlantUML's theming is deep, accreted, and full of special cases (skinparam
precedence, element-scoped `<style>`, stereotype styles, gradients, business
variants). Per the porting discipline, we copy that behavior faithfully in the
renderers **first**; only once output matches the oracle do we earn the right to
re-architect it. Doing this early would bake layout+style coupling around
behavior we haven't finished capturing.

## Open questions for the mission

- Does graphviz-ts's SVG / draw-op output give enough control to match
  PlantUML's visual style exactly, or only approximately?
- How do skinparam / `<style>` / stereotype resolution map onto DOT attributes
  (and what doesn't map — gradients, multi-line member tables, badges)?
- Which diagram types benefit most vs. those whose rendering is too bespoke
  (json/yaml tables, class member compartments) to route through graphviz draw-ops?

## Code pointers

- `src/core/graph-layout.ts` — the geometry-only adapter (where styled attrs
  would be injected).
- `src/diagrams/*/renderer.ts` — the per-type style passes this would unify.
- `src/core/skinparam.ts`, `src/core/theme.ts` — theme/skinparam resolution.
- graphviz-ts `getDrawOps` / `render(g,'svg')` — the styled-output path to evaluate.
