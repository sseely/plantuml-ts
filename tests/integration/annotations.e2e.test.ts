/**
 * End-to-end pin tests for T7 (mission G0b, batch 3): annotation chrome
 * (title/caption/legend/header/footer) wired through the actual render
 * pipeline (`renderSync`) — `plans/g0b-annotations/batch-3/
 * T7-pipeline-integration.md`'s acceptance criteria, verbatim:
 *
 *  - a sequence diagram's `title` renders centered above, doc height grows
 *    by exactly the title block's own height (T4 math, computed here via
 *    the SAME public `buildAnnotationBlock`/`resolveAnnotationStyles`
 *    T7's pipeline itself calls — not a hardcoded pixel snapshot);
 *  - the mission's named fixture, `buveco-86-tibo673` (a TIM cascade whose
 *    preprocessed content collapses to a single `title Test SVG` line),
 *    renders as a CLASS-typed diagram containing the title text;
 *  - legend/header/footer/caption/multiline-title placement on a class
 *    diagram, each relation cross-checked against a live jar render (jar
 *    snippets cited inline — see each test's comment) but asserted
 *    STRUCTURALLY here (text present, alignment relation, dims grown),
 *    never against a jar pixel value, per this port's own class-engine
 *    geometry (which uses `FormulaMeasurer`, not the jar's AWT metrics).
 *
 * `FormulaMeasurer` is passed explicitly everywhere in this file (rather
 * than letting `renderSync` pick its own default) so every assertion is
 * reproducible across CI environments regardless of `node-canvas`
 * availability — the default-measurer *selection* itself is already
 * covered by other suites (`index.test.ts`), not this file's concern.
 *
 * Annotation-free byte-stability (D5) is NOT re-asserted here as a new
 * mechanism: it is already the existing golden/ratchet suites' job (every
 * pre-T7 test continues to pass with zero golden edits — see this task's
 * final report for the `git stash`-based before/after diff performed
 * during development, 18 corpus fixtures across 6 engines, zero bytes
 * differing except the one deliberately-annotated fixture swapped in to
 * prove the opposite: that chrome DOES apply when present).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../src/index.js';
import { registry } from '../../src/core/dispatcher.js';
import { classPlugin } from '../../src/diagrams/class/index.js';
import { buildBlockUmls } from '../../src/core/BlockUmlBuilder.js';
import { FormulaMeasurer } from '../../src/core/measurer.js';
import { resolveTheme } from '../../src/core/theme.js';
import { buildAnnotationBlock } from '../../src/core/annotations/index.js';
import { resolveAnnotationStyles } from '../../src/core/annotations/style.js';
import { parseStyleBlock } from '../../src/core/skinparam.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MEASURER = new FormulaMeasurer();

/** Pulls `width="…" height="…"` off an assembled `<svg>` root — every
 *  engine but description routes through the shared `svgRoot` (T3), which
 *  always emits these two attributes first, in this order (bare numbers,
 *  no unit suffix). The annotated-description (klimt-shell, G1 I1) root
 *  matches the jar's OWN convention instead -- a `px` suffix
 *  (`width="401px"`, `test-results/dot-cache/component/balopu-66-jagu236/
 *  in.svg`) -- so the trailing `(?:px)?` tolerates either. */
