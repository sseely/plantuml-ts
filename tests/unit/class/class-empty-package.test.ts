/**
 * Multi-line empty package/namespace collapse (mission A2, Group 5 —
 * "empty-package placeholder anchors", iteration 17).
 *
 * `class-namespace-decl.test.ts` covers the SAME-LINE case (`package X {}`,
 * `CommandPackageEmpty`/`CommandNamespaceEmpty` — collapsed immediately at
 * parse time by `collapseEmptyNamespace`). This file covers the MULTI-line
 * case (`package X {` … `}` on a later line), which upstream does not
 * distinguish from the same-line case at all: `GraphvizImageBuilder#printGroups`
 * (svek/GraphvizImageBuilder.java:406-419) mutes ANY still-empty
 * `GroupType.PACKAGE` to `LeafType.EMPTY_PACKAGE` at DOT-export time,
 * regardless of which source form produced the empty group.
 *
 * A plain multi-line `package`/`namespace` is deliberately NOT collapsed at
 * parse-time close (unlike a descriptive container, `rectangle`/`component`/…,
 * which is): a dotted namespace path can be REOPENED by a later block adding
 * real content under it (`namespace f1 {}` … `namespace f1.function { class
 * Fox }`), which would strand an eagerly-collapsed `f1` as a stray duplicate.
 * Instead, `collapseEmptyNamespacesFinal` runs once on the fully-parsed AST
 * (wired into `layout.ts`, ahead of measurement) — this file tests it
 * directly, feeding it `parseClass()`'s output, mirroring how `layout.ts`
 * calls it after parsing completes.
 *
 * Fixtures verified against the oracle DOT (`dot-sync-report.ts --slug
 * <slug> class`):
 *  - daxeno-00-kasu166: two multi-line empty packages, one with a
 *    `<<Database>>` stereotype whose creole-decorated display
 *    (`<size:18>...</size>`) is used as the raw namespace id (no `as`
 *    alias) — the SAME chars `splitOnSeparator`'s decoration guard rejects
 *    when re-qualifying a classifier declared inside that namespace.
 *  - dojanu-92-vizo468: a plain multi-line empty package alongside two
 *    non-empty ones (regression check: siblings must be unaffected).
 *  - delasa-80-jusu462: a DOTTED empty package name (`X.siwd`) — the dot
 *    splits it into a 2-level chain via `intermediatePackages`; only the
 *    INNER level is empty, so it alone collapses to a leaf that becomes the
 *    OUTER level's sole member (the outer survives as a real 1-member
 *    cluster, matching oracle's `cluster51`/`cluster136`).
 *  - xitobu-41-lame230: a package literally named `package` (keyword
 *    collision check).
 *  - delano-03-xino845/faxoga-34-moja699/jabeme-35-logi109 (pre-existing
 *    ratchet fixtures, regression-tested here too): a namespace closed empty
 *    but reopened later with real content must NOT collapse.
 *
 * @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java:406-419 (printGroups)
 * @see ~/git/plantuml/.../svek/image/EntityImageEmptyPackage.java
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { collapseEmptyNamespacesFinal } from '../../../src/diagrams/class/class-namespace.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

/** Parse, then apply the layout-boundary collapse (mirrors layout.ts). */
function parseAndCollapse(source: string): ReturnType<typeof collapseEmptyNamespacesFinal> {
  return collapseEmptyNamespacesFinal(parse(source));
}

