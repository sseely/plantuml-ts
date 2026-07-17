/**
 * G2 N26 — `-[#color]->`/`-[bold]->`/`-[dashed]->`/`-[dotted]->`/
 * `-[thickness=N]->` inline bracket-modifier overrides for class-diagram
 * relationships (`WithLinkType.applyStyle`/`applyOneStyle`,
 * `decoration/WithLinkType.java:126-166` — the same method
 * `Link extends WithLinkType` and description's `DescriptiveLink` bracket
 * grammar both go through, `CommandLinkClass.java:368`).
 *
 * Three layers, each jar-verified against a real corpus fixture:
 *  - `parseArrowStyleOverrides` (class-arrow-grammar.ts): pure token parse.
 *  - `parseRelationshipLine` (class-relationship-parser.ts): wiring onto
 *    `Relationship.lineStyleOverride`/`.thicknessOverride`/`.colorOverride`.
 *  - `renderFixtureClass` (parse -> layout -> render, real pipeline):
 *    the rendered `<path style="...">` byte-matches
 *    `test-results/dot-cache/class/<slug>/in.svg`'s own edge style string.
 */
import { describe, it, expect } from 'vitest';
import {
  parseArrowStyleOverrides,
} from '../../../src/diagrams/class/class-arrow-grammar.js';
import { parseRelationshipLine } from '../../../src/diagrams/class/class-relationship-parser.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { renderFixtureClass } from '../../oracle/svg-conformance/render-fixture-class.js';

const measurer = new FormulaMeasurer();

// ---------------------------------------------------------------------------
// parseArrowStyleOverrides — pure token parse
// ---------------------------------------------------------------------------

