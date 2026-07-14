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
 *
 * D9 (plans/si5b-stdlib/decisions.md): a display line carrying a Creole
 * `<img>`/`<$sprite>` atom contributes the atom's SCALED pixel dims instead
 * of its raw markup text -- see `maxLineWidth`/`atomHeightBonus`, both
 * routed through `../../core/creole-atoms.js`.
 */

import type { DescriptiveNode } from './ast.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import { measureNodeLabel } from '../../core/latex.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import { measureLineWithAtoms, lineAtomHeightExcess, type SpriteDimsLookup } from '../../core/creole-atoms.js';

/** `skinparam componentStyle` — only `uml2` (the default) draws the corner
 *  component icon; `uml1` and `rectangle` render a plain box. */
export type ComponentStyle = 'uml2' | 'uml1' | 'rectangle';

/** Legacy actor box constants (kept for the re-export; the DOT size now comes
 *  from the stickman + label stack below). */
export const ACTOR_WIDTH = 50;
export const ACTOR_HEIGHT = 70;
/** ActorStickMan.getPreferredWidth = max(arms 13, legs 13) × 2 + 2×thickness
 *  = 26 + 1 (default thickness 0.5). */
const ACTOR_STICKMAN_WIDTH = 27;
/** ActorStickMan.getPreferredHeight = headDiam 16 + body 27 + legsY 15 +
 *  2×thickness + 1 = 59 + 1 (default thickness 0.5, no shadow). */
const ACTOR_STICKMAN_HEIGHT = 60;
/** Legacy fixed use-case ellipse height (renderer fallback / re-export). The
 *  actual DOT size now comes from the containing-ellipse formula below. */
export const USECASE_HEIGHT = 40;
/** `UEllipse.bigger(6)` — TextBlockInEllipse enlarges the containing ellipse by
 *  6px on each dimension after fitting it to the text footprint. */
const USECASE_ELLIPSE_BIGGER = 6;
/** Aspect clamp on the containing ellipse (TextBlockInEllipse: alpha in [0.2,0.8]). */
const USECASE_ALPHA_MIN = 0.2;
const USECASE_ALPHA_MAX = 0.8;
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

/** Stereotype line horizontal margin — `TextBlockUtils.withMargin(stereo, 1, 0)`
 *  in EntityImageDescription adds 1px each side (+2 total width, +0 height). */
const STEREO_MARGIN = 2;

/**
 * Per-line text height as a multiple of the font size. In the DETERMINISTIC
 * text mode that the oracle goldens use, `StringBounderFromWidthTable
 * .calculateDimension` returns height = size (no Creole leading), so a text
 * block is exactly `lineCount × size` tall — matching our own
 * `WidthTableMeasurer` (which likewise returns height = size). Hence 1.0.
 *
 * (An earlier value of 1.177736 was calibrated against the AWT build of the
 * oracle jar in `oracle/dist`, which is NOT the deterministic-patched jar that
 * produced the goldens — AWT adds ~2.5px/line of leading. Component golden
 * height 44px = 20 margin + 14 line + 10 icon confirms line = size = 14.)
 */
const LINE_HEIGHT_FACTOR = 1.0;

/**
 * Fixed pixel allowance `[width, height]` a USymbol's decoration adds on top of
 * its text box, independent of the font. UML2 `component` reserves space for
 * the corner component icon (measured `+20w, +10h` vs a plain rectangle in the
 * deterministic oracle). Symbols with no decoration add nothing.
 */
const SYMBOL_ICON_ALLOWANCE: Partial<Record<USymbol, readonly [number, number]>> = {
  component: [20, 10], // USymbolComponent1 UML2 corner icon
  cloud: [10, 10], //    cloud puffs (verified: cloud "L" 37.5×46.5 vs rect 27.5×36.5)
  folder: [0, 15], //    folder tab height (verified deterministic 52px = 23+14+15)
  // package intentionally NOT here: its geometry varies by braces vs leaf form
  // (empty-braces `package X {}` = label+20; no-braces leaf = margin 30 + tab).
  // Needs dedicated case analysis — see planning/s1l-leaf-sizing.md.
};

/** Fixed square a `port`/`portin`/`portout` leaf occupies
 *  (EntityPosition.RADIUS * 2, abel/EntityPosition.java:56). */
export const PORT_SIZE = 12;

