import { describe, it, expect } from 'vitest';
import {
  collectElementStyleBuckets,
  resolveDocumentBackground,
  resolveStyleCascade,
} from '../../../src/core/style-map-element.js';
import { applyStyleMap } from '../../../src/core/style-map-theme.js';
import { defaultTheme } from '../../../src/core/theme.js';
import type { StyleMap } from '../../../src/core/skinparam.js';

/** Build a StyleMap from a plain object of selector → declarations. */
function styleMap(spec: Record<string, Record<string, string>>): StyleMap {
  const m: StyleMap = new Map();
  for (const [sel, decls] of Object.entries(spec)) {
    m.set(sel, new Map(Object.entries(decls)));
  }
  return m;
}

describe('collectElementStyleBuckets (T5 / D4)', () => {
  it('routes a database style block into the database bucket, not a class field (AC1)', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({ database: { backgroundcolor: '#334455' } }),
    );
    expect(buckets.database?.background).toBe('#334455');
    // Nothing class-scoped was produced.
    expect(buckets.class).toBeUndefined();
  });

  it('parses a gradient in an element style block into a Gradient Paint (AC2)', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({ node: { backgroundcolor: '#aabbcc\\#112233' } }),
    );
    expect(buckets.node?.background).toEqual({
      color1: '#aabbcc',
      color2: '#112233',
      policy: '\\',
    });
  });

  it('collects background, border, and font roles', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({
        component: {
          backgroundcolor: '#111111',
          bordercolor: '#222222',
          fontcolor: '#333333',
        },
      }),
    );
    expect(buckets.component).toEqual({
      background: '#111111',
      border: '#222222',
      font: '#333333',
    });
  });

  it('ignores selectors that are not known bucket SNames', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({ class: { backgroundcolor: '#ffffff' }, widget: { backgroundcolor: '#000000' } }),
    );
    expect(Object.keys(buckets)).toHaveLength(0);
  });

  // G2 N32: `<style> spotClass { BackgroundColor blue; FontColor red; }` --
  // the class-badge spot-color override, reached via this PRE-EXISTING
  // generic mechanism once `spotclass` etc are in `ELEMENT_BUCKET_SNAMES`
  // (no new style-map-theme.ts/style-map-element.ts code needed). Jar-
  // verified `gekofe-43-lufa479`.
  it('routes a spotClass style block into the spotclass bucket (G2 N32)', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({ spotclass: { backgroundcolor: 'blue', fontcolor: 'red' } }),
    );
    expect(buckets.spotclass).toEqual({ background: 'blue', font: 'red' });
  });
});

// ---------------------------------------------------------------------------
// collectElementStyleBuckets — per-element FontSize / stereotype (G1 I4b)
// ---------------------------------------------------------------------------
describe('collectElementStyleBuckets — font-size buckets (G1 I4b)', () => {
  it('routes a bare <sname> { FontSize N } into the title fontSize field (fasave-91-jaka816)', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({ component: { fontsize: '19' }, collections: { fontsize: '19' } }),
    );
    expect(buckets.component?.fontSize).toBe(19);
    expect(buckets.collections?.fontSize).toBe(19);
  });

  it('routes <sname> { stereotype { FontSize N } } into stereotypeFontSize, not fontSize (kuciku-99-tedu217)', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({ 'node.stereotype': { fontsize: '20' } }),
    );
    expect(buckets.node).toEqual({ stereotypeFontSize: 20 });
  });

  it('merges a bare-selector bucket with its stereotype sub-selector bucket', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({
        actor: { fontsize: '15', fontcolor: 'blue' },
        'actor.stereotype': { fontsize: '10' },
      }),
    );
    expect(buckets.actor).toEqual({ fontSize: 15, font: 'blue', stereotypeFontSize: 10 });
  });

  it('ignores a stereotype sub-selector under a non-bucket SName', () => {
    const buckets = collectElementStyleBuckets(
      styleMap({ 'widget.stereotype': { fontsize: '99' } }),
    );
    expect(Object.keys(buckets)).toHaveLength(0);
  });
});

describe('applyStyleMap element-bucket integration (T5)', () => {
  it('surfaces a database style block on theme.colors.elements', () => {
    const theme = applyStyleMap(
      styleMap({ database: { backgroundcolor: '#654321' } }),
      defaultTheme,
    );
    expect(theme.colors.elements?.database?.background).toBe('#654321');
    // Base theme untouched.
    expect(defaultTheme.colors.elements).toBeUndefined();
  });

  it('returns base unchanged when there are no relevant selectors', () => {
    const theme = applyStyleMap(styleMap({ widget: { backgroundcolor: '#000' } }), defaultTheme);
    expect(theme).toBe(defaultTheme);
  });
});

