/**
 * renderer-entity.ts — T17: assembles `EntityImageDescription` (T14) for
 * one leaf `DescriptionNodeGeo` and draws it through klimt, translated to
 * its absolute layout position (`SvekResult.java:87`'s
 * `image.drawU(ug2.apply(new UTranslate(minX, minY)))` — flat, absolute
 * positioning; no coordinate-space nesting inside a parent container's
 * `<g>`, matching the jar's own flat draw order — see `renderer.ts`'s
 * module doc comment).
 *
 * `note` and `port` have no upstream `USymbol`/`EntityImageDescription`
 * mapping (`EntityImageNote`/`EntityImagePort` are separate, unported draw
 * classes — see `renderer-symbol.ts#resolveSymbol`'s doc comment) and draw
 * through a small local klimt-primitive fallback instead, preserving the
 * pre-T17 renderer's basic visual shape (rect + text) without upstream's
 * exact chrome. Documented approximation, not a T17 acceptance blocker
 * (neither symbol appears in the T17 zero-diff conformance fixture).
 */
import type { UGraphic } from '../../core/klimt/UGraphic.js';
import type { Theme } from '../../core/theme.js';
import { resolveElementPaint } from '../../core/theme.js';
import type { Paint } from '../../core/paint.js';
import { parseColor } from '../../core/paint.js';
import { UTranslate } from '../../core/klimt/UTranslate.js';
import { UStroke } from '../../core/klimt/UStroke.js';
import { HorizontalAlignment } from '../../core/klimt/geom/HorizontalAlignment.js';
import { URectangle } from '../../core/klimt/shape/URectangle.js';
import { FontStyle } from '../../core/klimt/shape/UText.js';
import { Fore } from '../../core/klimt/Fore.js';
import { Back } from '../../core/klimt/Back.js';
import type { DescriptionNodeGeo } from './layout-helpers.js';
import {
  EntityImageDescription,
  type EntityImageDescriptionParams,
} from '../../core/svek/image/EntityImageDescription.js';
import { buildTextBlock } from '../../core/svek/image/EntityImageDescriptionSupport.js';
import { UGraphicStencil } from '../../core/klimt/drawing/UGraphicStencil.js';
import {
  decorateEntityDrawing,
  type EntityDecorationInfo,
  type UGraphicWithGroups,
} from '../../core/svek/DecorateEntityImage.js';
import { upstreamKeyword, mapComponentStyle, textFont } from './renderer-symbol.js';
import { ActorStyle } from '../../core/skin/ActorStyle.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import { makeAtomImageResolverFor } from './render-atoms.js';

/** Jar-verified default entity corner radius / stroke width for the
 *  rectangle-family `USymbol`s (`test-results/dot-cache/component/
 *  sacuso-94-gugi476/in.svg`: `rx="2.5" ry="2.5"`,
 *  `style="stroke:...;stroke-width:0.5;"`). A uniform baseline across every
 *  `USymbol` — some (ellipse/actor families) ignore `roundCorner` entirely,
 *  matching upstream's own per-symbol `SymbolContext` consumption.
 *
 *  Value is 5.0, not the jar's rendered `rx="2.5"`: `driver-rectangle-svg
 *  .ts` halves `roundCorner` at serialization (`rx: rx / 2`, mirroring
 *  upstream `URectangle`'s own convention — see that driver's note), so a
 *  `roundCorner` of 5 emits `rx="2.5"`. */
const ENTITY_ROUND_CORNER = 5.0;
const ENTITY_STROKE_WIDTH = 0.5;
/** Stereotype text style flags — italic only, SAME size as the entity
 *  title (`klimt/font/FontParam.java`'s `*_STEREOTYPE` entries, e.g.
 *  `COMPONENT_STEREOTYPE(14, UFontFace.italic())` vs `COMPONENT(14, ...)`
 *  — see `renderer-symbol.ts#textFont`'s doc comment, G1 I2 finding: a
 *  prior `theme.fontSize - 2` delta here was not faithful to the jar). */
const STEREOTYPE_STYLES: ReadonlySet<FontStyle> = new Set([FontStyle.ITALIC]);

/** Narrows `ug` to `UGraphicWithGroups` (duplicated locally per this
 *  codebase's established one-helper-per-call-site convention — see
 *  `Cluster.ts`/`EntityImageDescription.ts`'s own identical helpers). */
