/**
 * Feature: `renderInitial`/`renderFinal`'s `#color` override scope.
 *
 * mission G4 S11: jar's `CircleStart`/`CircleEnd` apply a `#color` override
 * (`State.color`, `Colors#getColor(BackGroundColor)`) to FILL only -- the
 * stroke stays the pseudostate's own fixed `#222222` default regardless of
 * any override. jar-verified against `ceruzi-77-give569`'s raw SVG: `state
 * start1 <<start>> #Red` renders `fill="#FF0000"` but
 * `style="stroke:#222222;..."` (unchanged); `state end2 <<end>> #Green`
 * renders the inner dot `fill="#008000"` with BOTH ellipses' stroke staying
 * `#222222`. Prior to this fix, `renderInitial`/`renderFinal` both passed
 * `stroke: fill`, coloring the stroke too -- a bug this test guards against.
 */
import { describe, it, expect } from 'vitest';
import { renderInitial, renderFinal } from '../../../src/diagrams/state/renderer-pseudostate.js';
import type { StateNodeGeo } from '../../../src/diagrams/state/state-geo-types.js';

function pseudoNode(kind: 'initial' | 'final', overrides: Partial<StateNodeGeo> = {}): StateNodeGeo {
  return {
    id: 'p1',
    kind,
    display: '',
    x: 0,
    y: 0,
    width: kind === 'initial' ? 20 : 22,
    height: kind === 'initial' ? 20 : 22,
    children: [],
    transitions: [],
    ...overrides,
  };
}

describe('renderInitial', () => {
  it('defaults fill and stroke to the SAME #222222 with no #color override', () => {
    const svg = renderInitial(pseudoNode('initial'));
    expect(svg).toContain('fill="#222222"');
    expect(svg).toContain('stroke="#222222"');
  });

  it('applies a #color override to fill ONLY, stroke stays #222222', () => {
    const svg = renderInitial(pseudoNode('initial', { color: '#Red' }));
    expect(svg).toContain('fill="#FF0000"');
    expect(svg).toContain('stroke="#222222"');
    expect(svg).not.toContain('stroke="#FF0000"');
  });
});

describe('renderFinal', () => {
  it('defaults both ellipses to #222222 stroke with no #color override', () => {
    const svg = renderFinal(pseudoNode('final'));
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('fill="#222222"');
    const strokeCount = svg.split('stroke="#222222"').length - 1;
    expect(strokeCount).toBe(2);
  });

  it('applies a #color override to the inner dot fill ONLY, both strokes stay #222222', () => {
    const svg = renderFinal(pseudoNode('final', { color: '#Green' }));
    expect(svg).toContain('fill="#008000"');
    const strokeCount = svg.split('stroke="#222222"').length - 1;
    expect(strokeCount).toBe(2);
    expect(svg).not.toContain('stroke="#008000"');
  });
});
