/**
 * The include directives, executed INSIDE the interpreter (upstream's own
 * architecture) against the sync `IncludeStore`.
 *
 * The first describe block is the whole reason this moved out of the old
 * textual pre-pass: a pre-pass runs before conditionals, so it cannot decide
 * whether an include is live, and it cannot expand a variable-built path.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#executeInclude
 */
import { describe, expect, it } from 'vitest';
import { preprocess } from '../../../../src/core/preprocessor.js';
import {
  IncludeNotFoundError,
  MapIncludeStore,
  StdlibNotBundledError,
} from '../../../../src/core/tim/IncludeStore.js';
import { EaterException } from '../../../../src/core/tim/EaterException.js';

/** Preprocess `lines` with `store` as the include seam; return the emitted lines. */
function run(lines: readonly string[], store?: Record<string, string>): readonly string[] {
  return preprocess(lines.join('\n'), undefined, {
    includeStore: store === undefined ? undefined : new MapIncludeStore(store),
  }).lines;
}

describe('!include — resolution happens during interpretation', () => {
  it('splices the included content in place', () => {
    const lines = run(['class A', '!include shared.iuml', 'class C'], {
      'shared.iuml': 'class B',
    });
    expect(lines).toEqual(['class A', 'class B', 'class C']);
  });

  it('an !include inside a FALSE !ifdef is not executed', () => {
    const lines = run(['!ifdef NEVER', '!include dead.iuml', '!endif', 'class A'], {
      'dead.iuml': 'class Dead',
    });
    expect(lines).toEqual(['class A']);
  });

  it('an !include inside a TRUE !ifdef is executed', () => {
    const lines = run(['!define YES', '!ifdef YES', '!include live.iuml', '!endif'], {
      'live.iuml': 'class Live',
    });
    expect(lines).toEqual(['class Live']);
  });

  it('resolves a variable-built include path', () => {
    const lines = run(['!$name = "shared"', '!include $name.iuml'], { 'shared.iuml': 'class B' });
    expect(lines).toEqual(['class B']);
  });

  it('macros defined by an included file are usable afterwards', () => {
    const lines = run(['!include macros.iuml', 'BOLD(hi)'], {
      'macros.iuml': '!define BOLD(x) <b>x</b>',
    });
    expect(lines).toEqual(['<b>hi</b>']);
  });

  it('follows a nested !include inside included content', () => {
    const lines = run(['!include a.iuml'], {
      'a.iuml': 'class A\n!include b.iuml',
      'b.iuml': 'class B',
    });
    expect(lines).toEqual(['class A', 'class B']);
  });
});

describe('!include — PreprocessorIncludeStrategy', () => {
  it('DEFAULT: a file already included is silently skipped the second time', () => {
    const lines = run(['!include a.iuml', '!include a.iuml'], { 'a.iuml': 'class A' });
    expect(lines).toEqual(['class A']);
  });

  it('!include_many re-includes the file', () => {
    const lines = run(['!include_many a.iuml', '!include_many a.iuml'], { 'a.iuml': 'class A' });
    expect(lines).toEqual(['class A', 'class A']);
  });

  it('!include_once throws when the file was already included', () => {
    expect(() => run(['!include a.iuml', '!include_once a.iuml'], { 'a.iuml': 'class A' }))
      .toThrow(EaterException);
  });

  it('!includeurl resolves through the store like any other target', () => {
    const lines = run(['!includeurl https://example.com/a.iuml'], {
      'https://example.com/a.iuml': 'class A',
    });
    expect(lines).toEqual(['class A']);
  });

  it('a URL is re-read every time it is named (no dedup outside the file branch)', () => {
    const lines = run(
      ['!include https://example.com/a.iuml', '!include https://example.com/a.iuml'],
      { 'https://example.com/a.iuml': 'class A' },
    );
    expect(lines).toEqual(['class A', 'class A']);
  });
});