describe('multi-line empty package/namespace collapse', () => {
  it('parseClass alone leaves a plain multi-line empty package as an open namespace', () => {
    // Collapsing this early (before the whole diagram is known) is the bug
    // this fix avoids reintroducing — see the reopening tests below.
    const ast = parse(`
      package foo {
      }
      class qux
    `);
    expect(ast.namespaces.map((n) => n.id)).toEqual(['foo']);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['qux']);
  });

  it('collapseEmptyNamespacesFinal collapses a plain multi-line empty package', () => {
    const ast = parseAndCollapse(`
      package foo {
      }
      class qux
    `);
    expect(ast.namespaces).toHaveLength(0);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['foo', 'qux']);
    expect(ast.classifiers.find((c) => c.id === 'foo')!.kind).toBe('descriptive');
  });

  it('collapses a plain multi-line empty namespace the same way', () => {
    const ast = parseAndCollapse(`
      namespace bar {
      }
      class qux
    `);
    expect(ast.namespaces).toHaveLength(0);
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['bar', 'qux']);
    expect(ast.classifiers.find((c) => c.id === 'bar')!.kind).toBe('descriptive');
  });

  // dojanu-92-vizo468: an empty package alongside non-empty siblings.
  it('leaves non-empty sibling packages as real namespaces (dojanu-92-vizo468)', () => {
    const ast = parseAndCollapse(`
      package p1 {
        class Foo1
      }
      package p2 {
        class Foo2
      }
      package p3 {
      }
    `);
    // p1/p2 survive as clusters; p3 collapses to a leaf.
    expect(ast.namespaces.map((n) => n.id).sort()).toEqual(['p1', 'p2']);
    expect(ast.namespaces.find((n) => n.id === 'p1')!.classifiers).toEqual(['p1.Foo1']);
    expect(ast.namespaces.find((n) => n.id === 'p2')!.classifiers).toEqual(['p2.Foo2']);
    const p3 = ast.classifiers.find((c) => c.id === 'p3');
    expect(p3?.kind).toBe('descriptive');
  });

  // daxeno-00-kasu166: stereotyped empty package whose display (no `as`
  // alias, so the raw quoted text IS the id) carries creole markup.
  it('collapses an empty stereotyped package with a creole-decorated display (daxeno-00-kasu166)', () => {
    const ast = parseAndCollapse(`
      package "<size:18>styled</size>\\nshould be styled" <<Database>> {
      }
    `);
    expect(ast.namespaces).toHaveLength(0);
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.kind).toBe('descriptive');
    expect(ast.classifiers[0]!.display).toBe('<size:18>styled</size>\\nshould be styled');
  });

  // daxeno-00-kasu166: a SECOND, non-empty stereotyped package whose id also
  // carries creole markup — its member must still resolve into it (not be
  // dropped by `splitOnSeparator`'s decoration guard misfiring on the
  // package's own raw display). No collapse involved — checked on the raw
  // parse output.
  it('registers a member declared inside a creole-decorated non-empty package (daxeno-00-kasu166)', () => {
    const ast = parse(`
      package "<size:18>styled2</size>\\nshould be styled" <<Database>> {
      class foo
      }
    `);
    expect(ast.namespaces).toHaveLength(1);
    const ns = ast.namespaces[0]!;
    expect(ns.classifiers).toHaveLength(1);
    const foo = ast.classifiers.find((c) => c.id === ns.classifiers[0]);
    expect(foo).toBeDefined();
    expect(foo!.namespace).toBe(ns.id);
    expect(foo!.display).toBe('foo');
  });

  // delasa-80-jusu462: a dotted package name splits into a 2-level chain;
  // only the inner level is declared empty, so only it collapses — the
  // outer level survives as a real 1-member cluster.
  it('collapses only the empty inner level of a dotted package name (delasa-80-jusu462)', () => {
    const ast = parseAndCollapse(`
      package pdwzmyysm_abstract.siwd {
      }
    `);
    // The outer namespace survives with exactly one member: the collapsed
    // inner "siwd" level.
    expect(ast.namespaces).toHaveLength(1);
    const outer = ast.namespaces[0]!;
    expect(outer.id).toBe('pdwzmyysm_abstract');
    expect(outer.classifiers).toEqual(['pdwzmyysm_abstract.siwd']);
    const inner = ast.classifiers.find((c) => c.id === 'pdwzmyysm_abstract.siwd');
    expect(inner?.kind).toBe('descriptive');
    expect(inner?.namespace).toBe('pdwzmyysm_abstract');
  });

  // xitobu-41-lame230: a package literally named `package` (keyword
  // collision) alongside a top-level class.
  it('collapses an empty package literally named "package" (xitobu-41-lame230)', () => {
    const ast = parseAndCollapse(`
      package package {
      }
      class foo
    `);
    expect(ast.namespaces).toHaveLength(0);
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['foo', 'package']);
    expect(ast.classifiers.find((c) => c.id === 'package')!.kind).toBe('descriptive');
  });

  // Regression: a descriptive container (rectangle/component/…) still
  // collapses (and carries its USymbol) at parse-time close — unaffected by
  // moving the plain-namespace case to the layout-boundary pass.
  it('still attaches the USymbol to an empty multi-line descriptive container', () => {
    const ast = parse(`
      rectangle "R" as r {
      }
    `);
    expect(ast.namespaces).toHaveLength(0);
    const r = ast.classifiers.find((c) => c.id === 'r');
    expect(r?.kind).toBe('descriptive');
    expect(r?.usymbol).toBe('rectangle');
  });

  // delano-03-xino845 / faxoga-34-moja699 / jabeme-35-logi109: a namespace
  // closed empty must NOT collapse if a LATER block reopens it with real
  // content — collapsing eagerly here would strand the empty-at-the-time
  // classifier as a stray duplicate once `ensureNamespaceChain` recreates
  // the namespace for the reopen.
  describe('reopened-namespace safety (delano-03-xino845 pattern)', () => {
    it('does not collapse a namespace later reopened with a nested non-empty child', () => {
      const ast = parseAndCollapse(`
        namespace f1 {
        }
        namespace f1.function {
          class Fox
        }
      `);
      expect(ast.namespaces.map((n) => n.id).sort()).toEqual(['f1', 'f1.function']);
      expect(ast.classifiers.map((c) => c.id)).toEqual(['f1.function.Fox']);
    });

    it('does not collapse when the reopen is itself empty at first, then filled (faxoga-34-moja699)', () => {
      const ast = parseAndCollapse(`
        namespace f1 {
        }
        namespace f1.function {
        }
        namespace f1.function {
          class Fox
        }
      `);
      expect(ast.namespaces.map((n) => n.id).sort()).toEqual(['f1', 'f1.function']);
      expect(ast.classifiers.map((c) => c.id)).toEqual(['f1.function.Fox']);
    });
  });
});
