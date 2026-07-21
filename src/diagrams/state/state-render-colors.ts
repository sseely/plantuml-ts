/**
 * Shared state-box color/stroke constants and per-node `#color` override
 * resolution (mission G4 S2, mechanism 5) — used by both renderer-box.ts
 * (normal/json leaf box) and renderer-pseudostate.ts (choice/history/
 * deepHistory, which jar-verified share the SAME `state` StyleSignature
 * default: cekolo-21-gini183 draws history/choice with fill="#F1F1F1"
 * stroke="#181818" stroke-width="0.5", byte-identical to a plain leaf
 * state's own box — not a coincidence, `EntityImagePseudoState`/
 * `EntityImageBranch` share `EntityImageStateCommon.STYLE`'s
 * `StyleSignatureBasic.of(root, element, stateDiagram, state)` with the
 * plain leaf box, unlike initial/final/fork/join which have their OWN,
 * visually distinct default colors — see renderer-pseudostate.ts).
 * @see ~/git/plantuml/.../svek/image/EntityImageStateCommon.java
 */
import type { StateNodeGeo } from './state-geo-types.js';
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { resolveBareOrBackColor } from '../class/class-color-override.js';
import type { Theme } from '../../core/theme.js';

/** Default box fill (`skinparam stateBackgroundColor`'s own terminal
 *  default) — jar-verified jocela-05-niba392 / votoki-67-gufa610 /
 *  gefefe-91-xoge233 / cekolo-21-gini183 (history + choice). */
export const STATE_DEFAULT_BACKGROUND = '#F1F1F1';

/** Box/divider/history/choice border stroke-width — jar-verified for state
 *  directly (not assumed from class's own identical `0.5` default). */
export const STATE_BORDER_STROKE_WIDTH = 0.5;

/**
 * `Colors#getColor(BackGroundColor)` — a per-node `#color`/`#back:color`
 * inline override (`State.color`, the SAME raw grammar `Classifier.color`
 * uses upstream, per `state-commands-declarations.ts`'s own doc comment)
 * wins over `fallback`. Jar-verified jocela-05-niba392 (`state state1
 * #red` → `fill="#FF0000"`).
 */
export function resolveStateFill(node: Pick<StateNodeGeo, 'color'>, fallback: string): string {
  const override = resolveBareOrBackColor(node.color);
  return override !== undefined ? resolveColorToSvgHex(override) : fallback;
}

/** mission G4 S10: `theme.colors.elements['state'].background` -- the SAME
 *  generic `ELEMENT_BUCKET_SNAMES` bucket `object`/`map`/`json`/`note`
 *  already reuse for FREE (`core/skinparam.ts`'s own `'state'` entry doc
 *  comment) for the PLAIN `skinparam stateBackgroundColor` form -- a plain
 *  color NAME still needs HColorSet resolution (mirrors `renderer-classifier-
 *  box.ts#resolveElementBackground`'s identical string-only branch; a
 *  Gradient `Paint` bucket value is unsupported here for the SAME reason
 *  that sibling function documents -- no fixture in this corpus's own
 *  `state`-bucket family exercises one, out of scope). */
function resolveStateBucketBackground(theme: Theme): string | undefined {
  const bucket = theme.colors.elements?.['state']?.background;
  return typeof bucket === 'string' ? resolveColorToSvgHex(bucket) : undefined;
}

/** mission G4 S15: `skinparam stateBackgroundColor<<stereo>> #X` --
 *  `theme.colors.graph.stateBackgroundColorByStereo`'s own doc comment
 *  (theme.ts) for the precedence tier this sits at (below the `#color`
 *  inline override, above the bare `state`-element bucket). Keyed by the
 *  node's OWN lowercased stereotype, mirroring `resolveStateBorder`'s
 *  identical lookup shape. */
function resolveStateBackgroundByStereo(
  node: Pick<StateNodeGeo, 'stereotype'>,
  theme: Theme,
): string | undefined {
  if (node.stereotype === undefined) return undefined;
  const override = theme.colors.graph.stateBackgroundColorByStereo?.[node.stereotype.toLowerCase()];
  return override !== undefined ? resolveColorToSvgHex(override) : undefined;
}

