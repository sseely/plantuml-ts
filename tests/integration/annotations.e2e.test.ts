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

/** The `x` of a chrome slot's own FIRST rendered element (`<rect>` or
 *  `<text>`) inside `<g class="…">` — G1d: `chrome.ts#decorateEntityImage`
 *  now bakes each slot's absolute position directly into its own
 *  `<rect>`/`<text>` coordinates via `coord-shift.ts#shiftFragmentBody`
 *  (mirroring the jar's own `UGraphic.apply(UTranslate)` coordinate-context
 *  threading) rather than wrapping the slot in `<g transform="translate(x,y)">`
 *  — matching jar's own shape (`<g class="title">` never carries a
 *  transform, `test-results/dot-cache/**\/in.svg`). */
function chromeSlotX(svg: string, cls: string): number {
  const re = new RegExp('<g class="' + cls + '"><(?:rect|text)[^>]*\\sx="([\\d.]+)"');
  const m = re.exec(svg);
  if (m === null) throw new Error(`no class="${cls}" chrome slot found in svg`);
  return Number(m[1]);
}

/** Same as {@link chromeSlotX} but for the slot's own first `y`. */
function chromeSlotY(svg: string, cls: string): number {
  const re = new RegExp('<g class="' + cls + '"><(?:rect|text)[^>]*\\sy="([\\d.]+)"');
  const m = re.exec(svg);
  if (m === null) throw new Error(`no class="${cls}" chrome slot found in svg`);
  return Number(m[1]);
}

/** The `x` of an UN-offset `AnnotationBlock.body`'s own first rendered
 *  element — i.e. the block's local (margin.left [+ padding.left, if the
 *  first element is `<text>` rather than a background `<rect>`]) position,
 *  BEFORE `chrome.ts` adds its own (xText,yText) shift. Extracted from the
 *  public `buildAnnotationBlock` output directly (not a hardcoded style
 *  constant) so this stays correct if `BASE_DEFAULTS`'s padding/margin
 *  ever change — same "derive, don't hardcode" rigor the title test
 *  already used for `titleBlock.height`/`titleBlock.width`. */
