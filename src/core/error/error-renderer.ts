/**
 * Draws a `PSystemError` (and the black-on-white Welcome / Unsupported blocks)
 * to SVG.
 *
 * This is the drawing half of upstream's `PSystemError#getGraphicalFormatted`
 * and `GraphicStrings`. Upstream composes `TextBlockRaw`s with
 * `TextBlockUtils.mergeTB` / `withMargin` / `addBackcolor` and hands the result
 * to a `UGraphic`; this port has no `TextBlockRaw` and klimt's `TextBlockUtils`
 * here still stubs `addBackcolor`, so the same composition is expressed
 * directly against the house SVG emitter (`src/core/svg.ts` — `rect`, `text`,
 * `svgRoot`), which is how every diagram renderer in `src/diagrams/*` emits.
 * Fonts, colours, decorations, block order and line content are upstream's;
 * only the seam differs.
 *
 * Verified against `oracle/dist/plantuml-oracle.jar` (`-tsvg -pipe`) on an
 * orphan `!endif`: same five parts, in this order —
 *   1. Welcome block (only when the source is shorter than 5 lines)
 *   2. version banner
 *   3. `[From string (line N) ]`, black on a green band
 *   4. a blank line, then the executed source, the last line wavy-underlined
 *   5. the message, in red
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemError.java#getGraphicalFormatted
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/shape/GraphicStrings.java
 */

import type { FontSpec, StringMeasurer } from '../measurer.js';
import { rect, svgRoot, text } from '../svg.js';
import type { PSystemError } from './PSystemError.js';
import { PSystemWelcome } from './PSystemWelcome.js';
import type { PSystemUnsupported } from './PSystemUnsupported.js';

// --- Colours (klimt/color/HColors.java) ---------------------------------

const BLACK = '#000000';
const WHITE = '#FFFFFF';
const RED = '#FF0000';
/** `HColors.MY_GREEN` — the error diagram's foreground. */
const MY_GREEN = '#33FF02';

// --- Fonts (klimt/shape/GraphicStrings.java) ----------------------------

const SANS = 'sans-serif';
const MONO = 'monospace';
/** `GraphicStrings.sansSerif12` — Welcome / Unsupported text, and the banner. */
const SIZE_12 = 12;
/** `GraphicStrings.sansSerif14` — every line of the error block proper. */
const SIZE_14 = 14;

// --- Metrics ------------------------------------------------------------
//
// This port's `StringMeasurer` reports a line's height as the font size, which
// is the em box, not the line box: it has no ascent/descent table. The jar's
// AWT metrics for these fonts give a line advance of 14.1328px at size 12 and
// 16.4883px at size 14 — the same 1.1777 ratio — with the baseline 11.6016px
// below the line top at size 12 (a 0.9668 ratio). Both ratios are taken from
// the reference jar's own SVG output for this diagram, so the listing lines up
// the way upstream's does instead of colliding at height == size.

const LINE_ADVANCE_RATIO = 14.1328 / 12;
const ASCENT_RATIO = 11.6016 / 12;

/** `GraphicStrings#margin` */
const MARGIN = 5;

/** `PSystemError#getGraphicalFormatted`: `withMargin(…, 1, 1, 1, 4)` on the
 *  `[From … ]` band — left 1, right 1, top 1, bottom 4. */
const BAND_PAD_X = 1;
const BAND_PAD_TOP = 1;
const BAND_PAD_BOTTOM = 4;

/** A run of characters sharing one font and colour. */
interface Run {
  readonly content: string;
  readonly font: FontSpec;
  readonly fill: string;
  readonly decoration?: string;
}

/** One rendered line: its runs, and optionally a colour band drawn behind it. */
interface Line {
  readonly runs: readonly Run[];
  readonly band?: string;
}

/** A stack of lines over one background colour. */
interface Block {
  readonly lines: readonly Line[];
  readonly background: string;
}

function lineAdvance(line: Line): number {
  const size = Math.max(SIZE_12, ...line.runs.map((r) => r.font.size));
  return size * LINE_ADVANCE_RATIO;
}

function lineAscent(line: Line): number {
  const size = Math.max(SIZE_12, ...line.runs.map((r) => r.font.size));
  return size * ASCENT_RATIO;
}

