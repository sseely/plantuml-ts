/**
 * Mission A4 Phase L iteration 13 (grouped singles, Gap 3): `$tag`
 * declarations + `remove`/`restore` on state diagrams.
 *
 * Upstream mechanism (state-directives.ts's module doc has the full
 * citation set):
 *  - `state Foo $a $b` / `state "A" as a $tagA { }` -- `$tag` tokens on
 *    declarations are `Stereotag`s stored per-entity in a Set
 *    (`Entity#addStereotag`; `CommandCreateState`/`CommandCreatePackageState`
 *    TAGS1/TAGS2 slots).
 *  - `remove`/`restore <what>` is `CommandRemoveRestore` -- a
 *    `classdiagram.command` class `StateDiagramFactory` registers
 *    VERBATIM (not a state-specific reimplementation), so the matching
 *    semantics (`$tag`, `<<stereotype>>`, `@unlinked`, bare/wildcard id)
 *    are identical to the class engine's. Evaluated lazily at the
 *    layout-input boundary; removed entities are excluded from the DOT
 *    graph entirely.
 *  - `@unlinked` matches entities whose every transition connects to an
 *    entity removed by a non-`@unlinked` directive.
 * @see ~/git/plantuml/.../stereo/Stereotag.java
 * @see ~/git/plantuml/.../classdiagram/command/CommandRemoveRestore.java
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:87
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java
 * @see ~/git/plantuml/.../statediagram/command/CommandCreatePackageState.java
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import { layoutState } from '../../../src/diagrams/state/layout.js';
import { computeRemovedIds, filterRemovedEntities } from '../../../src/diagrams/state/state-directives.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State } from '../../../src/diagrams/state/ast.js';

const measurer = new WidthTableMeasurer();

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

function findState(ast: StateDiagramAST, id: string): State | undefined {
  return ast.states.find((s) => s.id === id);
}

/** Capture the DotInputGraph handed to the layout engine for `source`. */
function captureDotGraph(source: string): DotInputGraph {
  const ast = parse(source);
  let g: DotInputGraph | undefined;
  setLayoutInputObserver((x) => {
    g = x;
  });
  try {
    layoutState(ast, defaultTheme, measurer);
  } finally {
    setLayoutInputObserver(undefined);
  }
  return g!;
}

const nodeIds = (g: DotInputGraph): string[] => [...g.nodes.map((n) => n.id)].sort();

describe('$tag parsing on state declarations', () => {
  it('plain leaf: strips the tags and stores them (state Foo $a $b)', () => {
    const ast = parse('state Foo $a $b');
    expect(findState(ast, 'Foo')?.tags).toEqual(['a', 'b']);
  });

  it('stereotyped leaf (pseudostate): tags follow the stereotype (state F <<choice>> $z)', () => {
    const ast = parse('state F <<choice>> $z');
    const f = findState(ast, 'F');
    expect(f?.kind).toBe('choice');
    expect(f?.tags).toEqual(['z']);
  });

  it('composite opener: tags before the brace (state "A" as a $tagA { })', () => {
    const ast = parse('state "A" as a $tagA {\n}');
    const a = findState(ast, 'a');
    expect(a?.display).toBe('A');
    expect(a?.tags).toEqual(['tagA']);
  });

  it('accumulates tags across re-declarations (Set semantics)', () => {
    const ast = parse(['state Foo $a', 'state Foo $b', 'state Foo $a'].join('\n'));
    expect(findState(ast, 'Foo')?.tags).toEqual(['a', 'b']);
  });

  it('frame declarations carry NO tags slot upstream -- $token after the id fails the whole line', () => {
    // CommandCreatePackage2 has no Stereotag import; a `$tag`-shaped token
    // there is not a recognized frame decoration, so the line falls through
    // every rule and is silently ignored (no state created) -- matches
    // upstream's grammar exactly (no TAGS slot to match against).
    const ast = parse('frame F $tagX {\n}');
    expect(findState(ast, 'F')).toBeUndefined();
  });
});

describe('remove/restore directive parsing', () => {
  it('stores directives raw, in source order', () => {
    const ast = parse(['state A', 'remove *', 'restore $z'].join('\n'));
    expect(ast.removeDirectives).toEqual([
      { kind: 'removerestore', action: 'remove', what: '*' },
      { kind: 'removerestore', action: 'restore', what: '$z' },
    ]);
  });
});

