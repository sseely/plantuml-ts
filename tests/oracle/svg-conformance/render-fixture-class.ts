/**
 * Shared low-level render helper for svg-class conformance tests (G2/N0).
 *
 * Mirrors `render-fixture.ts` (svg-description) exactly, but routes through
 * the CLASS engine's own pipeline (`parseClass` -> `layoutClass` ->
 * `renderClass`) instead of description's. `renderClass` -- unlike
 * `renderDescription` -- takes no `measurer` parameter: every text metric it
 * needs is already baked into the `ClassGeometry` layoutClass produces, so
 * `DeterministicMeasurer` is injected once, at the layout stage only.
 *
 * Chrome (title/caption/legend/header/footer) wiring mirrors `src/index.ts
 * #applyAnnotationChrome`'s GENERIC (non-klimt) branch: `renderClass` always
 * returns a `RenderFragment` (never a klimt `CompleteSvg`), so this goes
 * straight through the shared `applyChrome` + `assembleSvg` -- no
 * `unwrapKlimtSvg` dance (that machinery is description/klimt-specific only,
 * per `renderClass`'s own doc comment: "Pure function: ClassGeometry + Theme
 * -> SVG string. No DOM, no async").
 */
import { buildBlockUmls } from '../../../src/core/BlockUmlBuilder.js';
import type { PreprocessOptions, PreprocessorResult } from '../../../src/core/preprocessor.js';
import { resolveTheme } from '../../../src/core/theme.js';
import { resolveSkinparam, parseStyleBlock } from '../../../src/core/skinparam.js';
import { applyStyleMap } from '../../../src/core/style-map-theme.js';
import type { Theme } from '../../../src/core/theme.js';
import type { StyleMap } from '../../../src/core/skinparam.js';
import type { StringMeasurer } from '../../../src/core/measurer.js';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { renderClass } from '../../../src/diagrams/class/renderer.js';
import { applyChrome, isEmpty } from '../../../src/core/annotations/index.js';
import { resolveAnnotationStyles } from '../../../src/core/annotations/style.js';
import { assembleSvg } from '../../../src/index.js';

interface ResolvedThemeAndStyles {
  readonly theme: Theme;
  readonly styleMap: StyleMap;
}

function buildThemeForFixture(preprocessed: PreprocessorResult): ResolvedThemeAndStyles {
  const base = resolveTheme(preprocessed.theme ?? 'default');
  const withSkinparam = resolveSkinparam(preprocessed.skinparam, base).theme;

  const styleMap = preprocessed.styles
    .map(parseStyleBlock)
    .reduce<StyleMap>((acc, m) => {
      m.forEach((props, selector) => {
        const existing = acc.get(selector) ?? new Map<string, string>();
        props.forEach((v, k) => existing.set(k, v));
        acc.set(selector, existing);
      });
      return acc;
    }, new Map());

  const flatRoot = styleMap.get('') ?? new Map<string, string>();
  const withStyles = resolveSkinparam(flatRoot, withSkinparam).theme;
  const theme = applyStyleMap(styleMap, withStyles);
  return { theme, styleMap };
}

/** Renders a `.puml` fixture through the CLASS engine's low-level pipeline
 * with `measurer` injected at the layout stage. `options` (e.g. `{
 * includeStore }`) passes through to `buildBlockUmls` verbatim -- additive,
 * optional, mirrors `scripts/svg-conformance-census.ts`'s own stdlib-store
 * wiring for the description pipeline (SI5b/T9) so `<bundle/...>` class
 * fixtures can render instead of erroring. Throws if the markup contains no
 * diagram block. Multi-page (`newpage`) sources render only the first
 * page's geometry, same fidelity level as `render-fixture.ts`. */
export function renderFixtureClass(
  markup: string,
  measurer: StringMeasurer,
  options?: PreprocessOptions,
): string {
  const blocks = buildBlockUmls(markup, options);
  const first = blocks[0];
  if (first === undefined) throw new Error('no diagram block found');
  if (!first.ok) throw first.failure.cause;

  const preprocessed = first.preprocessed;
  const { theme, styleMap } = buildThemeForFixture(preprocessed);
  const block = { ...first.source, rawStyles: preprocessed.styles };
  const ast = parseClass(block);
  const geo = layoutClass(ast, theme, measurer);
  const fragment = renderClass(geo, theme);

  const annotations = ast.annotations;
  if (annotations === undefined || isEmpty(annotations)) return assembleSvg(fragment);

  const styles = resolveAnnotationStyles(theme, preprocessed.skinparam, styleMap);
  return assembleSvg(applyChrome(fragment, annotations, styles, measurer));
}
