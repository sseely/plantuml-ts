/**
 * `DiagramExtractor` + the two `StartUtils` probes it rides on: which lines of
 * an included file actually get included when that file is itself a whole
 * `@startuml ... @enduml` document.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/DiagramExtractor.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/StartUtils.java
 */
import { describe, expect, it } from 'vitest';
import { extractDiagram } from '../../../../src/core/tim/DiagramExtractor.js';
import { isEndDirective, isStartDirective } from '../../../../src/core/tim/StartUtils.js';
import { readLines } from '../../../../src/core/tim/ReadLineReader.js';

/** The extracted block, as plain strings; `undefined` when there is no block at all. */
function extract(source: string, suf?: string): string[] | undefined {
  return extractDiagram(readLines(source), suf)?.map((s) => s.getString());
}

describe('isStartDirective', () => {
  it.each([
    ['@startuml', true],
    ['   @startuml', true],
    ['\\startuml', true],
    ['@startuml(id=A)', true],
    ['@start', false], // needs at least one char after "start"
    ['@enduml', false],
    ['class A', false],
    ['', false],
    ['   ', false],
  ])('isStartDirective(%j) === %s', (line, expected) => {
    expect(isStartDirective(line)).toBe(expected);
  });
});

describe('isEndDirective', () => {
  it.each([
    ['@enduml', true],
    ['  @enduml', true],
    ['\\enduml', true],
    ['@startuml', false],
    ['class A', false],
    ['', false],
    ['@', false],
  ])('isEndDirective(%j) === %s', (line, expected) => {
    expect(isEndDirective(line)).toBe(expected);
  });
});

describe('extractDiagram', () => {
  it('returns undefined when the content holds no @start directive', () => {
    expect(extract('class A\nclass B')).toBeUndefined();
  });

  it('takes the first block, without its markers, and drops surrounding prose', () => {
    expect(extract('before\n@startuml\nclass A\n@enduml\nafter')).toEqual(['class A']);
  });

  it('runs to end-of-content when the block is unterminated', () => {
    expect(extract('@startuml\nclass A')).toEqual(['class A']);
  });

  it('a numeric suffix selects the nth block (0-based)', () => {
    const src = '@startuml\nA\n@enduml\n@startuml\nB\n@enduml\n@startuml\nC\n@enduml';
    expect(extract(src, '0')).toEqual(['A']);
    expect(extract(src, '2')).toEqual(['C']);
  });

  it('an out-of-range block index yields no lines', () => {
    expect(extract('@startuml\nA\n@enduml', '7')).toEqual([]);
  });

  it('a named suffix selects the block declared with that id', () => {
    const src = '@startuml(id=ONE)\nA\n@enduml\n@startuml(id=TWO)\nB\n@enduml';
    expect(extract(src, 'TWO')).toEqual(['B']);
  });

  it('an unknown id yields no lines', () => {
    expect(extract('@startuml(id=ONE)\nA\n@enduml', 'NOPE')).toEqual([]);
  });

  it('an id carrying regex metacharacters is matched literally, not as a pattern', () => {
    // Upstream splices the uid into a regex raw; this port escapes it (see checkUid).
    expect(extract('@startuml(id=ONE)\nA\n@enduml', 'O.E')).toEqual([]);
  });
});
