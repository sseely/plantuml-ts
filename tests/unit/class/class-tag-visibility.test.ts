/**
 * Iteration 13 (class-dot-sync, group 2): `$tag` declarations +
 * `remove`/`restore` entity selectors.
 *
 * Upstream mechanism:
 *  - `$tag` tokens on declarations are `Stereotag`s stored per-entity in a
 *    Set (`Entity#addStereotag`; grammar slot `Stereotag.pattern()` — TAGS1
 *    before the stereotype, TAGS2 after).
 *    @see ~/git/plantuml/.../stereo/Stereotag.java:42-46
 *    @see ~/git/plantuml/.../classdiagram/command/CommandCreateClassMultilines.java:321-331
 *  - `remove`/`restore <what>` (CommandRemoveRestore) append raw HideOrShow
 *    entries; the removed-predicate is evaluated LAZILY at svek export time
 *    (after all parsing) by folding the list per entity — last applicable
 *    directive wins. Removed entities are excluded from the DOT graph
 *    entirely, unlike `hide` (hides2), which never reaches the export.
 *    @see ~/git/plantuml/.../classdiagram/command/CommandRemoveRestore.java:55-90
 *    @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:611-614,747-806
 *    @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java:230,350,413
 *  - `@unlinked` matches entities whose every non-invisible link connects to
 *    an entity removed by a non-@unlinked directive
 *    (`Entity#isAloneAndUnlinked`, using `isRemovedIgnoreUnlinked`).
 *    @see ~/git/plantuml/.../abel/Entity.java:457-476
 *  - A note with exactly ONE visible link to a non-note entity delegates its
 *    removed status to that neighbor (`isNoteWithSingleLinkAttachedTo`);
 *    member-anchored notes' links are invisible, so they answer for
 *    themselves. @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:762-797
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import {
  computeRemovedIds,
  computeHiddenIds,
  filterRemovedEntities,
  parseHideShowPatternDirective,
} from '../../../src/diagrams/class/class-directives.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

const measurer = new FormulaMeasurer();

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

/** Capture the DotInputGraph handed to the layout engine for `source`. */
function captureDotGraph(source: string): DotInputGraph {
  const ast = parse(source);
  let g: DotInputGraph | undefined;
  setLayoutInputObserver((x) => {
    g = x;
  });
  try {
    layoutClass(ast, defaultTheme, measurer);
  } finally {
    setLayoutInputObserver(undefined);
  }
  return g!;
}

const nodeIds = (g: DotInputGraph): string[] => g.nodes.map((n) => n.id).sort();

describe('$tag parsing on classifier declarations', () => {
  it('strips the tag from the id and stores it (class Foo $a)', () => {
    const ast = parse('class Foo $a');
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.id).toBe('Foo');
    expect(ast.classifiers[0]!.tags).toEqual(['a']);
  });

  it('stores multiple tags in declaration order (class C1 $tag13 $tag1)', () => {
    const ast = parse('class C1 $tag13 $tag1');
    expect(ast.classifiers[0]!.id).toBe('C1');
    expect(ast.classifiers[0]!.tags).toEqual(['tag13', 'tag1']);
  });

  it('keeps stereotype and color intact alongside tags', () => {
    const ast = parse('class Foo $v2 << data >> #pink');
    const c = ast.classifiers[0]!;
    expect(c.id).toBe('Foo');
    expect(c.tags).toEqual(['v2']);
    expect(c.stereotype).toBe('data');
    expect(c.color).toBe('#pink');
  });

  it('accumulates tags across re-declarations (Set semantics)', () => {
    const ast = parse(['class Foo $a', 'class Foo $b', 'class Foo $a'].join('\n'));
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.tags).toEqual(['a', 'b']);
  });

  it('stores tags on a freestanding single-line note (note "x" as N1 $z)', () => {
    const ast = parse('note "A note" as N1 $z');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]!.id).toBe('N1');
    expect(ast.notes[0]!.tags).toEqual(['z']);
  });
});

