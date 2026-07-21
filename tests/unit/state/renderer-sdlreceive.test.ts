import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import { layoutState } from '../../../src/diagrams/state/layout.js';
import { renderState } from '../../../src/diagrams/state/renderer.js';
import { resolveTheme } from '../../../src/core/theme.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

/**
 * Mission G4 S14 (`<<sdlreceive>>` folded-frame shape, `EntityImageState2`/
 * `USymbolFrame`): unwrapped `<rect>`+`<path>`+`<text>` siblings (no `<g>`
 * wrap, matching fork/join/history's existing unwrapped precedent) --
 * jar-verified byte-exact against `cekolo-21-gini183`'s own sdlreceive node.
 * @see plans/g4-state-svg/ledger.md (S14)
 */

function parse(source: string) {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

describe('<<sdlreceive>> folded-frame shape (mission G4 S14)', () => {
  const theme = resolveTheme('default');
  const measurer = new DeterministicMeasurer();

  function render(src: string): string {
    const ast = parse(src);
    const geo = layoutState(ast, theme, measurer);
    return renderState(geo, theme).body;
  }

  it('renders NO <g class="entity"> wrap around the sdlreceive box (unwrapped, like fork/join)', () => {
    const svg = render('state sdlreceive <<sdlreceive>>');
    expect(svg).not.toContain('class="entity"');
  });

  it('renders a <rect> with rx/ry=12.5 (same rounding as a normal box)', () => {
    const svg = render('state sdlreceive <<sdlreceive>>');
    expect(svg).toMatch(/<rect[^>]*rx="12\.5"[^>]*ry="12\.5"/);
  });

  it('renders exactly one fold-notch <path> with fill="none"', () => {
    const svg = render('state sdlreceive <<sdlreceive>>');
    const matches = svg.match(/<path[^>]*\/>/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(matches[0]).toContain('fill="none"');
  });

  it('the fold-notch path geometry matches USymbolFrame#drawFrame (textWidth=width/3, cornersize=7, textHeight=12)', () => {
    const svg = render('state sdlreceive <<sdlreceive>>');
    const rectMatch = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/.exec(svg);
    expect(rectMatch).not.toBeNull();
    const x = Number(rectMatch![1]);
    const y = Number(rectMatch![2]);
    const width = Number(rectMatch![3]);
    const textWidth = width / 3;
    const expectedD =
      `M${x + textWidth},${y} L${x + textWidth},${y + 5} ` + `L${x + textWidth - 7},${y + 12} L${x},${y + 12}`;
    expect(svg).toContain(`d="${expectedD}"`);
  });

  it('label position is top-left anchored (x=box.x+21, y=box.y+20+ascent), NOT centered', () => {
    const svg = render('state sdlreceive <<sdlreceive>>');
    const rectMatch = /<rect x="([\d.]+)" y="([\d.]+)"/.exec(svg);
    const x = Number(rectMatch![1]);
    const y = Number(rectMatch![2]);
    const textMatch = /<text x="([\d.]+)" y="([\d.]+)"/.exec(svg);
    expect(textMatch).not.toBeNull();
    // SDL_MARGIN.x1(15) + BODY_MARGIN_X(6) = 21; SDL_MARGIN.y1(20) + ascent(10.8889).
    expect(Number(textMatch![1])).toBeCloseTo(x + 21, 5);
    expect(Number(textMatch![2])).toBeCloseTo(y + 20 + 10.8889, 3);
  });

});
