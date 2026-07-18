import { describe, it, expect } from 'vitest';
import { defaultTheme } from '../../src/core/theme.js';
import { parseStyleBlock, type StyleMap } from '../../src/core/skinparam.js';
import {
  resolveAnnotationStyles,
  expandGrayShorthand,
  parseClockwise,
} from '../../src/core/annotations/style.js';
import { HorizontalAlignment } from '../../src/core/klimt/geom/HorizontalAlignment.js';

const EMPTY_SKINPARAM = new Map<string, string>();
const EMPTY_STYLEMAP: StyleMap = new Map();

function resolve(
  skinparam: ReadonlyMap<string, string> = EMPTY_SKINPARAM,
  styleMap: StyleMap = EMPTY_STYLEMAP,
) {
  return resolveAnnotationStyles(defaultTheme, skinparam, styleMap);
}

// ---------------------------------------------------------------------------
// expandGrayShorthand — HColorSet.java:122-133
// ---------------------------------------------------------------------------
describe('expandGrayShorthand', () => {
  it('expands #8 to #888888', () => {
    expect(expandGrayShorthand('#8')).toBe('#888888');
  });

  it('expands #D to #DDDDDD', () => {
    expect(expandGrayShorthand('#D')).toBe('#DDDDDD');
  });

  it('expands lowercase #d to #DDDDDD', () => {
    expect(expandGrayShorthand('#d')).toBe('#DDDDDD');
  });

  it('leaves 6-digit hex unchanged', () => {
    expect(expandGrayShorthand('#FFAA00')).toBe('#FFAA00');
  });

  it('leaves named colors unchanged', () => {
    expect(expandGrayShorthand('red')).toBe('red');
  });

  it('leaves transparent unchanged (caller handles it separately)', () => {
    expect(expandGrayShorthand('transparent')).toBe('transparent');
  });
});