describe('remove/restore directive parsing', () => {
  it('stores directives raw, in source order', () => {
    const ast = parse(['class A', 'remove *', 'restore $z'].join('\n'));
    expect(ast.removeDirectives).toEqual([
      { kind: 'removerestore', action: 'remove', what: '*' },
      { kind: 'removerestore', action: 'restore', what: '$z' },
    ]);
  });
});

describe('computeRemovedIds semantics', () => {
  it('remove $tag removes exactly the tagged classifiers', () => {
    const ast = parse(['class A $v', 'class B', 'remove $v'].join('\n'));
    expect([...computeRemovedIds(ast)]).toEqual(['A']);
  });

  it('remove * removes everything; restore $tag revives only the tagged (last writer wins)', () => {
    const ast = parse(
      ['class C1 $tag13 $tag1', 'enum E1', 'interface I1 $tag13', 'C1 -- I1', 'remove *', 'restore $tag1'].join('\n'),
    );
    expect([...computeRemovedIds(ast)].sort()).toEqual(['E1', 'I1']);
  });

  it('restore after remove of the same name is a no-op pair', () => {
    const ast = parse(['class A', 'class B', 'remove A', 'restore A'].join('\n'));
    expect(computeRemovedIds(ast).size).toBe(0);
  });

  it('remove @unlinked purges only entities with no visible links', () => {
    const ast = parse(['class a', 'class z', 'a <-- b', 'remove @unlinked'].join('\n'));
    expect([...computeRemovedIds(ast)]).toEqual(['z']);
  });

  it('@unlinked treats links to (non-@unlinked-)removed entities as absent', () => {
    // b's only link goes to a, which `remove a` removes — so b is unlinked.
    const ast = parse(['class a', 'a <-- b', 'remove a', 'remove @unlinked'].join('\n'));
    expect([...computeRemovedIds(ast)].sort()).toEqual(['a', 'b']);
  });

  it('a note with one visible link delegates removed-status to its neighbor', () => {
    // N1 has tag z; Bar restored by $z; N1 survives via delegation to Bar
    // (its own tags are never consulted). Foo/Goo stay removed.
    const ast = parse(
      ['class Foo $a', 'Foo -- Goo', 'class Bar $z', 'note "A note" as N1 $z', 'N1 .. Bar', 'remove *', 'restore $z'].join('\n'),
    );
    expect([...computeRemovedIds(ast)].sort()).toEqual(['Foo', 'Goo']);
  });

  it('member-anchored note (invisible connector) answers for itself under @unlinked', () => {
    // cejili-77 pattern: the a::i note's connector is invisible -> unlinked ->
    // purged; the plain right-of-a note delegates to linked a -> survives.
    const ast = parse(
      [
        'class a {',
        'int i',
        '}',
        'class z',
        'note left of a::i',
        'purged',
        'end note',
        'note right of a',
        'survives',
        'end note',
        'a <-- b',
        'remove @unlinked',
      ].join('\n'),
    );
    const removed = computeRemovedIds(ast);
    const memberNote = ast.notes.find((n) => n.targetPort === 'i')!;
    const plainNote = ast.notes.find((n) => n.targetPort === undefined)!;
    expect(removed.has(memberNote.id)).toBe(true);
    expect(removed.has(plainNote.id)).toBe(false);
    expect(removed.has('z')).toBe(true);
    expect(removed.has('a')).toBe(false);
    expect(removed.has('b')).toBe(false);
  });
});