describe('computeRemovedIds semantics', () => {
  it('remove $tag removes exactly the tagged states', () => {
    const ast = parse(['state A $v', 'state B', 'remove $v'].join('\n'));
    expect([...computeRemovedIds(ast)]).toEqual(['A']);
  });

  it('remove * removes everything; restore $tag revives only the tagged (last writer wins)', () => {
    const ast = parse(['state A $tagA', 'state B $tagB', 'remove *', 'restore $tagA'].join('\n'));
    expect([...computeRemovedIds(ast)]).toEqual(['B']);
  });

  it('restore after remove of the same name is a no-op pair', () => {
    const ast = parse(['state A', 'state B', 'remove A', 'restore A'].join('\n'));
    expect(computeRemovedIds(ast).size).toBe(0);
  });

  it('<<stereotype>> matches by stereotype label', () => {
    const ast = parse(['state F <<choice>>', 'state G', 'remove <<choice>>'].join('\n'));
    expect([...computeRemovedIds(ast)]).toEqual(['F']);
  });

  it('remove @unlinked purges only states with no incident transition', () => {
    const ast = parse(['state a', 'state z', 'a --> b', 'remove @unlinked'].join('\n'));
    expect([...computeRemovedIds(ast)].sort()).toEqual(['z']);
  });

  it('@unlinked treats links to (non-@unlinked-)removed entities as absent', () => {
    // b's only transition goes to a, which `remove a` removes -- so b is unlinked.
    const ast = parse(['state a', 'a --> b', 'remove a', 'remove @unlinked'].join('\n'));
    expect([...computeRemovedIds(ast)].sort()).toEqual(['a', 'b']);
  });

  it('reaches into nested composites (tags on a child inside state Parent { })', () => {
    const ast = parse(
      ['state Parent {', 'state Child1 $tagX', 'state Child2', '}', 'remove $tagX'].join('\n'),
    );
    expect([...computeRemovedIds(ast)]).toEqual(['Child1']);
  });

  it('a note attached to a state counts as a visible link for @unlinked', () => {
    // z has no transition but IS the target of a note -- @unlinked must NOT
    // purge it (collectVisibleLinks includes note-target connectors).
    const ast = parse(['state a', 'state z', 'note right of z : text', 'remove @unlinked'].join('\n'));
    expect([...computeRemovedIds(ast)]).toEqual(['a']);
  });
});

describe('filterRemovedEntities at the layout boundary', () => {
  it('returns the same object when no remove directives exist', () => {
    const ast = parse('state A');
    expect(filterRemovedEntities(ast)).toBe(ast);
  });

  it('drops a removed top-level state and any transition touching it', () => {
    const ast = parse(['state A', 'state B', 'A --> B', 'remove B'].join('\n'));
    const f = filterRemovedEntities(ast);
    expect(f.states.map((s) => s.id)).toEqual(['A']);
    expect(f.transitions).toHaveLength(0);
  });

  it('recursively prunes a removed NESTED child and its inner-scope transition', () => {
    const ast = parse(
      ['state Parent {', 'state Child1 $tagX', 'state Child2', 'Child1 --> Child2', '}', 'remove $tagX'].join('\n'),
    );
    const f = filterRemovedEntities(ast);
    const parent = f.states.find((s) => s.id === 'Parent')!;
    expect(parent.children.map((c) => c.id)).toEqual(['Child2']);
    expect(parent.transitions).toHaveLength(0);
  });

  it('DOT graph excludes the removed state and its transition (xoravu-40-gebe122 shape)', () => {
    const g = captureDotGraph(
      ['state "A" as a $tagA {', '}', 'state "B" as b $tagB {', '}', 'remove $tagA'].join('\n'),
    );
    expect(nodeIds(g)).toEqual(['b']);
  });

  it('drops a note whose target state was removed', () => {
    const ast = parse(['state a $tagA', 'note right of a : text', 'remove $tagA'].join('\n'));
    const f = filterRemovedEntities(ast);
    expect(f.states).toHaveLength(0);
    expect(f.notes ?? []).toHaveLength(0);
  });
});