describe('parseArrowStyleOverrides', () => {
  it('returns {} for an arrow with no bracket', () => {
    expect(parseArrowStyleOverrides('-->')).toEqual({});
  });

  it('extracts a bare #color token, stripping the leading #', () => {
    expect(parseArrowStyleOverrides('-[#blue]->')).toEqual({ color: 'blue' });
  });

  it('extracts an uppercase hex color token', () => {
    expect(parseArrowStyleOverrides('-[#FF0000]->')).toEqual({ color: 'FF0000' });
  });

  it('extracts a bracket thickness=N token as a number', () => {
    expect(parseArrowStyleOverrides('-[thickness=5]->')).toEqual({ thickness: 5 });
  });

  it('extracts dashed/dotted/bold keywords as lineStyle', () => {
    expect(parseArrowStyleOverrides('-[dashed]->')).toEqual({ lineStyle: 'dashed' });
    expect(parseArrowStyleOverrides('-[dotted]->')).toEqual({ lineStyle: 'dotted' });
    expect(parseArrowStyleOverrides('-[bold]->')).toEqual({ lineStyle: 'bold' });
  });

  it('composes a color + a style keyword from one comma-separated segment', () => {
    expect(parseArrowStyleOverrides('-[#FF0000,bold]->')).toEqual({
      color: 'FF0000', lineStyle: 'bold',
    });
  });

  it('composes a style keyword + thickness=N from one comma-separated segment', () => {
    expect(parseArrowStyleOverrides('-[dashed,thickness=2]->')).toEqual({
      lineStyle: 'dashed', thickness: 2,
    });
  });

  it('ignores hidden/norank/single/plain/node — never misclassified as color', () => {
    expect(parseArrowStyleOverrides('-[hidden]->')).toEqual({});
    expect(parseArrowStyleOverrides('-[norank]->')).toEqual({});
    expect(parseArrowStyleOverrides('-[single]->')).toEqual({});
    expect(parseArrowStyleOverrides('-[plain]->')).toEqual({});
    expect(parseArrowStyleOverrides('-[node]->')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parseRelationshipLine wiring
// ---------------------------------------------------------------------------

describe('parseRelationshipLine — bracket overrides on Relationship', () => {
  // kipure-14-suli112: `Subscriber "1" -[#blue]-> "1..*" IpSession`.
  it('wires a bare #color bracket onto Relationship.colorOverride', () => {
    const r = parseRelationshipLine('A -[#blue]-> B');
    expect(r).toMatchObject({ colorOverride: 'blue' });
    expect(r?.lineStyleOverride).toBeUndefined();
    expect(r?.thicknessOverride).toBeUndefined();
  });

  // pofebo-79-nape407: `foo -[thickness=N]-> barN`.
  it('wires a thickness=N bracket onto Relationship.thicknessOverride', () => {
    const r = parseRelationshipLine('A -[thickness=8]-> B');
    expect(r).toMatchObject({ thicknessOverride: 8 });
    expect(r?.colorOverride).toBeUndefined();
  });

  // ruzibe-92-doti700: `a <|-[#FF0000,bold]- b`.
  it('wires a color+bold bracket on an extension arrow', () => {
    const r = parseRelationshipLine('A <|-[#FF0000,bold]- B');
    expect(r).toMatchObject({
      type: 'extension', colorOverride: 'FF0000', lineStyleOverride: 'bold',
    });
  });

  // vufuko-05-lapu034: `c1 -[dashed,thickness=2]-> c3`.
  it('wires a dashed+thickness bracket', () => {
    const r = parseRelationshipLine('A -[dashed,thickness=2]-> B');
    expect(r).toMatchObject({ lineStyleOverride: 'dashed', thicknessOverride: 2 });
  });

  it('leaves every override field absent when no bracket is present', () => {
    const r = parseRelationshipLine('A --> B');
    expect(r?.colorOverride).toBeUndefined();
    expect(r?.lineStyleOverride).toBeUndefined();
    expect(r?.thicknessOverride).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// End-to-end render — byte-verified against real oracle SVGs
// ---------------------------------------------------------------------------

describe('renderFixtureClass — bracket overrides reach the rendered <path style>', () => {
  // kipure-14-suli112/in.svg: jar's own `<path style="stroke:#0000FF;
  // stroke-width:1;">` -- this port's `path()` primitive emits the SAME
  // stroke/stroke-width VALUES as separate SVG attributes rather than a
  // combined `style` string (this renderer's own established convention,
  // see `renderer.test.ts`'s identical `stroke-width="1.5"` assertions).
  it('resolves a named #color through HColorSet to its jar hex value', () => {
    const svg = renderFixtureClass(
      `@startuml
class Subscriber
class IpSession
Subscriber -[#blue]-> IpSession
@enduml`,
      measurer,
    );
    expect(svg).toContain('stroke="#0000FF" stroke-width="1"');
  });

  // pofebo-79-nape407/in.svg: thickness=N -> stroke-width:N verbatim
  // (no scaling), the default (no bracket) association stays stroke-width:1.
  it('passes bracket thickness=N straight through as stroke-width', () => {
    const svg = renderFixtureClass(
      `@startuml
class foo
class bar1
class bar2
foo -[thickness=1]-> bar1
foo -[thickness=8]-> bar2
@enduml`,
      measurer,
    );
    expect(svg).toContain('stroke="#181818" stroke-width="1"');
    expect(svg).toContain('stroke="#181818" stroke-width="8"');
  });

  // ruzibe-92-doti700/in.svg: lnk3 `stroke:#FF0000;stroke-width:2;` (bold,
  // no dasharray -- LinkStyle.getStroke3() ignores thickness for BOLD);
  // lnk5 `stroke:#00FF00;stroke-width:1;` (plain is a no-op, base type
  // 'extension' is already undashed).
  it('bold ignores any thickness and never dashes; plain is a pure no-op', () => {
    const svg = renderFixtureClass(
      `@startuml
class a
class b
class c
a <|-[#FF0000,bold]- b
a <|-[#00FF00,plain]- c
@enduml`,
      measurer,
    );
    expect(svg).toContain('stroke="#FF0000" stroke-width="2"');
    expect(svg).not.toMatch(/stroke="#FF0000" stroke-width="2" stroke-dasharray/);
    expect(svg).toContain('stroke="#00FF00" stroke-width="1"');
  });

  // vufuko-05-lapu034/in.svg: lnk4 `stroke-width:1;stroke-dasharray:1,3;`
  // (dotted); lnk5 `stroke-width:2;stroke-dasharray:7,7;` (dashed +
  // explicit thickness=2, overriding the default dashed thickness of 1).
  it('dotted uses a 1,3 dasharray; an explicit thickness overrides dashed default', () => {
    const svg = renderFixtureClass(
      `@startuml
class c1
class c2
class c3
c1 -[dotted]-> c2
c1 -[dashed,thickness=2]-> c3
@enduml`,
      measurer,
    );
    expect(svg).toContain('stroke-dasharray="1,3"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('stroke-dasharray="7,7"');
  });

  it('an edge with no bracket keeps the pre-existing default (solid, width 1)', () => {
    const svg = renderFixtureClass(
      `@startuml
class a
class b
a --> b
@enduml`,
      measurer,
    );
    expect(svg).toContain('stroke="#181818" stroke-width="1"');
    expect(svg).not.toContain('stroke-dasharray');
  });
});