describe('filterRemovedEntities at the layout boundary', () => {
  it('returns the same object when no remove directives exist', () => {
    const ast = parse('class A');
    expect(filterRemovedEntities(ast)).toBe(ast);
  });

  it('drops removed classifiers and any relationship touching them', () => {
    const ast = parse(['class A', 'class B', 'A -- B', 'remove B'].join('\n'));
    const f = filterRemovedEntities(ast);
    expect(f.classifiers.map((c) => c.id)).toEqual(['A']);
    expect(f.relationships).toHaveLength(0);
  });

  it('DOT graph excludes removed entities (remove * / restore $tag1 -> one node)', () => {
    const g = captureDotGraph(
      ['class C1 $tag13 $tag1', 'enum E1', 'interface I1 $tag13', 'C1 -- I1', 'remove *', 'restore $tag1'].join('\n'),
    );
    expect(nodeIds(g)).toEqual(['C1']);
    expect(g.edges).toHaveLength(0);
  });

  it('hide is layout-preserving: hide * / show $z changes NOTHING in the DOT graph', () => {
    // Oracle-verified (doseko-41 vs sevaxa-72): hidden entities still occupy
    // their DOT nodes; only remove excludes them.
    const src = ['class Foo $a', 'Foo -- Goo', 'class Bar $z', 'note "A note" as N1 $z', 'N1 .. Bar'].join('\n');
    const bare = captureDotGraph(src);
    const hidden = captureDotGraph(src + '\nhide *\nshow $z');
    expect(nodeIds(hidden)).toEqual(nodeIds(bare));
    expect(hidden.edges.length).toBe(bare.edges.length);
  });

  it('remove * / restore $z keeps the tagged class and its delegating note (zuxoxu-54)', () => {
    const g = captureDotGraph(
      ['class Foo $a', 'Foo -- Goo', 'class Bar $z', 'note "A note" as N1 $z', 'N1 .. Bar', 'remove *', 'restore $z'].join('\n'),
    );
    expect(nodeIds(g)).toEqual(['Bar', 'N1']);
    expect(g.edges).toHaveLength(1);
  });

  it('remove @unlinked purges the member-note and the unlinked class (cejili-77)', () => {
    const g = captureDotGraph(
      [
        'class a {',
        'int i',
        '}',
        'class z',
        'note left of a::i',
        'purged',
        'end note',
        'note right of a',
        'survives',
        'end note',
        'a <-- b',
        'remove @unlinked',
      ].join('\n'),
    );
    // 3 nodes: a, b, the surviving note; 2 edges: b->a + the note connector.
    expect(g.nodes).toHaveLength(3);
    expect(g.edges).toHaveLength(2);
    expect(nodeIds(g)).toContain('a');
    expect(nodeIds(g)).toContain('b');
    expect(nodeIds(g)).not.toContain('z');
  });
});

describe('parseHideShowPatternDirective (G2 N7, hide/show entity-selector)', () => {
  it('parses a bare entity name', () => {
    expect(parseHideShowPatternDirective('hide aaa')).toEqual({
      kind: 'hideshowpattern',
      action: 'hide',
      what: 'aaa',
    });
  });

  it('parses show with a $tag target', () => {
    expect(parseHideShowPatternDirective('show $z')).toEqual({
      kind: 'hideshowpattern',
      action: 'show',
      what: '$z',
    });
  });

  it('parses a wildcard target', () => {
    expect(parseHideShowPatternDirective('hide *')).toEqual({
      kind: 'hideshowpattern',
      action: 'hide',
      what: '*',
    });
  });

  it('parses a <<stereotype>> target with internal whitespace', () => {
    expect(parseHideShowPatternDirective('hide << My Stereo >>')).toEqual({
      kind: 'hideshowpattern',
      action: 'hide',
      what: '<< My Stereo >>',
    });
  });

  it('parses @unlinked', () => {
    expect(parseHideShowPatternDirective('hide @unlinked')).toEqual({
      kind: 'hideshowpattern',
      action: 'hide',
      what: '@unlinked',
    });
  });

  it('returns null for a known global target (members/circle/empty *)', () => {
    expect(parseHideShowPatternDirective('hide members')).toBeNull();
    expect(parseHideShowPatternDirective('hide circle')).toBeNull();
    expect(parseHideShowPatternDirective('hide empty members')).toBeNull();
  });

  it('returns null for a compound qualifier form (belongs to an unported command)', () => {
    // `hide C2 circle` / `hide Dummy2 methods` — two whitespace-separated,
    // non-bracketed tokens; upstream's CommandHideShow2 regex does not match
    // this shape either (CommandHideShowByGender's territory instead).
    expect(parseHideShowPatternDirective('hide C2 circle')).toBeNull();
    expect(parseHideShowPatternDirective('hide Dummy2 methods')).toBeNull();
  });

  it('returns null for a non hide/show line', () => {
    expect(parseHideShowPatternDirective('class Foo')).toBeNull();
  });
});