function localSlotX(body: string): number {
  const m = /<(?:rect|text)[^>]*\sx="([\d.]+)"/.exec(body);
  if (m === null) throw new Error(`no <rect>/<text> x= found in block body: ${body.slice(0, 120)}`);
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
    // G1d: the rendered <text x="..."> is the CHROME offset (xText1) PLUS
    // the title block's own local x (margin.left+padding.left, baked by
    // buildAnnotationBlock BEFORE chrome.ts's shift) -- no longer just
    // xText1 alone, since there is no more `<g transform>` wrapper.
    const titleX = chromeSlotX(titled, 'title');
    const xText1 = (titledDims.width - titleBlock.width) / 2;
    expect(titleX).toBeCloseTo(xText1 + localSlotX(titleBlock.body), 6);
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

    // "Above" -- the legend's own chrome-level Y offset is 0 (chrome.ts's
    // addLegend calls decorateEntityImage(original, slot, null) for TOP,
    // placing it in the text1/"before" position -- see decorateEntityImage's
    // yImage = dim1.height, i.e. the ORIGINAL diagram is pushed down by the
    // legend's height, not vice versa). G1d: the rendered <rect y="..."> is
    // now this SAME 0 chrome-level offset PLUS the legend block's own
    // baked margin.top (BASE_DEFAULTS.legend, margin=12 all sides) --
    // matches the jar snippet cited above (`<rect x="12" y="12" .../>`)
    // exactly, since jar bakes coordinates the same way.
    expect(chromeSlotY(svg, 'legend')).toBe(12);

    // "Left-aligned" -- getTextX's LEFT branch is an unconditional 0
    // (chrome.ts#getTextX) for the chrome-level offset; the rendered
    // <rect x="..."> also carries the legend block's own baked margin.left
    // (12) -- again matching jar's cited `x="12"` exactly.
    expect(chromeSlotX(svg, 'legend')).toBe(12);
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
      // G2 N3: 'Alpha'/'Beta' (not bare 'A'/'B') -- single-letter class
      // names collapse the diagram body well below the footer text's own
      // required width now that EntityImageClass carries no 100px floor
      // (upstream has none), which would make this test exercise an
      // unrelated, pre-existing annotation-chrome-width gap instead of the
      // alignment behavior it targets.
      '@startuml\nleft header MyHeaderText\nright footer MyFooterText\nclass Alpha\nclass Beta\nAlpha --> Beta\n@enduml';
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
    // And NOT flush left / centered. (G2 N3: the class body's own width no
    // longer carries the pre-fix 100px floor -- EntityImageClass has no
    // such minimum upstream -- so the whole canvas is narrower than before;
    // an absolute floor replaces the old `width / 4` relative check, which
    // was tuned to the inflated pre-fix width and no longer holds at this
    // scale.)
    expect(footerX).toBeGreaterThan(10);
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

    // G1d: class="title" now wraps its <text> lines DIRECTLY (no nested
    // `<g transform>` per line), so its own content ends at the FIRST
    // `</g>` after the open tag -- count `<text` within that span.
    const titleGroup = /<g class="title">([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? '';
    const titleTextCount = (titleGroup.match(/<text /g) ?? []).length;
    expect(titleTextCount).toBe(2);
    expect(svg).toContain('>Line One<');
    expect(svg).toContain('>Line Two<');
    expect(svg).toContain('class="caption"');
    expect(svg).toContain('a caption');

    // G1d: title/caption no longer carry a `<g transform>` -- their own
    // baked <text>/<rect> y is chromeSlotY's job now.
    const titleY = chromeSlotY(svg, 'title');
    const captionY = chromeSlotY(svg, 'caption');
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
    // G1c: named colors resolve to their canonical jar hex.
    expect(svg).toContain('fill="#FFFF00"'); // <style> title { BackGroundColor yellow }
    expect(svg).toContain('fill="#008000"'); // <style> legend { BackGroundColor green }
    expect(svg).toContain('fill="#0000FF"'); // <style> footer { BackGroundColor blue }
    expect(svg).toContain('fill="#FF0000"'); // <style> header { BackGroundColor red } (also footer FontColor red)
    expect(svg).toContain('fill="#800080"'); // <style> caption { BackGroundColor purple }

    // G2 N3: body width dropped 112 -> 79 -- EntityImageClass's own width
    // formula lost its pre-fix 100px floor (upstream has none; see
    // `class-layout-helpers.ts#measureGenericClassifier`'s doc comment) --
    // no chrome element here is wider than the (now-narrower) diagram body,
    // so this stays the body's own width; height grows substantially (5
    // stacked chrome bands), unaffected by the width-formula fix.
    // G2 N4: 79 -> 77 -- `degenerateSingleClassifier`'s whole-pixel canvas
    // rounding was `Math.round`, corrected to `Math.floor` (jar-verified
    // with ZERO residual against 7 corpus fixtures whose fractional part
    // is >= 0.5, e.g. `dimile-20-saki799`: `54.575 + 20 = 74.575` -> jar
    // `74`, not `Math.round`'s `75` -- `plans/g2-class-svg/ledger.md` N4).
    // G2 N5: 77 -> 84 -- this fixture has a relationship (`Sally --> Bob`),
    // so it goes through the DOT-driven (non-degenerate) layout path, not
    // `degenerateSingleClassifier`. That path's own document-dimension
    // formula was replaced this iteration (`layout-ink-extent.ts
    // #computeClassDocumentDims`, the `SvekResult`/`TextBlockExporter`/
    // `SvgGraphics#ensureVisible` ink-extent+margin+floor(+1) recipe,
    // jar-verified against 80+ corpus fixtures -- `plans/g2-class-svg/
    // ledger.md` N5) -- this fixture has no jar oracle of its own (a
    // synthetic annotation-chrome corpus fixture), so the new pin is the
    // correct application of the now-verified formula, not an independent
    // guess.
    const { width, height } = dims(svg);
    expect(width).toBe(84);
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
