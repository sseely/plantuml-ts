import type { SyncPlugin } from '../../core/dispatcher.js';
import type { UmlSource } from '../../core/block-extractor.js';
import type { DotDiagramAST, DotGeometry } from './ast.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { Theme } from '../../core/theme.js';
import { parseDot } from './parser.js';
import { layoutDot } from './layout.js';
import { renderDot } from './renderer.js';
import { resolveSkinparam } from '../../core/skinparam.js';
import { deepMergeTheme } from '../../core/theme.js';

export const dotPlugin: SyncPlugin<DotDiagramAST, DotGeometry> = {
  type: 'dot',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source: UmlSource): DotDiagramAST {
    // parseDot expects a raw string; join the extracted lines back together
    // so @startdot / @enddot markers and title directives are visible.
    return parseDot(source.lines.join('\n'));
  },

  layoutSync(ast: DotDiagramAST, theme: Theme, measurer: StringMeasurer): DotGeometry {
    // Apply skinparam overrides (D7)
    let resolvedTheme = theme;
    if (ast.skinparamLines.length > 0) {
      const skinMap = new Map<string, string>();
      for (const line of ast.skinparamLines) {
        const m = line.match(/^skinparam\s+(\S+)\s+(.+)$/i);
        if (m) skinMap.set(m[1]!, m[2]!.trim());
      }
      const { theme: skinTheme } = resolveSkinparam(skinMap, theme);
      resolvedTheme = deepMergeTheme(theme, skinTheme);
    }
    return layoutDot(ast, measurer, resolvedTheme);
  },

  render(geo: DotGeometry, theme: Theme): string {
    return renderDot(geo, theme);
  },
};
