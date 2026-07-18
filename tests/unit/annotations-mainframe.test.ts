/**
 * Unit tests for `mainframe`'s current (T9) state — mission G0b.
 *
 * T9 investigated porting `DiagramChromeFactory.decorateWithFrame` +
 * `BigFrame` (`klimt/shape/BigFrame.java`) and took the D9 escape hatch:
 * `BigFrame`'s geometry depends on `TextBlockUtils.getMinMax`'s ink-
 * bounding-box walk (`LimitFinder`), which this port's flat-fragment
 * `AnnotationBlock` chrome pipeline (T4) has no equivalent for anywhere —
 * jar-verified (`plans/g0b-annotations/decision-journal.md`'s T9 row;
 * `DIVERGENCES.md`, "## General" → "mainframe <label> — parsed, not yet
 * rendered"). This file pins the CURRENT, documented state: `mainframe`
 * parses into the model (T1) and participates in `isEmpty()` (so chrome
 * still runs for a mainframe-only diagram), but `applyChrome` does not
 * draw it — content passes through unchanged. Delete/replace these tests
 * the day `BigFrame` actually gets ported.
 *
 * @see DIVERGENCES.md ("mainframe <label> — parsed, not yet rendered")
 * @see plans/g0b-annotations/decisions.md D9
 */
import { describe, it, expect } from 'vitest';
import { applyChrome, type AnnotationStyles } from '../../src/core/annotations/chrome.js';
import { createAnnotations, setMainFrame, singleDisplayPositioned, isEmpty } from '../../src/core/annotations/index.js';
import type { AnnotationBoxStyle, AnnotationElement } from '../../src/core/annotations/style.js';
import type { RenderFragment } from '../../src/core/dispatcher.js';
import { FixedMeasurer } from '../../src/core/measurer.js';

const MEASURER = new FixedMeasurer(10, 10);

const PLAIN_STYLE: AnnotationBoxStyle = {
  fontSize: 14,
  fontStyle: 'plain',
  fontColor: 'black',
  fontFamily: 'SansSerif',
  backgroundColor: null,
  lineColor: null,
  roundCorner: 0,
  lineThickness: 1, // G2 N50: root{}'s LineThickness 1.0 default
  documentBackground: '#FFFFFF', // G2 N51: default canvas background
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  horizontalAlignment: 'LEFT',
};

function plainStyles(): AnnotationStyles {
  const elements: AnnotationElement[] = ['title', 'caption', 'header', 'footer', 'legend', 'mainframe'];
  const result = {} as AnnotationStyles;
  for (const el of elements) result[el] = { ...PLAIN_STYLE, padding: { ...PLAIN_STYLE.padding }, margin: { ...PLAIN_STYLE.margin } };
  return result;
}

function makeFragment(width: number, height: number, body = '<rect id="BODY"/>'): RenderFragment {
  return { body, width, height, background: '#FFFFFF', extraDefs: '<marker/>' };
}

describe('mainframe — T9 escape hatch (D9): parsed, not rendered', () => {
  it('a mainframe-only annotations bag is NOT isEmpty (chrome still runs)', () => {
    const annotations = createAnnotations();
    setMainFrame(annotations, singleDisplayPositioned(['demo'], null, null, 0));
    expect(isEmpty(annotations)).toBe(false);
  });

  it('applyChrome leaves body/width/height unchanged when mainFrame is the ONLY annotation set', () => {
    const annotations = createAnnotations();
    setMainFrame(annotations, singleDisplayPositioned(['demo'], null, null, 0));
    const fragment = makeFragment(70, 107);

    const result = applyChrome(fragment, annotations, plainStyles(), MEASURER);

    expect(result.body).toBe(fragment.body);
    expect(result.width).toBe(fragment.width);
    expect(result.height).toBe(fragment.height);
  });

  it('applyChrome preserves background/extraDefs (spread-through, decisions.md D5 shape)', () => {
    const annotations = createAnnotations();
    setMainFrame(annotations, singleDisplayPositioned(['demo'], null, null, 0));
    const fragment = makeFragment(70, 107);

    const result = applyChrome(fragment, annotations, plainStyles(), MEASURER);

    expect(result.background).toBe('#FFFFFF');
    expect(result.extraDefs).toBe('<marker/>');
  });

  it('byte-stability: applyChrome returns the SAME fragment object when no annotations are present at all', () => {
    const fragment = makeFragment(70, 107);
    const result = applyChrome(fragment, createAnnotations(), plainStyles(), MEASURER);
    expect(result).toBe(fragment);
  });
});
