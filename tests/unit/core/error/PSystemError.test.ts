/**
 * The error-diagram TEXT model — upstream's `PSystemError` methods, tested
 * directly (the SVG that draws them is pinned end-to-end in
 * `tests/integration/error-diagram.test.ts`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemError.java
 */

import { describe, expect, it } from 'vitest';
import { ErrorUml } from '../../../../src/core/error/ErrorUml.js';
import { PSystemErrorEmpty } from '../../../../src/core/error/PSystemErrorEmpty.js';
import { PSystemErrorPreprocessor } from '../../../../src/core/error/PSystemErrorPreprocessor.js';
import { PSystemErrorV2 } from '../../../../src/core/error/PSystemErrorV2.js';
import { PSystemUnsupported } from '../../../../src/core/error/PSystemUnsupported.js';
import { PSystemWelcome } from '../../../../src/core/error/PSystemWelcome.js';
import { buildV2, merge } from '../../../../src/core/error/PSystemErrorUtils.js';
import { umlSourceOf } from '../../../../src/core/error/UmlSource.js';
import {
  renderPSystemError,
  renderPSystemUnsupported,
} from '../../../../src/core/error/error-renderer.js';
import { WidthTableMeasurer } from '../../../../src/core/measurer.js';
import { readLines } from '../../../../src/core/tim/ReadLineReader.js';
import { LineLocationImpl } from '../../../../src/core/tim/LineLocationImpl.js';
import { StringLocated } from '../../../../src/core/tim/StringLocated.js';

const measurer = new WidthTableMeasurer();

/** A source and a trace that fails on its last line, as `TimLoader#load` leaves them. */
function failing(source: string, message: string): PSystemErrorPreprocessor {
  const input = readLines(source);
  const trace = [...input];
  trace[trace.length - 1] = trace[trace.length - 1]!.withErrorPreprocessor(message);
  return new PSystemErrorPreprocessor(umlSourceOf(input), trace);
}

describe('PSystemErrorPreprocessor', () => {
  it('takes its message off the trace line marked by withErrorPreprocessor', () => {
    const system = failing('@startuml\n!endif', 'No if related to this endif');
    expect(system.getFirstError().getError()).toBe('No if related to this endif');
  });

  it('prints the 1-based line number of the 0-based location', () => {
    const system = failing('@startuml\nA -> B\n!endif', 'No if related to this endif');
    expect(system.getTextFromStack()).toEqual(['[From string (line 3) ]']);
  });

  it('lists a leading blank line, then every executed line', () => {
    const system = failing('@startuml\nA -> B\n!endif', 'boom');
    expect(system.getTextFullBody()).toEqual([' ', '@startuml', 'A -> B', '!endif']);
  });

  it('indents the message by one space, as upstream does', () => {
    expect(failing('@startuml\n!endif', 'boom').getTextError()).toEqual([' boom']);
  });

  it('describes itself as (Error)', () => {
    expect(failing('@startuml\n!endif', 'boom').getDescription()).toBe('(Error)');
  });

  it('walks the include stack, innermost first', () => {
    const outer = new LineLocationImpl('string', undefined).oneLineRead().oneLineRead();
    const inner = new LineLocationImpl('shared.iuml', outer).oneLineRead();
    const trace = [new StringLocated('!endif', inner).withErrorPreprocessor('boom')];
    const system = new PSystemErrorPreprocessor(readLines('@startuml\n@enduml'), trace);
    expect(system.getTextFromStack()).toEqual([
      '[From shared.iuml (line 1) ]',
      '[From string (line 2) ]',
    ]);
  });
});