function dims(svg: string): { width: number; height: number } {
  const m = /width="([\d.]+)(?:px)?" height="([\d.]+)(?:px)?"/.exec(svg);
  if (m === null) throw new Error(`no width/height attributes found in: ${svg.slice(0, 120)}`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** The `x` of a chrome slot's OWN `<g transform="translate(x,y)" class="…">`
 *  wrapper (chrome.ts's `decorateEntityImage` — see that module's doc
 *  comment for why the DOM nests `<g transform>` rather than baking
 *  absolute coordinates into `<text>`, a mechanism-only divergence from
 *  the jar). */
function chromeSlotX(svg: string, cls: string): number {
  const re = new RegExp('<g transform="translate\\(([\\d.]+),[\\d.]+\\)" class="' + cls + '"');
  const m = re.exec(svg);
  if (m === null) throw new Error(`no class="${cls}" chrome slot found in svg`);
  return Number(m[1]);
}

describe('T7 pipeline integration — annotation chrome end to end', () => {
  // ---------------------------------------------------------------------------
  // T7 bug find (src/core/annotations/style.ts#applyStyleOverrides):
  // `<style>` selectors nested under `document { <element> { ... } } }` --
  // the ACTUAL syntax upstream fixtures use for chrome overrides (D6/D7's
  // own doc comment names the upstream signature `root,document,<element>`;
  // `parseStyleBlock`'s dot-joined stack for that block shape is literally
  // "document.<element>") -- were silently ignored: `applyStyleOverrides`
  // only ever checked the BARE `<element>` key, never `document.<element>`.
  // Jar-verified against `tests/corpus/class/A0005_Test.puml`'s own
  // `document { title { BackGroundColor yellow } } }` block: the jar's SVG
  // contains `fill="#FFFF00"` on the title rect -- so this is a real
  // pre-existing behavior gap, not a preference. Failing-test-first proof:
  // this test fails against the pre-fix `applyStyleOverrides` (bare-only)
  // and passes once it also checks `document.<element>`.
  it('resolveAnnotationStyles: document{ title {...} } nested selector applies (bug fix, jar-verified)', () => {
    const styleMap = parseStyleBlock('document { title { BackGroundColor yellow } }');
    const theme = resolveTheme('default');
    const styles = resolveAnnotationStyles(theme, new Map(), styleMap);
    expect(styles.title.backgroundColor).toBe('yellow');
  });

  it('sequence: title centers above the diagram; doc height grows by exactly the title block height (T4 math)', () => {
    const plain = renderSync('@startuml\nAlice -> Bob : hi\n@enduml', { measurer: MEASURER });
    const titled = renderSync('@startuml\ntitle Hello\nAlice -> Bob : hi\n@enduml', { measurer: MEASURER });

    expect(titled).toContain('class="title"');
    expect(titled).toContain('>Hello<');

    const plainDims = dims(plain);
    const titledDims = dims(titled);

    // Width is unaffected -- "Hello" is narrower than the sequence body.
    expect(titledDims.width).toBe(plainDims.width);

    // Height grows by EXACTLY the title block's own reported height --
    // the same `buildAnnotationBlock` call T7's `applyChrome` makes
    // internally (src/core/annotations/chrome.ts#addTitle), computed here
    // independently via the public API rather than a hardcoded constant.
    const theme = resolveTheme('default');
    const styles = resolveAnnotationStyles(theme, new Map(), new Map());
    const titleBlock = buildAnnotationBlock('title', ['Hello'], styles.title, MEASURER);
    expect(titledDims.height).toBeCloseTo(plainDims.height + titleBlock.height, 6);

    // Title is horizontally centered over the FINAL (post-chrome) width --
    // D8: title is forced CENTER regardless of any stored alignment.
    const titleX = chromeSlotX(titled, 'title');
    expect(titleX).toBeCloseTo((titledDims.width - titleBlock.width) / 2, 6);
  });

  it("buveco-86-tibo673: TIM cascade collapsing to a bare 'title Test SVG' line renders a CLASS-typed diagram containing the title", () => {
    const source = readFileSync(
      join(REPO_ROOT, 'tests/corpus/sequence/buveco-86-tibo673.puml'),
      'utf-8',
    );

    // Mission's own routing assertion (SI7 default: an @startuml block with
    // no diagram-specific content falls back to the CLASS plugin, not
    // sequence) -- resolved the SAME way renderSync resolves it internally.
    const blocks = buildBlockUmls(source);
    const first = blocks[0]!;
    if (!first.ok) throw new Error('expected a valid block');
    const umlSource = { ...first.source, rawStyles: first.preprocessed.styles };
    expect(registry.resolve(umlSource)).toBe(classPlugin);

    const svg = renderSync(source, { measurer: MEASURER });
    expect(svg).toContain('Test SVG');
    expect(svg).toContain('class="title"');

    const { width, height } = dims(svg);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Class-diagram chrome placement — each relation jar-verified (snippets
  // below), asserted structurally against this port's own FormulaMeasurer
  // geometry (see file doc comment for why pixel values are not compared).
  // -------------------------------------------------------------------------

  it('legend "top left": legend renders ABOVE the diagram body, left-aligned', () => {
    // Jar (`legend top left` / `a legend` / `end legend`, class A/B):
    //   <g class="legend" ...><rect x="12" y="12" .../>...  -- first child
    //   of the document's content <g>, i.e. drawn BEFORE the class boxes,
    //   x close to the canvas's own left edge (VerticalAlignment.TOP +
    //   HorizontalAlignment.LEFT).
    const source =
      '@startuml\nlegend top left\n  a legend\nend legend\nclass A\nclass B\nA --> B\n@enduml';
    const svg = renderSync(source, { measurer: MEASURER });

    expect(svg).toContain('class="legend"');
    expect(svg).toContain('a legend');

    // "Above" -- the legend slot's own translate() Y is 0 (chrome.ts's
    // addLegend calls decorateEntityImage(original, slot, null) for TOP,
    // placing it in the text1/"before" position -- see decorateEntityImage's
    // yImage = dim1.height, i.e. the ORIGINAL diagram is pushed down by the
    // legend's height, not vice versa).
    const legendY = /<g transform="translate\([\d.]+,([\d.]+)\)" class="legend"/.exec(svg)?.[1];
    expect(legendY).toBe('0');

    // "Left-aligned" -- getTextX's LEFT branch is an unconditional 0
    // (chrome.ts#getTextX), independent of measurer -- exact match with
    // the jar's own left-aligned case.
    expect(chromeSlotX(svg, 'legend')).toBe(0);
  });

  it('header "left" flush left, footer "right" flush right (D8 explicit-alignment paths)', () => {
    // Jar (`left header MyHeaderText` / `right footer MyFooterText`):
    //   header <text x="0" .../>MyHeaderText  -- explicit LEFT -> x=0.
    //   footer <text x="3.3496" .../>MyFooterText, canvas width 77,
    //   footer textLength 66.6553 -- right edge (x+width) sits near the
    //   canvas's own right edge, i.e. right-ALIGNED (not left, not
    //   centered) -- the relation this test pins, not the pixel value
    //   (this port's FormulaMeasurer sizes "MyFooterText" differently than
    //   the jar's AWT metrics, so the absolute numbers differ; see file
    //   doc comment).
    const source =
      '@startuml\nleft header MyHeaderText\nright footer MyFooterText\nclass A\nclass B\nA --> B\n@enduml';
    const svg = renderSync(source, { measurer: MEASURER });

    expect(chromeSlotX(svg, 'header')).toBe(0);

    const { width } = dims(svg);
    const footerX = chromeSlotX(svg, 'footer');
    const footerTextWidth = MEASURER.measure('MyFooterText', {
      family: 'SansSerif',
      size: 10,
      weight: 'normal',
      style: 'normal',
    }).width;
    // Right-aligned: slot's right edge lands at (or within a couple px of,
    // rounding on the FormulaMeasurer's own width vs. buildAnnotationBlock's
    // padding/margin composition) the document's own width (getTextX RIGHT
    // branch: dimTotal.width - dimText.width).
    expect(Math.abs(footerX + footerTextWidth - width)).toBeLessThan(2);
    // And NOT flush left / centered.
    expect(footerX).toBeGreaterThan(width / 4);
  });

  it('multiline title (two lines via \\n) renders two centered text lines; caption renders below the diagram', () => {
    // Jar (`title Line One\nLine Two` / `caption a caption`):
    //   class="title" contains TWO <text> elements (one per line), each
    //   independently horizontally centered within the title block; y of
    //   the second line's baseline (40.0234) > the first's (23.5352).
    //   class="caption" sits at a LARGER y than the title/diagram block
    //   (bottom placement -- addCaption uses decorateEntityImage(original,
    //   null, slot), the text2/"after" position).
    const source =
      '@startuml\ntitle Line One\\nLine Two\ncaption a caption\nclass A\nclass B\nA --> B\n@enduml';
    const svg = renderSync(source, { measurer: MEASURER });

    const titleTextCount = (svg.match(/class="title"[\s\S]*?<\/g><\/g>/)?.[0].match(/<text /g) ?? [])
      .length;
    expect(titleTextCount).toBe(2);
    expect(svg).toContain('>Line One<');
    expect(svg).toContain('>Line Two<');
    expect(svg).toContain('class="caption"');
    expect(svg).toContain('a caption');

    const titleY = Number(
      /<g transform="translate\([\d.]+,([\d.]+)\)" class="title"/.exec(svg)?.[1],
    );
    const captionY = Number(
      /<g transform="translate\([\d.]+,([\d.]+)\)" class="caption"/.exec(svg)?.[1],
    );
    expect(captionY).toBeGreaterThan(titleY);
  });

  it('real corpus fixture (A0005_Test): all five chrome elements together, <style>-overridden colors intact', () => {
    // tests/corpus/class/A0005_Test.puml: bare `title title` / `legend
    // legend` / `footer footer` / `header header` / `caption caption`
    // (no explicit left|right|center prefix on ANY of them -- exercises
    // D8's STYLE-DEFAULT alignment path: header defaults RIGHT, footer
    // defaults CENTER, both resolved from `styles.header`/`styles.footer`
    // at draw time, not stored on the parsed DisplayPositioned), plus a
    // `<style>` block giving each element its own BackGroundColor.
    const source = readFileSync(join(REPO_ROOT, 'tests/corpus/class/A0005_Test.puml'), 'utf-8');

    // Byte-stability control: this fixture legitimately carries chrome
    // (title/legend/footer/header/caption all present) -- its output is
    // EXPECTED to differ from a pre-T7 render (which drew none of it) and
    // is exactly what this test pins, not a byte-stability violation. The
    // git-stash-verified byte-stability check (file doc comment) used a
    // different, annotation-free fixture instead.
    const svg = renderSync(source, { measurer: MEASURER });

    for (const cls of ['title', 'legend', 'footer', 'header', 'caption']) {
      expect(svg).toContain(`class="${cls}"`);
    }
    expect(svg).toContain('fill="yellow"'); // <style> title { BackGroundColor yellow }
    expect(svg).toContain('fill="green"'); // <style> legend { BackGroundColor green }
    expect(svg).toContain('fill="blue"'); // <style> footer { BackGroundColor blue }
    expect(svg).toContain('fill="red"'); // <style> header { BackGroundColor red } (also footer FontColor red)
    expect(svg).toContain('fill="purple"'); // <style> caption { BackGroundColor purple }

    // Width unaffected (no chrome element here is wider than the diagram
    // body); height grows substantially (5 stacked chrome bands).
    const { width, height } = dims(svg);
    expect(width).toBe(112);
    expect(height).toBeGreaterThan(250);
  });

  it('description engine (component diagram): title renders via the klimt unwrap+rewrap path (D2b)', () => {
    // T7 decision D2b: klimt (description engine) always emits a complete
    // `<svg>` document (no fragment-without-document mode -- see
    // `unwrapKlimtSvg`'s doc comment in src/diagrams/description/
    // renderer.ts for the full rationale). This test is the wiring proof:
    // a titled component diagram must show its title, the klimt entity
    // content must survive the unwrap/rewrap round-trip intact, and the
    // final canvas must be taller than the UN-chromed diagram alone.
    const untitled = renderSync('@startuml\ncomponent A\ncomponent B\nA --> B\n@enduml', {
      measurer: MEASURER,
    });
    const titled = renderSync(
      '@startuml\ntitle My Component Diagram\ncomponent A\ncomponent B\nA --> B\n@enduml',
      { measurer: MEASURER },
    );

    expect(titled).toContain('class="title"');
    expect(titled).toContain('My Component Diagram');
    // klimt content (entity groups) survives the unwrap -- not swallowed
    // or duplicated.
    expect((titled.match(/class="entity"/g) ?? []).length).toBe(
      (untitled.match(/class="entity"/g) ?? []).length,
    );

    const untitledDims = dims(untitled);
    const titledDims = dims(titled);
    expect(titledDims.height).toBeGreaterThan(untitledDims.height);
  });
});