function requireGroups(ug: UGraphic): UGraphicWithGroups {
  const candidate = ug as Partial<UGraphicWithGroups>;
  if (typeof candidate.startGroup !== 'function' || typeof candidate.closeGroup !== 'function') {
    throw new Error('renderer-entity: ug does not support startGroup/closeGroup (see UGraphicSvg)');
  }
  return ug as UGraphicWithGroups;
}

/** Business actor/use-case fill: upstream draws these two symbols with a
 *  dedicated `businessActorFill`/`businessUsecaseFill` skinparam (the legacy
 *  `renderer-helpers.ts` read the same `theme.colors.graph.*` fields, and the
 *  `<style> actor { business { BackGroundColor } }` block writes there), NOT
 *  the generic element background `resolveElementPaint` resolves. Returns
 *  `undefined` for every other symbol so the caller falls back to the generic
 *  path. */
function businessBackcolor(theme: Theme, symbol: DescriptionNodeGeo['symbol']): string | undefined {
  if (symbol === 'actor-business') return theme.colors.graph.businessActorFill;
  if (symbol === 'usecase-business') return theme.colors.graph.businessUsecaseFill;
  return undefined;
}

/** Per-entity inline color/style override (`#orange;line:blue`,
 *  `#line.dashed`) — mirrors upstream `Colors` (klimt/color/Colors.java)
 *  token parsing: `;`-separated tokens, a bare no-colon/no-dot token is the
 *  mainType (BACK, `ColorParser.simpleColor(ColorType.BACK)` —
 *  CommandCreateElementFull.java:119) color, `name:value` tokens set
 *  `line`/`text`/`back` (ColorType.getType strips the `.dashed` suffix
 *  before matching, so `line.dashed:x` — never emitted by upstream syntax
 *  — would still key on `line`), and a bare `line.dashed`/`line.dotted`/
 *  `line.bold` token (excluded from the color map since it contains a
 *  `.`) sets the line STYLE (`Colors.java:117-122`). `shadowing:` and
 *  `header`/`arrow` keys have no consumer in this renderer (undocumented
 *  gap — no reachable description fixture exercises them; see
 *  `ColorOverride`'s own doc comment). Named CSS colors (`orange`, `blue`),
 *  bare hex without a leading `#` (stripped by this function's own
 *  `data = raw.toLowerCase().replace(/#/g, '')`), and already-`#RRGGBB`
 *  values all flow as plain `Paint` strings into `back`/`line`/`text` and
 *  are resolved to the jar's canonical uppercase hex at SVG-emission time
 *  by `svg-graphics-core.ts`'s `fixColor`/`createSvgGradient` (G1c: the
 *  ~150-name `klimt/color/ColorTrieNode.ts` table; I2, T19 closed).
 *  `back` (only) is additionally run through `paint.ts#parseColor` (G1 I5h):
 *  a compound two-color token (`red|green`, `yellow\ffffff`) resolves to a
 *  {@link Paint} `Gradient`, which `EntityImageDescriptionPaint.backcolor`
 *  already accepts (the klimt draw path was always Paint-aware — only this
 *  parse site never produced one). `line`/`text` stay plain strings: no
 *  reachable fixture exercises a border or text gradient, and
 *  `FontConfiguration.color` is `string | null`, not `Paint`. */
interface ColorOverride {
  back?: Paint;
  line?: string;
  text?: string;
  lineStyle?: 'dashed' | 'dotted' | 'bold';
}

