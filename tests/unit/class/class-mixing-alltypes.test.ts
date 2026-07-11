/**
 * Full `CommandCreateElementFull.ALL_TYPES` keyword set (+ classdiagram's
 * `state` addition) ported into the class engine's descriptive-leaf command
 * (`CommandCreateElementFull2`).
 *
 * Regression fixtures: oracle/goldens/object/{gapisu-00-celo011,
 * ruturo-47-kapi300,togixe-65-bepo490} — an `allow_mixing` block declaring
 * every ALL_TYPES keyword self-named (e.g. `agent agent`, `storage storage`)
 * used to drop ~14 declarations per fixture: only `database|component|
 * actor|rectangle|usecase` were recognized; every other keyword line was
 * silently unmatched (dropped from the AST entirely, unless later
 * auto-vivified as a generic `class`-kind node via a relationship
 * reference).
 *
 * @see ~/git/plantuml/.../descdiagram/command/CommandCreateElementFull.java:76
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateElementFull2.java:84,239-241
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { Classifier } from '../../../src/diagrams/class/ast.js';

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return parseClass({ lines, type: 'class' } satisfies UmlSource);
}

function classifier(ast: ReturnType<typeof parseClass>, id: string): Classifier {
  const c = ast.classifiers.find((x) => x.id === id);
  if (c === undefined) throw new Error(`Expected classifier "${id}"`);
  return c;
}

// ---------------------------------------------------------------------------
// The gapisu-00-celo011 shape: every ALL_TYPES keyword, self-named, under
// `allow_mixing`. 25 declarations -> 24 'descriptive'/native-rect kinds + 1
// 'usecase' (the only ellipse).
// ---------------------------------------------------------------------------

const GAPISU_LINES = [
  'allow_mixing',
  'abstract abstract',
  'actor actor',
  'agent agent',
  'artifact artifact',
  'boundary boundary',
  'card card',
  'class class',
  'cloud cloud',
  'component component',
  'control control',
  'database database',
  'entity entity',
  'enum enum',
  'file file',
  'folder folder',
  'frame frame',
  'interface interface',
  'node node',
  'object object',
  'package package',
  'queue queue',
  'stack stack',
  'rectangle rectangle',
  'storage storage',
  'usecase usecase',
].join('\n');

describe('ALL_TYPES mixing block — descriptive leaves (gapisu shape)', () => {
  const ast = parse(GAPISU_LINES);

  it('parses all 25 declarations (previously ~11 recognized, 14 dropped)', () => {
    expect(ast.classifiers).toHaveLength(25);
  });

  it.each([
    ['actor', 'actor'],
    ['agent', 'agent'],
    ['artifact', 'artifact'],
    ['boundary', 'boundary'],
    ['card', 'card'],
    ['cloud', 'cloud'],
    ['component', 'component'],
    ['control', 'control'],
    ['database', 'database'],
    ['file', 'file'],
    ['folder', 'folder'],
    ['frame', 'frame'],
    ['node', 'node'],
    ['package', 'package'],
    ['queue', 'queue'],
    ['stack', 'stack'],
    ['rectangle', 'rectangle'],
    ['storage', 'storage'],
  ])('%s -> kind descriptive, usymbol %s', (id, usymbol) => {
    expect(classifier(ast, id)).toMatchObject({ kind: 'descriptive', usymbol });
  });

  it('usecase -> kind usecase (the only ellipse)', () => {
    expect(classifier(ast, 'usecase').kind).toBe('usecase');
  });

  it('leaves the native class-declaration keywords on their existing routing', () => {
    expect(classifier(ast, 'abstract').kind).toBe('abstract');
    expect(classifier(ast, 'class').kind).toBe('class');
    expect(classifier(ast, 'entity').kind).toBe('entity');
    expect(classifier(ast, 'enum').kind).toBe('enum');
    expect(classifier(ast, 'interface').kind).toBe('interface');
    expect(classifier(ast, 'object').kind).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// togixe-65-bepo490 adds `state state` (classdiagram-only ALL_TYPES
// superset — LeafType.STATE, rounded rect, not part of descdiagram's
// ALL_TYPES).
// ---------------------------------------------------------------------------

describe('state — classdiagram-only ALL_TYPES addition', () => {
  it('state Foo -> kind state', () => {
    const ast = parse('allow_mixing\nstate Foo');
    expect(classifier(ast, 'Foo').kind).toBe('state');
  });
});

// ---------------------------------------------------------------------------
// entity/interface/circle keep their existing native routing even though
// they are ALSO ALL_TYPES members — upstream registers CommandCreateClass /
// CommandCreateEntityObjectMultilines before CommandCreateElementFull2.
// ---------------------------------------------------------------------------

describe('entity/interface/circle — native routing unaffected', () => {
  it('entity entity stays kind entity (not descriptive)', () => {
    const ast = parse('allow_mixing\nentity entity');
    const c = classifier(ast, 'entity');
    expect(c.kind).toBe('entity');
    expect(c.usymbol).toBeUndefined();
  });

  it('circle circle stays kind circle (not descriptive)', () => {
    const ast = parse('allow_mixing\ncircle circle');
    const c = classifier(ast, 'circle');
    expect(c.kind).toBe('circle');
    expect(c.usymbol).toBeUndefined();
  });

  it('interface interface stays kind interface (not descriptive)', () => {
    const ast = parse('allow_mixing\ninterface interface');
    const c = classifier(ast, 'interface');
    expect(c.kind).toBe('interface');
    expect(c.usymbol).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// package (bare, no body) is the ALL_TYPES leaf form — distinct from
// `package X { ... }`, the CommandPackage container. A leaf `package` never
// opens a body, so it always reaches the descriptive-leaf command.
// ---------------------------------------------------------------------------

describe('package — bare leaf form vs container form', () => {
  it('bare `package package` (no body) is a descriptive leaf', () => {
    const ast = parse('allow_mixing\npackage package');
    expect(classifier(ast, 'package')).toMatchObject({
      kind: 'descriptive',
      usymbol: 'package',
    });
  });

  it('`package X { }` (with body) still opens a container, not a leaf', () => {
    const ast = parse('allow_mixing\npackage X {\nclass Inner\n}');
    // The container form creates a namespace, not a 'descriptive' classifier
    // (the child's id is namespace-qualified: 'X.Inner').
    const inner = classifier(ast, 'X.Inner');
    expect(inner.kind).toBe('class');
    expect(ast.namespaces.some((n) => n.id === 'X')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Business/port variants — accepted, documented divergence (plain rect /
// plain ellipse; no dedicated cluster-border port shape yet).
// ---------------------------------------------------------------------------

describe('business variants and ports — acceptance', () => {
  it('usecase/ business variant parses as kind usecase (ellipse, same as plain usecase)', () => {
    const ast = parse('allow_mixing\nusecase/ Foo');
    expect(classifier(ast, 'Foo').kind).toBe('usecase');
  });

  it('actor/ business variant parses as kind descriptive, usymbol actor/', () => {
    const ast = parse('allow_mixing\nactor/ Foo');
    expect(classifier(ast, 'Foo')).toMatchObject({ kind: 'descriptive', usymbol: 'actor/' });
  });

  it.each(['port', 'portin', 'portout'])(
    '%s Foo parses as a descriptive leaf (documented divergence: plain rect, not the fixed 12x12 cluster-border shape)',
    (kw) => {
      const ast = parse(`allow_mixing\n${kw} Foo`);
      expect(classifier(ast, 'Foo')).toMatchObject({ kind: 'descriptive', usymbol: kw });
    },
  );
});
