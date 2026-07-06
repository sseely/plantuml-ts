/**
 * Leaf-node box sizing for the description diagram engine.
 *
 * Faithful port of PlantUML's `EntityImageDescription.calculateDimensionSlow`
 * (= `symbol.asSmall(...).calculateDimension`): a leaf box is
 * `margin.addDimension(textBlock)`, i.e. the USymbol's margin added to the
 * text block's dimension. Under the deterministic StringBounder the text block
 * measures `lineCount × fontSize` tall (no inter-line leading) and
 * `maxLineWidth` wide. See `planning/s1l-leaf-sizing.md` and the per-symbol
 * `decoration/symbol/USymbol*.java` `getMargin()` values.
 */

import type { DescriptiveNode } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { measureNodeLabel } from '../../core/latex.js';
import type { USymbol } from '../../core/descriptive-keywords.js';

/** Fixed width of an actor stick-figure (upstream ActorStickMan.java). */
export const ACTOR_WIDTH = 50;
/** Fixed height of an actor stick-figure. */
export const ACTOR_HEIGHT = 70;
/** Fixed height of a use-case ellipse; width is text-driven. */
export const USECASE_HEIGHT = 40;
const USECASE_ELLIPSE_PAD = 24;
/**
 * Box text-block minimum width. This is the `MinimumWidth` style value
 * (`EntityImageDescription:186` / `BodyEnhanced2:114`), whose default is 0 —
 * a narrow box is sized purely by its text + margin (verified: oracle
 * `rectangle "i"` = 24px, not floored). The `minClassWidth` skinparam raises
 * it (mapped to `PName.MinimumWidth`), still to be wired through.
 */
const BOX_MIN_WIDTH = 0;

/**
 * Per-USymbol box margin `[horizontal (x1+x2), vertical (y1+y2)]` in px,
 * transcribed verbatim from upstream `decoration/symbol/USymbol*.java`
 * `getMargin()`. Symbols not listed use DEFAULT_BOX_MARGIN.
 */
const SYMBOL_BOX_MARGIN: Partial<Record<USymbol, readonly [number, number]>> = {
  component: [20, 20], // USymbolComponent1 (uml2/default) Margin(10,10,10,10)
  rectangle: [20, 20], // USymbolRectangle
  node: [40, 30], //      USymbolNode        Margin(15,25,20,10)
  frame: [40, 30], //     USymbolFrame       Margin(15,25,20,10)
  folder: [30, 23], //    USymbolFolder      Margin(10,20,13,10)
  package: [30, 23], //   USymbolFolder
  artifact: [30, 23], //  USymbolArtifact    Margin(10,20,13,10)
  card: [20, 6], //       USymbolCard        Margin(10,10,3,3)
  cloud: [20, 20], //     USymbolCloud (non-uml2) Margin(10,10,10,10)
  database: [20, 29], //  USymbolDatabase    Margin(10,10,24,5)
  storage: [20, 20], //   USymbolStorage
  file: [20, 20], //      USymbolFile
  person: [20, 20], //    USymbolPerson
  hexagon: [20, 20], //   USymbolHexagon
  label: [20, 20], //     USymbolLabel
  collections: [20, 20], // USymbolCollections
  queue: [20, 10], //     USymbolQueue       Margin(5,15,5,5)
  stack: [50, 20], //     USymbolStack       Margin(25,25,10,10)
  action: [30, 20], //    USymbolAction      Margin(10,20,10,10)
  process: [40, 20], //   USymbolProcess     Margin(20,20,10,10)
  agent: [20, 20], //     rectangle-like
};
/** Margin for any box symbol not in SYMBOL_BOX_MARGIN (upstream default). */
const DEFAULT_BOX_MARGIN: readonly [number, number] = [20, 20];

/**
 * Per-line text height as a multiple of the font size. The atom height is the
 * font size itself (StringBounderFromWidthTable.calculateDimension), but the
 * Creole line stack (BodyEnhanced2 → SheetBlock) adds leading, so a text block
 * measures `lineCount × size × 1.177736` tall. Measured exactly from the
 * deterministic oracle: 14pt → 16.488304px/line, 28pt → 32.977px/line (linear,
 * so a pure font-size ratio, not a fixed leading). Origin: Creole line leading.
 */
const LINE_HEIGHT_FACTOR = 16.488304 / 14; // ≈ 1.177736

/**
 * Fixed pixel allowance `[width, height]` a USymbol's decoration adds on top of
 * its text box, independent of the font. UML2 `component` reserves space for
 * the corner component icon (measured `+20w, +10h` vs a plain rectangle in the
 * deterministic oracle). Symbols with no decoration add nothing.
 */
