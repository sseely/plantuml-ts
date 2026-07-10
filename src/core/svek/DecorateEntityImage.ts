import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { UGraphic } from '../klimt/UGraphic.js';
import type { StringBounder } from '../klimt/font/StringBounder.js';
import { UGroup, UGroupType } from '../klimt/shape/UGroup.js';
import { UComment } from '../klimt/shape/UComment.js';
import { UTranslate } from '../klimt/UTranslate.js';
import { XDimension2D } from '../klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../klimt/geom/VerticalAlignment.js';

/**
 * UGraphicWithGroups — the `UGraphic` surface this module needs beyond
 * the (Brief 1 T2-scoped) `UGraphic` interface: `startGroup`/
 * `closeGroup`. Those two methods exist today only as extra public
 * surface on the concrete `UGraphicSvg` (see `u-graphic-svg.ts`'s
 * module doc comment — T2 deliberately scoped them out of the
 * `UGraphic` interface itself, matching upstream's split between the
 * `UGraphic` interface, which DOES declare them, and this port's
 * narrower one). This local extension lets callers here stay typed
 * against an interface (not the concrete SVG class) while still
 * reaching those two methods.
 */
export interface UGraphicWithGroups extends UGraphic {
  startGroup(group: UGroup): void;
  closeGroup(): void;
}

/**
 * Narrows `ug` to `UGraphicWithGroups`, throwing if the concrete
 * `UGraphic` passed in does not actually expose `startGroup`/
 * `closeGroup` (today, every real caller passes a `UGraphicSvg`, which
 * does). Upstream's own `UGraphic` interface declares these directly,
 * so this check can never fail there; it exists only because this
 * port's `UGraphic` interface is deliberately narrower (see above).
 */
function requireGroups(ug: UGraphic): UGraphicWithGroups {
  const candidate = ug as Partial<UGraphicWithGroups>;
  if (typeof candidate.startGroup !== 'function' || typeof candidate.closeGroup !== 'function') {
    throw new Error('DecorateEntityImage: ug does not support startGroup/closeGroup (see UGraphicSvg)');
  }
  return ug as UGraphicWithGroups;
}

function textDim(text: TextBlock | null, stringBounder: StringBounder): XDimension2D {
  if (text === null) return new XDimension2D(0, 0);
  return text.calculateDimension(stringBounder);
}

function textX(dimText: XDimension2D, dimTotal: XDimension2D, h: HorizontalAlignment): number {
  if (h === HorizontalAlignment.CENTER) return (dimTotal.getWidth() - dimText.getWidth()) / 2;
  if (h === HorizontalAlignment.LEFT) return 0;
  if (h === HorizontalAlignment.RIGHT) return dimTotal.getWidth() - dimText.getWidth();
  throw new Error('DecorateEntityImage: illegal horizontal alignment');
}

/**
 * Argument bundle for `DecorateEntityImage`'s private constructor.
 * Upstream's own constructor (`svek/DecorateEntityImage.java`) takes
 * these same seven values positionally; collapsed into one object here
 * only to satisfy this project's lizard param-count budget (`-a 5`) —
 * the four static factories below still expose upstream's own
 * positional parameter lists unchanged, and are the only public
 * surface callers use.
 */
interface DecorateEntityImageParts {
  readonly original: TextBlock;
  readonly group1: UGroup | null;
  readonly text1: TextBlock | null;
  readonly horizontal1: HorizontalAlignment | null;
  readonly group2: UGroup | null;
  readonly text2: TextBlock | null;
  readonly horizontal2: HorizontalAlignment | null;
}

/**
 * DecorateEntityImage — wraps a `TextBlock` with an optional label
 * ABOVE it, BELOW it, or both, each label optionally stamped in its own
 * `UGroup` (e.g. object-diagram "quantity" labels via `ClusterHeader`).
 *
 * Upstream: `svek/DecorateEntityImage.java` (188 ln). Ported: the
 * static factories `addTop`/`addBottom`/`add`/`addTopAndBottom`, the
 * private constructor, `drawU`, `calculateDimension`, `getDeltaX`,
 * `getDeltaY`, and the private `getTextDim`/`getTextX` helpers (ported
 * as module-level functions `textDim`/`textX` above — pure, no `this`,
 * so free functions rather than private methods; TS-idiom mechanical
 * decomposition, not a behavior change).
 *
 * Dropped (reported, following `TextBlock.ts`'s own precedent for the
 * identical members): `getBackcolor()` (needs an unported `HColor`
 * type) and `getMinMax()` (needs an unported `MinMax` type). Neither
 * has any caller in `USymbol`/`SymbolContext`/`EntityImageDescription`/
 * this class's own two real callers (`ClusterHeader.java`,
 * `DiagramChromeFactory.java`) — add them, with upstream's bodies, the
 * day a ported caller needs one.
 *
 * `drawSide` (this port's own addition, not upstream): upstream inlines
 * the `if (group != null) ug.startGroup(group); text.drawU(...); if
 * (group != null) ug.closeGroup();` sequence twice (once for text1,
 * once for text2) with different translate shapes (`UTranslate.dx(x)`
 * for text1, `new UTranslate(x, y)` for text2 — preserved exactly at
 * each call site below). Factored into one private method purely to
 * stay inside this project's complexity-hook budget; the two call
 * sites still pass upstream's own translate values unchanged.
 */
