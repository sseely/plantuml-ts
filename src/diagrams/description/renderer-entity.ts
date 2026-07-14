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
import { UTranslate } from '../../core/klimt/UTranslate.js';
import { UStroke } from '../../core/klimt/UStroke.js';
import { HorizontalAlignment } from '../../core/klimt/geom/HorizontalAlignment.js';
import { URectangle } from '../../core/klimt/shape/URectangle.js';
import { UText } from '../../core/klimt/shape/UText.js';
import { Fore } from '../../core/klimt/Fore.js';
import { Back } from '../../core/klimt/Back.js';
import type { DescriptionNodeGeo } from './layout-helpers.js';
import {
  EntityImageDescription,
  type EntityImageDescriptionParams,
} from '../../core/svek/image/EntityImageDescription.js';
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
/** `theme.fontSize` delta for stereotype text (matches the legacy
 *  `renderer.ts`'s own `theme.fontSize - 2` convention). */
const STEREOTYPE_SIZE_DELTA = -2;

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
 *  `ColorOverride`'s own doc comment). Named CSS colors (`orange`, `blue`)
 *  are passed through verbatim — this port has no `HColorSet` name→hex
 *  table (`src/core/theme.ts`, out of this task's write-set); values that
 *  are already `#RRGGBB` pass through unchanged. */
interface ColorOverride {
  back?: string;
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
      if (!token.includes('.')) result.back = token;
      continue;
    }
    const name = token.slice(0, colonIdx);
    const value = token.slice(colonIdx + 1);
    const dotIdx = name.indexOf('.');
    const key = dotIdx === -1 ? name : name.slice(0, dotIdx);
    if (key === 'line') result.line = value;
    else if (key === 'text') result.text = value;
    else if (key === 'back') result.back = value;
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
  const stereotypeLabels = node.stereotype !== undefined ? [node.stereotype] : [];
  const override = node.color !== undefined ? parseColorOverride(node.color) : {};
  const fontTitle = textFont(theme, node.symbol);
  const fontStereo = textFont(theme, node.symbol, STEREOTYPE_SIZE_DELTA);
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

function drawNoteFallback(ug: UGraphic, node: DescriptionNodeGeo, theme: Theme, uid: string): void {
  drawFallbackBox(ug, node, uid, theme.colors.noteBackground, theme.colors.border);
  const font = textFont(theme, 'note');
  const lineHeight = theme.fontSize + 4;
  node.display.split('\n').forEach((line, i) => {
    ug.apply(new UTranslate(6, lineHeight * (i + 1))).draw(UText.build(line, font));
  });
}

function drawPortFallback(ug: UGraphic, node: DescriptionNodeGeo, theme: Theme, uid: string): void {
  drawFallbackBox(ug, node, uid, theme.colors.border, theme.colors.border);
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
  if (node.symbol === 'note') { drawNoteFallback(translated, node, theme, uid); return; }
  if (node.symbol === 'port') { drawPortFallback(translated, node, theme, uid); return; }
  const params = buildEntityParams(node, theme, sprites);
  new EntityImageDescription({ ...params, entity: { ...params.entity, uid } }).drawU(translated);
}
