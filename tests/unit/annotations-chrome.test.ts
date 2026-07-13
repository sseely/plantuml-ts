/**
 * Unit tests for `applyChrome`/`mergeTB`/`getTextX` (src/core/annotations/
 * chrome.ts) — mission G0b / T4. Pins `DiagramChromeFactory.create`'s
 * stacking order (legend → title → caption → header/footer, header/footer
 * outermost) and `DecorateEntityImage`'s composition math (mergeTB /
 * getTextX / xImage / yImage / yText2), against the acceptance criteria in
 * `plans/g0b-annotations/batch-2/T4-chrome-core.md`.
 *
 * Jar structural verification (2026-07-13,
 * `oracle/dist/plantuml-oracle.jar -tsvg -pipe`) on:
 *   @startuml
 *   title A Title
 *   header a header
 *   footer a footer
 *   legend bottom left
 *   This is
 *   my legend
 *   end legend
 *   a->b
 *   @enduml
 * DOM child order: <g class="header">, <g class="title">, <g class="message"
 * (the body)>, <g class="legend">, <g class="footer"> — i.e. header, title,
 * body, legend, footer. This is the draw-order oracle for the "stacking
 * order" tests below (jar text metrics are AWT; only RELATIONS are
 * asserted here, per the task spec, not absolute widths).
 */
import { describe, it, expect } from 'vitest';
import { applyChrome, getTextX, mergeTB, type AnnotationStyles } from '../../src/core/annotations/chrome.js';
import {
  createAnnotations,
  setTitle,
  setCaption,
  setLegend,
  updateHeader,
  updateFooter,
  singleDisplayPositioned,
  type DiagramAnnotations,
} from '../../src/core/annotations/index.js';
import type { AnnotationBoxStyle, AnnotationElement } from '../../src/core/annotations/style.js';
import type { RenderFragment } from '../../src/core/dispatcher.js';
import { HorizontalAlignment } from '../../src/core/klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../../src/core/klimt/geom/VerticalAlignment.js';
import { FixedMeasurer } from '../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// mergeTB / getTextX — pure geometry primitives
// ---------------------------------------------------------------------------

describe('mergeTB', () => {
  it('width = max, height = sum (XDimension2D#mergeTB)', () => {
    expect(mergeTB({ width: 10, height: 5 }, { width: 6, height: 20 })).toEqual({ width: 10, height: 25 });
    expect(mergeTB({ width: 6, height: 20 }, { width: 10, height: 5 })).toEqual({ width: 10, height: 25 });
  });
});

