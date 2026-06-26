import type { SyncPlugin } from '../../core/dispatcher.js';
import type { UmlSource } from '../../core/block-extractor.js';
import type { DotDiagramAST, DotGeometry } from './ast.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { Theme } from '../../core/theme.js';
import { parseDot } from './parser.js';
import { layoutDot } from './layout.js';
import { renderDot } from './renderer.js';
import { resolveSkinparam, parseStyleBlock, resolveColor } from '../../core/skinparam.js';
import { deepMergeTheme } from '../../core/theme.js';
import type { ThemeOverride } from '../../core/theme.js';

function styleBlocksToTheme(rawStyles: readonly string[]): ThemeOverride {
  const override: ThemeOverride = {};

  for (const raw of rawStyles) {
    const styleMap = parseStyleBlock(raw);

    for (const [selector, decls] of styleMap) {
      const sel = selector.toLowerCase();

      for (const [prop, value] of decls) {
        const color = resolveColor(value);

        if (sel === '' || sel === 'diagram' || sel === 'graph') {
          if (prop === 'backgroundcolor') {
            override.colors ??= {};
            override.colors.background = color;
          } else if (prop === 'fontsize') {
            override.fontSize = Number(value);
          } else if (prop === 'fontname' || prop === 'fontfamily') {
            override.fontFamily = value;
          } else if (prop === 'fontcolor') {
            override.colors ??= {};
            override.colors.text = color;
          }
        } else if (sel === 'node') {
          if (prop === 'backgroundcolor' || prop === 'fillcolor') {
            override.colors ??= {};
            override.colors.nodeBackground = color;
          } else if (prop === 'bordercolor' || prop === 'color') {
            override.colors ??= {};
            override.colors.border = color;
          } else if (prop === 'fontcolor') {
            override.colors ??= {};
            override.colors.text = color;
          } else if (prop === 'fontsize') {
            override.fontSize = Number(value);
          } else if (prop === 'fontname' || prop === 'fontfamily') {
            override.fontFamily = value;
          }
        } else if (sel === 'edge' || sel === 'arrow') {
          if (prop === 'linecolor' || prop === 'color') {
            override.colors ??= {};
            override.colors.arrow = color;
          } else if (prop === 'fontcolor') {
            override.colors ??= {};
            override.colors.text = color;
          }
        }
      }
    }
  }

  return override;
}

export const dotPlugin: SyncPlugin<DotDiagramAST, DotGeometry> = {
  type: 'dot',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source: UmlSource): DotDiagramAST {
    // parseDot expects a raw string; join the extracted lines back together
    // so @startdot / @enddot markers and title directives are visible.
    const ast = parseDot(source.lines.join('\n'));
    return { ...ast, rawStyles: source.rawStyles ?? [] };
  },

  layoutSync(ast: DotDiagramAST, theme: Theme, measurer: StringMeasurer): DotGeometry {
    let resolvedTheme = theme;

    // Apply skinparam line overrides (D7).
    if (ast.skinparamLines.length > 0) {
      const skinMap = new Map<string, string>();
      for (const line of ast.skinparamLines) {
        const m = line.match(/^skinparam\s+(\S+)\s+(.+)$/i);
        if (m) skinMap.set(m[1]!, m[2]!.trim());
      }
      const { theme: skinTheme } = resolveSkinparam(skinMap, theme);
      resolvedTheme = deepMergeTheme(resolvedTheme, skinTheme);
    }

    // Apply <style> block overrides (D7 extension).
    if (ast.rawStyles.length > 0) {
      resolvedTheme = deepMergeTheme(resolvedTheme, styleBlocksToTheme(ast.rawStyles));
    }

    const geo = layoutDot(ast, measurer, resolvedTheme);
    return { ...geo, resolvedTheme };
  },

  render(geo: DotGeometry, theme: Theme): string {
    return renderDot(geo, geo.resolvedTheme ?? theme);
  },
};
