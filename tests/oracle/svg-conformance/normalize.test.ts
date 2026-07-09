/**
 * Unit tests for the golden-SVG conformance normalizer (T1).
 *
 * Fixture at the bottom of this file (`JAR_COMPONENT_SVG`) is real
 * plantuml.jar output (component diagram, `Pack1`/`Comp1..4`/`Comp2`),
 * captured verbatim from a local dot-cache run rather than read from
 * `test-results/dot-cache/` at test time — that directory is gitignored
 * (regenerated locally / in CI setup steps), so embedding the fixture keeps
 * this test self-contained and reproducible.
 */
import { describe, test, expect } from 'vitest';
import { normalizeSvg } from './normalize.js';

describe('normalizeSvg', () => {
  test('sorts attributes alphabetically and normalizes numeric values', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
      '<ellipse cy="50.000000" cx="20.1234567" rx="10" ry="5"/>' +
      '</svg>';

    const result = normalizeSvg(svg);

    expect(result.type).toBe('element');
    expect(result.tag).toBe('svg');
    const ellipse = result.children?.[0];
    expect(ellipse?.tag).toBe('ellipse');
    // sorted alphabetically: cx, cy, rx, ry
    expect(Object.keys(ellipse?.attrs ?? {})).toEqual(['cx', 'cy', 'rx', 'ry']);
    expect(ellipse?.attrs?.['cx']).toBe('20.1235'); // 6 sig figs
    expect(ellipse?.attrs?.['cy']).toBe('50'); // trailing zeros stripped
  });

  test('collapses and trims whitespace-only text nodes to nothing', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<text>  hello   world  </text>' +
      '<g>   \n  </g>' +
      '</svg>';

    const result = normalizeSvg(svg);
    const text = result.children?.find((c) => c.tag === 'text');
    expect(text?.children).toHaveLength(1);
    expect(text?.children?.[0]?.type).toBe('text');
    expect(text?.children?.[0]?.text).toBe('hello world');

    const g = result.children?.find((c) => c.tag === 'g');
    expect(g?.children).toEqual([]); // whitespace-only text node dropped
  });

  // AC3: style declarations resolve to individual attrs; style wins over
  // a same-named presentation attribute; the style attr itself is dropped.
  test('resolves style declarations into attrs, style wins, style key dropped', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M0,0" fill="none" style="stroke:#181818;fill:none;stroke-width:0.5;"/>' +
      '</svg>';

    const result = normalizeSvg(svg);
    const path = result.children?.[0];
    expect(path?.attrs).toMatchObject({
      stroke: '#181818',
      fill: 'none',
      'stroke-width': '0.5',
    });
    expect(path?.attrs?.['style']).toBeUndefined();
    expect('style' in (path?.attrs ?? {})).toBe(false);
  });

  test('malformed style declarations (no colon, empty key) are skipped', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<rect style="stroke:#181818;malformed-no-colon;:no-key;fill:none;"/>' +
      '</svg>';

    const result = normalizeSvg(svg);
    const rect = result.children?.[0];
    expect(rect?.attrs).toEqual({ stroke: '#181818', fill: 'none' });
  });

  test('style declaration overwrites a conflicting presentation attribute', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<rect fill="#F1F1F1" style="fill:#FFFFFF;"/>' +
      '</svg>';

    const result = normalizeSvg(svg);
    const rect = result.children?.[0];
    expect(rect?.attrs?.['fill']).toBe('#FFFFFF');
  });

  // AC4: comments, processing instructions, and data-* attrs are all
  // absent after normalization, at every depth.
  test('strips comments, processing instructions, and data-* attrs at any depth', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" data-diagram-type="DESCRIPTION">' +
      '<?plantuml $version$?>' +
      '<g class="entity" data-qualified-name="Pack1.Comp1" id="ent0002">' +
      '<!--entity Comp1-->' +
      '<rect x="1" y="2" width="3" height="4"/>' +
      '</g>' +
      '<?plantuml-src AqujKIXE?>' +
      '</svg>';

    const result = normalizeSvg(svg);
    expect(result.attrs?.['data-diagram-type']).toBeUndefined();

    const g = result.children?.[0];
    expect(g?.tag).toBe('g');
    expect(g?.attrs?.['data-qualified-name']).toBeUndefined();
    expect(g?.attrs?.['id']).toBe('ent0002');
    // only the <rect> child remains: comment and PI both dropped
    expect(g?.children).toHaveLength(1);
    expect(g?.children?.[0]?.tag).toBe('rect');
    // no PI sibling survives at the root either
    expect(result.children).toHaveLength(1);
  });

  test('skips non-element/text/comment/PI nodes such as CDATA sections', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<script><![CDATA[ignored]]></script>' +
      '</svg>';

    const result = normalizeSvg(svg);
    const script = result.children?.[0];
    expect(script?.tag).toBe('script');
    expect(script?.children).toEqual([]); // CDATA section dropped
  });

  // xmldom's own parser rejects a document with no root element before
  // normalizeSvg's own defensive "no root element found" throw is ever
  // reached (that throw exists only to satisfy TypeScript's control-flow
  // exhaustiveness check on the function's return type) — this test asserts
  // the observable boundary behavior: malformed/rootless input throws.
  test('throws on a document with no root element', () => {
    expect(() => normalizeSvg('<!--just a comment, no element-->')).toThrow();
  });

  // AC5: a real cached jar SVG normalizes without throwing, root tag svg.
  test('normalizes a real plantuml.jar component-diagram SVG without throwing', () => {
    const result = normalizeSvg(JAR_COMPONENT_SVG);
    expect(result.type).toBe('element');
    expect(result.tag).toBe('svg');
    expect(result.attrs?.['viewBox']).toBe('0 0 481 190');
    // data-* stripped
    expect(result.attrs?.['data-diagram-type']).toBeUndefined();
    // style resolved, no style key survives anywhere in the tree
    expect(result.attrs?.['style']).toBeUndefined();
    expect(containsStyleKey(result)).toBe(false);
  });
});

