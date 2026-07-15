/**
 * Unit tests for `set separator` namespace-group synthesis
 * (src/diagrams/description/namespace-groups.ts) — pins the mechanism
 * traced in plans/description-dot-100/decision-journal.md (iteration I1)
 * before the parser/layout/magma call sites are wired up to it.
 */

import { describe, it, expect } from 'vitest';
import {
  splitNamespacePath,
  leafDisplayName,
  resolveQualifiedNode,
  buildNamespaceGroups,
  scopedKey,
  bareEntityName,
  findCollidingIds,
  dotKeyFor,
} from '../../../src/diagrams/description/namespace-groups.js';
import type { DescriptiveNode } from '../../../src/diagrams/description/ast.js';

function leaf(id: string, display = id): DescriptiveNode {
  return { id, display, symbol: 'component', children: [] };
}

function container(id: string, children: DescriptiveNode[], display = id): DescriptiveNode {
  return { id, display, symbol: 'node', children, declaredAsGroup: true };
}

// ---------------------------------------------------------------------------
// splitNamespacePath
// ---------------------------------------------------------------------------

describe('splitNamespacePath', () => {
  it('splits a dotted id into segments', () => {
    expect(splitNamespacePath('aaa.bbb1.ccc01', '.')).toEqual(['aaa', 'bbb1', 'ccc01']);
  });

  it('returns null for a non-qualified (single-segment) id', () => {
    expect(splitNamespacePath('ccc01', '.')).toBeNull();
  });

  it('returns null when the separator is null (disabled)', () => {
    expect(splitNamespacePath('aaa.bbb', null)).toBeNull();
  });

  it('returns null when the separator is undefined (unset)', () => {
    expect(splitNamespacePath('aaa.bbb', undefined)).toBeNull();
  });

  it('returns null when the separator is empty', () => {
    expect(splitNamespacePath('aaa.bbb', '')).toBeNull();
  });

  it('supports a non-dot separator', () => {
    expect(splitNamespacePath('aaa::bbb::ccc', '::')).toEqual(['aaa', 'bbb', 'ccc']);
  });
});

// ---------------------------------------------------------------------------
// leafDisplayName
// ---------------------------------------------------------------------------

describe('leafDisplayName', () => {
  it('returns only the last segment of a qualified id', () => {
    expect(leafDisplayName('aaa.bbb1.ccc01', '.')).toBe('ccc01');
  });

  it('returns the id unchanged when not qualified', () => {
    expect(leafDisplayName('ccc01', '.')).toBe('ccc01');
  });

  it('returns the id unchanged when the separator is disabled', () => {
    expect(leafDisplayName('aaa.bbb1.ccc01', null)).toBe('aaa.bbb1.ccc01');
  });
});

// ---------------------------------------------------------------------------
// resolveQualifiedNode
// ---------------------------------------------------------------------------