describe('getTextX', () => {
  const dimTotal = { width: 100, height: 0 };

  it('CENTER — (total - text) / 2', () => {
    expect(getTextX({ width: 40, height: 0 }, dimTotal, HorizontalAlignment.CENTER)).toBe(30);
  });

  it('LEFT — 0', () => {
    expect(getTextX({ width: 40, height: 0 }, dimTotal, HorizontalAlignment.LEFT)).toBe(0);
  });

  it('RIGHT — total - text', () => {
    expect(getTextX({ width: 40, height: 0 }, dimTotal, HorizontalAlignment.RIGHT)).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// applyChrome — test fixtures
// ---------------------------------------------------------------------------

/** Zero padding/margin, transparent box — isolates composition math from
 *  buildAnnotationBlock's own (separately tested) padding/margin/+1 quirk. */
function plainStyle(overrides: Partial<AnnotationBoxStyle> = {}): AnnotationBoxStyle {
  return {
    fontSize: 10,
    fontStyle: 'plain',
    fontColor: '#000000',
    fontFamily: 'sans-serif',
    backgroundColor: null,
    lineColor: null,
    roundCorner: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    horizontalAlignment: HorizontalAlignment.CENTER,
    ...overrides,
  };
}

function plainStyles(overrides: Partial<Record<AnnotationElement, Partial<AnnotationBoxStyle>>> = {}): AnnotationStyles {
  const elements: AnnotationElement[] = ['title', 'caption', 'header', 'footer', 'legend', 'mainframe'];
  const result = {} as AnnotationStyles;
  for (const el of elements) result[el] = plainStyle(overrides[el]);
  return result;
}

const MEASURER = new FixedMeasurer(10, 10); // 10px/char, 10px line height (unused — advance is font-size-ratio driven)
const BODY_MARKER = '<rect id="BODY_MARKER"/>';
/** fontSize(10) * LINE_ADVANCE_RATIO(14.1328/12) + BORDERED_DIMENSION_QUIRK(1) —
 *  the height of a zero-padding/margin single-line block at fontSize 10. */
const ONE_LINE_BLOCK_HEIGHT = 10 * (14.1328 / 12) + 1;

function makeFragment(width: number, height: number, body = BODY_MARKER): RenderFragment {
  return { body, width, height, background: '#FFFFFF', extraDefs: '<marker/>' };
}

// ---------------------------------------------------------------------------
// Empty annotations — byte-stability (decisions.md D5)
// ---------------------------------------------------------------------------

describe('applyChrome — empty annotations', () => {
  it('returns the SAME fragment object (===), zero cost', () => {
    const fragment = makeFragment(100, 50);
    const result = applyChrome(fragment, createAnnotations(), plainStyles(), MEASURER);
    expect(result).toBe(fragment);
  });
});

// ---------------------------------------------------------------------------
// Title composition (acceptance criteria #2)
// ---------------------------------------------------------------------------

describe('applyChrome — title', () => {
  function withTitle(text: string): DiagramAnnotations {
    const a = createAnnotations();
    setTitle(a, singleDisplayPositioned([text], HorizontalAlignment.CENTER, VerticalAlignment.TOP, 0));
    return a;
  }

  it('narrower title: total height grows by the title block height, width unchanged', () => {
    const fragment = makeFragment(100, 50);
    const styles = plainStyles();
    // 'T' at 10px/char -> pureTextWidth 10, +1 quirk -> titleBlock width 11, narrower than 100.
    const result = applyChrome(fragment, withTitle('T'), styles, MEASURER);
    expect(result.width).toBeCloseTo(100, 6);
    expect(result.height).toBeCloseTo(50 + ONE_LINE_BLOCK_HEIGHT, 6);
    // body (original) is centered: xImage = (100 - 100) / 2 = 0; yImage = titleHeight.
    expect(result.body).toContain(`<g transform="translate(0,${ONE_LINE_BLOCK_HEIGHT})">${BODY_MARKER}</g>`);
  });

  it('wider title: total width grows to the title width, body re-centered by (titleWidth-bodyWidth)/2', () => {
    const fragment = makeFragment(100, 50);
    const styles = plainStyles();
    // 14 chars * 10px/char = 140 pureTextWidth -> titleBlock width 141 (> fragment 100).
    const result = applyChrome(fragment, withTitle('AAAAAAAAAAAAAA'), styles, MEASURER);
    const titleWidth = 140 + 1;
    expect(result.width).toBeCloseTo(titleWidth, 6);
    expect(result.height).toBeCloseTo(50 + ONE_LINE_BLOCK_HEIGHT, 6);
    const xImage = (titleWidth - 100) / 2;
    expect(result.body).toContain(`<g transform="translate(${xImage},${ONE_LINE_BLOCK_HEIGHT})">${BODY_MARKER}</g>`);
  });

  it('wraps the title text in a class="title" group', () => {
    const fragment = makeFragment(100, 50);
    const result = applyChrome(fragment, withTitle('T'), plainStyles(), MEASURER);
    expect(result.body).toMatch(/<g transform="translate\([\d.]+,0\)" class="title">/);
  });
});

// ---------------------------------------------------------------------------
// Legend stacking (acceptance criteria #3)
// ---------------------------------------------------------------------------

describe('applyChrome — legend + title stacking', () => {
  it('legend bottom-left + title: draw order is title, body, legend (legend x=0 when not the widest)', () => {
    const a = createAnnotations();
    setTitle(a, singleDisplayPositioned(['T'], HorizontalAlignment.CENTER, VerticalAlignment.TOP, 0));
    setLegend(a, singleDisplayPositioned(['L'], HorizontalAlignment.LEFT, VerticalAlignment.BOTTOM, 1));
    const fragment = makeFragment(500, 50); // body is the widest block -> legend/title tandem delta is 0
    const result = applyChrome(fragment, a, plainStyles(), MEASURER);

    const titleIdx = result.body.indexOf('class="title"');
    const bodyIdx = result.body.indexOf(BODY_MARKER);
    const legendIdx = result.body.indexOf('class="legend"');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(bodyIdx).toBeGreaterThan(titleIdx);
    expect(legendIdx).toBeGreaterThan(bodyIdx);

    // Legend is LEFT and not the widest block (body=500 dominates) -> x=0.
    expect(result.body).toMatch(/<g transform="translate\(0,[\d.]+\)" class="legend">/);
  });

  it('legend top: draw order is legend, body (before title is added)', () => {
    const a = createAnnotations();
    setLegend(a, singleDisplayPositioned(['L'], HorizontalAlignment.CENTER, VerticalAlignment.TOP, 0));
    const fragment = makeFragment(100, 50);
    const result = applyChrome(fragment, a, plainStyles(), MEASURER);
    const legendIdx = result.body.indexOf('class="legend"');
    const bodyIdx = result.body.indexOf(BODY_MARKER);
    expect(legendIdx).toBeGreaterThanOrEqual(0);
    expect(bodyIdx).toBeGreaterThan(legendIdx);
  });

  it('a legend with horizontalAlignment=null (defensive — never produced by the real parser, D7 always resolves CENTER) falls back to CENTER', () => {
    const a = createAnnotations();
    setLegend(a, singleDisplayPositioned(['LL'], null, VerticalAlignment.BOTTOM, 0));
    const fragment = makeFragment(100, 50);
    const result = applyChrome(fragment, a, plainStyles(), MEASURER);
    // 'LL' block width = 2*10+1 = 21; CENTER against total 100 -> x = (100-21)/2 = 39.5.
    const legendMatch = /<g transform="translate\(([\d.]+),[\d.]+\)" class="legend">/.exec(result.body);
    expect(legendMatch).not.toBeNull();
    expect(Number(legendMatch![1])).toBeCloseTo((100 - 21) / 2, 6);
  });
});

// ---------------------------------------------------------------------------
// Header/footer outermost (acceptance criteria #3)
// ---------------------------------------------------------------------------

describe('applyChrome — header/footer outermost', () => {
  it('header above title, footer below caption', () => {
    const a = createAnnotations();
    setTitle(a, singleDisplayPositioned(['T'], HorizontalAlignment.CENTER, VerticalAlignment.TOP, 0));
    setCaption(a, singleDisplayPositioned(['C'], HorizontalAlignment.CENTER, VerticalAlignment.BOTTOM, 1));
    updateHeader(a, 2, ['H'], null);
    updateFooter(a, 3, ['F'], null);
    const fragment = makeFragment(100, 50);
    const result = applyChrome(fragment, a, plainStyles(), MEASURER);

    const headerIdx = result.body.indexOf('class="header"');
    const titleIdx = result.body.indexOf('class="title"');
    const bodyIdx = result.body.indexOf(BODY_MARKER);
    const captionIdx = result.body.indexOf('class="caption"');
    const footerIdx = result.body.indexOf('class="footer"');

    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeGreaterThan(headerIdx);
    expect(bodyIdx).toBeGreaterThan(titleIdx);
    expect(captionIdx).toBeGreaterThan(bodyIdx);
    expect(footerIdx).toBeGreaterThan(captionIdx);
  });

  it('D8: header defaults RIGHT, footer defaults CENTER, from style, when no explicit prefix', () => {
    const a = createAnnotations();
    updateHeader(a, 0, ['H'], null); // no left|right|center prefix -> horizontalAlignment null
    updateFooter(a, 1, ['F'], null);
    const fragment = makeFragment(200, 50);
    const styles = plainStyles({
      header: { horizontalAlignment: HorizontalAlignment.RIGHT },
      footer: { horizontalAlignment: HorizontalAlignment.CENTER },
    });
    const result = applyChrome(fragment, a, styles, MEASURER);

    // 'H'/'F' at 10px/char -> block width 11 each; dimTotal.width = max(200,11,11) = 200.
    const headerMatch = /<g transform="translate\(([\d.]+),0\)" class="header">/.exec(result.body);
    expect(headerMatch).not.toBeNull();
    expect(Number(headerMatch![1])).toBeCloseTo(200 - 11, 6); // RIGHT: total - text = 189

    const footerMatch = /<g transform="translate\(([\d.]+),[\d.]+\)" class="footer">/.exec(result.body);
    expect(footerMatch).not.toBeNull();
    expect(Number(footerMatch![1])).toBeCloseTo((200 - 11) / 2, 6); // CENTER: (total - text) / 2 = 94.5
  });

  it('explicit header/footer alignment overrides the style default', () => {
    const a = createAnnotations();
    updateHeader(a, 0, ['H'], HorizontalAlignment.LEFT);
    const fragment = makeFragment(200, 50);
    const styles = plainStyles({ header: { horizontalAlignment: HorizontalAlignment.RIGHT } });
    const result = applyChrome(fragment, a, styles, MEASURER);
    expect(result.body).toMatch(/<g transform="translate\(0,0\)" class="header">/);
  });
});

// ---------------------------------------------------------------------------
// Preserves background/extraDefs from the input fragment
// ---------------------------------------------------------------------------

describe('applyChrome — preserves fragment.background/extraDefs', () => {
  it('carries background and extraDefs through unchanged when chrome is applied', () => {
    const a = createAnnotations();
    setTitle(a, singleDisplayPositioned(['T'], HorizontalAlignment.CENTER, VerticalAlignment.TOP, 0));
    const fragment = makeFragment(100, 50);
    const result = applyChrome(fragment, a, plainStyles(), MEASURER);
    expect(result.background).toBe('#FFFFFF');
    expect(result.extraDefs).toBe('<marker/>');
  });
});