// EntityImageNote sizing. Notes use FontParam.NOTE — a fixed 13px font, not the
// theme's default. Total horizontal margin (text padding + folded corner) and
// vertical margin measured exactly against the deterministic oracle.
const NOTE_FONT_SIZE = 13;
const NOTE_MARGIN_H = 21;
const NOTE_MARGIN_V = 10;

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
 *
 * `sprites` (D9): an optional per-diagram sprite-dims lookup, consulted by
 * `maxLineWidth`/`atomHeightBonus` when a display line embeds a
 * `<$sprite>` atom. Undefined when no registry is available (unknown
 * sprites then contribute nothing, per `creole-atoms.ts#measureInlineAtom`).
 */
export function measureLeafNode(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  componentStyle?: ComponentStyle,
  sprites?: SpriteDimsLookup,
): Dim {
  switch (node.symbol) {
    case 'port':
      // EntityImagePort.calculateDimensionSlow: fixed RADIUS*2 square,
      // independent of the display text (the text drives the shape choice
      // instead — see isPortLabelWide/portTablePad in layout-helpers).
      return { width: PORT_SIZE, height: PORT_SIZE };
    case 'note':
      return measureNote(node.display, fontSpec, measurer, sprites);
    case 'actor':
    case 'actor-business':
      return measureActor(node.display, fontSpec, measurer, sprites);
    case 'usecase':
    case 'usecase-business':
      return measureUsecase(node.display, fontSpec, measurer, sprites);
    default:
      return measureBox(node, fontSpec, measurer, componentStyle, sprites);
  }
}

/** EntityImageNote: multi-line body, folded top-right corner. Notes measure at
 *  the fixed 13px note font (FontParam.NOTE), not the theme size. Width = widest
 *  line + horizontal margin; height = line count × 13 + vertical margin. Exact
 *  vs the deterministic oracle ("Hello" 50.74×23, 2-line 67.31×36). */
function measureNote(
  display: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  sprites?: SpriteDimsLookup,
): Dim {
  const noteFont: FontSpec = { ...fontSpec, size: NOTE_FONT_SIZE };
  return {
    width: maxLineWidth(display, noteFont, measurer, sprites) + NOTE_MARGIN_H,
    height: lineCount(display) * NOTE_FONT_SIZE + NOTE_MARGIN_V + atomHeightBonus(display, noteFont, sprites),
  };
}

/**
 * Actor — the stick-figure stacked above its label (USymbolSimpleAbstract
 * .asSmall -> mergeLayoutT12B3(stereo, stickman, label)): width is the wider of
 * the stickman (27px) and the label; height is the stickman (60px) plus the
 * label. Exact against the deterministic oracle ("Bob" 27x74, "A Long Actor
 * Name" 110.51x74). actor-business shares the same bounding box.
 */
export function measureActor(
  display: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  sprites?: SpriteDimsLookup,
): Dim {
  return {
    width: Math.max(ACTOR_STICKMAN_WIDTH, maxLineWidth(display, fontSpec, measurer, sprites)),
    height:
      ACTOR_STICKMAN_HEIGHT +
      lineCount(display) * fontSpec.size * LINE_HEIGHT_FACTOR +
      atomHeightBonus(display, fontSpec, sprites),
  };
}

/**
 * Use-case ellipse — faithful port of `TextBlockInEllipse` +
 * `ContainingEllipse` (EntityImageUseCase.calculateDimensionSlow). The ellipse
 * is the smallest circle enclosing the text footprint after the Y axis is
 * scaled by 1/alpha, so:
 *   alpha = clamp(textH / textW, 0.2, 0.8)
 *   diag  = √(textW² + (textH / alpha)²)     // 2×SEC radius of the scaled box
 *   width  = diag + 6,   height = alpha × diag + 6   // UEllipse.bigger(6)
 * Exact against the deterministic oracle (footprint = text bounding box):
 * "L" 25.15×21.32, "Hello World" 103.0×25.8.
 *
 * `sprites` widens the footprint (via `maxLineWidth`) when the display
 * embeds an img/sprite atom; the ellipse's height side of the footprint
 * stays text-only for now (no corpus fixture exercises a tall atom inside
 * a use-case label -- flagged as a follow-up alongside T9's registry wiring).
 */
