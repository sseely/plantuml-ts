/**
 * Member-row visibility icon shape/color (G2 N6).
 *
 * Upstream draws each member row's colored visibility marker via
 * `VisibilityModifier#getUBlock`/`#drawWithGroup` (`skin/
 * VisibilityModifier.java`): a `<g data-visibility-modifier="KIND_FIELD"|
 * "KIND_METHOD">` wrapper around ONE shape per visibility char --
 * PRIVATE=square, PROTECTED=diamond, PACKAGE=triangle, PUBLIC=circle,
 * IE_MANDATORY(`*`)=circle always filled. FIELD members draw the shape
 * UNFILLED (`fill="none"`, stroke-only, the visibility's `LineColor`);
 * METHOD members draw it FILLED (`fill=BackgroundColor`, stroke
 * `LineColor`) -- `MethodsOrFieldsArea#getUBlock`'s `isField ? null :
 * BackGroundColor` branch. This port previously drew a single uniform
 * filled shape (wrong shape for 4/5 visibility chars, wrong fill rule for
 * every field, `<circle>` never wrapped in a `<g>`) -- jar-verified via
 * `sigoji-75-mojo941` (protected field), `cuxuni-25-doxi736` (public
 * field+method), `lufide-34-cexu026` (all five chars, both field+method,
 * skinparam-overridden colors -- override support itself deferred, see
 * below).
 *
 * Colors: `~/git/plantuml/src/main/resources/skin/plantuml.skin`'s
 * `visibilityIcon { public/private/protected/package/IEMandatory { LineColor
 * ...; BackgroundColor ... } }` block -- the DEFAULT (unthemed) values;
 * `skinparam icon<Kind>Color`/`icon<Kind>BackgroundColor` overrides
 * (`lufide-34-cexu026` exercises these) are NOT wired -- no existing
 * skinparam/theme plumbing carries them, and only 1/718 corpus fixtures
 * uses the override, so deferred rather than widening `theme.ts`/
 * `skinparam.ts` (shared code) this iteration.
 *
 * Geometry: `VisibilityModifier#drawSquare/drawCircle/drawDiamond/
 * drawTriangle`, all relative to an "icon block origin" `(originX,
 * originY)` this port derives from the row's own already-correct text
 * baseline position (`renderer.ts#renderRow`'s `geo.x + row.indent`/
 * `geo.y + row.y`, G2 N4) via two constants jar-verified against 20+
 * icon occurrences across the three sample fixtures above (every shape,
 * every field/method combination, zero residual once the earlier
 * `EntityImageClass` chrome pass -- N3/N4 -- already puts the row baseline
 * in the right place):
 *   - `originX = geo.x + ROW_TEXT_LEFT_MARGIN` (6px) -- SAME left margin
 *     `class-layout-helpers.ts` already reserves for the icon zone; the
 *     icon block's local x=0 sits exactly there (`PlacementStrategy
 *     Visibility#getPositions`'s `ent1` -> x=0, the row group's own left
 *     edge).
 *   - `originY = rowBaselineY - (ascent(fontSize) - VISIBILITY_ICON_
 *     CENTER_ADJUST)`, derived from `PlacementStrategyVisibility#
 *     getPositions`'s `2 + y + (maxHeight12 - height1) / 2` term: the
 *     icon TextBlock's own height is `VISIBILITY_ICON_SIZE + 1` (=11,
 *     `VisibilityModifier#getUBlock`'s `calculateDimension`); the row
 *     slot height (`maxHeight12`) is the SAME `fontSize`-based
 *     `memberRowHeight` this port's own row layout already uses (jar's
 *     text TextBlock dominates the max at any font size `>= 11px`, the
 *     only regime this corpus exercises) -- reducing the placement
 *     formula to `2 + rowTop + (fontSize - (SIZE+1)) / 2`, i.e.
 *     `rowTop + VISIBILITY_ICON_CENTER_ADJUST` where `rowTop =
 *     rowBaselineY - ascent(fontSize)` (this port's own baseline-from-top
 *     offset, `class-layout-helpers.ts`'s `baselineOffset`). NOT
 *     independently re-derived for a non-default `fontSize` skinparam (no
 *     corpus fixture combines visibility icons with a custom font size) --
 *     the symbolic form above should generalize, but is only
 *     jar-verified at the default 14px.
 */
import type { Visibility } from './ast.js';

/** `SkinParam#classAttributeIconSize()` default -- skinparam override not wired. */
export const VISIBILITY_ICON_SIZE = 10;

/** `VisibilityModifier#getUBlock`'s `calculateDimension` height (size + 1). */
const ICON_BLOCK_HEIGHT = VISIBILITY_ICON_SIZE + 1;

/**
 * `PlacementStrategyVisibility#getPositions`'s `2 + (maxHeight12 -
 * height1) / 2` term, reduced for the `maxHeight12 == memberRowHeight ==
 * fontSize` regime (see module doc comment): `2 + (fontSize -
 * ICON_BLOCK_HEIGHT) / 2`, evaluated at the corpus's only sampled
 * `fontSize` (14) and left as a function of `rowHeight` for other sizes.
 */
function centeringDelta(rowHeight: number): number {
  return 2 + (rowHeight - ICON_BLOCK_HEIGHT) / 2;
}