const SYMBOL_ICON_ALLOWANCE: Partial<Record<USymbol, readonly [number, number]>> = {
  component: [20, 10], // USymbolComponent1 UML2 corner icon
};

/** Fixed square a `port`/`portin`/`portout` leaf occupies
 *  (EntityPosition.RADIUS * 2, abel/EntityPosition.java:56). */
export const PORT_SIZE = 12;

// EntityImageNote sizing (approximate — folded-corner note body).
const NOTE_H_PADDING = 8;
const NOTE_V_PADDING = 6;
const NOTE_FOLD_ALLOWANCE = 10;
const NOTE_LINE_HEIGHT_FACTOR = 1.4;

type Dim = { width: number; height: number };

/**
 * Measure a leaf node's bounding box, dispatching by USymbol to the shape's
 * own sizing rule:
 *
 * - port → fixed PORT_SIZE square
 * - note → multi-line body + folded-corner padding (NOTE_* constants)
 * - actor / actor-business → fixed ACTOR_WIDTH × ACTOR_HEIGHT
 * - usecase / usecase-business → USECASE_HEIGHT; width from text or LaTeX
 * - everything else → USymbol box (per-symbol margin + multi-line text block)
 */
export function measureLeafNode(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): Dim {
  switch (node.symbol) {
    case 'port':
      // EntityImagePort.calculateDimensionSlow: fixed RADIUS*2 square,
      // independent of the display text (the text drives the shape choice
      // instead — see isPortLabelWide/portTablePad in layout-helpers).
      return { width: PORT_SIZE, height: PORT_SIZE };
    case 'note':
      return measureNote(node.display, fontSpec, measurer);
    case 'actor':
    case 'actor-business':
      return { width: ACTOR_WIDTH, height: ACTOR_HEIGHT };
    case 'usecase':
    case 'usecase-business':
      return measureUsecase(node.display, fontSpec, measurer);
    default:
      return measureBox(node.symbol, node.display, fontSpec, measurer);
  }
}

/** EntityImageNote: multi-line body, folded top-right corner. Width from the
 *  widest line + padding + fold allowance; height from line count. */
function measureNote(display: string, fontSpec: FontSpec, measurer: StringMeasurer): Dim {
  return {
    width: maxLineWidth(display, fontSpec, measurer) + NOTE_H_PADDING * 2 + NOTE_FOLD_ALLOWANCE,
    height: lineCount(display) * fontSpec.size * NOTE_LINE_HEIGHT_FACTOR + NOTE_V_PADDING * 2,
  };
}

/** Use-case ellipse: fixed height, text-driven (or LaTeX) width. */
function measureUsecase(display: string, fontSpec: FontSpec, measurer: StringMeasurer): Dim {
  if (display.includes('<latex>')) {
    return measureNodeLabel(display, measurer, fontSpec);
  }
  const textWidth = measurer.measure(display, fontSpec).width;
  return {
    width: Math.max(textWidth + USECASE_ELLIPSE_PAD, USECASE_HEIGHT),
    height: USECASE_HEIGHT,
  };
}

/** USymbol box. Faithful to EntityImageDescription: asSmall.calculateDimension
 *  = margin.addDimension(textBlock). width = maxLineWidth + (x1+x2), floored at
 *  BOX_MIN_WIDTH; height = lineCount × fontSize + (y1+y2). */
function measureBox(symbol: USymbol, display: string, fontSpec: FontSpec, measurer: StringMeasurer): Dim {
  const [marginH, marginV] = SYMBOL_BOX_MARGIN[symbol] ?? DEFAULT_BOX_MARGIN;
  const [iconW, iconH] = SYMBOL_ICON_ALLOWANCE[symbol] ?? [0, 0];
  const textHeight = lineCount(display) * fontSpec.size * LINE_HEIGHT_FACTOR;
  return {
    width: Math.max(BOX_MIN_WIDTH, maxLineWidth(display, fontSpec, measurer) + marginH + iconW),
    height: textHeight + marginV + iconH,
  };
}

/** Number of display lines (upstream text block splits on hard newlines). */
function lineCount(display: string): number {
  return display.split('\n').length;
}

/** Width of the widest display line, measured per line (not the whole string). */
function maxLineWidth(display: string, fontSpec: FontSpec, measurer: StringMeasurer): number {
  let max = 0;
  for (const ln of display.split('\n')) {
    const w = measurer.measure(ln, fontSpec).width;
    if (w > max) max = w;
  }
  return max;
}
