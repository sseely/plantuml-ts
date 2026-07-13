/**
 * The error diagram, end to end (SI6).
 *
 * The property under test is the one the three retired divergences were each
 * bending themselves to preserve: **a malformed document still renders.**
 * PlantUML never throws at its caller — it draws the error. Every expectation
 * below was verified against the reference jar
 * (`oracle/dist/plantuml-oracle.jar -tsvg -pipe`).
 *
 * @see src/core/error/PSystemError.ts
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemError.java
 */

import { describe, expect, it } from 'vitest';
import { renderSync, renderAll } from '../../src/index.js';
import { WidthTableMeasurer } from '../../src/core/measurer.js';
import { ERROR_BANNER, WELCOME_MARKER, expectErrorDiagram } from '../helpers/error-diagram.js';

const measurer = new WidthTableMeasurer();
const opts = { measurer };

/** The text content of every `<text>` element, in document order, unescaped. */
function textOf(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>(?:<tspan[^>]*>)?([^<]*)/gu)].map((m) =>
    (m[1] ?? '').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&'),
  );
}

const ORPHAN_ENDIF = '@startuml\nBob -> Alice : hi\n!endif\n@enduml\n';

describe('error diagram — an orphan !endif (jar: "No if related to this endif")', () => {
  it('renders an SVG instead of throwing', () => {
    const svg = renderSync(ORPHAN_ENDIF, opts);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });

  it('reports the jar\'s message', () => {
    expectErrorDiagram(renderSync(ORPHAN_ENDIF, opts), 'No if related to this endif');
  });

  it('locates the failure on the source line that carries it', () => {
    // `!endif` is line 3 (1-based), which is what the jar prints.
    expect(textOf(renderSync(ORPHAN_ENDIF, opts))).toContain('[From string (line 3) ]');
  });

  it('lists the executed source up to and including the offending line', () => {
    const texts = textOf(renderSync(ORPHAN_ENDIF, opts));
    const from = texts.indexOf('[From string (line 3) ]');
    expect(texts.slice(from + 1)).toEqual([
      ' ',
      '@startuml',
      'Bob -> Alice : hi',
      '!endif',
      ' No if related to this endif',
    ]);
  });

  it('waves the offending line in red, and only that line', () => {
    const svg = renderSync(ORPHAN_ENDIF, opts);
    const waved = [...svg.matchAll(/<text[^>]*text-decoration="wavy underline"[^>]*>(?:<tspan>)?([^<]*)/gu)];
    expect(waved.map((m) => m[1])).toEqual(['!endif']);
  });

  it('stacks the Welcome block on a source of fewer than 5 lines', () => {
    expect(renderSync(ORPHAN_ENDIF, opts)).toContain(WELCOME_MARKER);
  });

  it('omits the Welcome block on a longer source, as the jar does', () => {
    const long = [
      '@startuml',
      'Bob -> Alice : hi',
      'Bob -> Alice : hi2',
      'Bob -> Alice : hi3',
      'Bob -> Alice : hi4',
      '!endif',
      '@enduml',
    ].join('\n');
    const svg = renderSync(long, opts);
    expectErrorDiagram(svg, 'No if related to this endif');
    expect(svg).not.toContain(WELCOME_MARKER);
    expect(textOf(svg)).toContain('[From string (line 6) ]');
  });
});

describe('error diagram — a known function called with an uncoverable arity', () => {
  // Jar: `Function not found BOLD`.
  it('renders the error diagram naming the function', () => {
    const source = '@startuml\n!define BOLD(x) <b>##x##</b>\nAlice -> Bob : BOLD(x,y)\n@enduml\n';
    const svg = renderSync(source, opts);
    expectErrorDiagram(svg, 'Function not found BOLD');
    expect(textOf(svg)).toContain('[From string (line 3) ]');
  });
});

describe('error diagram — an unclosed !ifdef is NOT an error', () => {
  it('renders the diagram when the unclosed !ifdef is TRUE', () => {
    const source = '@startuml\n!define FOO\n!ifdef FOO\nAlice -> Bob\n@enduml\n';
    const svg = renderSync(source, opts);
    expect(svg).not.toContain(ERROR_BANNER);
    expect(svg).toContain('Alice');
  });

  it('a FALSE unclosed !ifdef swallows the document — the jar reports it EMPTY, not an if error', () => {
    const svg = renderSync('@startuml\n!ifdef NEVER\nAlice -> Bob\n@enduml\n', opts);
    // Everything after the false !ifdef is suppressed, `@enduml` included, so no
    // block survives -- the jar renders the Welcome screen for that, and says
    // nothing about `!if`.
    expect(svg).toContain(WELCOME_MARKER);
    expect(svg).not.toContain('No if related');
  });
});

describe('error diagram — the render entry points never throw', () => {
  it('renderSync returns an error diagram rather than propagating', () => {
    expect(() => renderSync(ORPHAN_ENDIF, opts)).not.toThrow();
  });

  it('renderAll returns an error diagram rather than propagating', async () => {
    const svgs = await renderAll(ORPHAN_ENDIF, opts);
    expect(svgs).toHaveLength(1);
    expectErrorDiagram(svgs[0]!, 'No if related to this endif');
  });

  it('an unresolvable include is an error diagram naming the path', () => {
    const svg = renderSync('@startuml\n!include missing.puml\n@enduml\n', opts);
    expectErrorDiagram(svg, 'includeStore');
  });
});