function containsStyleKey(node: ReturnType<typeof normalizeSvg>): boolean {
  if (node.attrs && 'style' in node.attrs) return true;
  return (node.children ?? []).some((c) => containsStyleKey(c));
}

// Captured verbatim from a local `test-results/dot-cache/component/` run
// (plantuml.jar output for a small component diagram with a package and
// five components). See file header for why this is embedded rather than
// read from disk.
const JAR_COMPONENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" data-diagram-type="DESCRIPTION" style="width:481px;height:190px;background:#FFFFFF;" width="481px" height="190px" viewBox="0 0 481 190" zoomAndPan="magnify" preserveAspectRatio="none" contentStyleType="text/css"><?plantuml $version$?><defs/><g><!--cluster Pack1--><g class="cluster" data-qualified-name="Pack1" id="ent0001" data-source-line="3"><path d="M8.5,82.46 L48.4375,82.46 A3.75,3.75 0 0 1 50.9375,84.96 L57.9375,102.46 L361.5,102.46 A2.5,2.5 0 0 1 364,104.96 L364,172.96 A2.5,2.5 0 0 1 361.5,175.46 L8.5,175.46 A2.5,2.5 0 0 1 6,172.96 L6,84.96 A2.5,2.5 0 0 1 8.5,82.46" style="stroke:#FF0000;stroke-width:1.5;" fill="none"/><line x1="6" y1="102.46" x2="57.9375" y2="102.46" style="stroke:#FF0000;stroke-width:1.5;"/><text x="10" y="95.3489" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="38.9375" font-weight="700" font-family="sans-serif">Pack1</text></g><!--entity Comp1--><g class="entity" data-qualified-name="Pack1.Comp1" id="ent0002" data-source-line="4"><rect x="22.42" y="115.46" width="85.15" height="44" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/><rect x="87.57" y="120.46" width="15" height="10" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="85.57" y="122.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="85.57" y="126.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><text x="37.42" y="146.3489" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="45.15" font-family="sans-serif">Comp1</text></g><!--entity Comp3--><g class="entity" data-qualified-name="Pack1.Comp3" id="ent0003" data-source-line="5"><rect x="142.42" y="115.46" width="85.15" height="44" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/><rect x="207.57" y="120.46" width="15" height="10" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="205.57" y="122.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="205.57" y="126.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><text x="157.42" y="146.3489" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="45.15" font-family="sans-serif">Comp3</text></g><!--entity Comp4--><g class="entity" data-qualified-name="Pack1.Comp4" id="ent0004" data-source-line="6"><rect x="262.42" y="115.46" width="85.15" height="44" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/><rect x="327.57" y="120.46" width="15" height="10" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="325.57" y="122.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="325.57" y="126.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><text x="277.42" y="146.3489" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="45.15" font-family="sans-serif">Comp4</text></g><!--entity Comp2--><g class="entity" data-qualified-name="Comp2" id="ent0005" data-source-line="8"><rect x="382.42" y="115.46" width="85.15" height="44" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/><rect x="447.57" y="120.46" width="15" height="10" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="445.57" y="122.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><rect x="445.57" y="126.46" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/><text x="397.42" y="146.3489" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="45.15" font-family="sans-serif">Comp2</text></g><!--link Comp1 to Comp2--><g class="link" data-entity-1="ent0002" data-entity-2="ent0005" id="lnk6" data-source-line="8" data-link-type="association"><path d="M75.97,115.31 C88.54,92.72 111.48,58.99 142.5,44.46 C224.61,6 264.27,6.26 346.5,44.46 C377.73,58.97 401.02,92.71 413.81,115.3" style="stroke:#181818;stroke-width:1;" fill="none" id="Comp1-Comp2"/></g><?plantuml-src AqujKIXEBKWiIYp9BrB8oyzBvIhEpim32UGg52GcPoUcfphb5wMa5Zddvm1LABkv6G015rHA8G186ofKSqKxv-SM6CP2Q6CeRHBBLGkJKT1L0BECOW40?></g></svg>`;
