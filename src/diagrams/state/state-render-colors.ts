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