export class DecorateEntityImage implements TextBlock {
  private readonly original: TextBlock;

  private readonly group1: UGroup | null;
  private readonly horizontal1: HorizontalAlignment | null;
  private readonly text1: TextBlock | null;

  private readonly group2: UGroup | null;
  private readonly horizontal2: HorizontalAlignment | null;
  private readonly text2: TextBlock | null;

  private deltaX = 0;
  private deltaY = 0;

  private constructor(parts: DecorateEntityImageParts) {
    this.original = parts.original;
    this.group1 = parts.group1;
    this.horizontal1 = parts.horizontal1;
    this.text1 = parts.text1;
    this.group2 = parts.group2;
    this.horizontal2 = parts.horizontal2;
    this.text2 = parts.text2;
  }

  static addTop(
    group: UGroup,
    original: TextBlock,
    text: TextBlock,
    horizontal: HorizontalAlignment,
  ): TextBlock {
    return new DecorateEntityImage({
      original,
      group1: group,
      text1: text,
      horizontal1: horizontal,
      group2: null,
      text2: null,
      horizontal2: null,
    });
  }

  static addBottom(
    group: UGroup,
    original: TextBlock,
    text: TextBlock,
    horizontal: HorizontalAlignment,
  ): TextBlock {
    return new DecorateEntityImage({
      original,
      group1: null,
      text1: null,
      horizontal1: null,
      group2: group,
      text2: text,
      horizontal2: horizontal,
    });
  }

  static add(
    group: UGroup,
    original: TextBlock,
    text: TextBlock,
    horizontal: HorizontalAlignment,
    verticalAlignment: VerticalAlignment,
  ): TextBlock {
    if (verticalAlignment === VerticalAlignment.TOP) return DecorateEntityImage.addTop(group, original, text, horizontal);
    return DecorateEntityImage.addBottom(group, original, text, horizontal);
  }

  static addTopAndBottom(
    original: TextBlock,
    group1: UGroup,
    text1: TextBlock,
    horizontal1: HorizontalAlignment,
    group2: UGroup,
    text2: TextBlock,
    horizontal2: HorizontalAlignment,
  ): TextBlock {
    const parts = { original, group1, text1, horizontal1, group2, text2, horizontal2 };
    const result = new DecorateEntityImage(parts);
    return result;
    //#lizard forgives -- 7-param factory mirrors upstream's own
    // `addTopAndBottom` (svek/DecorateEntityImage.java) verbatim.
  }

  private drawSide(ug: UGraphic, group: UGroup | null, text: TextBlock, translate: UTranslate): void {
    if (group !== null) requireGroups(ug).startGroup(group);
    text.drawU(ug.apply(translate));
    if (group !== null) requireGroups(ug).closeGroup();
  }

  drawU(ug: UGraphic): void {
    const stringBounder = ug.getStringBounder();
    const dimOriginal = this.original.calculateDimension(stringBounder);
    const dimText1 = textDim(this.text1, stringBounder);
    const dimTotal = this.calculateDimension(stringBounder);

    const yImage = dimText1.getHeight();
    const yText2 = yImage + dimOriginal.getHeight();
    const xImage = (dimTotal.getWidth() - dimOriginal.getWidth()) / 2;

    if (this.text1 !== null) {
      const xText1 = textX(dimText1, dimTotal, this.horizontal1 as HorizontalAlignment);
      this.drawSide(ug, this.group1, this.text1, UTranslate.dx(xText1));
    }

    this.original.drawU(ug.apply(new UTranslate(xImage, yImage)));
    this.deltaX = xImage;
    this.deltaY = yImage;

    if (this.text2 !== null) {
      const dimText2 = textDim(this.text2, stringBounder);
      const xText2 = textX(dimText2, dimTotal, this.horizontal2 as HorizontalAlignment);
      this.drawSide(ug, this.group2, this.text2, new UTranslate(xText2, yText2));
    }
  }

  calculateDimension(stringBounder: StringBounder): XDimension2D {
    const dimOriginal = this.original.calculateDimension(stringBounder);
    const dim1 = textDim(this.text1, stringBounder);
    const dim2 = textDim(this.text2, stringBounder);
    const dimText = dim1.mergeTB(dim2);
    return dimOriginal.mergeTB(dimText);
  }

  getDeltaX(): number {
    if (this.original instanceof DecorateEntityImage) return this.deltaX + this.original.deltaX;
    return this.deltaX;
  }

  getDeltaY(): number {
    if (this.original instanceof DecorateEntityImage) return this.deltaY + this.original.deltaY;
    return this.deltaY;
  }
}