// ---------------------------------------------------------------------------
// parseClockwise — ClockwiseTopRightBottomLeft.java#read
// ---------------------------------------------------------------------------
describe('parseClockwise', () => {
  it('1 value -> all four sides', () => {
    expect(parseClockwise('5')).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
  });

  it('2 values -> top/bottom = a, right/left = b', () => {
    expect(parseClockwise('1 5')).toEqual({ top: 1, right: 5, bottom: 1, left: 5 });
  });

  it('3 values -> top=a right=b bottom=c left=b', () => {
    expect(parseClockwise('1 2 3')).toEqual({ top: 1, right: 2, bottom: 3, left: 2 });
  });

  it('4 values -> top right bottom left in order', () => {
    expect(parseClockwise('1 2 3 4')).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  });

  it('non-numeric input -> all-zero fallback (upstream none())', () => {
    expect(parseClockwise('abc')).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('5+ values -> all-zero fallback', () => {
    expect(parseClockwise('1 2 3 4 5')).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

// ---------------------------------------------------------------------------
// resolveAnnotationStyles — no overrides (plantuml.skin verbatim defaults)
// ---------------------------------------------------------------------------
describe('resolveAnnotationStyles — defaults, no overrides', () => {
  it('title: 14 bold center, padding/margin 5x4, transparent bg/line', () => {
    const { title } = resolve();
    expect(title).toEqual({
      fontSize: 14,
      fontStyle: 'bold',
      fontColor: 'black',
      fontFamily: 'sans-serif', // G2 N45: CSS-ready default, not Java's logical AWT name
      backgroundColor: null,
      lineColor: null,
      roundCorner: 0,
      padding: { top: 5, right: 5, bottom: 5, left: 5 },
      margin: { top: 5, right: 5, bottom: 5, left: 5 },
      horizontalAlignment: HorizontalAlignment.CENTER,
    });
  });

  it('legend: 14 plain, bg #D expansion, line black, roundCorner 15, padding 5, margin 12', () => {
    const { legend } = resolve();
    expect(legend).toEqual({
      fontSize: 14,
      fontStyle: 'plain',
      fontColor: 'black',
      fontFamily: 'sans-serif', // G2 N45: CSS-ready default, not Java's logical AWT name
      backgroundColor: '#DDDDDD',
      lineColor: 'black',
      roundCorner: 15,
      padding: { top: 5, right: 5, bottom: 5, left: 5 },
      margin: { top: 12, right: 12, bottom: 12, left: 12 },
      horizontalAlignment: HorizontalAlignment.LEFT,
    });
  });

  it('header: right-aligned, size 10, #8 expansion, transparent bg/line, zero padding/margin', () => {
    const { header } = resolve();
    expect(header.horizontalAlignment).toBe(HorizontalAlignment.RIGHT);
    expect(header.fontSize).toBe(10);
    expect(header.fontColor).toBe('#888888');
    expect(header.backgroundColor).toBeNull();
    expect(header.lineColor).toBeNull();
    expect(header.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(header.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('footer: center-aligned, size 10, #8 expansion, transparent bg/line', () => {
    const { footer } = resolve();
    expect(footer.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(footer.fontSize).toBe(10);
    expect(footer.fontColor).toBe('#888888');
    expect(footer.backgroundColor).toBeNull();
    expect(footer.lineColor).toBeNull();
  });

  it('caption: center-aligned, size 14, padding 0, margin 1, transparent bg/line', () => {
    const { caption } = resolve();
    expect(caption.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(caption.fontSize).toBe(14);
    expect(caption.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(caption.margin).toEqual({ top: 1, right: 1, bottom: 1, left: 1 });
    expect(caption.backgroundColor).toBeNull();
    expect(caption.lineColor).toBeNull();
  });

  it('mainframe: padding 1 5, margin 10 5, line #181818 (root default), no bg', () => {
    const { mainframe } = resolve();
    expect(mainframe.padding).toEqual({ top: 1, right: 5, bottom: 1, left: 5 });
    expect(mainframe.margin).toEqual({ top: 10, right: 5, bottom: 10, left: 5 });
    expect(mainframe.lineColor).toBe('#181818');
    expect(mainframe.backgroundColor).toBeNull();
    expect(mainframe.fontSize).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// skinparam overrides
// ---------------------------------------------------------------------------
describe('resolveAnnotationStyles — skinparam overrides', () => {
  it('TitleFontSize overrides title.fontSize; unrelated fields/elements unaffected', () => {
    const styles = resolve(new Map([['TitleFontSize', '20']]));
    expect(styles.title.fontSize).toBe(20);
    expect(styles.title.fontStyle).toBe('bold');
    expect(styles.header.fontSize).toBe(10);
  });

  it('HeaderFontColor overrides header.fontColor', () => {
    const styles = resolve(new Map([['HeaderFontColor', 'red']]));
    expect(styles.header.fontColor).toBe('red');
  });

  it('FooterFontStyle overrides footer.fontStyle', () => {
    const styles = resolve(new Map([['FooterFontStyle', 'italic']]));
    expect(styles.footer.fontStyle).toBe('italic');
  });

  it('CaptionFontName overrides caption.fontFamily', () => {
    const styles = resolve(new Map([['CaptionFontName', 'Courier']]));
    expect(styles.caption.fontFamily).toBe('Courier');
  });

  it('LegendBackgroundColor overrides legend.backgroundColor', () => {
    const styles = resolve(new Map([['LegendBackgroundColor', '#FFAA00']]));
    expect(styles.legend.backgroundColor).toBe('#FFAA00');
  });

  it('LegendBorderColor overrides legend.lineColor', () => {
    const styles = resolve(new Map([['LegendBorderColor', 'blue']]));
    expect(styles.legend.lineColor).toBe('blue');
  });

  it('LegendBorderRoundCorner overrides legend.roundCorner', () => {
    const styles = resolve(new Map([['LegendBorderRoundCorner', '3']]));
    expect(styles.legend.roundCorner).toBe(3);
  });

  it('TitleBackgroundColor overrides title.backgroundColor (title is a Box key element)', () => {
    const styles = resolve(new Map([['TitleBackgroundColor', '#EEEEEE']]));
    expect(styles.title.backgroundColor).toBe('#EEEEEE');
  });

  it('unknown/unrelated skinparam keys leave annotation styles unaffected', () => {
    const styles = resolve(new Map([['classBackgroundColor', '#000000']]));
    expect(styles.title).toEqual(resolve().title);
  });

  it('mainframe has no skinparam keys upstream — mainframeFontSize is a no-op', () => {
    const styles = resolve(new Map([['mainframeFontSize', '99']]));
    expect(styles.mainframe.fontSize).toBe(14);
  });

  it('header/footer/caption do not expose BackgroundColor/BorderColor skinparam keys', () => {
    const styles = resolve(
      new Map([
        ['HeaderBackgroundColor', '#111111'],
        ['HeaderBorderColor', '#222222'],
      ]),
    );
    expect(styles.header.backgroundColor).toBeNull();
    expect(styles.header.lineColor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// <style> overrides
// ---------------------------------------------------------------------------
describe('resolveAnnotationStyles — <style> overrides', () => {
  it('title { FontColor red } overrides title.fontColor; other fields keep skin defaults', () => {
    const styleMap = parseStyleBlock('title { FontColor red }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.title.fontColor).toBe('red');
    expect(styles.title.fontSize).toBe(14);
    expect(styles.title.fontStyle).toBe('bold');
  });

  it('legend { BackGroundColor: #FFAA00 } overrides legend.backgroundColor', () => {
    const styleMap = parseStyleBlock('legend { BackGroundColor: #FFAA00 }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.legend.backgroundColor).toBe('#FFAA00');
  });

  it('header { HorizontalAlignment: left } overrides header.horizontalAlignment', () => {
    const styleMap = parseStyleBlock('header { HorizontalAlignment: left }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.header.horizontalAlignment).toBe(HorizontalAlignment.LEFT);
  });

  it('caption { Padding: 3 } overrides caption.padding via ClockwiseTopRightBottomLeft', () => {
    const styleMap = parseStyleBlock('caption { Padding: 3 }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.caption.padding).toEqual({ top: 3, right: 3, bottom: 3, left: 3 });
  });

  it('mainframe { LineColor: white } overrides mainframe.lineColor (bare, non-diagram-scoped selector)', () => {
    const styleMap = parseStyleBlock('mainframe { LineColor: white }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.mainframe.lineColor).toBe('white');
  });

  it('BackGroundColor: transparent resolves to null', () => {
    const styleMap = parseStyleBlock('legend { BackGroundColor: transparent }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.legend.backgroundColor).toBeNull();
  });

  it('diagram-type-scoped legend selector (sequencediagram.legend) applies to legend', () => {
    const styleMap = parseStyleBlock('sequenceDiagram { legend { FontColor: green } }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.legend.fontColor).toBe('green');
  });

  it('a diagram-type-scoped selector for a non-legend element has no effect', () => {
    const styleMap = parseStyleBlock('sequenceDiagram { title { FontColor: green } }');
    const styles = resolve(EMPTY_SKINPARAM, styleMap);
    expect(styles.title.fontColor).toBe('black');
  });
});

// ---------------------------------------------------------------------------
// Layering: <style> wins over skinparam (buildTheme Stage 2 -> Stage 3 order,
// src/index.ts:131-160)
// ---------------------------------------------------------------------------
describe('resolveAnnotationStyles — <style> overrides skinparam', () => {
  it('LegendBackgroundColor skinparam + <style> legend override -> style wins', () => {
    const styleMap = parseStyleBlock('legend { BackGroundColor: #00FF00 }');
    const styles = resolve(new Map([['LegendBackgroundColor', '#FFAA00']]), styleMap);
    expect(styles.legend.backgroundColor).toBe('#00FF00');
  });

  it('when only skinparam is set (no <style> override), skinparam value is used', () => {
    const styles = resolve(new Map([['LegendBackgroundColor', '#FFAA00']]));
    expect(styles.legend.backgroundColor).toBe('#FFAA00');
  });
});