/** Default (unthemed) `visibilityIcon { ... }` colors, `plantuml.skin`. */
const VISIBILITY_COLORS: Record<Exclude<Visibility, '*'>, { line: string; background: string }> = {
  '+': { line: '#038048', background: '#84BE84' }, // public
  '-': { line: '#C82930', background: '#F24D5C' }, // private
  '#': { line: '#B38D22', background: '#FFFF44' }, // protected
  '~': { line: '#1963A0', background: '#4177AF' }, // package
};
const IE_MANDATORY_COLOR = { line: '#000000', background: '#000000' };

function colorsFor(icon: Visibility): { line: string; background: string } {
  return icon === '*' ? IE_MANDATORY_COLOR : VISIBILITY_COLORS[icon];
}

/** `VisibilityModifier#name()` -- the `data-visibility-modifier` value. */
export function visibilityModifierName(icon: Visibility, isField: boolean): string {
  if (icon === '*') return 'IE_MANDATORY';
  const base = { '+': 'PUBLIC', '-': 'PRIVATE', '#': 'PROTECTED', '~': 'PACKAGE_PRIVATE' }[icon];
  return `${base}_${isField ? 'FIELD' : 'METHOD'}`;
}

/**
 * `IE_MANDATORY.isField()` is FALSE regardless of member context
 * (`VisibilityModifier.java`'s enum only has ONE `IE_MANDATORY` entry,
 * shared by field and method call sites) -- so `*` always resolves the
 * METHOD (filled) fill rule, even on a field member.
 */
function isFilled(icon: Visibility, memberIsField: boolean): boolean {
  return icon === '*' ? true : !memberIsField;
}

const STROKE_WIDTH = 1;

function polygonTag(points: ReadonlyArray<readonly [number, number]>, fill: string, stroke: string): string {
  const pts = points.map(([x, y]) => `${x},${y}`).join(',');
  return (
    `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${STROKE_WIDTH}" ` +
    `stroke-linejoin="miter" stroke-miterlimit="10"/>`
  );
}

/** `VisibilityModifier#drawSquare`: translate(x+2,y+2), size-4 square. */
function drawSquare(x: number, y: number, fill: string, stroke: string): string {
  const s = VISIBILITY_ICON_SIZE - 4;
  return (
    `<rect x="${x + 2}" y="${y + 2}" width="${s}" height="${s}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${STROKE_WIDTH}"/>`
  );
}

/** `VisibilityModifier#drawCircle`: translate(x+2,y+2), size-4 diameter. */
function drawCircle(x: number, y: number, fill: string, stroke: string): string {
  const r = (VISIBILITY_ICON_SIZE - 4) / 2;
  return (
    `<ellipse cx="${x + 2 + r}" cy="${y + 2 + r}" rx="${r}" ry="${r}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${STROKE_WIDTH}"/>`
  );
}

/** `VisibilityModifier#drawDiamond`: size-2 diamond, translate(x+1,y). */
function drawDiamond(x: number, y: number, fill: string, stroke: string): string {
  const s = VISIBILITY_ICON_SIZE - 2;
  const ox = x + 1;
  const points: Array<[number, number]> = [
    [ox + s / 2, y],
    [ox + s, y + s / 2],
    [ox + s / 2, y + s],
    [ox, y + s / 2],
  ];
  return polygonTag(points, fill, stroke);
}

/** `VisibilityModifier#drawTriangle`: size-2 triangle, translate(x+1,y). */
function drawTriangle(x: number, y: number, fill: string, stroke: string): string {
  const s = VISIBILITY_ICON_SIZE - 2;
  const ox = x + 1;
  const points: Array<[number, number]> = [
    [ox + s / 2, y + 1],
    [ox, y + s - 1],
    [ox + s, y + s - 1],
  ];
  return polygonTag(points, fill, stroke);
}

/**
 * Renders one member row's visibility icon (shape + color + `<g
 * data-visibility-modifier>` wrapper), given the icon block's own origin
 * (top-left) -- see module doc comment for how the caller derives
 * `originX`/`originY` from the row's text-baseline position.
 */
export function renderVisibilityIcon(
  icon: Visibility,
  isField: boolean,
  originX: number,
  originY: number,
): string {
  const { line, background } = colorsFor(icon);
  const filled = isFilled(icon, isField);
  const fill = filled ? background : 'none';
  const shape =
    icon === '-'
      ? drawSquare(originX, originY, fill, line)
      : icon === '#'
        ? drawDiamond(originX, originY, fill, line)
        : icon === '~'
          ? drawTriangle(originX, originY, fill, line)
          : drawCircle(originX, originY, fill, line); // '+' and '*'
  return `<g data-visibility-modifier="${visibilityModifierName(icon, isField)}">${shape}</g>`;
}

/**
 * Absolute Y of the icon block's top-left corner, given the row's own
 * (already jar-correct) text baseline Y and the row height driving
 * `memberRowHeight`/`baselineOffset` (`class-layout-helpers.ts`) --
 * `rowBaselineY - ascent(rowHeight) + centeringDelta(rowHeight)`. `ascent`
 * mirrors `class-layout-helpers.ts`'s own `baselineOffset` formula
 * (`fontSize - measurer.getDescent`), reduced here to the SAME
 * `fontSize/4.5` descent this port's every `StringMeasurer` shares
 * (matches `renderer.ts`'s pre-existing `iconBaselineLift` doc comment,
 * which this function replaces).
 */
export function visibilityIconOriginY(rowBaselineY: number, rowHeight: number): number {
  const descent = rowHeight / 4.5;
  const ascent = rowHeight - descent;
  return rowBaselineY - ascent + centeringDelta(rowHeight);
}
