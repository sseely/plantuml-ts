import { describe, it, expect } from 'vitest';
import {
  collectElementStyleBuckets,
  resolveDocumentBackground,
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