describe('!include — an included @startuml document contributes only its block', () => {
  it('drops the @start / @end markers and any prose around them', () => {
    const lines = run(['class Root', '!include doc.puml'], {
      'doc.puml': 'preamble\n@startuml\nclass Inner\n@enduml\ntrailer',
    });
    expect(lines).toEqual(['class Root', 'class Inner']);
  });

  it('a numeric !suffix selects the block by index', () => {
    const lines = run(['!include doc.puml!1'], {
      'doc.puml': '@startuml\nclass First\n@enduml\n@startuml\nclass Second\n@enduml',
    });
    expect(lines).toEqual(['class Second']);
  });

  it('a non-numeric !suffix selects the block by id', () => {
    const lines = run(['!include doc.puml!TWO'], {
      'doc.puml': '@startuml(id=ONE)\nclass First\n@enduml\n@startuml(id=TWO)\nclass Second\n@enduml',
    });
    expect(lines).toEqual(['class Second']);
  });

  it('a fragment with no @start directive is included whole', () => {
    const lines = run(['!include frag.iuml'], { 'frag.iuml': 'class A\nclass B' });
    expect(lines).toEqual(['class A', 'class B']);
  });
});

describe('!includesub', () => {
  it('replays a !startsub block declared in the same source', () => {
    const lines = run(['!startsub S', 'class A', '!endsub', 'class B', '!includesub S']);
    expect(lines).toEqual(['class A', 'class B', 'class A']);
  });

  it('pulls a named sub out of another file (the file!bloc form)', () => {
    const lines = run(['!includesub shared.iuml!S'], {
      'shared.iuml': 'class Skipped\n!startsub S\nclass Wanted\n!endsub\nclass AlsoSkipped',
    });
    expect(lines).toEqual(['class Wanted']);
  });

  it('throws when the named sub does not exist', () => {
    expect(() => run(['!includesub NOPE'])).toThrow(EaterException);
  });

  it('throws when the file exists but holds no such sub', () => {
    expect(() => run(['!includesub shared.iuml!NOPE'], { 'shared.iuml': 'class A' }))
      .toThrow(EaterException);
  });
});

describe('!includedef', () => {
  it('executes the named definition from the store', () => {
    const lines = run(['!includedef COLORS'], { COLORS: '!define BG #eee' });
    expect(lines).toEqual([]);
  });

  it('the definition it pulled in is in scope afterwards', () => {
    const lines = run(['!includedef COLORS', 'skinparam x BG'], { COLORS: '!define BG #eee' });
    expect(lines).toEqual([]);
    // (the skinparam line is consumed by the collector, not emitted)
  });

  it('throws IncludeNotFoundError for an unknown definition', () => {
    expect(() => run(['!includedef NOPE'])).toThrow(IncludeNotFoundError);
  });
});

describe('!import', () => {
  it('registers a lookup prefix that later !includes resolve against', () => {
    const lines = run(['!import lib', '!include a.iuml'], { 'lib/a.iuml': 'class A' });
    expect(lines).toEqual(['class A']);
  });

  it('accepts a prefix written with a trailing slash', () => {
    const lines = run(['!import lib/', '!include a.iuml'], { 'lib/a.iuml': 'class A' });
    expect(lines).toEqual(['class A']);
  });

  it('never throws, even though no filesystem backs it', () => {
    expect(() => run(['!import nowhere', 'class A'])).not.toThrow();
  });
});

describe('the seam is loud — never a silent skip', () => {
  it('an unresolvable !include throws IncludeNotFoundError naming the path', () => {
    const err = (() => {
      try {
        run(['!include missing.iuml'], {});
        return undefined;
      } catch (e) {
        return e as IncludeNotFoundError;
      }
    })();
    expect(err).toBeInstanceOf(IncludeNotFoundError);
    expect(err?.path).toBe('missing.iuml');
  });

  it('an !include <bundle/thing> with no bundle throws StdlibNotBundledError', () => {
    const err = (() => {
      try {
        run(['!include <tupadr3/common>'], {});
        return undefined;
      } catch (e) {
        return e as StdlibNotBundledError;
      }
    })();
    expect(err).toBeInstanceOf(StdlibNotBundledError);
    expect(err?.bundle).toBe('tupadr3');
  });

  it('a host-supplied bundle resolves the angle-bracket form through the seam', () => {
    const lines = run(['!include <tupadr3/common>', 'BOLD(hi)'], {
      '<tupadr3/common>': '!define BOLD(x) <b>x</b>',
    });
    expect(lines).toEqual(['<b>hi</b>']);
  });

  it('an unresolvable !includesub file throws IncludeNotFoundError', () => {
    expect(() => run(['!includesub missing.iuml!S'], {})).toThrow(IncludeNotFoundError);
  });
});