/**
 * `resolveStateFill` PLUS the `state`-element bucket tier, for the call
 * sites that share jar's `EntityImageStateCommon` StyleSignature (plain
 * leaf box, composite box, choice/history/deepHistory pseudostates) -- NOT
 * initial/final/fork/join/syncBar, which keep their OWN distinct default
 * colors and stay on the plain {@link resolveStateFill} (module doc
 * comment's own scoping note; `core/skinparam.ts`'s `'state'` bucket entry
 * doc comment). Precedence: `#color`/`#back:color` inline override (highest)
 * -> `skinparam stateBackgroundColor<<stereo>>` (mission G4 S15) ->
 * `skinparam stateBackgroundColor` bucket -> `fallback` (the per-kind
 * hardcoded default, e.g. {@link STATE_DEFAULT_BACKGROUND}).
 */
export function resolveStateFillBucketed(
  node: Pick<StateNodeGeo, 'color' | 'stereotype'>,
  theme: Theme,
  fallback: string,
): string {
  const override = resolveBareOrBackColor(node.color);
  if (override !== undefined) return resolveColorToSvgHex(override);
  return resolveStateBackgroundByStereo(node, theme) ?? resolveStateBucketBackground(theme) ?? fallback;
}

/**
 * `skinparam StateBorderColor<<X>> #color` -- `SkinParam#getColor(ColorParam,
 * Stereotype)`, a direct stereotype-qualified VALUE lookup (mission G4 S9,
 * mirrors the class engine's `classBorderThicknessByStereo` mechanism, G2
 * N51). Wins over the plain `theme.colors.border` default when `node`'s OWN
 * stereotype (lowercased, matching `core/skinparam.ts`'s own lowercased-key
 * storage) has a matching entry in `theme.colors.graph.stateBorderColorByStereo`.
 * Jar-verified `semala-31-joji042` (`skinparam StateBorderColor<<meblue>>
 * blue`, `state a<<meblue>>` -> box/divider `stroke="#0000FF"`; its plain,
 * non-stereotyped children keep the `#181818` default).
 */
export function resolveStateBorder(
  node: Pick<StateNodeGeo, 'stereotype'>,
  theme: Pick<Theme, 'colors'>,
): string {
  if (node.stereotype !== undefined) {
    const override = theme.colors.graph.stateBorderColorByStereo?.[node.stereotype.toLowerCase()];
    if (override !== undefined) return resolveColorToSvgHex(override);
  }
  return theme.colors.border;
}

/**
 * `skinparam StateFontColor<<X>> #color` -- mission G4 S15, the SAME
 * direct-value-lookup mechanism as {@link resolveStateBorder}, applied to
 * a state box's own label text color. Wins over `fallback` (the box's
 * pre-existing hardcoded `#000000` text default) when `node`'s OWN
 * stereotype (lowercased) has a matching entry in
 * `theme.colors.graph.stateFontColorByStereo`.
 */
export function resolveStateFontColor(
  node: Pick<StateNodeGeo, 'stereotype'>,
  theme: Pick<Theme, 'colors'>,
  fallback: string,
): string {
  if (node.stereotype !== undefined) {
    const override = theme.colors.graph.stateFontColorByStereo?.[node.stereotype.toLowerCase()];
    if (override !== undefined) return resolveColorToSvgHex(override);
  }
  return fallback;
}

/**
 * `fontSize - fontSize/4.5` — the SAME content-independent ascent-from-
 * line-top formula the class engine uses (`class-layout-helpers.ts`'s
 * `fontSpec.size - measurer.getDescent(fontSpec, '')`), reproduced
 * arithmetically here since the renderer has no `StringMeasurer` of its own
 * — every measurer in this codebase returns a content-independent descent
 * (`core/measurer.ts`'s own `getDescent` implementations all ignore their
 * `text` parameter), so this is exact, not an approximation.
 */
export function textAscent(fontSize: number): number {
  return fontSize - fontSize / 4.5;
}

/** `fontSize/4.5` — see {@link textAscent}'s own doc comment. */
export function textDescent(fontSize: number): number {
  return fontSize / 4.5;
}
