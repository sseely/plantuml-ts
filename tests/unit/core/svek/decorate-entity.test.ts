import { describe, expect, it } from 'vitest';
import {
  DecorateEntityImage,
  decorateEntityDrawing,
  type UGraphicWithGroups,
} from '../../../../src/core/svek/DecorateEntityImage.js';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import type { UGraphic } from '../../../../src/core/klimt/UGraphic.js';
import type { UChange } from '../../../../src/core/klimt/UChange.js';
import type { UParam } from '../../../../src/core/klimt/UParam.js';
import type { StringBounder } from '../../../../src/core/klimt/font/StringBounder.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { UGroup, UGroupType } from '../../../../src/core/klimt/shape/UGroup.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../../../../src/core/klimt/geom/VerticalAlignment.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { normalizeSvg } from '../../../oracle/svg-conformance/normalize.js';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

const stubStringBounder: StringBounder = {
  calculateDimension() {
    return new XDimension2D(0, 0);
  },
};

/** The narrower `{ width }`-only bounder `UGraphicSvg.build` itself takes
 * (see `u-graphic-svg.ts`'s own `getStringBounder()` doc comment for how
 * it adapts this into the wide `StringBounder` above). */
const stubDriverStringBounder: DriverStringBounder = {
  calculateDimension() {
    return { width: 0 };
  },
};

/** Records every `UGraphic` it is drawn on, and returns a fixed dimension. */
class RecordingTextBlock implements TextBlock {
  readonly translates: UTranslate[] = [];

  constructor(private readonly dim: XDimension2D) {}

  drawU(ug: UGraphic): void {
    this.translates.push(ug.getTranslate());
  }

  calculateDimension(): XDimension2D {
    return this.dim;
  }
}

/**
 * A minimal `UGraphic` with NO `startGroup`/`closeGroup` — used to prove
 * `DecorateEntityImage`'s `requireGroups` throws instead of silently
 * skipping the group wrap (see `UGraphic.ts`'s doc comment: T2 scoped
 * these two methods out of the base interface).
 */
class GrouplessUGraphic implements UGraphic {
  constructor(private readonly translate: UTranslate = UTranslate.none()) {}

  apply(change: UChange): UGraphic {
    if (change instanceof UTranslate) return new GrouplessUGraphic(this.translate.compose(change));
    return this;
  }

  draw(): void {
    // no-op: this double only needs to satisfy the UGraphic surface.
  }

  getParam(): UParam {
    throw new Error('GrouplessUGraphic: getParam not exercised by these tests');
  }

  getTranslate(): UTranslate {
    return this.translate;
  }

  getStringBounder(): StringBounder {
    return stubStringBounder;
  }
}

function newSvg(seed = 0): UGraphicSvg {
  return UGraphicSvg.build(seed, basicSvgOption(), '$version$', stubDriverStringBounder);
}

/** A one-key `UGroup` — upstream's factories always require a real,
 * non-empty group (`startGroup` on an empty one throws — see
 * `svg-graphics.ts`), so tests exercising `addTop`/`addBottom` etc.
 * through a real `UGraphic` always pass one of these, never `new
 * UGroup()`. */
function labelGroup(id: string): UGroup {
  return UGroup.singletonMap(UGroupType.DATA_UID, id);
}

// ---------------------------------------------------------------------------
// decorateEntityDrawing
// ---------------------------------------------------------------------------