function parseColorOverride(raw: string): ColorOverride {
  const data = raw.toLowerCase().replace(/#/g, '');
  const result: ColorOverride = {};
  for (const token of data.split(';')) {
    if (token.length === 0) continue;
    const colonIdx = token.indexOf(':');
    if (colonIdx === -1) {
      // G1 I5h: the bare (mainType/BACK) token may be a two-color gradient
      // (`red|green`, `yellow\ffffff`) -- upstream's `Colors.java` feeds
      // this same token straight into `ColorParser.simpleColor`, which
      // resolves through `HColorSet#getColorOrWhite` (gradient-aware,
      // klimt/color/HColorSet.java:107-119) exactly like a skinparam
      // background value already does (`skinparam.ts`'s `parseColor` call).
      if (!token.includes('.')) result.back = parseColor(token);
      continue;
    }
    const name = token.slice(0, colonIdx);
    const value = token.slice(colonIdx + 1);
    const dotIdx = name.indexOf('.');
    const key = dotIdx === -1 ? name : name.slice(0, dotIdx);
    if (key === 'line') result.line = value;
    else if (key === 'text') result.text = value;
    else if (key === 'back') result.back = parseColor(value);
  }
  if (data.includes('line.dashed')) result.lineStyle = 'dashed';
  else if (data.includes('line.dotted')) result.lineStyle = 'dotted';
  else if (data.includes('line.bold')) result.lineStyle = 'bold';
  return result;
}

/** `LinkStyle.getStroke3()` (decoration/LinkStyle.java:97-107) — the
 *  three fixed dash patterns upstream uses for `line.dashed`/`.dotted`/
 *  `.bold`, all with `nonZeroThickness()` = 1 (no thickness override
 *  syntax reaches entity declarations). Falls back to this renderer's
 *  default entity stroke when no line-style override is present. */
function overrideStroke(lineStyle: ColorOverride['lineStyle']): UStroke {
  if (lineStyle === 'dashed') return new UStroke(7, 7, 1);
  if (lineStyle === 'dotted') return new UStroke(1, 3, 1);
  if (lineStyle === 'bold') return UStroke.withThickness(2);
  return UStroke.withThickness(ENTITY_STROKE_WIDTH);
}

function buildEntityParams(
  node: DescriptionNodeGeo,
  theme: Theme,
  sprites: SpriteRegistry | undefined,
): EntityImageDescriptionParams {
  const stereotypeLabels = node.stereotype ?? [];
  const override = node.color !== undefined ? parseColorOverride(node.color) : {};
  const fontTitle = textFont(theme, node.symbol);
  const fontStereo = textFont(theme, node.symbol, 0, STEREOTYPE_STYLES, 'stereotype');
  return {
    entity: { name: node.id, uid: '', qualifiedName: node.id, location: null, url: null },
    symbol: {
      keyword: upstreamKeyword(node.symbol),
      actorStyle: ActorStyle.STICKMAN,
      componentStyle: mapComponentStyle(theme.componentStyle),
    },
    labels: { codeName: node.display, displayText: node.display, stereotypeLabels },
    paint: {
      forecolor: override.line ?? resolveElementPaint(theme, node.symbol, 'border'),
      backcolor:
        override.back ?? businessBackcolor(theme, node.symbol) ?? resolveElementPaint(theme, node.symbol, 'background'),
      roundCorner: ENTITY_ROUND_CORNER,
      diagonalCorner: 0,
      deltaShadow: 0,
      stroke: overrideStroke(override.lineStyle),
      fontTitle: override.text !== undefined ? { ...fontTitle, color: override.text } : fontTitle,
      fontStereo: override.text !== undefined ? { ...fontStereo, color: override.text } : fontStereo,
      titleAlignment: HorizontalAlignment.CENTER,
      stereotypeAlignment: HorizontalAlignment.CENTER,
      ...(theme.wrapWidth !== undefined ? { wrapWidth: theme.wrapWidth } : {}),
    },
    links: [],
    fixCircleLabelOverlapping: theme.fixCircleLabelOverlapping === true,
    atomImageResolverFor: makeAtomImageResolverFor(sprites),
    ...(node.symbol === 'hexagon' ? { hexagonPolygon: null } : {}),
  };
}

/** Fallback draw for `note`/`port` — shares the `startGroup ->
 *  inner.drawU -> closeGroup` `<g class="entity" ...>` wrapper every
 *  entity draw uses (`decorateEntityDrawing`, T11), but WITHOUT the
 *  leading `<!--entity NAME-->` comment: unlike the description entity
 *  path (`EntityImageDescription.java:295`), upstream's port/note
 *  draws never emit that comment (`EntityImagePort.java:110-116`,
 *  `EntityImageNote.java:196-202` go straight to `new UGroup(...)`) —
 *  see `decorateEntityDrawing`'s doc comment (G1 I0 correction) for the
 *  full mechanism, including why drawing it here was also producing
 *  invalid XML for a `set separator`-disambiguated port id. */
function drawFallbackBox(ug: UGraphic, node: DescriptionNodeGeo, uid: string, fill: string, border: string): void {
  const info: EntityDecorationInfo = { name: node.id, qualifiedName: node.id, uid, location: null };
  decorateEntityDrawing(
    requireGroups(ug),
    info,
    {
      drawU(inner: UGraphic): void {
        const rect = URectangle.build(node.width, node.height);
        inner.apply(new Fore(border)).apply(new Back(fill)).draw(rect);
      },
    },
    { withComment: false },
  );
}

/** Upstream: `EntityImageNote.java`'s `marginX1 = 6`, `marginY = 5`
 *  (`getTextWidth`/`drawNormal`'s `ug.apply(new UTranslate(marginX1,
 *  marginY))`), jar-verified 2026-07-15 against `component/
 *  basetu-75-xevi153` (single-line: box top-left (127.62,17.5), text
 *  (133.62,32.6111) — x offset 6.0, y offset 15.1111 = marginY(5) +
 *  the SAME font-baseline math `buildTextBlock` already reproduces
 *  correctly for every other entity) and `component/fojamu-08-veku866`
 *  (3-line note: every line shares the SAME x offset 6.0 from the box's
 *  left edge — `HorizontalAlignment.LEFT`, not centered). */
const NOTE_MARGIN_X = 6;
const NOTE_MARGIN_Y = 5;

/** E2r/L3 (notes cutover): routes the note body through the SAME L1/L2
 *  creole stripe/atom pipeline (`buildTextBlock`) every other entity's
 *  text already uses — nested inline style runs, `==` headings, `<img>`/
 *  `<$sprite>`/`<latex>` atoms, and word-wrap (`wrapWidth`) all now apply
 *  to note bodies too, matching upstream's `EntityImageNote.java`'s own
 *  `BodyFactory.create3(strings, ..., style.wrapWidth(), style)` call
 *  (the SAME `BodyFactory.create3` `EntityImageDescription.java`'s `desc`
 *  uses). Previously this drew each `\n`-split line as ONE literal
 *  `UText` run with an approximated line-height offset (`theme.fontSize +
 *  4`, not the jar's real `marginY`/baseline math) — no creole markup was
 *  ever recognized inside a note. The note's own BOX shape (upstream:
 *  `Opale`'s folded-corner polygon) is unchanged/out of this cutover's
 *  scope — `drawFallbackBox` still draws a plain rect, a pre-existing,
 *  separately-ledgered divergence (G1 territory, not E2r). */
function drawNoteFallback(
  ug: UGraphic,
  node: DescriptionNodeGeo,
  theme: Theme,
  uid: string,
  sprites: SpriteRegistry | undefined,
): void {
  drawFallbackBox(ug, node, uid, theme.colors.noteBackground, theme.colors.border);
  const font = textFont(theme, 'note');
  const resolveAtomImage = makeAtomImageResolverFor(sprites)(font);
  const block = buildTextBlock(node.display, font, HorizontalAlignment.LEFT, resolveAtomImage, theme.wrapWidth ?? 0);
  const dim = block.calculateDimension(ug.getStringBounder());
  // `UGraphicStencil.create` -- REQUIRED here, not optional plumbing: a
  // note body containing a bare creole separator line (`----`/`====`/
  // `....`) now builds a `UHorizontalLine` atom (E2r/L3 cutover, same
  // stripe/atom pipeline entity descriptions already use), and that shape
  // is only ever intercepted by an `AbstractUGraphicHorizontalLine`
  // wrapper (upstream: every `UHorizontalLine#drawMe` call REQUIRES one --
  // `klimt/drawing/LimitFinder.java` itself has no `UHorizontalLine`
  // branch either, jar-verified by inspection). Mirrors
  // `EntityImageDescription.ts#drawU`'s own identical
  // `UGraphicStencil.create(ugDesc, dimDesc)` wrap around its `desc`
  // TextBlock draw (the same pattern this port already uses for entity
  // description bodies -- notes had never needed it before this cutover).
  const translated = ug.apply(new UTranslate(NOTE_MARGIN_X, NOTE_MARGIN_Y));
  block.drawU(UGraphicStencil.create(translated, dim));
}

/** Jar-verified port box border thickness (`EntityImagePort
 *  .getUStroke()`, svek/image/EntityImagePort.java:139-141) -- FIXED at
 *  1.5, independent of `ENTITY_STROKE_WIDTH`'s 0.5 (the regular-entity
 *  default) and of any `#line:`/`line.dashed` override (upstream's
 *  `drawU` never reads `getEntity().getColors()`'s stroke override for a
 *  port -- only backcolor/bordercolor). */
const PORT_STROKE_WIDTH = 1.5;

/** `EntityImagePort.drawU` (svek/image/EntityImagePort.java:99-137): draws
 *  the port's OWN display text (`getDesc()` — `leaf.getDisplay()`, i.e.
 *  `node.display`, CENTER-aligned) positioned above or below the port's
 *  small square box (never inside it — the box stays a fixed
 *  `RADIUS*2` square regardless of label width), THEN the box itself —
 *  text first, box second, matching the jar's own child order (`<text>`
 *  before `<rect>` in every jar-cached port fixture). Horizontal
 *  centering: `x = 0 - (dimDesc.width - node.width) / 2`. Vertical side:
 *  `node.portLabelAbove` (set once, at layout time, by `layout.ts
 *  #applyPortLabelPositions` — see that field's doc comment; `undefined`
 *  — a port with no resolved parent cluster, not reachable from any real
 *  `parseDescription()` output — defaults to the "below" branch, same as
 *  upstream's own `false` case). Fill/border resolve through the SAME
 *  `resolveElementPaint` cascade every other entity uses (`sname: 'port'`
 *  has no per-sname override in any sampled fixture, so both fall back to
 *  the shared `nodeBackground`/`border` theme defaults — jar-verified
 *  `#F1F1F1`/`#181818`), NOT `theme.colors.border` for both (the prior,
 *  visibly-wrong fill this replaces). */
function drawPortFallback(ug: UGraphic, node: DescriptionNodeGeo, theme: Theme, uid: string): void {
  const info: EntityDecorationInfo = { name: node.id, qualifiedName: node.id, uid, location: null };
  const font = textFont(theme, 'port');
  const fill = resolveElementPaint(theme, 'port', 'background');
  const border = resolveElementPaint(theme, 'port', 'border');
  decorateEntityDrawing(
    requireGroups(ug),
    info,
    {
      drawU(inner: UGraphic): void {
        const desc = buildTextBlock(node.display, font, HorizontalAlignment.CENTER);
        const dimDesc = desc.calculateDimension(inner.getStringBounder());
        const x = -(dimDesc.getWidth() - node.width) / 2;
        const y = node.portLabelAbove === true ? -(node.height + dimDesc.getHeight()) : node.height;
        desc.drawU(inner.apply(new UTranslate(x, y)));
        const rect = URectangle.build(node.width, node.height);
        inner
          .apply(new Fore(border))
          .apply(new Back(fill))
          .apply(UStroke.withThickness(PORT_STROKE_WIDTH))
          .draw(rect);
      },
    },
    { withComment: false },
  );
}

/** Draws one leaf entity, translated to its absolute layout position.
 *  Text measurement (dual-measurer conformance seam) is NOT threaded as a
 *  function parameter here — `EntityImageDescription.drawU`/its internal
 *  `TextBlock`s read the active measurer from `ug.getStringBounder()`
 *  (the single render-phase injection seam, `renderer.ts`'s
 *  `UGraphicSvg.build` call). See `EntityImageDescriptionSupport.ts`'s
 *  `buildTextBlock` doc comment for why this is safe (lazy — no
 *  measurement happens before a `ug`/`stringBounder` is available). */
export function drawEntity(
  ug: UGraphic,
  node: DescriptionNodeGeo,
  theme: Theme,
  uid: string,
  sprites?: SpriteRegistry,
): void {
  const translated = ug.apply(new UTranslate(node.x, node.y));
  if (node.symbol === 'note') { drawNoteFallback(translated, node, theme, uid, sprites); return; }
  if (node.symbol === 'port') { drawPortFallback(translated, node, theme, uid); return; }
  const params = buildEntityParams(node, theme, sprites);
  new EntityImageDescription({ ...params, entity: { ...params.entity, uid } }).drawU(translated);
}