describe('PSystemError — the source listing is truncated past 40 lines', () => {
  it('prints the first 5, a skip marker, and the last 20', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line${String(i)}`);
    const trace = lines.map((s, i) => new StringLocated(s, new LineLocationImpl('string', undefined, i)));
    const error = new ErrorUml('SYNTAX_ERROR', 'boom', 0, trace[49]);
    const body = new PSystemErrorV2(trace, trace, error).getTextFullBody();
    expect(body[0]).toBe(' ');
    expect(body.slice(1, 6)).toEqual(['line0', 'line1', 'line2', 'line3', 'line4']);
    expect(body.slice(6, 9)).toEqual(['...', '... ( skipping 25 lines )', '...']);
    expect(body.slice(9)).toEqual(lines.slice(30));
  });

  it('truncates any single line past 120 characters', () => {
    const long = 'x'.repeat(130);
    const trace = [new StringLocated(long, new LineLocationImpl('string', undefined, 0))];
    const system = new PSystemErrorV2(trace, trace, new ErrorUml('SYNTAX_ERROR', 'boom'));
    expect(system.getTextFullBody()[1]).toBe(`${'x'.repeat(120)} ...`);
  });
});

describe('ErrorUml', () => {
  it('appends the assumed diagram type to the message, as the jar does', () => {
    const error = new ErrorUml('SYNTAX_ERROR', 'Syntax Error?', 0, undefined, 'sequence');
    expect(error.getError()).toBe('Syntax Error? (Assumed diagram type: sequence)');
  });

  it('reports position 0 when it has no line', () => {
    expect(new ErrorUml('EXECUTION_ERROR', 'boom').getPosition()).toBe(0);
  });

  it('reports the 0-based position of its line', () => {
    const line = new StringLocated('!endif', new LineLocationImpl('string', undefined, 4));
    expect(new ErrorUml('SYNTAX_ERROR', 'boom', 0, line).getPosition()).toBe(4);
  });
});

describe('PSystemErrorUtils — the error that got FURTHEST wins', () => {
  it('merge picks the highest score (trace length x 10 + the error score)', () => {
    const short = readLines('@startuml\nA');
    const long = readLines('@startuml\nA\nB\nC');
    const a = buildV2(short, new ErrorUml('SYNTAX_ERROR', 'shallow'), short);
    const b = buildV2(long, new ErrorUml('SYNTAX_ERROR', 'deep'), long);
    expect(a.score()).toBeLessThan(b.score());
    expect(merge([a, b]).getFirstError().getError()).toBe('deep');
  });

  it('merge of nothing is a programmer error, not a silent undefined', () => {
    expect(() => merge([])).toThrow('no error to merge');
  });
});

describe('UmlSource — the @start…@end slice decides whether Welcome is shown', () => {
  it('slices the block out of the raw input, dropping a trailing newline', () => {
    // 4 real lines + the '' a trailing "\n" splits into. Counting that '' would
    // push the source to 5 and silently drop the Welcome block.
    const sliced = umlSourceOf(readLines('@startuml\nA -> B\n!endif\n@enduml\n'));
    expect(sliced.map((s) => s.getString())).toEqual([
      '@startuml',
      'A -> B',
      '!endif',
      '@enduml',
    ]);
  });

  it('keeps everything when there is no @start at all', () => {
    expect(umlSourceOf(readLines('just text')).map((s) => s.getString())).toEqual(['just text']);
  });

  it('a 4-line source gets the Welcome block; a 5-line one does not', () => {
    expect(failing('@startuml\nA -> B\n!endif\n@enduml', 'boom').getTotalLineCountLessThan5()).toBe(
      true,
    );
    expect(
      failing('@startuml\nA -> B\nC -> D\n!endif\n@enduml', 'boom').getTotalLineCountLessThan5(),
    ).toBe(false);
  });
});

describe('PSystemErrorEmpty / PSystemErrorV2', () => {
  it('PSystemErrorEmpty carries its ErrorUml through', () => {
    const trace = readLines('@startuml');
    const system = new PSystemErrorEmpty(trace, trace, new ErrorUml('EXECUTION_ERROR', 'Empty description'));
    expect(system.getTextError()).toEqual([' Empty description']);
    expect(system.getErrorsUml()).toHaveLength(1);
  });

  it('PSystemErrorV2 keeps the root cause for the caller', () => {
    const trace = readLines('@startuml');
    const cause = new TypeError('boom');
    const system = new PSystemErrorV2(trace, trace, new ErrorUml('EXECUTION_ERROR', 'boom'), cause);
    expect(system.getRootCause()).toBe(cause);
  });
});

describe('the rendered SVG', () => {
  it('draws the message in red and the listing in the error-diagram green', () => {
    const svg = renderPSystemError(failing('@startuml\n!endif', 'boom'), measurer);
    expect(svg).toContain('fill="#FF0000"');
    expect(svg).toContain('fill="#33FF02"');
  });

  it('escapes markup in the offending source line', () => {
    const svg = renderPSystemError(failing('@startuml\n<b>&x</b>', 'boom'), measurer);
    expect(svg).toContain('&lt;b&gt;&amp;x&lt;/b&gt;');
  });

  it('renders the Welcome hyperlink underlined and its examples in monospace', () => {
    const svg = renderPSystemError(failing('@startuml\n!endif', 'boom'), measurer);
    expect(svg).toContain('text-decoration="underline"');
    expect(svg).toContain('font-family="monospace"');
    expect(svg).not.toContain('<b>Welcome'); // the creole tag is resolved, not printed
  });

  it('PSystemUnsupported names the directive it does not know', () => {
    const svg = renderPSystemUnsupported(new PSystemUnsupported('@startfoo'), measurer);
    expect(svg).toContain('Diagram not supported by this release of PlantUML');
    expect(svg).toContain('@startfoo');
  });

  it('PSystemWelcome is the (Empty) diagram', () => {
    expect(new PSystemWelcome().getDescription()).toBe('(Empty)');
    expect(new PSystemUnsupported('@startfoo').getDescription()).toBe('(Unsupported)');
  });
});