describe('decorateEntityDrawing', () => {
  it('emits comment + <g> in the exact attr order/set of the jar golden fragment (AC1)', () => {
    // Cited fragment: test-results/dot-cache/component/sacuso-94-gugi476/in.svg
    //   <!--entity Comp1--><g class="entity" data-qualified-name="Pack1.Comp1"
    //   id="ent0002" data-source-line="4">...</g>
    const root = newSvg();
    decorateEntityDrawing(
      root,
      { name: 'Comp1', qualifiedName: 'Pack1.Comp1', uid: 'ent0002', location: { position: 4 } },
      { drawU: (ug) => ug.draw(URectangle.build(1, 1)) },
    );

    const xml = root.getSvgString();
    expect(xml).toContain(
      '<!--entity Comp1--><g class="entity" data-qualified-name="Pack1.Comp1" id="ent0002" data-source-line="4">',
    );
    // The group is actually closed (inner content sits between open/close).
    expect(xml).toMatch(
      /<g class="entity" data-qualified-name="Pack1\.Comp1" id="ent0002" data-source-line="4"><rect[^>]*\/><\/g>/,
    );
  });

  it('omits data-source-line when no location is given', () => {
    const root = newSvg();
    decorateEntityDrawing(
      root,
      { name: 'Comp2', qualifiedName: 'Comp2', uid: 'ent0005' },
      { drawU: (ug) => ug.draw(URectangle.build(1, 1)) },
    );

    const xml = root.getSvgString();
    expect(xml).toContain('<g class="entity" data-qualified-name="Comp2" id="ent0005">');
    expect(xml).not.toContain('data-source-line');
  });

  it('drops an entity group entirely when the inner drawable draws nothing (matches upstream closeTopPendingElement)', () => {
    const root = newSvg();
    decorateEntityDrawing(
      root,
      { name: 'Empty', qualifiedName: 'Empty', uid: 'ent0000' },
      { drawU: () => undefined },
    );

    const xml = root.getSvgString();
    // Upstream `SvgGraphics#closeTopPendingElement` (SvgGraphics.java:1165-1170)
    // discards a group with no children rather than emitting an empty <g/>.
    expect(xml).toContain('<!--entity Empty-->');
    expect(xml).not.toContain('class="entity"');
  });

  it('sanitizes non-word characters in name/qualifiedName via UGroup.put (fix())', () => {
    const root = newSvg();
    decorateEntityDrawing(
      root,
      { name: 'A B!', qualifiedName: 'Pack!1.A B', uid: 'ent0009' },
      { drawU: (ug) => ug.draw(URectangle.build(1, 1)) },
    );

    const xml = root.getSvgString();
    expect(xml).toContain('data-qualified-name="Pack.1.A B"');
  });

  it('normalized decorated content differs from undecorated only by the wrapping <g> (AC2)', () => {
    const inner: Pick<TextBlock, 'drawU'> = { drawU: (ug) => ug.draw(URectangle.build(4, 4)) };

    const plain = newSvg();
    inner.drawU(plain);
    const plainNormalized = normalizeSvg(plain.getSvgString());

    const decorated = newSvg();
    decorateEntityDrawing(decorated, { name: 'Comp1', qualifiedName: 'Pack1.Comp1', uid: 'ent0002' }, inner);
    const decoratedNormalized = normalizeSvg(decorated.getSvgString());

    // Document children (after normalizeSvg drops the <?plantuml?> PI) are
    // [<defs/>, <g>...</g>] in both documents — <g> is the root draw group
    // every `UGraphicSvg` document emits (see u-graphic-svg.ts's
    // getSvgString()). The undecorated tree is svg > defs, g > rect; the
    // decorated tree is svg > defs, g > g[entity] > rect — exactly one
    // extra structural level, and the rect itself (once data-* is
    // stripped by normalizeSvg) is byte-for-byte identical.
    const plainRoot = plainNormalized.children?.find((c) => c.tag === 'g');
    const decoratedRoot = decoratedNormalized.children?.find((c) => c.tag === 'g');
    const decoratedEntityGroup = decoratedRoot?.children?.[0];

    expect(plainRoot?.tag).toBe('g');
    expect(decoratedEntityGroup?.tag).toBe('g');
    expect(decoratedEntityGroup?.attrs?.['class']).toBe('entity');
    expect(decoratedEntityGroup?.children).toEqual(plainRoot?.children);
  });
});

// ---------------------------------------------------------------------------
// DecorateEntityImage
// ---------------------------------------------------------------------------

