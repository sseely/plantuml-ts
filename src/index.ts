import { preprocess } from './core/preprocessor.js';
import { extractBlocks } from './core/block-extractor.js';
import { registry } from './core/dispatcher.js';
import { resolveTheme } from './core/theme.js';
import { CanvasMeasurer, FormulaMeasurer } from './core/measurer.js';
import { sequencePlugin } from './diagrams/sequence/index.js';
import type { Theme } from './core/theme.js';
import type { StringMeasurer } from './core/measurer.js';

// Register all Phase 1 plugins once on module load.
// The module singleton ensures this runs only once per module instance.
registry.register(sequencePlugin);

export interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome' | Partial<Theme>;
  measurer?: StringMeasurer;
  maxWidth?: number;
}

function getDefaultMeasurer(): StringMeasurer {
  try {
    return new CanvasMeasurer();
  } catch {
    return new FormulaMeasurer();
  }
}

export function renderSync(source: string, options?: RenderOptions): string {
  try {
    const preprocessed = preprocess(source);
    const themeOption = options?.theme ?? (preprocessed.theme ?? 'default');
    const theme = resolveTheme(
      typeof themeOption === 'string'
        ? (themeOption as 'default' | 'dark' | 'sketchy' | 'monochrome')
        : themeOption,
    );
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const blocks = extractBlocks(preprocessed.lines);
    if (blocks.length === 0) {
      return errorSvg('No diagram found in source');
    }
    const block = blocks[0]!;
    const plugin = registry.resolve(block);
    if (!('layoutSync' in plugin)) {
      return errorSvg(
        `renderSync() is not supported for this diagram type — use render()`,
      );
    }
    const ast = plugin.parse(block);
    const geo = plugin.layoutSync(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    return errorSvg(String(err));
  }
}

export async function render(
  source: string,
  options?: RenderOptions,
): Promise<string> {
  try {
    const preprocessed = preprocess(source);
    const themeOption = options?.theme ?? (preprocessed.theme ?? 'default');
    const theme = resolveTheme(
      typeof themeOption === 'string'
        ? (themeOption as 'default' | 'dark' | 'sketchy' | 'monochrome')
        : themeOption,
    );
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const blocks = extractBlocks(preprocessed.lines);
    if (blocks.length === 0) {
      return errorSvg('No diagram found in source');
    }
    const block = blocks[0]!;
    const plugin = registry.resolve(block);
    const ast = plugin.parse(block);
    const geo =
      'layoutSync' in plugin
        ? plugin.layoutSync(ast, theme, measurer)
        : await plugin.layout(ast, theme, measurer);
    return plugin.render(geo, theme);
  } catch (err) {
    return errorSvg(String(err));
  }
}

export async function renderAll(
  source: string,
  options?: RenderOptions,
): Promise<string[]> {
  try {
    const preprocessed = preprocess(source);
    const themeOption = options?.theme ?? (preprocessed.theme ?? 'default');
    const theme = resolveTheme(
      typeof themeOption === 'string'
        ? (themeOption as 'default' | 'dark' | 'sketchy' | 'monochrome')
        : themeOption,
    );
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const blocks = extractBlocks(preprocessed.lines);
    const results = await Promise.all(
      blocks.map(async (block) => {
        try {
          const plugin = registry.resolve(block);
          const ast = plugin.parse(block);
          const geo =
            'layoutSync' in plugin
              ? plugin.layoutSync(ast, theme, measurer)
              : await plugin.layout(ast, theme, measurer);
          return plugin.render(geo, theme);
        } catch (err) {
          return errorSvg(String(err));
        }
      }),
    );
    return results;
  } catch (err) {
    return [errorSvg(String(err))];
  }
}

function errorSvg(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">` +
    `<rect width="400" height="80" fill="#fee2e2" stroke="#dc2626" stroke-width="1"/>` +
    `<text x="10" y="30" fill="#dc2626" font-family="monospace" font-size="12">PlantUML error:</text>` +
    `<text x="10" y="55" fill="#dc2626" font-family="monospace" font-size="11">${escaped}</text>` +
    `</svg>`
  );
}
