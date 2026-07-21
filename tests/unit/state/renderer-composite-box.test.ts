/**
 * Composite-state box renderer tests — mission G4 S3, mechanism 6.
 * TDD-first, jar-verified byte-for-byte against `bajelo-54-dixe684`'s
 * `Track_FSM` (no body/action lines) and `Track_FSM.Run.Do_Sector` (with
 * 2 action lines) — see `src/diagrams/state/renderer-composite-box.ts`'s
 * own doc comment for the full anatomy this mirrors.
 */
import { describe, it, expect } from 'vitest';
import { renderComposite } from '../../../src/diagrams/state/renderer-composite-box.js';
import type { StateNodeGeo } from '../../../src/diagrams/state/state-geo-types.js';
import { defaultTheme } from '../../../src/core/theme.js';

function makeComposite(overrides: Partial<StateNodeGeo> = {}): StateNodeGeo {
  return {
    id: 'composite1',
    kind: 'normal',
    display: 'Composite',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    children: [
      { id: 'child1', kind: 'normal', display: 'Child', x: 10, y: 40, width: 50, height: 50, children: [], transitions: [] },
    ],
    transitions: [],
    ...overrides,
  };
}

describe('renderComposite — fallback (headerLines undefined)', () => {
  it('renders the pre-mechanism-6 dashed rect + centered label when headerLines is absent', () => {
    const node = makeComposite();
    const out = renderComposite(node, defaultTheme);
    expect(out).toContain('stroke-dasharray="6,3"');
    expect(out).toContain('>Composite<');
    expect(out).not.toContain('<path');
  });
});

describe('renderComposite — measured shape, no body lines (Track_FSM-shape)', () => {
  // jar-verified bajelo-54-dixe684 Track_FSM: x=7,y=86,width=472.4437,
  // height=398, headerLines=[{text:'Track_FSM',width:72.3625}], no body.
  const node = makeComposite({
    id: 'Track_FSM',
    display: 'Track_FSM',
    x: 7,
    y: 86,
    width: 472.4437,
    height: 398,
    children: [],
    headerLines: [{ text: 'Track_FSM', width: 72.3625 }],
  });
  const out = renderComposite(node, defaultTheme);

  it('draws the half-rounded header path first, filled #F1F1F1, no stroke', () => {
    expect(out.indexOf('<path')).toBe(0);
    expect(out).toContain(
      '<path d="M19.5,86 L466.9437,86 A12.5,12.5 0 0 1 479.4437,98.5 L479.4437,110 L7,110 L7,98.5 A12.5,12.5 0 0 1 19.5,86" fill="#F1F1F1"/>',
    );
  });

  it('draws NO action-zone background rect (no body lines)', () => {
    expect(out).not.toContain('stroke-width="1"');
  });

  it('draws a full, solid (never dashed) outline rect after the header path', () => {
    expect(out).toContain(
      '<rect x="7" y="86" width="472.4437" height="398" fill="none" stroke="#181818" stroke-width="0.5" rx="12.5" ry="12.5"/>',
    );
    expect(out).not.toContain('stroke-dasharray');
  });

  it('draws exactly ONE divider line, at the header/body boundary y=110', () => {
    const dividerCount = (out.match(/<line/g) ?? []).length;
    expect(dividerCount).toBe(1);
    expect(out).toContain('<line x1="7" y1="110" x2="479.4437" y2="110" stroke="#181818" stroke-width="0.5"/>');
  });

  it('centers the title text via textLength, matching jar x=207.0406 (unrounded, same convention as the leaf box)', () => {
    expect(out).toContain('textLength="72.3625"');
    expect(out).toContain('>Track_FSM<');
    // x = box midX(243.22185) - textLength/2(36.18125) = 207.0406 (raw
    // float noise, unrounded -- ONLY textLength is javaRound4'd, matching
    // renderer-box.ts's own identical x/y-unrounded convention).
    const expectedX = 7 + 472.4437 / 2 - 72.3625 / 2;
    expect(out).toContain(`x="${expectedX}"`);
  });

  it('draws NO action text (no body lines)', () => {
    // Only the title <text> should be present.
    const textCount = (out.match(/<text/g) ?? []).length;
    expect(textCount).toBe(1);
  });
});