describe('resolveDocumentBackground (relocated from applyStyleMap)', () => {
  it('reads the bare document selector background', () => {
    expect(resolveDocumentBackground(styleMap({ document: { backgroundcolor: '#abcdef' } }))).toBe(
      '#abcdef',
    );
  });

  it('lets a diagram-scoped document variant win over the bare one', () => {
    const bg = resolveDocumentBackground(
      styleMap({
        document: { backgroundcolor: '#111111' },
        'jsondiagram.document': { backgroundcolor: '#222222' },
      }),
    );
    expect(bg).toBe('#222222');
  });

  it('returns undefined when no document selector is present', () => {
    expect(resolveDocumentBackground(styleMap({ database: { backgroundcolor: '#fff' } }))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveStyleCascade (G2 N36) — the "classDiagram class-selector cascade
// reaching classifier boxes" mechanism: a declaration's own dot-path SName
// tokens must be a SUBSET of the caller's query `snames`, last match (by
// map/textual insertion order) wins per property.
// ---------------------------------------------------------------------------
describe('resolveStyleCascade (G2 N36)', () => {
  const CLASS_SNAMES = ['root', 'element', 'classdiagram', 'class'] as const;

  it('a bare classDiagram {} selector cascades down to a classifier query', () => {
    const value = resolveStyleCascade(
      styleMap({ classdiagram: { backgroundcolor: 'Green' } }),
      CLASS_SNAMES,
      'backgroundcolor',
    );
    expect(value).toBe('Green');
  });

  it('a bare root {} selector cascades down to a classifier query', () => {
    const value = resolveStyleCascade(
      styleMap({ root: { backgroundcolor: 'Red' } }),
      CLASS_SNAMES,
      'backgroundcolor',
    );
    expect(value).toBe('Red');
  });

  it('a nested classDiagram.class selector matches (fumalu/bajula shape)', () => {
    const value = resolveStyleCascade(
      styleMap({ 'classdiagram.class': { backgroundcolor: 'yellow' } }),
      CLASS_SNAMES,
      'backgroundcolor',
    );
    expect(value).toBe('yellow');
  });

  it('a more-specific declaration registered LATER overrides an earlier match (source order, not a fixed precedence list)', () => {
    const m = styleMap({
      root: { backgroundcolor: 'Red' },
      classdiagram: { backgroundcolor: 'Green' },
      class: { backgroundcolor: 'pink' },
    });
    expect(resolveStyleCascade(m, CLASS_SNAMES, 'backgroundcolor')).toBe('pink');
  });

  it('an earlier-registered MORE specific declaration still loses to a later-registered broader one (textual order determines the winner, not selector specificity)', () => {
    const m = styleMap({
      class: { backgroundcolor: 'pink' },
      classdiagram: { backgroundcolor: 'Green' },
    });
    expect(resolveStyleCascade(m, CLASS_SNAMES, 'backgroundcolor')).toBe('Green');
  });

  it('a document {} selector does NOT cascade to a classifier box (document is not in its own signature)', () => {
    const value = resolveStyleCascade(
      styleMap({ document: { backgroundcolor: 'Navy' } }),
      CLASS_SNAMES,
      'backgroundcolor',
    );
    expect(value).toBeUndefined();
  });

  it('a nested classDiagram.document selector does NOT cascade to a classifier box', () => {
    const value = resolveStyleCascade(
      styleMap({ 'classdiagram.document': { backgroundcolor: 'Yellow' } }),
      CLASS_SNAMES,
      'backgroundcolor',
    );
    expect(value).toBeUndefined();
  });

  it('a bare classDiagram {} selector does NOT cascade to a spot/badge query (spot has no classDiagram token)', () => {
    const value = resolveStyleCascade(
      styleMap({ classdiagram: { backgroundcolor: 'Green' } }),
      ['root', 'element', 'spot', 'spotclass'],
      'backgroundcolor',
    );
    expect(value).toBeUndefined();
  });

  it('a bare root {} selector DOES cascade to a spot/badge query', () => {
    const value = resolveStyleCascade(
      styleMap({ root: { backgroundcolor: 'Red' } }),
      ['root', 'element', 'spot', 'spotclass'],
      'backgroundcolor',
    );
    expect(value).toBe('Red');
  });

  it('a `.tagname` stereotype sub-selector never matches (excluded, not mismatched)', () => {
    const value = resolveStyleCascade(
      styleMap({ 'classdiagram..x': { backgroundcolor: 'cyan' } }),
      CLASS_SNAMES,
      'backgroundcolor',
    );
    expect(value).toBeUndefined();
  });

  it('a header-scoped query picks up a MORE SPECIFIC classDiagram.class.header override over the class-level one (momaku shape)', () => {
    const m = styleMap({
      root: { fontcolor: 'Red' },
      'classdiagram.class': { fontcolor: 'blue' },
      'classdiagram.class.header': { fontcolor: 'violet' },
    });
    const headerSnames = [...CLASS_SNAMES, 'header'];
    expect(resolveStyleCascade(m, headerSnames, 'fontcolor')).toBe('violet');
    // The member-row query (no `header` token) never matches the header-only
    // declaration, correctly falling back to the class-level value.
    expect(resolveStyleCascade(m, CLASS_SNAMES, 'fontcolor')).toBe('blue');
  });

  it('returns undefined when no declaration matches at all', () => {
    expect(
      resolveStyleCascade(styleMap({ widget: { backgroundcolor: '#000' } }), CLASS_SNAMES, 'backgroundcolor'),
    ).toBeUndefined();
  });

  it('an arrow-scoped query only matches classDiagram/root plus a nested arrow selector (rakici shape)', () => {
    const m = styleMap({
      'classdiagram.arrow': { linecolor: 'blue' },
      'classdiagram.class': { backgroundcolor: '#00ff00' },
    });
    const arrowSnames = ['root', 'element', 'classdiagram', 'arrow'];
    expect(resolveStyleCascade(m, arrowSnames, 'linecolor')).toBe('blue');
    // The class-scoped declaration never leaks into the arrow query.
    expect(resolveStyleCascade(m, arrowSnames, 'backgroundcolor')).toBeUndefined();
  });
});
