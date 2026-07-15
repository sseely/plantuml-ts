/**
 * Unit tests for `computeInkShift` (G1b/J1, mechanism C) — the
 * `SvekResult#calculateDimension`/`moveDelta` ink-extent document margin
 * that replaced the flat `LAYOUT_MARGIN_LEADING` node-box margin
 * (`layout-ink-shift.ts`'s own doc comment has the full jar citation
 * trail and the closed X/Y formula this pins).
 *
 * `node.width`/`node.height` are NOT read by `drawEntity` beyond the
 * `(node.x, node.y)` translate (`renderer-entity.ts#drawEntity` — the
 * drawn image is always the shape's OWN natural size, no box-width
 * centering), so these tests use arbitrary width/height values without
 * affecting the ink-derived shift.
 */
import { describe, it, expect } from 'vitest';
import { computeInkShift } from '../../../src/diagrams/description/layout-ink-shift.js';
import type { DescriptionNodeGeo } from '../../../src/diagrams/description/layout-helpers.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();

function rectLeaf(id: string, x: number, y: number): DescriptionNodeGeo {
  return { id, symbol: 'component', display: id, x, y, width: 80, height: 40, children: [] };
}

// Display MUST stay narrower than the stickman's own natural width (~26px)
// -- `USymbolSimpleAbstract#asSmall` (decoration/symbol/USymbolSimpleAbstract.ts)
// horizontally CENTERS the stickman within max(stickman, label, stereotype)
// width; a WIDER label would make the label (not the stickman) the ink-left
// binding element, defeating these tests' point (isolating the stickman's
// OWN `thickness()`-derived ink offset, not the unrelated label-centering
// composition upstream already faithfully ports). A single-char display
// (`'A'`/`'a'`) is always narrower than 26px at any realistic font size.
function actorLeaf(id: string, x: number, y: number): DescriptionNodeGeo {
  return { id, symbol: 'actor', display: 'A', x, y, width: 27, height: 60, children: [] };
}

describe('computeInkShift — mechanism C ink-extent margin', () => {
  it('anchors a single rect-shaped leaf at box (7,7): LimitFinder#drawRectangle\'s ' +
    '-1 min-corner inset means box.x - 1 = 6 (the jar-forced ink constant), so ' +
    'box.x = 7 -- same value the OLD flat LAYOUT_MARGIN_LEADING=7 margin used, ' +
    'proving the fix is a no-op for the rect-topmost case (ledger.md I7).', () => {
    const node = rectLeaf('a', 0, 0);
    const { dx, dy } = computeInkShift([node], [], defaultTheme, measurer, undefined);
    expect(dx).toBeCloseTo(7, 6);
    expect(dy).toBeCloseTo(7, 6);
  });

  it('anchors a single actor leaf at box (5.5,5.5): ActorStickMan draws its head ' +
    'ellipse (no LimitFinder inset) at local y=thickness()=0.5 and the body path\'s ' +
    'leftmost local x also resolves to thickness()=0.5 from centerX -- box.x/y = ' +
    '6 - 0.5 = 5.5 on BOTH axes (jar-verified: component/zanibo-14-sami874\'s ' +
    'actor ellipse cy=14 -> box top 14-8-0.5=5.5; ratchet-pinned this iteration).', () => {
    const node = actorLeaf('emp', 0, 0);
    const { dx, dy } = computeInkShift([node], [], defaultTheme, measurer, undefined);
    expect(dx).toBeCloseTo(5.5, 6);
    expect(dy).toBeCloseTo(5.5, 6);
  });

  it('picks the GLOBAL per-axis minimum across independent entities, not one ' +
    'entity\'s own offset on both axes -- X and Y need not share a binding shape ' +
    '(mirrors jar\'s own MinMax#getMinX()/getMinY(), independent per-axis ' +
    'reductions over the same addPoint stream, per this module\'s doc comment).', () => {
    // Rect at raw (0,10): ink-min-x = 0-1=-1, ink-min-y = 10-1=9.
    // Actor at raw (20,0): ink-min-x = 20+0.5=20.5, ink-min-y = 0+0.5=0.5.
    // Global ink-min-x = -1 (rect) -> dx = 6-(-1) = 7.
    // Global ink-min-y = 0.5 (actor) -> dy = 6-0.5 = 5.5.
    const rect = rectLeaf('r', 0, 10);
    const actor = actorLeaf('a', 20, 0);
    const { dx, dy } = computeInkShift([rect, actor], [], defaultTheme, measurer, undefined);
    expect(dx).toBeCloseTo(7, 6);
    expect(dy).toBeCloseTo(5.5, 6);
  });

  it('shifts a non-zero raw position by the same delta (translation-additive: the ' +
    'ink walk measures the ACTUAL raw position, not just a fixed per-shape offset ' +
    'from an assumed (0,0) origin).', () => {
    const node = rectLeaf('a', 12, 34);
    const { dx, dy } = computeInkShift([node], [], defaultTheme, measurer, undefined);
    // ink-min-x = 12-1=11 -> dx = 6-11 = -5; ink-min-y = 34-1=33 -> dy = 6-33 = -27.
    expect(dx).toBeCloseTo(-5, 6);
    expect(dy).toBeCloseTo(-27, 6);
  });
});