export function measureUsecase(
  display: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  sprites?: SpriteDimsLookup,
): Dim {
  if (display.includes('<latex>')) {
    return measureNodeLabel(display, measurer, fontSpec);
  }
  const textW = maxLineWidth(display, fontSpec, measurer, sprites);
  const textH = lineCount(display) * fontSpec.size * LINE_HEIGHT_FACTOR;
  let alpha = textH / textW;
  if (alpha < USECASE_ALPHA_MIN) alpha = USECASE_ALPHA_MIN;
  else if (alpha > USECASE_ALPHA_MAX) alpha = USECASE_ALPHA_MAX;
  const diag = Math.sqrt(textW * textW + (textH / alpha) * (textH / alpha));
  return {
    width: diag + USECASE_ELLIPSE_BIGGER,
    height: alpha * diag + USECASE_ELLIPSE_BIGGER,
  };
}

/** Decoration allowance `[w, h]` for a box symbol. Only the default `uml2`
 *  component draws the corner icon; `uml1`/`rectangle` render a plain box
 *  (verified against the oracle: both identical to a plain rectangle). */
function boxIcon(symbol: USymbol, componentStyle: ComponentStyle | undefined): readonly [number, number] {
  if (symbol === 'component' && componentStyle !== undefined && componentStyle !== 'uml2') {
    return [0, 0];
  }
  return SYMBOL_ICON_ALLOWANCE[symbol] ?? [0, 0];
}

/** USymbol box. Faithful to EntityImageDescription: asSmall.calculateDimension
 *  = margin.addDimension(stereo ⊕ textBlock). The content is the stereotype
 *  line (`«name»`, +2px `withMargin(1,0)`) stacked above the label
 *  (`mergeTB`): width = max(labelW, stereoW), height = labelH + stereoH.
 *  Then + per-symbol margin and icon; floored at BOX_MIN_WIDTH.
 *
 *  `sprites` (D9): an img/sprite atom on a display line adds its scaled
 *  width to `contentW` and (via `atomHeightBonus`) grows `contentH` beyond
 *  the plain `lineCount * lineH` when the atom is taller than one text line
 *  -- this is what moves the six awslib-icon fixtures' DOT output. */
function measureBox(
  node: DescriptiveNode,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  componentStyle: ComponentStyle | undefined,
  sprites?: SpriteDimsLookup,
): Dim {
  const [marginH, marginV] = SYMBOL_BOX_MARGIN[node.symbol] ?? DEFAULT_BOX_MARGIN;
  const [iconW, iconH] = boxIcon(node.symbol, componentStyle);
  const lineH = fontSpec.size * LINE_HEIGHT_FACTOR;
  let contentW = maxLineWidth(node.display, fontSpec, measurer, sprites);
  let contentH = lineCount(node.display) * lineH + atomHeightBonus(node.display, fontSpec, sprites);
  if (node.stereotype !== undefined && node.stereotype.length > 0) {
    contentW = Math.max(contentW, measurer.measure(`«${node.stereotype}»`, fontSpec).width + STEREO_MARGIN);
    contentH += lineH; // stereotype line above the label
  }
  return {
    width: Math.max(BOX_MIN_WIDTH, contentW + marginH + iconW),
    height: contentH + marginV + iconH,
  };
}

/** Number of display lines (upstream text block splits on hard newlines). */
function lineCount(display: string): number {
  return display.split('\n').length;
}

/** Width of the widest display line, measured per line (not the whole
 *  string). Atom-aware (D9): a line's `<img>`/`<$sprite>` markup stops
 *  contributing text width and the atom's own scaled width is added
 *  instead -- see `creole-atoms.ts#measureLineWithAtoms`, which is a
 *  zero-diff drop-in for `measurer.measure(ln, fontSpec).width` on any
 *  atom-free line. */
function maxLineWidth(
  display: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  sprites?: SpriteDimsLookup,
): number {
  let max = 0;
  for (const ln of display.split('\n')) {
    const w = measureLineWithAtoms(ln, fontSpec, measurer, sprites).width;
    if (w > max) max = w;
  }
  return max;
}

/** Sum of `lineAtomHeightExcess` over every line of `display` — 0 for any
 *  atom-free display, so every caller above ADDS this to (never replaces)
 *  its existing `lineCount(display) * lineHeight` uniform-height formula. */
function atomHeightBonus(display: string, fontSpec: FontSpec, sprites: SpriteDimsLookup | undefined): number {
  let bonus = 0;
  for (const ln of display.split('\n')) bonus += lineAtomHeightExcess(ln, fontSpec, sprites);
  return bonus;
}
