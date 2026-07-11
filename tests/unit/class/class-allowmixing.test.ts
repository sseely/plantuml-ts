/**
 * `mix_` prefix descriptive leaves — upstream `CommandCreateElementFull2`
 * registers the SAME leaf-declaration command twice: once as the bare keyword
 * (`Mode.NORMAL_KEYWORD`, gated on `allowmixing` upstream — this port already
 * accepts it unconditionally, see the `allow_mixing` no-op directive in
 * class-commands.ts) and once with an unconditional `mix_` prefix
 * (`Mode.WITH_MIX_PREFIX`, no `allowmixing` gate at all — see
 * CommandCreateElementFull2.java:197-198 and ClassDiagramFactory.java:133-134).
 *
 * Regression fixture: oracle/goldens/class/cezaka-60-jado323 (`class foo1`,
 * `mix_usecase foo2`, `mix_actor foo3`, `foo1 -- foo2`) — the mix_ prefix was
 * previously unrecognized by both the class-commands.ts dispatch gate and
 * class-declaration-parser.ts's DECL_KIND_RE, silently dropping the
 * declaration line entirely (foo3 never appeared in the AST at all; foo2
 * appeared only because the relationship line auto-created it as a plain
 * generic classifier).
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { Classifier } from '../../../src/diagrams/class/ast.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph, DotInputNode } from '../../../src/core/graph-layout.js';

const measurer = new FormulaMeasurer();

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return parseClass({ lines, type: 'class' } satisfies UmlSource);
}

function classifier(ast: ReturnType<typeof parseClass>, id: string): Classifier {
  const c = ast.classifiers.find((x) => x.id === id);
  if (c === undefined) throw new Error(`Expected classifier "${id}"`);
  return c;
}

/** Layout the AST and return the captured DOT input graph's nodes. */
function captureNodes(ast: ReturnType<typeof parseClass>): DotInputNode[] {
  let captured: DotInputGraph | undefined;
  setLayoutInputObserver((g) => { captured = g; });
  try {
    layoutClass(ast, defaultTheme, measurer);
  } finally {
    setLayoutInputObserver(undefined);
  }
  if (captured === undefined) throw new Error('Expected a captured layout graph');
  return captured.nodes;
}

// ---------------------------------------------------------------------------
// Parsing: mix_ prefix recognized, unconditionally (no allowmixing needed)
// ---------------------------------------------------------------------------

describe('mix_ prefix descriptive leaves — parsing', () => {
  it('parses `mix_usecase Foo` as kind usecase with no allowmixing directive', () => {
    const ast = parse('mix_usecase Foo');
    const c = classifier(ast, 'Foo');
    expect(c.kind).toBe('usecase');
  });

  it('parses `mix_actor Foo` as kind descriptive with usymbol actor', () => {
    const ast = parse('mix_actor Foo');
    const c = classifier(ast, 'Foo');
    expect(c.kind).toBe('descriptive');
    expect(c.usymbol).toBe('actor');
  });

  it('generalizes to other descriptive leaves (mix_component, mix_rectangle)', () => {
    const ast = parse('mix_component Foo\nmix_rectangle Bar');
    expect(classifier(ast, 'Foo')).toMatchObject({ kind: 'descriptive', usymbol: 'component' });
    expect(classifier(ast, 'Bar')).toMatchObject({ kind: 'descriptive', usymbol: 'rectangle' });
  });

  it('the full cezaka-60-jado323 fixture: all three classifiers present', () => {
    const ast = parse('class foo1\nmix_usecase foo2\nmix_actor foo3\nfoo1 -- foo2');
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['foo1', 'foo2', 'foo3']);
    expect(classifier(ast, 'foo1').kind).toBe('class');
    expect(classifier(ast, 'foo2').kind).toBe('usecase');
    expect(classifier(ast, 'foo3')).toMatchObject({ kind: 'descriptive', usymbol: 'actor' });
  });

  it('a relationship to a mix_ prefixed entity resolves to its declared id', () => {
    const ast = parse('mix_usecase foo2\nclass foo1\nfoo1 -- foo2');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({ from: 'foo1', to: 'foo2' });
  });
});

// ---------------------------------------------------------------------------
// DOT shape: usecase -> ellipse, actor -> default rect (matches the oracle
// svek DOT — oracle/goldens/class/cezaka-60-jado323/svek-1.dot).
// ---------------------------------------------------------------------------

describe('mix_ prefix descriptive leaves — DOT shape', () => {
  it('mix_usecase renders shape=ellipse; mix_actor keeps the default rect', () => {
    const ast = parse('class foo1\nmix_usecase foo2\nmix_actor foo3\nfoo1 -- foo2');
    const nodes = captureNodes(ast);
    expect(nodes.find((n) => n.id === 'foo1')?.shape).toBeUndefined(); // default rect
    expect(nodes.find((n) => n.id === 'foo2')?.shape).toBe('ellipse');
    expect(nodes.find((n) => n.id === 'foo3')?.shape).toBeUndefined(); // default rect
  });

  it('sizes mix_usecase/mix_actor via the USymbol formulas, not the generic box',
    () => {
      const ast = parse('mix_usecase Longlabel\nmix_actor A');
      const nodes = captureNodes(ast);
      const uc = nodes.find((n) => n.id === 'Longlabel')!;
      const actor = nodes.find((n) => n.id === 'A')!;
      // Generic class box floors width at 100 and height at fontSize*1.4+8+4;
      // the USymbol formulas (ContainingEllipse / ActorStickMan+label) don't
      // share that floor — actor height in particular (stickman 60 + one
      // label line) is well above the generic header-only floor.
      expect(uc.width).toBeGreaterThan(0);
      expect(uc.height).toBeGreaterThan(0);
      expect(actor.height).toBeGreaterThan(60); // stickman (60) + label line
    });
});