function lineWidth(line: Line, measurer: StringMeasurer): number {
  return line.runs.reduce((w, r) => w + measurer.measure(r.content, r.font).width, 0);
}

// --- Creole subset ------------------------------------------------------

/**
 * The markup upstream's `Display`/`Creole` layer resolves inside a
 * `GraphicStrings` block, restricted to what the Welcome and Unsupported
 * strings actually use: `<b>` / `<i>` / `<u>` (which apply to the REST of the
 * line when never closed — `<b>Welcome to PlantUML!` is a bold line, not a
 * literal `<b>`), and `""…""` (monospace).
 *
 * `src/core/creole.ts` is not reused here: its documented rule for unclosed
 * markup is to emit the delimiters literally, which would print `<b>` in the
 * Welcome header, and it has no monospace span (upstream's `""…""`) to switch
 * the font family on.
 */
const CREOLE_TOKEN = /<\/?[biu]>|""/giu;

function parseCreoleSubset(source: string, baseFont: FontSpec, fill: string): Run[] {
  const runs: Run[] = [];
  let bold = baseFont.weight === 'bold';
  let italic = baseFont.style === 'italic';
  let underline = false;
  let mono = false;
  let cursor = 0;

  const flush = (end: number): void => {
    const content = source.slice(cursor, end);
    if (content.length === 0) return;

    runs.push({
      content,
      font: {
        family: mono ? MONO : baseFont.family,
        size: baseFont.size,
        weight: bold ? 'bold' : 'normal',
        style: italic ? 'italic' : 'normal',
      },
      fill,
      ...(underline ? { decoration: 'underline' } : {}),
    });
  };

  CREOLE_TOKEN.lastIndex = 0;
  let match = CREOLE_TOKEN.exec(source);
  while (match !== null) {
    flush(match.index);
    const token = match[0].toLowerCase();
    if (token === '""') mono = !mono;
    else if (token === '<b>') bold = true;
    else if (token === '</b>') bold = false;
    else if (token === '<i>') italic = true;
    else if (token === '</i>') italic = false;
    else if (token === '<u>') underline = true;
    else if (token === '</u>') underline = false;

    cursor = match.index + match[0].length;
    match = CREOLE_TOKEN.exec(source);
  }
  flush(source.length);
  return runs;
}

// --- Blocks -------------------------------------------------------------

/**
 * `GraphicStrings.createBlackOnWhite` — the Welcome screen and the
 * "not supported" screen.
 */
function blackOnWhite(strings: readonly string[]): Block {
  const font: FontSpec = { family: SANS, size: SIZE_12, weight: 'normal', style: 'normal' };
  return {
    background: WHITE,
    lines: strings.map((s) => ({ runs: parseCreoleSubset(s, font, BLACK) })),
  };
}

/**
 * The error block itself, in upstream's assembly order (`result4` on top, then
 * `result0`…`result3`).
 * @see ~/git/plantuml/.../error/PSystemError.java#getGraphicalFormatted
 */
function errorBlock(system: PSystemError): Block {
  /** `fc4` — the version banner: green, bold, italic, size 12. */
  const fc4: FontSpec = { family: SANS, size: SIZE_12, weight: 'bold', style: 'italic' };
  /** `fc0` — the `[From … ]` stack: black on the green band, bold, size 14. */
  const fc0: FontSpec = { family: SANS, size: SIZE_14, weight: 'bold', style: 'normal' };
  /** `fc1` — the source listing: green, bold, size 14. */
  const fc1: FontSpec = { family: SANS, size: SIZE_14, weight: 'bold', style: 'normal' };
  /** `fc2` — the message: red, bold, size 14. */
  const fc2: FontSpec = { family: SANS, size: SIZE_14, weight: 'bold', style: 'normal' };

  const lines: Line[] = [];

  for (const s of system.header()) lines.push({ runs: [{ content: s, font: fc4, fill: MY_GREEN }] });

  for (const s of system.getTextFromStack())
    lines.push({ runs: [{ content: s, font: fc0, fill: BLACK }], band: MY_GREEN });

  const fullBody = system.getTextFullBody();
  fullBody.forEach((s, i) => {
    // `result2`: only the LAST body line — the one that failed — is waved red.
    const isLast = i === fullBody.length - 1;
    lines.push({
      runs: [
        {
          content: s,
          font: fc1,
          fill: MY_GREEN,
          ...(isLast ? { decoration: 'wavy underline' } : {}),
        },
      ],
    });
  });

  for (const s of system.getTextError())
    lines.push({ runs: [{ content: s, font: fc2, fill: RED }] });

  return { background: BLACK, lines };
}

