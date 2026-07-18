/**
 * G2 N33 — collapsed-empty `package`/`namespace` leaf (`class-magma.ts
 * #isCollapsedGroup`) draws its OWN small `EntityImageEmptyPackage`
 * folder-tab icon instead of the generic classifier box. Jar-verified
 * against `gatula-10-bifu561` (`package foo {}` / `namespace bar {}` /
 * `class qux {}`): geometry (39.425x48 for "foo"), color (classifier-box
 * defaults, NOT the package-cluster's own `packageBorderColor`), and
 * unwrapped draw structure (`<path>`/`<line>`/`<text>` siblings, no
 * `<g class="entity">`).
 */
import { describe, it, expect } from 'vitest';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { defaultTheme } from '../../../src/core/theme.js';
import {
  measureEmptyPackageLeafDim,
  renderEmptyPackageIcon,
} from '../../../src/diagrams/class/class-namespace-shape.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { renderFixtureClass } from '../../oracle/svg-conformance/render-fixture-class.js';

const measurer = new WidthTableMeasurer();
const detMeasurer = new DeterministicMeasurer();

describe('measureEmptyPackageLeafDim', () => {
  it('is rawTextWidth+20 x 2*rawTextHeight+20 for "foo" at 14pt (jar: 39.425x48)', () => {
    const dim = measureEmptyPackageLeafDim(measurer, defaultTheme, 'foo');
    expect(dim.width).toBeCloseTo(39.425, 3);
    expect(dim.height).toBe(48);
  });

  it('shares the SAME wtitle/htitle formula as a non-empty package cluster', () => {
    const dim = measureEmptyPackageLeafDim(measurer, defaultTheme, 'foo');
    expect(dim.wtitle).toBeCloseTo(25.425, 3);
    expect(dim.htitle).toBe(20);
  });
});

describe('renderEmptyPackageIcon', () => {
  it('draws classifier-box default colors (#181818/0.5/classBackground), not package-cluster colors', () => {
    const dim = measureEmptyPackageLeafDim(measurer, defaultTheme, 'foo');
    const svg = renderEmptyPackageIcon(
      { id: 'foo', x: 6, y: 7, label: 'foo', ...dim },
      defaultTheme,
    );
    expect(svg).toContain(`stroke="${defaultTheme.colors.border}"`);
    expect(svg).toContain('stroke-width="0.5"');
    expect(svg).toContain(`fill="${defaultTheme.colors.graph.classBackground}"`);
  });

  it('draws NO <g> wrapper (plain path+line+text siblings)', () => {
    const dim = measureEmptyPackageLeafDim(measurer, defaultTheme, 'foo');
    const svg = renderEmptyPackageIcon(
      { id: 'foo', x: 6, y: 7, label: 'foo', ...dim },
      defaultTheme,
    );
    expect(svg).not.toContain('<g');
    expect(svg).toContain('<path');
    expect(svg).toContain('<line');
    expect(svg).toContain('<text');
  });
});

describe('renderFixtureClass — gatula-10-bifu561 end-to-end', () => {
  it('an empty package/namespace draws unwrapped; a real classifier still wraps', () => {
    const svg = renderFixtureClass(
      `@startuml
package foo {
}

namespace bar {
}

class qux {}
@enduml`,
      detMeasurer,
    );
    // qux (real classifier) still gets the normal <g class="entity"> wrap.
    expect(svg).toContain('<!--class qux--><g class="entity"');
    // foo/bar (collapsed-empty) do not -- no comment, no wrapper, matching
    // jar's own bare-sibling structure (module doc comment above).
    expect(svg).not.toContain('<!--class foo-->');
    expect(svg).not.toContain('<!--class bar-->');
  });
});
