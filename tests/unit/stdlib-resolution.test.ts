/**
 * SI5b T3 -- the `<bundle/thing>` stdlib resolution seam.
 *
 * Three layers, each pinned here:
 *   1. `stdlibStore()` / `resolvePumlResource` -- the Stdlib.java:98-114 key
 *      semantics table (case, `.puml` stripping, first-slash split, aliasing).
 *   2. `withStdlib()` + `IncludeExecutor#load` -- the wiring: a supplied store
 *      is consulted BEFORE `StdlibNotBundledError`, the `!`-suffix split still
 *      runs first (so `<x!SUB>` never reaches the stdlib branch), and there is
 *      no include-once dedup for the stdlib form.
 *   3. `renderSync` end-to-end -- a caller-supplied bundle actually reaches the
 *      rendered document.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Stdlib.java#getPumlResource
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#executeInclude
 */
import { describe, expect, it } from 'vitest';
import { renderSync } from '../../src/index.js';
import { FormulaMeasurer } from '../../src/core/measurer.js';
import { preprocess } from '../../src/core/preprocessor.js';
import { MapIncludeStore, StdlibNotBundledError } from '../../src/core/tim/IncludeStore.js';
import { stdlibStore, withStdlib, type BundleData } from '../../src/core/tim/StdlibStore.js';

// ---------------------------------------------------------------------------
// 1. stdlibStore() -- the Stdlib.java:98-114 key-semantics table.
// ---------------------------------------------------------------------------