describe('renderComposite — measured shape, WITH body/action lines (Do_Sector-shape)', () => {
  // jar-verified bajelo-54-dixe684 Track_FSM.Run.Do_Sector: x=130.71875,
  // y=252, width=242.5, height=129 (local coords used here for round math),
  // headerLines=[{text:'Do_Sector',width:66.15}], bodyLines = 2 action lines.
  const node = makeComposite({
    id: 'Do_Sector',
    display: 'Do_Sector',
    x: 130.71875,
    y: 252,
    width: 242.5,
    height: 129,
    children: [],
    headerLines: [{ text: 'Do_Sector', width: 66.15 }],
    bodyLines: [
      { text: 'entry / enter_do_sector();', width: 149.1 },
      { text: 'exit / exit_do_sector();', width: 129.7625 },
    ],
  });
  const out = renderComposite(node, defaultTheme);

  it('draws header path, action-zone bg, outline, divider1, divider2, title, action text in that order', () => {
    const order = [
      '<path d="M143.21875,252',
      '<rect x="130.71875" y="276" width="242.5" height="33" fill="#F1F1F1" stroke="#F1F1F1" stroke-width="1"/>',
      '<rect x="130.71875" y="252" width="242.5" height="129" fill="none"',
      '<line x1="130.71875" y1="276" x2="373.21875" y2="276"',
      '<line x1="130.71875" y1="309" x2="373.21875" y2="309"',
      '>Do_Sector<',
      '>entry / enter_do_sector();<',
      '>exit / exit_do_sector();<',
    ];
    let cursor = 0;
    for (const fragment of order) {
      const idx = out.indexOf(fragment, cursor);
      expect(idx, `expected to find ${JSON.stringify(fragment)} after position ${cursor}`).toBeGreaterThanOrEqual(cursor);
      cursor = idx + fragment.length;
    }
  });

  it('draws the action-zone background with fill=stroke=the resolved fill color, stroke-width 1', () => {
    expect(out).toContain('<rect x="130.71875" y="276" width="242.5" height="33" fill="#F1F1F1" stroke="#F1F1F1" stroke-width="1"/>');
  });

  it('draws exactly TWO divider lines (header/body + action-zone bottom)', () => {
    const dividerCount = (out.match(/<line/g) ?? []).length;
    expect(dividerCount).toBe(2);
  });

  it('positions the first action-text baseline at dividerY1 + ascent (NOT dividerY1 + MARGIN_LINE + ascent)', () => {
    // dividerY1 = 252 + MARGIN(5) + 1*14 + MARGIN_LINE(5) = 276.
    // ascent = 14 - 14/4.5 = 10.888888888888889.
    // jar-verified: baseline = 276 + ascent EXACTLY, matching Do_Sector's
    // own y="349.8889" (relative to its real y=315, not this test's y=252,
    // but the SAME dividerY1+ascent formula either way).
    const expectedY = 276 + (14 - 14 / 4.5);
    expect(out).toContain(`y="${expectedY}"`);
  });

  it('left-aligns action text at box.x + MARGIN(5)', () => {
    expect(out).toContain('x="135.71875"');
  });
});

describe('renderComposite — per-node #color override resolves through the header/action fill', () => {
  it('threads a raw #color override into the header path fill and action-zone bg', () => {
    const node = makeComposite({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      headerLines: [{ text: 'X', width: 10 }],
      bodyLines: [{ text: 'y', width: 5 }],
      color: '#red',
    });
    const out = renderComposite(node, defaultTheme);
    expect(out).toContain('fill="#FF0000"');
    expect(out).toContain('stroke="#FF0000" stroke-width="1"');
  });
});