describe('DecorateEntityImage', () => {
  describe('calculateDimension', () => {
    it('addTop merges the label height above the original', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const label = new RecordingTextBlock(new XDimension2D(10, 5));
      const deco = DecorateEntityImage.addTop(labelGroup('lbl1'), original, label, HorizontalAlignment.CENTER);

      const dim = deco.calculateDimension(stubStringBounder);
      expect(dim.getWidth()).toBe(30);
      expect(dim.getHeight()).toBe(25);
    });

    it('addTopAndBottom merges both labels', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const top = new RecordingTextBlock(new XDimension2D(10, 5));
      const bottom = new RecordingTextBlock(new XDimension2D(12, 7));
      const deco = DecorateEntityImage.addTopAndBottom(
        original,
        labelGroup('lbl1'),
        top,
        HorizontalAlignment.LEFT,
        labelGroup('lbl2'),
        bottom,
        HorizontalAlignment.RIGHT,
      );

      const dim = deco.calculateDimension(stubStringBounder);
      expect(dim.getWidth()).toBe(30);
      expect(dim.getHeight()).toBe(32);
    });
  });

  describe('add()', () => {
    it('dispatches to addTop for VerticalAlignment.TOP', () => {
      const original = new RecordingTextBlock(new XDimension2D(10, 10));
      const label = new RecordingTextBlock(new XDimension2D(10, 4));
      const deco = DecorateEntityImage.add(
        labelGroup('lbl1'),
        original,
        label,
        HorizontalAlignment.CENTER,
        VerticalAlignment.TOP,
      );

      deco.drawU(newSvg());
      // Label drawn first at y=0 (dx-only translate), matching addTop.
      expect(label.translates[0]?.getDy()).toBe(0);
    });

    it('dispatches to addBottom for any non-TOP VerticalAlignment', () => {
      const original = new RecordingTextBlock(new XDimension2D(10, 10));
      const label = new RecordingTextBlock(new XDimension2D(10, 4));
      const deco = DecorateEntityImage.add(
        labelGroup('lbl1'),
        original,
        label,
        HorizontalAlignment.CENTER,
        VerticalAlignment.BOTTOM,
      );

      deco.drawU(newSvg());
      // Label drawn below the original: y = originalHeight (10).
      expect(label.translates[0]?.getDy()).toBe(10);
    });
  });

  describe('drawU positioning', () => {
    it('addTop draws the label at y=0 and the original below it, per horizontal alignment', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const label = new RecordingTextBlock(new XDimension2D(10, 5));
      const deco = DecorateEntityImage.addTop(labelGroup('lbl1'), original, label, HorizontalAlignment.LEFT);

      deco.drawU(newSvg());

      expect(label.translates[0]?.getDx()).toBe(0); // LEFT
      expect(label.translates[0]?.getDy()).toBe(0);
      expect(original.translates[0]?.getDx()).toBe(0); // (30-30)/2
      expect(original.translates[0]?.getDy()).toBe(5); // label height
    });

    it('addBottom draws the original first, then the label below it', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const label = new RecordingTextBlock(new XDimension2D(10, 5));
      const deco = DecorateEntityImage.addBottom(labelGroup('lbl1'), original, label, HorizontalAlignment.RIGHT);

      deco.drawU(newSvg());

      expect(original.translates[0]?.getDy()).toBe(0); // no top label
      expect(label.translates[0]?.getDx()).toBe(20); // RIGHT: 30-10
      expect(label.translates[0]?.getDy()).toBe(20); // below the original
    });

    it('CENTER alignment centers the (narrower) label over the original', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const label = new RecordingTextBlock(new XDimension2D(10, 5));
      const deco = DecorateEntityImage.addTop(labelGroup('lbl1'), original, label, HorizontalAlignment.CENTER);

      deco.drawU(newSvg());

      expect(label.translates[0]?.getDx()).toBe(10); // (30-10)/2
    });

    it('throws for an unrecognized horizontal alignment value', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const label = new RecordingTextBlock(new XDimension2D(10, 5));
      const deco = DecorateEntityImage.addTop(
        labelGroup('lbl1'),
        original,
        label,
        'DIAGONAL' as HorizontalAlignment,
      );

      expect(() => deco.drawU(newSvg())).toThrow(/illegal horizontal alignment/);
    });
  });

  describe('group wrapping (UGroup on text1/text2)', () => {
    it('wraps only the label in startGroup/closeGroup, not the original, through a real UGraphic', () => {
      const original: TextBlock = {
        drawU: (ug) => ug.draw(URectangle.build(5, 5)),
        calculateDimension: () => new XDimension2D(30, 20),
      };
      const label: TextBlock = {
        drawU: (ug) => ug.draw(URectangle.build(3, 3)),
        calculateDimension: () => new XDimension2D(10, 5),
      };
      const group = UGroup.singletonMap(UGroupType.DATA_UID, 'lbl0001');
      const deco = DecorateEntityImage.addTop(group, original, label, HorizontalAlignment.CENTER);

      const root = newSvg();
      deco.drawU(root);

      const xml = root.getSvgString();
      // The label's rect sits inside <g id="lbl0001">...</g>; the
      // original's rect does not (no wrapping <g> around it at all).
      expect(xml).toMatch(/<g id="lbl0001"><rect[^>]*width="3"[^>]*\/><\/g>/);
      expect(xml).toMatch(/<\/g><rect[^>]*width="5"[^>]*\/>/);
    });

    it('requireGroups throws when the UGraphic lacks startGroup/closeGroup', () => {
      const original: TextBlock = {
        drawU: () => undefined,
        calculateDimension: () => new XDimension2D(30, 20),
      };
      const label: TextBlock = {
        drawU: () => undefined,
        calculateDimension: () => new XDimension2D(10, 5),
      };
      const group = labelGroup('lbl1');
      const deco = DecorateEntityImage.addTop(group, original, label, HorizontalAlignment.CENTER);

      expect(() => deco.drawU(new GrouplessUGraphic())).toThrow(/does not support startGroup\/closeGroup/);
    });
  });

  describe('getDeltaX / getDeltaY', () => {
    it('reports the original image offset for a single decoration level', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const label = new RecordingTextBlock(new XDimension2D(10, 5));
      const deco = DecorateEntityImage.addTop(
        labelGroup('lbl1'),
        original,
        label,
        HorizontalAlignment.LEFT,
      ) as DecorateEntityImage;

      deco.drawU(newSvg());
      expect(deco.getDeltaX()).toBe(0); // (30-30)/2
      expect(deco.getDeltaY()).toBe(5); // label height
    });

    it('accumulates delta across nested DecorateEntityImage levels', () => {
      const original = new RecordingTextBlock(new XDimension2D(30, 20));
      const label1 = new RecordingTextBlock(new XDimension2D(10, 5));
      const inner = DecorateEntityImage.addTop(labelGroup('lbl1'), original, label1, HorizontalAlignment.LEFT);

      const label2 = new RecordingTextBlock(new XDimension2D(10, 3));
      const outer = DecorateEntityImage.addTop(
        labelGroup('lbl2'),
        inner,
        label2,
        HorizontalAlignment.LEFT,
      ) as DecorateEntityImage;

      outer.drawU(newSvg());
      // outer's own deltaY (label2 height = 3) plus inner's deltaY (label1
      // height = 5), matching upstream's `getDeltaY()` recursion.
      expect(outer.getDeltaY()).toBe(8);
      // getDeltaX takes the same nested-instanceof path: both levels
      // center a width-10 label over a width-30 original, so each
      // level's own deltaX is (30-30)/2 = 0 (unaffected by the label
      // width) -- accumulated total stays 0.
      expect(outer.getDeltaX()).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// UGraphicWithGroups (type-only export smoke check)
// ---------------------------------------------------------------------------

describe('UGraphicWithGroups', () => {
  it('a real UGraphicSvg structurally satisfies the extended interface', () => {
    const root: UGraphicWithGroups = newSvg();
    expect(typeof root.startGroup).toBe('function');
    expect(typeof root.closeGroup).toBe('function');
  });
});