describe('stdlibStore().getPumlResource -- key semantics', () => {
  const c4: BundleData = {
    name: 'c4',
    files: { c4_context: 'class C4Context', 'folder/nested': 'class Nested' },
  };

  it('resolves an exact lowercase key', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('c4/c4_context')).toBe('class C4Context');
  });

  it('is case-insensitive on the bundle name', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('C4/c4_context')).toBe('class C4Context');
  });

  it('is case-insensitive on the file name', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('c4/C4_Context')).toBe('class C4Context');
  });

  it('strips a trailing .puml extension', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('c4/c4_context.puml')).toBe('class C4Context');
  });

  it('strips .puml wherever it occurs, not just at the end (Java String#replace)', () => {
    // Stdlib.java: `fullname.toLowerCase().replace(".puml", "")` removes EVERY
    // occurrence of the literal substring -- this is a global replace, not a
    // trailing-suffix strip.
    const bundle: BundleData = { name: 'x', files: { 'ab/cd': 'GLOBAL' } };
    const store = stdlibStore(bundle);
    expect(store.getPumlResource('x.puml/a.pumlb/c.pumld')).toBe('GLOBAL');
  });

  it('splits on the FIRST slash: the bundle is the first path segment', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('c4/folder/nested')).toBe('class Nested');
  });

  it('a multi-slash remainder is preserved verbatim as the file key', () => {
    const bundle: BundleData = {
      name: 'awslib14',
      files: { 'storage/simplestorageservice': 'class S3' },
    };
    const store = stdlibStore(bundle);
    expect(store.getPumlResource('awslib14/Storage/SimpleStorageService')).toBe('class S3');
  });

  it('<bundle> alone (no slash) resolves to nothing', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('c4')).toBeUndefined();
  });

  it('an unknown bundle resolves to nothing', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('nope/thing')).toBeUndefined();
  });

  it('a known bundle with an unknown file resolves to nothing', () => {
    const store = stdlibStore(c4);
    expect(store.getPumlResource('c4/does_not_exist')).toBeUndefined();
  });

  it('follows a link: alias chain (awslib -> awslib14)', () => {
    const awslib14: BundleData = {
      name: 'awslib14',
      files: { 'general/user': 'class User' },
    };
    const awslib: BundleData = { name: 'awslib', aliasOf: 'awslib14', files: {} };
    const store = stdlibStore(awslib, awslib14);
    expect(store.getPumlResource('awslib/General/User')).toBe('class User');
  });

  it('an alias chain is itself case-insensitive', () => {
    const target: BundleData = { name: 'bootstrap1.13.1', files: { common: 'class Common' } };
    const alias: BundleData = { name: 'bootstrap', aliasOf: 'Bootstrap1.13.1', files: {} };
    const store = stdlibStore(alias, target);
    expect(store.getPumlResource('BOOTSTRAP/common')).toBe('class Common');
  });

  it('an alias cycle resolves to nothing rather than hanging', () => {
    const a: BundleData = { name: 'a', aliasOf: 'b', files: {} };
    const b: BundleData = { name: 'b', aliasOf: 'a', files: {} };
    const store = stdlibStore(a, b);
    expect(store.getPumlResource('a/thing')).toBeUndefined();
  });

  it('an alias pointing at a bundle with no files (dangling target) resolves to nothing', () => {
    const alias: BundleData = { name: 'ghost', aliasOf: 'nowhere', files: {} };
    const store = stdlibStore(alias);
    expect(store.getPumlResource('ghost/thing')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Wiring: withStdlib() + IncludeExecutor#load consults the store BEFORE
//    throwing StdlibNotBundledError.
// ---------------------------------------------------------------------------

/** Preprocess `lines` with `store` as the include seam; return the emitted lines. */
function run(lines: readonly string[], store: MapIncludeStore, stdlib?: ReturnType<typeof stdlibStore>) {
  return preprocess(lines.join('\n'), undefined, {
    includeStore: stdlib === undefined ? store : withStdlib(store, stdlib),
  }).lines;
}

describe('withStdlib() wiring -- IncludeExecutor consults the store before throwing', () => {
  const fake: BundleData = { name: 'fake', files: { thing: '!define BOLD(x) <b>x</b>' } };

  it('a supplied stdlib store resolves <bundle/thing>', () => {
    const lines = run(['!include <fake/thing>', 'BOLD(hi)'], new MapIncludeStore(), stdlibStore(fake));
    expect(lines).toEqual(['<b>hi</b>']);
  });

  it('a bundle absent from the supplied store still throws StdlibNotBundledError', () => {
    const err = (() => {
      try {
        run(['!include <other/thing>'], new MapIncludeStore(), stdlibStore(fake));
        return undefined;
      } catch (e) {
        return e as StdlibNotBundledError;
      }
    })();
    expect(err).toBeInstanceOf(StdlibNotBundledError);
    expect(err?.bundle).toBe('other');
  });

  it('no store at all: message is byte-for-byte the pinned StdlibNotBundledError text', () => {
    const err = (() => {
      try {
        run(['!include <fake/thing>'], new MapIncludeStore());
        return undefined;
      } catch (e) {
        return e as StdlibNotBundledError;
      }
    })();
    expect(err).toBeInstanceOf(StdlibNotBundledError);
    expect(err?.message).toBe(
      'Cannot resolve !include <fake/thing>: plantuml-ts bundles no PlantUML stdlib, ' +
        "so the 'fake' bundle is not available.\n" +
        'Supply it through the include seam: pass options.includeStore with an entry keyed ' +
        "'<fake/thing>' (or 'fake/thing') whose value is the content of that stdlib file.",
    );
  });

  it('!SUB fall-through: <x!SUB> never reaches the stdlib branch (upstream splits the ! suffix first)', () => {
    // Stdlib.java's stdlib branch is only tried on `what.startsWith('<') &&
    // what.endsWith('>')`, checked AFTER `what.lastIndexOf('!')` has already cut
    // the suffix off -- so `<x!SUB>` becomes what="<x" (no longer a bracket
    // form) and falls through to the ordinary file branch instead, even though
    // a store that WOULD serve bundle "x" is supplied.
    const x: BundleData = { name: 'x', files: { thing: 'class ShouldNotAppear' } };
    expect(() => run(['!include <x!SUB>'], new MapIncludeStore(), stdlibStore(x))).toThrow(
      /Cannot resolve !include '<x': it is not in the IncludeStore/,
    );
  });

  it('no include-once dedup for the stdlib form: the same <bundle/thing> inlines twice', () => {
    // A `!define` line (like `fake` above) is consumed silently, so it cannot
    // show dedup either way -- use a bundle whose content is a plain content
    // line instead, which DOES emit output, to make re-inclusion observable.
    const twice: BundleData = { name: 'twice', files: { thing: 'class B' } };
    const lines = run(
      ['!include <twice/thing>', '!include <twice/thing>'],
      new MapIncludeStore(),
      stdlibStore(twice),
    );
    expect(lines).toEqual(['class B', 'class B']);
  });
});

// ---------------------------------------------------------------------------
// 3. End-to-end renderSync() with a caller-supplied bundle.
// ---------------------------------------------------------------------------

describe('renderSync() end-to-end with a host-supplied stdlib bundle', () => {
  it('!include <fake/thing> inlines the bundle content into the rendered diagram', () => {
    const fake: BundleData = { name: 'fake', files: { thing: 'class Included' } };
    const source = ['@startuml', '!include <fake/thing>', 'class Root', '@enduml'].join('\n');

    const svg = renderSync(source, {
      includeStore: withStdlib(new MapIncludeStore(), stdlibStore(fake)),
      // jsdom has no <canvas> backend; use the deterministic formula measurer
      // instead of letting CanvasMeasurer fail per-call (see measurer.ts).
      measurer: new FormulaMeasurer(),
    });

    expect(svg).toContain('<svg');
    expect(svg).not.toContain('renderSync() is not supported');
    expect(svg).toMatch(/>\s*Root\s*</);
    expect(svg).toMatch(/>\s*Included\s*</);
  });
});