/**
 * EntityDecorationInfo — the identifying fields every `EntityImage*`
 * subclass's `drawU` reads to build its entity `<g>` wrapper (see
 * `decorateEntityDrawing` below). `location` mirrors `UGroup`'s own
 * `{ position }` adaptation of upstream's `LineLocation`.
 */
export interface EntityDecorationInfo {
  readonly name: string;
  readonly qualifiedName: string;
  readonly uid: string;
  readonly location?: { readonly position: number } | null;
}

/**
 * decorateEntityDrawing — draws `<!--entity NAME-->`, then wraps
 * `inner`'s drawing in the `class="entity"` `<g>` every `EntityImage*`
 * subclass stamps around its own content: `comment → startGroup →
 * inner.drawU → closeGroup`, exactly as upstream sequences it.
 *
 * NOT a 1:1 port of a single upstream method — `DecorateEntityImage`
 * (the class above) does not do this; it is an unrelated top/bottom
 * label decorator. Upstream instead duplicates this exact sequence
 * verbatim, inline, once per concrete `EntityImage*` subclass (found
 * via `grep -rn 'UGroupType.CLASS, "entity"'
 * src/main/java/net/sourceforge/plantuml/svek` in the upstream repo):
 *
 *  - `svek/image/EntityImageDescription.java:294-303,330` (canonical —
 *    cited below)
 *  - `svek/image/EntityImageClass.java:142-154`
 *  - `svek/image/EntityImageState.java:116-171`
 *  - `svek/image/EntityImageObject.java:190-214`
 *  - `svek/image/EntityImageJson.java:185-...`
 *  - `svek/image/EntityImageNote.java:197-...`
 *  - `svek/image/EntityImageBranch.java:87-...`
 *  - `svek/image/EntityImagePort.java:111-...`
 *  - `svek/image/EntityImageUseCase.java:140-...`
 *  - `svek/image/EntityImageMap.java:190-...`
 *  - `svek/image/EntityImageLollipopInterface.java:115-...`
 *  - `svek/InnerStateAutonom.java:143-...`
 *
 * Consolidated here (T11, svg-conformance Brief 2) as ONE shared
 * function so T14 (`EntityImageDescription.ts`) and any later
 * `EntityImage*` port call this instead of re-duplicating the
 * sequence. This is NOT "refactoring away a special case" per this
 * project's porting discipline: every one of the ~12 upstream copies
 * is byte-for-byte identical (same `UGroupType` keys, same value
 * derivation, same comment→startGroup→drawU→closeGroup order) — there
 * is no special case being discarded, only literal repetition.
 * Journaled per this task's write-set note.
 *
 * Canonical citation (`EntityImageDescription.java:294-303,330`):
 * ```java
 * ug.draw(new UComment("entity " + getEntity().getName()));
 * final UGroup group = new UGroup(getEntity().getLocation());
 * group.put(UGroupType.CLASS, "entity");
 * group.put(UGroupType.ID, "entity_" + getEntity().getName());
 * group.put(UGroupType.DATA_ENTITY, getEntity().getName());
 * group.put(UGroupType.DATA_UID, getEntity().getUid());
 * group.put(UGroupType.DATA_QUALIFIED_NAME, getEntity().getQuark().getQualifiedName());
 * ug.startGroup(group);
 * // ... inner content ...
 * ug.closeGroup();
 * ```
 *
 * Rendered attribute order/set (verified against
 * `test-results/dot-cache/component/sacuso-94-gugi476/in.svg`:
 * `<g class="entity" data-qualified-name="Pack1.Comp1" id="ent0002"
 * data-source-line="4">`) is NOT the `put()` call order above — see
 * `UGroup.ts#asMap`'s doc comment for why (upstream's `EnumMap`
 * ordinal iteration; `ID`/`DATA_ENTITY` are dropped entirely by
 * `xml-writer.ts#applyGroupAttribute`, `DATA_UID` renders as `id`).
 *
 * Scope note: upstream additionally wraps `if (url != null)
 * ug.startUrl(url)/closeUrl()` around the inner draw when the entity
 * has a hyperlink. Out of scope per this task's interface contract
 * ("comment → startGroup → inner drawU → closeGroup", no URL
 * handling) — `openLink`/`closeLink` are D3′ throwing stubs on the
 * klimt emitter (Brief 1) as of this writing regardless, so there is
 * no capability to wire yet.
 */
export function decorateEntityDrawing(
  ug: UGraphicWithGroups,
  info: EntityDecorationInfo,
  inner: Pick<TextBlock, 'drawU'>,
): void {
  ug.draw(new UComment(`entity ${info.name}`));
  const group = new UGroup(info.location ?? null);
  group.put(UGroupType.CLASS, 'entity');
  group.put(UGroupType.ID, `entity_${info.name}`);
  group.put(UGroupType.DATA_ENTITY, info.name);
  group.put(UGroupType.DATA_UID, info.uid);
  group.put(UGroupType.DATA_QUALIFIED_NAME, info.qualifiedName);
  ug.startGroup(group);
  inner.drawU(ug);
  ug.closeGroup();
}
