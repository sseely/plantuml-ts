/**
 * classAccepts trims each line before testing CLASS_ACCEPTS_PATTERNS (the
 * patterns anchor on `^`). Untrimmed, an indented `class`/`abstract class`
 * inside a namespace block is invisible to the scan — and rusuzi-21-kile910's
 * front-matter (title/legend) pushes its lone relationship line past the
 * 20-line scan window, so nothing else can carry the block to `class`.
 *
 * @see src/diagrams/class/class-dispatch.ts (final return of classAccepts)
 */
import { describe, it, expect } from 'vitest';
import { classAccepts } from '../../../src/diagrams/class/class-dispatch.js';

describe('classAccepts — indented declarations are trimmed before matching', () => {
  it('accepts an indented class/abstract-class declaration', () => {
    expect(classAccepts(['    class Foo {', '    }'])).toBe(true);
    expect(classAccepts(['        abstract class Base'])).toBe(true);
  });

  it('routes rusuzi-21-kile910\'s shape: front-matter + indented namespace body', () => {
    // Body lines from rusuzi-21-kile910.puml (after @startuml, before
    // @enduml), indentation preserved as the block extractor delivers them
    // (blank-trimmed at the array ends only, never per-line trimmed).
    const lines = [
      "' 2022-06-29 19:54:38, m2uml 2.1, PlantUML 1.2022.7beta1, graphviz 2.44.1, Matlab R2018b, PCWIN64",
      '    title',
      '        <font size=18>Pragma Multi Test</font>',
      '    end title',
      '    legend top left',
      '        Note on the folder, m4test.',
      '        This text shall end up in the box.',
      '    end legend',
      '    namespace ltr  {',
      '        abstract class Singleton {',
      '            __',
      '            {method} + getSingletonData',
      '            {method}{abstract}{static} + instance',
      '            {method} + setSingletonData',
      '        }',
      '        class SingletonImpl <<(S,#FF7700)>> {',
      '            {field} + myData',
      '            __',
      '            {method}{static} + instance',
      '            {method} + myOperation',
      '        }',
      '        class Singleton_pattern_tempate <<(S,#FF7700)>> {',
      '            __',
      '            {method}{static} + do_something',
      '            {method}{static} + Instance',
      '        }',
      '    }',
      '    ltr.Singleton <|-- ltr.SingletonImpl',
    ];
    // The relationship line (the only unindented class-forcing signal) falls
    // at index 27 — past the 20-line scan window — so this depends entirely
    // on the indented `abstract class`/`class` declarations within the
    // window being trimmed before CLASS_ACCEPTS_PATTERNS tests them.
    expect(lines.slice(0, 20).some((l) => l.includes('<|--'))).toBe(false);
    expect(classAccepts(lines)).toBe(true);
  });

  it('still declines a pure descriptive block when indented', () => {
    expect(classAccepts(['    node A', '    component B', '    A --> B'])).toBe(
      false,
    );
  });
});