describe('resolveQualifiedNode', () => {
  it('walks into an existing container to find a nested entity by dotted path, plus the walked segments', () => {
    const br0 = leaf('br0');
    const tree = [container('srv1', [br0]), container('srv2', [leaf('br0', 'br0')])];
    const match = resolveQualifiedNode(tree, 'srv1.br0', '.');
    expect(match?.node).toBe(br0);
    expect(match?.segments).toEqual(['srv1', 'br0']);
  });

  it('returns undefined when the first segment does not exist', () => {
    const tree = [container('srv1', [leaf('br0')])];
    expect(resolveQualifiedNode(tree, 'srv9.br0', '.')).toBeUndefined();
  });

  it('returns undefined when an intermediate segment does not exist', () => {
    const tree = [container('srv1', [leaf('br0')])];
    expect(resolveQualifiedNode(tree, 'srv1.missing.br0', '.')).toBeUndefined();
  });

  it('returns undefined for a non-qualified id', () => {
    const tree = [leaf('br0')];
    expect(resolveQualifiedNode(tree, 'br0', '.')).toBeUndefined();
  });

  it('returns undefined when the separator is disabled', () => {
    const tree = [container('srv1', [leaf('br0')])];
    expect(resolveQualifiedNode(tree, 'srv1.br0', null)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildNamespaceGroups
// ---------------------------------------------------------------------------

describe('buildNamespaceGroups', () => {
  it('is a structural no-op when the separator is disabled', () => {
    const nodes = [leaf('aaa.bbb1.ccc01')];
    expect(buildNamespaceGroups(nodes, null)).toEqual(nodes);
  });

  it('is a structural no-op when no id is qualified', () => {
    const nodes = [leaf('a'), leaf('b')];
    expect(buildNamespaceGroups(nodes, '.')).toEqual(nodes);
  });

  it('wraps a single dotted leaf in one phantom package per segment', () => {
    const c = leaf('aaa.bbb1.ccc01', 'ccc01');
    const grouped = buildNamespaceGroups([c], '.');
    expect(grouped).toHaveLength(1);
    const aaa = grouped[0]!;
    expect(aaa).toMatchObject({ id: 'aaa', display: 'aaa', symbol: 'package', phantomGroup: true });
    expect(aaa.children).toHaveLength(1);
    const bbb1 = aaa.children[0]!;
    expect(bbb1).toMatchObject({ id: 'aaa.bbb1', display: 'bbb1', symbol: 'package', phantomGroup: true });
    expect(bbb1.children).toEqual([c]);
  });

  it('groups siblings sharing a namespace prefix under the same phantom chain', () => {
    const c1 = leaf('aaa.bbb1.ccc01', 'ccc01');
    const c2 = leaf('aaa.bbb1.ccc02', 'ccc02');
    const c3 = leaf('aaa.bbb2.ccc03', 'ccc03');
    const grouped = buildNamespaceGroups([c1, c2, c3], '.');
    expect(grouped).toHaveLength(1);
    const aaa = grouped[0]!;
    expect(aaa.children.map((n) => n.id)).toEqual(['aaa.bbb1', 'aaa.bbb2']);
    const bbb1 = aaa.children.find((n) => n.id === 'aaa.bbb1')!;
    expect(bbb1.children).toEqual([c1, c2]);
    const bbb2 = aaa.children.find((n) => n.id === 'aaa.bbb2')!;
    expect(bbb2.children).toEqual([c3]);
  });

  it('reproduces the fidati-41-kofe029 cluster-size shape: [2,6,10,14,32]', () => {
    const bbb1 = ['ccc01', 'ccc03', 'ccc04', 'ccc05', 'ccc09', 'ccc14'];
    const bbb2 = ['ccc02', 'ccc06', 'ccc07', 'ccc10', 'ccc11', 'ccc12', 'ccc23', 'ccc24', 'ccc25', 'ccc26'];
    const bbb3 = ['ccc08', 'ccc13'];
    const bbb4 = [
      'ccc15', 'ccc16', 'ccc17', 'ccc18', 'ccc19', 'ccc20', 'ccc21', 'ccc22',
      'ccc04', 'ccc27', 'ccc28', 'ccc29', 'ccc30', 'ccc25',
    ];
    const nodes = [
      ...bbb1.map((c) => leaf(`aaa.bbb1.${c}`)),
      ...bbb2.map((c) => leaf(`aaa.bbb2.${c}`)),
      ...bbb3.map((c) => leaf(`aaa.bbb3.${c}`)),
      ...bbb4.map((c) => leaf(`aaa.bbb4.${c}`)),
    ];
    const grouped = buildNamespaceGroups(nodes, '.');
    expect(grouped).toHaveLength(1);
    const aaa = grouped[0]!;
    const sizes = aaa.children.map((c) => c.children.length).sort((a, b) => a - b);
    expect(sizes).toEqual([2, 6, 10, 14]);
    expect(aaa.children.reduce((sum, c) => sum + c.children.length, 0)).toBe(32);
  });

  it('leaves an explicitly declared container child untouched and recurses into it', () => {
    const nested = leaf('aaa.bbb.ccc');
    const tree = [container('frame1', [nested])];
    const grouped = buildNamespaceGroups(tree, '.');
    expect(grouped).toHaveLength(1);
    const frame1 = grouped[0]!;
    expect(frame1.id).toBe('frame1');
    expect(frame1.phantomGroup).toBeUndefined();
    // The dotted grandchild is grouped WITHIN the explicit container.
    expect(frame1.children).toHaveLength(1);
    expect(frame1.children[0]).toMatchObject({ id: 'aaa', phantomGroup: true });
  });

  it('a node whose full id ends exactly at an intermediate segment is a direct member', () => {
    // `aaa.bbb` alongside `aaa.bbb.ccc`: `aaa.bbb` itself has no further
    // segments once `aaa` is consumed, so it lands directly in the `aaa`
    // group rather than needing its own sub-group.
    const short = leaf('aaa.bbb');
    const deep = leaf('aaa.bbb.ccc');
    const grouped = buildNamespaceGroups([short, deep], '.');
    const aaa = grouped[0]!;
    expect(aaa.children).toContainEqual(short);
  });
});

// ---------------------------------------------------------------------------
// Container-scoped identity (mission I1b)
// ---------------------------------------------------------------------------

describe('scopedKey', () => {
  it('joins segments with the internal (non-user) separator', () => {
    expect(scopedKey(['srv1', 'br0'])).toBe('srv1' + '\u0000' + 'br0');
  });

  it('returns the bare id unchanged for a zero-ancestor (root) segment list', () => {
    expect(scopedKey(['ccc01'])).toBe('ccc01');
  });
});

describe('bareEntityName', () => {
  it('strips back to the last SCOPE_KEY_SEP-delimited segment (G1 I0, display-only use)', () => {
    expect(bareEntityName(scopedKey(['srv1', 'br0']))).toBe('br0');
  });

  it('is a no-op for a key with no internal separator (the non-colliding common case)', () => {
    expect(bareEntityName('br0')).toBe('br0');
  });

  it('strips back to the LAST segment of a multi-ancestor qualified key', () => {
    expect(bareEntityName(scopedKey(['pkg1', 'srv1', 'br0']))).toBe('br0');
  });
});

describe('findCollidingIds', () => {
  it('flags a bare id declared under two DIFFERENT real containers', () => {
    const tree = [container('srv1', [leaf('br0')]), container('srv2', [leaf('br0')])];
    expect(findCollidingIds(tree)).toEqual(new Set(['br0']));
  });

  it('does NOT flag the identical id declared twice under the SAME scope', () => {
    // CommandCreateElementFull.java:319-321: a redeclaration under the same
    // quark reuses the existing entity -- not a second, distinct one.
    const tree = [leaf('aaa.bbb2.ccc02'), leaf('aaa.bbb2.ccc02')];
    expect(findCollidingIds(tree)).toEqual(new Set());
  });

  it('does not flag ids that are already globally unique', () => {
    const tree = [container('srv1', [leaf('a')]), container('srv2', [leaf('b')])];
    expect(findCollidingIds(tree)).toEqual(new Set());
  });

  it('flags a top-level id colliding with a nested id of the same bare name', () => {
    const tree = [leaf('x'), container('srv1', [leaf('x')])];
    expect(findCollidingIds(tree)).toEqual(new Set(['x']));
  });
});

describe('dotKeyFor', () => {
  it('returns the bare id when it is not a colliding id', () => {
    const colliding = new Set<string>();
    expect(dotKeyFor(['srv1'], 'br0', colliding)).toBe('br0');
  });

  it('returns the ancestor-qualified path when the id collides', () => {
    const colliding = new Set(['br0']);
    expect(dotKeyFor(['srv1'], 'br0', colliding)).toBe(scopedKey(['srv1', 'br0']));
  });

  it('a root-level participant of a collision needs no further qualification -- its path IS its bare id', () => {
    // `findCollidingIds` would only ever mark 'x' as colliding if some
    // OTHER node also uses it (at a different, non-root path) -- but THIS
    // call site's own ancestor chain is empty, so its scoped path and its
    // bare id coincide exactly.
    const colliding = new Set(['x']);
    expect(dotKeyFor([], 'x', colliding)).toBe('x');
  });
});