describe('computeHiddenIds semantics (mirrors computeRemovedIds)', () => {
  it('hide <name> hides exactly that classifier', () => {
    const ast = parse(['class aaa', 'hide aaa', 'class bbb'].join('\n'));
    expect([...computeHiddenIds(ast)]).toEqual(['aaa']);
  });

  it('hide * / show $z hides everything except the tagged classifier', () => {
    const ast = parse(['class Foo $a', 'Foo -- Goo', 'class Bar $z', 'hide *', 'show $z'].join('\n'));
    expect([...computeHiddenIds(ast)].sort()).toEqual(['Foo', 'Goo']);
  });

  it('returns an empty set when no hide-pattern directives exist', () => {
    const ast = parse('class A');
    expect(computeHiddenIds(ast).size).toBe(0);
  });

  it('a note with one visible link delegates hidden-status to its neighbor', () => {
    const ast = parse(
      ['class Foo $a', 'Foo -- Goo', 'class Bar $z', 'note "A note" as N1 $z', 'N1 .. Bar', 'hide *', 'show $z'].join(
        '\n',
      ),
    );
    expect([...computeHiddenIds(ast)].sort()).toEqual(['Foo', 'Goo']);
  });
});

// G2 N21: `hide-class`/`show-class` are literal alternate spellings upstream
// accepts for BOTH keywords (`CommandHideShow2.java`'s own regex --
// `(hide|hide-class|show|show-class)`) -- `parseHideShowPatternDirective`
// already matched the suffix, but the command DISPATCH gate in
// `class-commands.ts` required whitespace immediately after "hide"/"show",
// so a `hide-class Foo` line never reached that parser at all. Jar-verified
// against `nekali-92-loda300` (zero-diff after this fix).
describe('hide-class / show-class dispatch (G2 N21)', () => {
  it('"hide-class <name>" reaches the AST through the full command dispatcher', () => {
    const ast = parse(['class Method', 'class Other', 'hide-class Method'].join('\n'));
    expect([...computeHiddenIds(ast)]).toEqual(['Method']);
  });

  it('"show-class" combines with a prior hide the same way "show" does', () => {
    const ast = parse(
      ['class Foo $a', 'Foo -- Goo', 'class Bar $z', 'hide *', 'show-class $z'].join('\n'),
    );
    expect([...computeHiddenIds(ast)].sort()).toEqual(['Foo', 'Goo']);
  });
});

describe('hide-by-name does not filter the DOT graph (net/atmp/CucaDiagram.java#isHidden)', () => {
  it('hide aaa keeps aaa\'s node and does not touch edges (cikeni-99-kojo447 pattern)', () => {
    const g = captureDotGraph(
      ['class aaa', 'hide aaa', 'interface Entity', 'interface SubEntity', 'Entity o-- SubEntity'].join('\n'),
    );
    expect(nodeIds(g)).toEqual(['Entity', 'SubEntity', 'aaa']);
    expect(g.edges).toHaveLength(1);
  });
});

describe('package declarations with $tag (verufu-58)', () => {
  it('package p1 $txn { ... } still opens a cluster; hide $tag is a DOT no-op', () => {
    const g = captureDotGraph(
      ['class foo1 $tag1', 'package p1 $txn {', 'class inside1', '}', 'class foo3', 'hide $txn'].join('\n'),
    );
    expect(g.nodes).toHaveLength(3);
    expect(g.edges).toHaveLength(0);
    // inside1's id is package-qualified (p1.inside1) once the package parses.
    expect(g.clusters?.some((c) => c.nodeIds.includes('p1.inside1'))).toBe(true);
  });
});