// --- Drawing ------------------------------------------------------------

function drawRun(run: Run, x: number, baseline: number): string {
  return text(x, baseline, run.content, {
    fontFamily: run.font.family,
    fontSize: run.font.size,
    fontWeight: run.font.weight ?? 'normal',
    fontStyle: run.font.style ?? 'normal',
    fill: run.fill,
    ...(run.decoration === undefined ? {} : { textDecoration: run.decoration }),
  });
}

/** Draw one line at `top`, returning its SVG and the height it consumed. */
function drawLine(
  line: Line,
  top: number,
  measurer: StringMeasurer,
): { readonly svg: string[]; readonly advance: number } {
  const svg: string[] = [];
  const advance = lineAdvance(line);
  const baseline = top + lineAscent(line);

  if (line.band !== undefined)
    svg.push(
      rect(
        MARGIN,
        top - BAND_PAD_TOP,
        lineWidth(line, measurer) + 2 * BAND_PAD_X,
        advance + BAND_PAD_TOP + BAND_PAD_BOTTOM,
        { fill: line.band, stroke: line.band },
      ),
    );

  let x = MARGIN + (line.band === undefined ? 0 : BAND_PAD_X);
  for (const run of line.runs) {
    svg.push(drawRun(run, x, baseline));
    x += measurer.measure(run.content, run.font).width;
  }
  return { svg, advance };
}

function blockWidth(block: Block, measurer: StringMeasurer): number {
  return 2 * MARGIN + Math.max(0, ...block.lines.map((l) => lineWidth(l, measurer)));
}

function blockHeight(block: Block): number {
  return 2 * MARGIN + block.lines.reduce((h, l) => h + lineAdvance(l), 0);
}

/** Draw one block's background band and its lines, at `top`, `width` wide. */
function drawBlock(
  block: Block,
  top: number,
  width: number,
  measurer: StringMeasurer,
): string[] {
  const svg: string[] = [
    rect(0, top, width, blockHeight(block), {
      fill: block.background,
      stroke: block.background,
    }),
  ];
  let y = top + MARGIN;
  for (const line of block.lines) {
    const drawn = drawLine(line, y, measurer);
    svg.push(...drawn.svg);
    y += drawn.advance;
  }
  return svg;
}

/** Stack the blocks top to bottom, left-aligned, each as wide as the widest. */
function drawBlocks(blocks: readonly Block[], measurer: StringMeasurer): string {
  const width = Math.max(...blocks.map((b) => blockWidth(b, measurer)));
  const height = blocks.reduce((h, b) => h + blockHeight(b), 0);

  const children: string[] = [];
  let top = 0;
  for (const block of blocks) {
    children.push(...drawBlock(block, top, width, measurer));
    top += blockHeight(block);
  }
  return svgRoot(width, height, children, WHITE);
}

// --- Public API ---------------------------------------------------------

/**
 * Render the error diagram. The Welcome block is stacked on top only for a
 * source of fewer than 5 lines, exactly as upstream gates it.
 * @see ~/git/plantuml/.../error/PSystemError.java#getTextBlock
 */
export function renderPSystemError(system: PSystemError, measurer: StringMeasurer): string {
  const blocks: Block[] = [];
  if (system.getTotalLineCountLessThan5())
    blocks.push(blackOnWhite(new PSystemWelcome().getStrings()));

  blocks.push(errorBlock(system));
  return drawBlocks(blocks, measurer);
}

/** @see ~/git/plantuml/.../error/PSystemUnsupported.java#getTextBlock */
export function renderPSystemUnsupported(
  system: PSystemUnsupported,
  measurer: StringMeasurer,
): string {
  return drawBlocks([blackOnWhite(system.getStrings())], measurer);
}

/** @see ~/git/plantuml/.../eggs/PSystemWelcome.java#getTextBlock */
export function renderPSystemWelcome(system: PSystemWelcome, measurer: StringMeasurer): string {
  return drawBlocks([blackOnWhite(system.getStrings())], measurer);
}
