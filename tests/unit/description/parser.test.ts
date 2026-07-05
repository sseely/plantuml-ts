/**
 * Tests for the unified descriptive-diagram parser (parseDescription).
 *
 * Migrated and merged from:
 *   tests/unit/component/parser.test.ts  (42 cases)
 *   tests/unit/usecase/parser.test.ts    (55 cases)
 *
 * Key changes from the old per-diagram parsers:
 *   - `kind` property → `symbol` (same values, different field name)
 *   - `business-actor` → `actor-business`
 *   - `business-usecase` → `usecase-business`
 */

import { describe, it, expect } from 'vitest';
import { parseDescription } from '../../../src/diagrams/description/parser.js';
import { effectiveRemovedIds } from '../../../src/diagrams/description/element-grammar.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type {
  DescriptionDiagramAST,
  DescriptiveLink,
  DescriptiveNode,
} from '../../../src/diagrams/description/ast.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(source: string): DescriptionDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'description' };
  return parseDescription(block);
}

function firstNode(source: string): DescriptiveNode {
  const ast = parse(source);
  const node = ast.nodes[0];
  if (node === undefined) throw new Error('Expected at least one node');
  return node;
}

function firstLink(source: string): DescriptiveLink {
  const ast = parse(source);
  const link = ast.links[0];
  if (link === undefined) throw new Error('Expected at least one link');
  return link;
}

// ===========================================================================
// ──────────────────────── COMPONENT-ORIGIN TESTS ───────────────────────────
// ===========================================================================

// ---------------------------------------------------------------------------
// [Name] bracket shorthand
// ---------------------------------------------------------------------------

describe('[Name] bracket shorthand', () => {
  it('produces symbol=component with id and display set to the name', () => {
    const node = firstNode('[MyComponent]');
    expect(node.symbol).toBe('component');
    expect(node.id).toBe('MyComponent');
    expect(node.display).toBe('MyComponent');
  });

  it('produces an empty children array', () => {
    const node = firstNode('[MyComponent]');
    expect(node.children).toHaveLength(0);
  });

  it('strips leading/trailing whitespace from the bracketed name', () => {
    const node = firstNode('[ Padded ]');
    expect(node.id).toBe('Padded');
  });

  it('attaches color when trailing #token is present', () => {
    const node = firstNode('[Foo] #pink');
    expect(node.color).toBe('#pink');
    expect(node.id).toBe('Foo');
  });

  it('attaches stereotype when << ... >> is present', () => {
    const node = firstNode('[Foo] << myStereotype >>');
    expect(node.stereotype).toBe('myStereotype');
  });

  it('attaches both stereotype and color', () => {
    const node = firstNode('[Foo] << svc >> #blue');
    expect(node.stereotype).toBe('svc');
    expect(node.color).toBe('#blue');
  });
});

// ---------------------------------------------------------------------------
// () Interface shorthand
// ---------------------------------------------------------------------------

describe('() interface shorthand', () => {
  it('produces symbol=interface with id and display set to the name', () => {
    const node = firstNode('() Interface1');
    expect(node.symbol).toBe('interface');
    expect(node.id).toBe('Interface1');
    expect(node.display).toBe('Interface1');
  });

  it('produces an empty children array', () => {
    const node = firstNode('() Interface1');
    expect(node.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Explicit component keyword
// ---------------------------------------------------------------------------

describe('explicit component keyword', () => {
  it('bare component Name sets id and display to Name', () => {
    const node = firstNode('component Foo');
    expect(node.symbol).toBe('component');
    expect(node.id).toBe('Foo');
    expect(node.display).toBe('Foo');
  });

  it('component Name as Alias uses Alias as id', () => {
    const node = firstNode('component Foo as F');
    expect(node.id).toBe('F');
    expect(node.display).toBe('Foo');
  });

  it('component "Long Name" as Alias', () => {
    const node = firstNode('component "Long Name" as LN');
    expect(node.id).toBe('LN');
    expect(node.display).toBe('Long Name');
  });

  it('component with color', () => {
    const node = firstNode('component Foo #blue');
    expect(node.color).toBe('#blue');
  });

  it('component with stereotype', () => {
    const node = firstNode('component Foo << myStereotype >>');
    expect(node.stereotype).toBe('myStereotype');
  });
});

// ---------------------------------------------------------------------------
// Explicit interface keyword
// ---------------------------------------------------------------------------

describe('explicit interface keyword', () => {
  it('produces symbol=interface', () => {
    const node = firstNode('interface IFoo');
    expect(node.symbol).toBe('interface');
    expect(node.id).toBe('IFoo');
  });

  it('interface "Long Name" as Alias resolves id to alias', () => {
    const node = firstNode('interface "My Interface" as MI');
    expect(node.id).toBe('MI');
    expect(node.display).toBe('My Interface');
  });
});

// ---------------------------------------------------------------------------
// Single-line package block
// ---------------------------------------------------------------------------

describe('single-line package block', () => {
  it('parses package symbol and its inline component children', () => {
    const node = firstNode('package P { [A] [B] }');
    expect(node.symbol).toBe('package');
    expect(node.id).toBe('P');
    expect(node.children).toHaveLength(2);
    expect(node.children[0]?.id).toBe('A');
    expect(node.children[1]?.id).toBe('B');
  });

  it('inline children are not in top-level nodes list', () => {
    const ast = parse('package P { [A] [B] }');
    expect(ast.nodes).toHaveLength(1);
  });

  it('parses inline interface shorthand children', () => {
    const node = firstNode('package P { () IFoo }');
    expect(node.children).toHaveLength(1);
    expect(node.children[0]?.symbol).toBe('interface');
    expect(node.children[0]?.id).toBe('IFoo');
  });
});

// ---------------------------------------------------------------------------
// Solid arrow with label ([A] --> [B] : label)
// ---------------------------------------------------------------------------

describe('[A] --> [B] : label', () => {
  it('produces style=solid arrowHead=open with label', () => {
    const link = firstLink('[A] --> [B] : uses');
    expect(link.style).toBe('solid');
    expect(link.arrowHead).toBe('open');
    expect(link.label).toBe('uses');
    expect(link.from).toBe('A');
    expect(link.to).toBe('B');
  });

  it('link without label has no label property', () => {
    const link = firstLink('[A] --> [B]');
    expect(link.label).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Dashed arrow ([A] ..> [B])
// ---------------------------------------------------------------------------

describe('[A] ..> [B]', () => {
  it('produces style=dashed arrowHead=open', () => {
    const link = firstLink('[A] ..> [B]');
    expect(link.style).toBe('dashed');
    expect(link.arrowHead).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// Container kinds (component-origin)
// ---------------------------------------------------------------------------

describe('container kinds', () => {
  const containerSymbols = [
    'node',
    'folder',
    'frame',
    'cloud',
    'database',
    'storage',
  ] as const;

  for (const sym of containerSymbols) {
    it(`${sym} keyword produces symbol=${sym}`, () => {
      const node = firstNode(`${sym} MyContainer { [Inner] }`);
      expect(node.symbol).toBe(sym);
    });
  }
});

// ---------------------------------------------------------------------------
// Multi-line container block
// ---------------------------------------------------------------------------

describe('multi-line container block', () => {
  it('children appear in parent.children, not top-level nodes', () => {
    const ast = parse(`
      package P {
        [A]
        [B]
      }
    `);
    expect(ast.nodes).toHaveLength(1);
    const pkg = ast.nodes[0]!;
    expect(pkg.symbol).toBe('package');
    expect(pkg.children).toHaveLength(2);
    expect(pkg.children[0]?.id).toBe('A');
    expect(pkg.children[1]?.id).toBe('B');
  });

  it('supports interface children inside multi-line block', () => {
    const ast = parse(`
      package P {
        () IFoo
        interface IBar
      }
    `);
    const pkg = ast.nodes[0]!;
    expect(pkg.children).toHaveLength(2);
    expect(pkg.children[0]?.symbol).toBe('interface');
    expect(pkg.children[1]?.symbol).toBe('interface');
  });

  it('top-level nodes after the closing brace are not nested', () => {
    const ast = parse(`
      package P {
        [A]
      }
      [B]
    `);
    expect(ast.nodes).toHaveLength(2);
    expect(ast.nodes[0]?.id).toBe('P');
    expect(ast.nodes[1]?.id).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Solid no-arrow link ([A] -- [B])
// ---------------------------------------------------------------------------

describe('[A] -- [B]', () => {
  it('produces style=solid arrowHead=none', () => {
    const link = firstLink('[A] -- [B]');
    expect(link.style).toBe('solid');
    expect(link.arrowHead).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Link arrow variants
// ---------------------------------------------------------------------------

describe('link arrow variants', () => {
  it('[A] .. [B] produces dashed arrowHead=none', () => {
    const link = firstLink('[A] .. [B]');
    expect(link.style).toBe('dashed');
    expect(link.arrowHead).toBe('none');
  });

  it('[A] ->> [B] produces solid arrowHead=filled', () => {
    const link = firstLink('[A] ->> [B]');
    expect(link.style).toBe('solid');
    expect(link.arrowHead).toBe('filled');
  });

  it('() IFoo --> [Comp] resolves interface endpoint correctly', () => {
    const link = firstLink('() IFoo --> [Comp]');
    expect(link.from).toBe('IFoo');
    expect(link.to).toBe('Comp');
    expect(link.style).toBe('solid');
  });
});

// ---------------------------------------------------------------------------
// Arrow length (upstream Link.getLength() — count of '-'/'.' in the token).
// Drives SvekEdge.isHorizontal() (length === 1) which determines whether a
// labeled link's dzeta feeds nodesep (length 1) or ranksep (length > 1).
// ---------------------------------------------------------------------------

describe('arrow length (Link.getLength)', () => {
  const table: Array<[string, number]> = [
    ['->', 1],
    ['-->', 2],
    ['->>', 1],
    ['--', 2],
    ['..', 2],
    ['.>', 1],
    ['..>', 2],
  ];

  for (const [arrow, length] of table) {
    it(`[A] ${arrow} [B] has length=${length}`, () => {
      const link = firstLink(`[A] ${arrow} [B]`);
      expect(link.length).toBe(length);
    });
  }
});

// ---------------------------------------------------------------------------
// Ignored directives (component-origin)
// ---------------------------------------------------------------------------

describe('ignored directives', () => {
  it('skinparam lines produce no nodes or links', () => {
    const ast = parse('skinparam componentStyle rectangle');
    expect(ast.nodes).toHaveLength(0);
    expect(ast.links).toHaveLength(0);
  });

  it('title lines are ignored', () => {
    const ast = parse('title My Diagram');
    expect(ast.nodes).toHaveLength(0);
  });

  it('hide lines are ignored', () => {
    const ast = parse('hide stereotype');
    expect(ast.nodes).toHaveLength(0);
  });

  it('comment lines starting with single-quote are ignored', () => {
    const ast = parse("' this is a comment\n[A]");
    expect(ast.nodes).toHaveLength(1);
  });

  it('blank lines are ignored', () => {
    const ast = parse('\n\n[A]\n\n');
    expect(ast.nodes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// `remove <id>` — CommandRemoveRestore.java, simple-identifier `WHAT` form
// (mission dot-oracle-sync, phase 2 iteration 5). `<<stereotype>>`/`@unlinked`
// matching is a separate, out-of-scope HideOrShow pattern-matching feature.
// ---------------------------------------------------------------------------

describe('remove <id> (CommandRemoveRestore, simple-identifier form)', () => {
  it('marks a top-level leaf node removed (lazy marker, not a splice)', () => {
    const ast = parse('component A\ncomponent B\nremove A');
    // Upstream isRemoved is a lazy print-time marker: A stays in the AST
    // (magma/degenerate counts are unfiltered) but is effectively removed.
    expect(ast.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    expect([...effectiveRemovedIds(ast.nodes, ast.links)]).toEqual(['A']);
  });

  it('restore clears the marker', () => {
    const ast = parse('component A\nremove A\nrestore A');
    expect(effectiveRemovedIds(ast.nodes, ast.links).size).toBe(0);
  });

  it('remove * marks everything; restore $tag brings tagged back', () => {
    const ast = parse('component a $t\ncomponent b\nremove *\nrestore $t');
    expect([...effectiveRemovedIds(ast.nodes, ast.links)]).toEqual(['b']);
  });

  it('removing a container removes its whole subtree (gogosu-37)', () => {
    const ast = parse('component a {\n component a_sub\n}\nremove a');
    const removed = effectiveRemovedIds(ast.nodes, ast.links);
    expect(removed.has('a')).toBe(true);
    expect(removed.has('a_sub')).toBe(true);
  });

  it('removes a leaf nested inside a still-open container', () => {
    const ast = parse('package P {\n  component A\n  component B\n}\nremove A');
    const pkg = ast.nodes.find((n) => n.id === 'P')!;
    expect(pkg.children.map((n) => n.id)).toEqual(['A', 'B']);
    expect(effectiveRemovedIds(ast.nodes, ast.links).has('A')).toBe(true);
  });

  it('removes a leaf from a container whose block already closed', () => {
    // frame f1 { component A } — the block closes before `remove A` runs;
    // the marker must still find A via nodesById, not containerStack.
    const ast = parse('frame f1 {\n  component A\n}\ncomponent B\nremove A');
    expect(effectiveRemovedIds(ast.nodes, ast.links).has('A')).toBe(true);
    expect(ast.nodes.map((n) => n.id)).toEqual(['f1', 'B']);
  });

  it('removing an unknown id is a silent no-op', () => {
    const ast = parse('component A\nremove ghost');
    expect(ast.nodes.map((n) => n.id)).toEqual(['A']);
  });
});

// ---------------------------------------------------------------------------
// Direction directive (rankdir) — CommandRankDir.java. `left to right
// direction` sets skinparam Rankdir=LR; `top to bottom direction` and the
// unset default both leave rankdir undefined (upstream emits no `rankdir`
// attribute for TB, which is the default).
// ---------------------------------------------------------------------------

describe('direction directive (rankdir)', () => {
  it('`left to right direction` sets ast.rankdir="LR"', () => {
    const ast = parse('left to right direction');
    expect(ast.rankdir).toBe('LR');
  });

  it('`left to right direction` produces no nodes or links', () => {
    const ast = parse('left to right direction');
    expect(ast.nodes).toHaveLength(0);
    expect(ast.links).toHaveLength(0);
  });

  it('is case-insensitive: "LEFT TO RIGHT DIRECTION" sets rankdir="LR"', () => {
    const ast = parse('LEFT TO RIGHT DIRECTION');
    expect(ast.rankdir).toBe('LR');
  });

  it('tolerates extra whitespace between words', () => {
    const ast = parse('left   to  right    direction');
    expect(ast.rankdir).toBe('LR');
  });

  it('`top to bottom direction` leaves rankdir undefined (explicit TB no-op)', () => {
    const ast = parse('top to bottom direction');
    expect(ast.rankdir).toBeUndefined();
  });

  it('`top to bottom direction` produces no nodes', () => {
    const ast = parse('top to bottom direction');
    expect(ast.nodes).toHaveLength(0);
  });

  it('rankdir is undefined by default (no direction directive present)', () => {
    const ast = parse('[A]\n[B]');
    expect(ast.rankdir).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Default AST shape
// ---------------------------------------------------------------------------

describe('default AST shape', () => {
  it('returns empty nodes and links for empty input', () => {
    const ast = parse('');
    expect(ast.nodes).toEqual([]);
    expect(ast.links).toEqual([]);
  });

  it('multiple top-level components appear in nodes array', () => {
    const ast = parse('[A]\n[B]\n[C]');
    expect(ast.nodes).toHaveLength(3);
  });

  it('multiple links appear in links array', () => {
    const ast = parse('[A] --> [B]\n[B] --> [C]');
    expect(ast.links).toHaveLength(2);
  });
});

// ===========================================================================
// ──────────────────────── USE-CASE-ORIGIN TESTS ────────────────────────────
// ===========================================================================

// ---------------------------------------------------------------------------
// Actor declarations
// ---------------------------------------------------------------------------

describe('actor declarations', () => {
  it('AC-1: parses a simple actor keyword', () => {
    const ast = parse('actor User');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor',
      id: 'User',
      display: 'User',
    });
  });

  it('AC-2: parses actor with quoted name and alias', () => {
    const ast = parse('actor "Admin User" as AU');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor',
      id: 'AU',
      display: 'Admin User',
    });
  });

  it('AC-3: parses actor with single-quoted name and alias', () => {
    const ast = parse("actor 'Complex Name' as CN");
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor',
      id: 'CN',
      display: 'Complex Name',
    });
  });

  it('AC-4: parses actor with color', () => {
    const ast = parse('actor User #pink');
    const node = ast.nodes[0];
    expect(node?.symbol).toBe('actor');
    expect(node?.id).toBe('User');
    expect(node?.color).toBe('#pink');
  });

  it('AC-5: parses colon shorthand :Admin Actor:', () => {
    const ast = parse(':Admin Actor:');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor',
      id: 'Admin Actor',
      display: 'Admin Actor',
    });
  });

  it('AC-6: actors have empty children array', () => {
    const ast = parse('actor X');
    expect(ast.nodes[0]?.children).toEqual([]);
  });

  it('AC-7: parses actor with unquoted alias (PlainName as Alias form)', () => {
    const ast = parse('actor User as U');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'actor', id: 'U', display: 'User' });
  });
});

// ---------------------------------------------------------------------------
// Use-case declarations
// ---------------------------------------------------------------------------

describe('use case declarations', () => {
  it('UC-1: parses parenthesis shorthand (Login)', () => {
    const ast = parse('(Login)');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'usecase',
      id: 'Login',
      display: 'Login',
    });
  });

  it('UC-2: parses usecase keyword with plain name', () => {
    const ast = parse('usecase UC1');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'usecase', id: 'UC1', display: 'UC1' });
  });

  it('UC-3: parses usecase "Display" as Alias', () => {
    const ast = parse('usecase "Do Thing" as UC1');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'usecase',
      id: 'UC1',
      display: 'Do Thing',
    });
  });

  it('UC-4: parses usecase UC1 as single-quoted display name', () => {
    const ast = parse("usecase UC1 as 'Do Thing'");
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'usecase',
      id: 'UC1',
      display: 'Do Thing',
    });
  });

  it('UC-5: parses usecase with parens in keyword form', () => {
    const ast = parse('usecase (Login)');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'usecase',
      id: 'Login',
      display: 'Login',
    });
  });

  it('UC-9: parses usecase (Name) as Alias form', () => {
    const ast = parse('usecase (Login) as UC1');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'usecase',
      id: 'UC1',
      display: 'Login',
    });
  });

  it('UC-6: parses usecase with color', () => {
    const ast = parse('usecase UC1 #yellow');
    const node = ast.nodes[0];
    expect(node?.symbol).toBe('usecase');
    expect(node?.color).toBe('#yellow');
  });

  it('UC-7: use cases have empty children array', () => {
    const ast = parse('(Pay)');
    expect(ast.nodes[0]?.children).toEqual([]);
  });

  it('UC-8: parses usecase with double-quoted display (id-first form)', () => {
    const ast = parse('usecase UC2 as "Do Another Thing"');
    expect(ast.nodes[0]).toMatchObject({ id: 'UC2', display: 'Do Another Thing' });
  });
});

// ---------------------------------------------------------------------------
// Links (use-case-origin)
// ---------------------------------------------------------------------------

describe('links (use-case)', () => {
  it('LK-1: parses solid arrow -->', () => {
    const ast = parse('User --> (Login)');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({
      from: 'User',
      to: 'Login',
      style: 'solid',
    });
  });

  it('LK-2: parses solid no-arrow line --', () => {
    const ast = parse('(A) -- (B)');
    expect(ast.links[0]).toMatchObject({ from: 'A', to: 'B', style: 'solid' });
  });

  it('LK-3: parses dashed arrow ..> with <<include>> stereotype', () => {
    const ast = parse('(Login) ..> (Validate) : <<include>>');
    const link = ast.links[0];
    expect(link).toMatchObject({ style: 'dashed', stereotype: 'include' });
    expect(link?.from).toBe('Login');
    expect(link?.to).toBe('Validate');
    expect(link?.label).toBeUndefined();
  });

  it('LK-4: parses dashed arrow .. (no arrow head) with <<include>>', () => {
    const ast = parse('(Login) .. (Validate) : <<include>>');
    expect(ast.links[0]).toMatchObject({ style: 'dashed', stereotype: 'include' });
  });

  it('LK-5: parses dashed arrow .> with <<extend>> stereotype', () => {
    const ast = parse('(Feature) .> (Base) : <<extend>>');
    expect(ast.links[0]).toMatchObject({ style: 'dashed', stereotype: 'extend' });
  });

  it('LK-6: parses custom stereotype', () => {
    const ast = parse('(A) ..> (B) : <<uses>>');
    expect(ast.links[0]).toMatchObject({ stereotype: 'uses', style: 'dashed' });
  });

  it('LK-7: parses link with plain label (no stereotype)', () => {
    const ast = parse('User --> (Login) : click here');
    expect(ast.links[0]).toMatchObject({ label: 'click here', style: 'solid' });
    expect(ast.links[0]?.stereotype).toBeUndefined();
  });

  it('LK-8: strips <<stereotype>> but keeps remaining text as label', () => {
    const ast = parse('(A) ..> (B) : some text <<include>>');
    const link = ast.links[0];
    expect(link?.stereotype).toBe('include');
    expect(link?.label).toBe('some text');
  });

  it('LK-9: link with no label has no label property', () => {
    const ast = parse('User --> (Login)');
    expect(ast.links[0]?.label).toBeUndefined();
  });

  it('LK-10: resolves colon endpoint :Actor: in link', () => {
    const ast = parse(':Admin: --> (Dashboard)');
    expect(ast.links[0]).toMatchObject({ from: 'Admin', to: 'Dashboard' });
  });

  it('LK-11: resolves paren endpoint (UseCase) in link from side', () => {
    const ast = parse('(A) --> (B)');
    expect(ast.links[0]).toMatchObject({ from: 'A', to: 'B', style: 'solid' });
  });

  it('LK-12: parses -> as solid link', () => {
    const ast = parse('User -> (Login)');
    expect(ast.links[0]).toMatchObject({ style: 'solid', from: 'User', to: 'Login' });
  });
});

// ---------------------------------------------------------------------------
// CommandLinkElement.java link grammar — direction hints, decors, styles,
// qualifier labels, and auto-created endpoints.
// ---------------------------------------------------------------------------

describe('link grammar — direction hints (StringUtils.getQueueDirection)', () => {
  it('LG-1: a -> b has length=1, no inversion', () => {
    const ast = parse('a -> b');
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b', length: 1 });
  });

  it('LG-2: a --> b has length=2, no inversion', () => {
    const ast = parse('a --> b');
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b', length: 2 });
  });

  it('LG-3: a -r-> b explicit right direction: length=1, no inversion', () => {
    const ast = parse('a -r-> b');
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b', length: 1 });
  });

  it('LG-4: a -left-> b is inverted (from=b, to=a), length=1', () => {
    const ast = parse('a -left-> b');
    expect(ast.links[0]).toMatchObject({ from: 'b', to: 'a', length: 1 });
  });

  it('LG-5: a -up-> b is inverted (from=b, to=a), length=2 (queue as written)', () => {
    const ast = parse('a -up-> b');
    expect(ast.links[0]).toMatchObject({ from: 'b', to: 'a', length: 2 });
  });
});

describe('link grammar — inline [style] brackets and hidden links', () => {
  it('LG-6: a -[#blue,dashed;#red]-> b : test — edge exists, label parsed', () => {
    const ast = parse('a -[#blue,dashed;#red]-> b : test');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({
      from: 'a', to: 'b', label: 'test', rawStyle: '#blue,dashed;#red',
    });
  });

  it('LG-7: net -[hidden]- eth1 — edge exists with hidden flag set', () => {
    const ast = parse('net -[hidden]- eth1');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'net', to: 'eth1', hidden: true });
  });
});

describe('link grammar — reversed arrow decor (<-)', () => {
  it('LG-8: x <- y keeps from/to orientation (no explicit direction token)', () => {
    const ast = parse('x <- y');
    expect(ast.links[0]).toMatchObject({ from: 'x', to: 'y', length: 1 });
  });
});

describe('link grammar — stereotype and qualifier labels', () => {
  it('LG-9: x ..> y : <<use>> parses dashed stereotype link', () => {
    const ast = parse('x ..> y : <<use>>');
    expect(ast.links[0]).toMatchObject({ from: 'x', to: 'y', style: 'dashed', stereotype: 'use' });
  });

  it('LG-10: a "1" --> "0..*" b : label carries first/second qualifier labels', () => {
    const ast = parse('a "1" --> "0..*" b : label');
    expect(ast.links[0]).toMatchObject({
      from: 'a', to: 'b', firstLabel: '1', secondLabel: '0..*', label: 'label',
    });
  });
});

describe('link grammar — auto-created endpoints (CommandLinkElement.getDummy)', () => {
  it('LG-11: A --> B with no prior declarations resolves both to interface', () => {
    // STILL_UNKNOWN endpoints mute at parse end: no usecase/actor leaf in
    // the diagram, so DescriptionDiagram.makeDiagramReady picks INTERFACE.
    const ast = parse('A --> B');
    expect(ast.nodes).toHaveLength(2);
    expect(ast.nodes[0]).toMatchObject({ id: 'A', symbol: 'interface' });
    expect(ast.nodes[1]).toMatchObject({ id: 'B', symbol: 'interface' });
    expect(ast.links[0]).toMatchObject({ from: 'A', to: 'B' });
  });

  it('LG-11b: bare endpoints resolve to actor when the diagram has a usecase', () => {
    const ast = parse('(uc)\nA --> B');
    const a = ast.nodes.find((n) => n.id === 'A');
    expect(a).toMatchObject({ symbol: 'actor' });
  });

  it('LG-12: (A) ..> (B) auto-creates both as usecase', () => {
    const ast = parse('(A) ..> (B)');
    expect(ast.nodes).toHaveLength(2);
    expect(ast.nodes[0]).toMatchObject({ id: 'A', symbol: 'usecase' });
    expect(ast.nodes[1]).toMatchObject({ id: 'B', symbol: 'usecase' });
  });

  it('LG-13: :u: -> [c] auto-creates actor + component', () => {
    const ast = parse(':u: -> [c]');
    expect(ast.nodes).toHaveLength(2);
    expect(ast.nodes[0]).toMatchObject({ id: 'u', symbol: 'actor' });
    expect(ast.nodes[1]).toMatchObject({ id: 'c', symbol: 'component' });
  });

  it('LG-14: (x)/ auto-creates a business usecase', () => {
    const ast = parse('(x)/ --> y');
    expect(ast.nodes[0]).toMatchObject({ id: 'x', symbol: 'usecase-business' });
  });

  it('LG-15: :y:/ auto-creates a business actor', () => {
    const ast = parse(':y:/ --> z');
    expect(ast.nodes[0]).toMatchObject({ id: 'y', symbol: 'actor-business' });
  });

  it('LG-16: auto-created endpoints inside a container join that container', () => {
    const ast = parse(`
      package P {
        M --> N
      }
    `);
    const pkg = ast.nodes[0]!;
    expect(pkg.children).toHaveLength(2);
    expect(pkg.children[0]).toMatchObject({ id: 'M' });
    expect(pkg.children[1]).toMatchObject({ id: 'N' });
  });

  it('LG-17: an already-declared endpoint is not duplicated', () => {
    const ast = parse(`
      [Comp]
      Comp --> Other
    `);
    expect(ast.nodes).toHaveLength(2);
    expect(ast.nodes[0]).toMatchObject({ id: 'Comp', symbol: 'component' });
    // 'Other' is STILL_UNKNOWN; no usecase/actor leaf here -> interface.
    expect(ast.nodes[1]).toMatchObject({ id: 'Other', symbol: 'interface' });
  });
});

// ---------------------------------------------------------------------------
// Containers (use-case-origin)
// ---------------------------------------------------------------------------

describe('containers (use-case)', () => {
  it('CT-1: single-line rectangle with inline children', () => {
    const ast = parse('rectangle System { (Login) (Logout) }');
    expect(ast.nodes).toHaveLength(1);
    const rect = ast.nodes[0];
    expect(rect?.symbol).toBe('rectangle');
    expect(rect?.id).toBe('System');
    expect(rect?.children).toHaveLength(2);
    expect(rect?.children[0]).toMatchObject({ symbol: 'usecase', id: 'Login' });
    expect(rect?.children[1]).toMatchObject({ symbol: 'usecase', id: 'Logout' });
  });

  it('CT-2: multi-line rectangle block', () => {
    const ast = parse(`
      rectangle System {
        (Login)
        (Logout)
      }
    `);
    const rect = ast.nodes[0];
    expect(rect?.symbol).toBe('rectangle');
    expect(rect?.children).toHaveLength(2);
  });

  it('CT-3: package container symbol', () => {
    const ast = parse(`
      package "My App" {
        (Login)
      }
    `);
    const node = ast.nodes[0];
    expect(node?.symbol).toBe('package');
    expect(node?.id).toBe('My App');
    expect(node?.children[0]?.id).toBe('Login');
  });

  it('CT-4: nested container nodes do not appear in top-level nodes', () => {
    const ast = parse(`
      rectangle Sys {
        (Search)
      }
    `);
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]?.children).toHaveLength(1);
  });

  it('CT-5: single-line cloud container', () => {
    const ast = parse('cloud Internet { (Browse) }');
    expect(ast.nodes[0]?.symbol).toBe('cloud');
    expect(ast.nodes[0]?.children[0]?.id).toBe('Browse');
  });

  it('CT-6: multi-line block with actor child', () => {
    const ast = parse(`
      rectangle Scope {
        actor Admin
      }
    `);
    const rect = ast.nodes[0];
    expect(rect?.children[0]).toMatchObject({ symbol: 'actor', id: 'Admin' });
  });

  it('CT-7: single-line container with colon-actor shorthand in body', () => {
    const ast = parse('rectangle HR { :Employee: }');
    const rect = ast.nodes[0];
    expect(rect?.symbol).toBe('rectangle');
    expect(rect?.children[0]).toMatchObject({ symbol: 'actor', id: 'Employee' });
  });
});

// ---------------------------------------------------------------------------
// Ignored lines (use-case-origin)
// ---------------------------------------------------------------------------

describe('ignored lines (use-case)', () => {
  it('IG-1: skinparam lines are ignored', () => {
    const ast = parse('skinparam ActorBorderColor black');
    expect(ast.nodes).toHaveLength(0);
    expect(ast.links).toHaveLength(0);
  });

  it('IG-2: title lines are ignored', () => {
    const ast = parse('title My Use Case Diagram');
    expect(ast.nodes).toHaveLength(0);
  });

  it('IG-3: hide/show lines are ignored', () => {
    const ast = parse('hide stereotype');
    expect(ast.nodes).toHaveLength(0);
  });

  it('IG-4: direction directives are ignored', () => {
    const ast = parse('left to right direction');
    expect(ast.nodes).toHaveLength(0);
  });

  it('IG-5: comment lines starting with single quote are ignored', () => {
    const ast = parse("' this is a comment\nactor User");
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]?.id).toBe('User');
  });

  it('IG-6: blank lines are ignored', () => {
    const ast = parse('\n\n\nactor Bob\n\n');
    expect(ast.nodes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Mixed diagram
// ---------------------------------------------------------------------------

describe('mixed diagram', () => {
  it('MX-1: full diagram with actors, use cases, and links', () => {
    const src = `
      actor User
      actor "Admin" as AD
      (Login)
      (Dashboard)
      User --> (Login)
      AD --> (Dashboard)
      (Login) ..> (Validate) : <<include>>
    `;
    const ast = parse(src);
    // Validate is never declared — CommandLinkElement.getDummy auto-creates
    // it as a 5th top-level usecase node (paren shorthand `(Validate)`).
    expect(ast.nodes).toHaveLength(5);
    expect(ast.nodes[4]).toMatchObject({ id: 'Validate', symbol: 'usecase' });
    expect(ast.links).toHaveLength(3);
    expect(ast.links[2]).toMatchObject({ stereotype: 'include', style: 'dashed' });
  });

  it('MX-2: node ids from paren and colon shorthands resolve consistently in links', () => {
    const ast = parse(`
      :Customer:
      (Buy Product)
      :Customer: --> (Buy Product)
    `);
    expect(ast.links[0]).toMatchObject({ from: 'Customer', to: 'Buy Product' });
  });
});

// ---------------------------------------------------------------------------
// Business element symbols (renamed from old business-actor/business-usecase)
// ---------------------------------------------------------------------------

describe('business element symbols', () => {
  it('BA-1: :joe2:/ produces actor-business with display="joe2"', () => {
    const ast = parse(':joe2:/');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor-business',
      id: 'joe2',
      display: 'joe2',
    });
  });

  it('BA-2: :joe2: / (space before slash) produces actor-business', () => {
    const ast = parse(':joe2: /');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'actor-business', display: 'joe2' });
  });

  it('BA-3: :joe: (no slash) still produces plain actor (no regression)', () => {
    const ast = parse(':joe:');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'actor', display: 'joe' });
  });

  it('BA-4: display name is trimmed — ": My Actor :/" → display="My Actor"', () => {
    const ast = parse(': My Actor :/');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'actor-business', display: 'My Actor' });
  });

  it('BU-1: (run)/ produces usecase-business with display="run"', () => {
    const ast = parse('(run)/');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'usecase-business',
      id: 'run',
      display: 'run',
    });
  });

  it('BU-2: (run) / (space before slash) produces usecase-business', () => {
    const ast = parse('(run) /');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'usecase-business', display: 'run' });
  });

  it('BU-3: (walk) (no slash) still produces plain usecase (no regression)', () => {
    const ast = parse('(walk)');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'usecase', display: 'walk' });
  });

  it('BU-4: display name is trimmed — "( My UC )/" → display="My UC"', () => {
    const ast = parse('( My UC )/');
    expect(ast.nodes[0]).toMatchObject({ symbol: 'usecase-business', display: 'My UC' });
  });

  it('BK-1: actor/ keyword form produces actor-business', () => {
    const ast = parse('actor/ Joe');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor-business',
      id: 'Joe',
      display: 'Joe',
    });
  });

  it('BK-2: actor/ keyword with alias produces actor-business', () => {
    const ast = parse('actor/ "Business User" as BU');
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor-business',
      id: 'BU',
      display: 'Business User',
    });
  });

  it('BK-3: actor-business and usecase-business have empty children array', () => {
    const ast = parse(':joe:/\n(pay)/');
    for (const node of ast.nodes) {
      expect(node.children).toEqual([]);
    }
  });
});

// ===========================================================================
// ── CONTAINER-OPEN KEYWORD SET — CommandPackageWithUSymbol.java allows 17
//    keywords to open a `{` group; `component "display" as alias {` must
//    parse as a container, not a mangled leaf id (babafi-51 regression)
// ===========================================================================

describe('parseDescription — container-open keyword coverage', () => {
  it('component with quoted display + alias + braces parses as container', () => {
    const ast = parse([
      'component "b\\n====\\ncan be used by a" as b {',
      '}',
      'a -> b',
      'actor a',
    ].join('\n'));
    const b = ast.nodes.find((n) => n.id === 'b');
    expect(b).toBeDefined();
    expect(b!.symbol).toBe('component');
    expect(b!.display).toBe('b\\n====\\ncan be used by a');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]!.to).toBe('b');
  });

  it.each(['artifact', 'card', 'queue', 'stack', 'hexagon', 'file'])(
    '%s opens a brace group with children',
    (kw) => {
      const ast = parse([`${kw} G {`, '[inner]', '}'].join('\n'));
      const g = ast.nodes.find((n) => n.id === 'G');
      expect(g).toBeDefined();
      expect(g!.symbol).toBe(kw);
      expect(g!.children.map((c) => c.id)).toEqual(['inner']);
    },
  );
});

// ===========================================================================
// ── EMBEDDED QUALIFIERS IN POST-COLON LABEL — Labels.java init():
//    : "1" uses "many" → firstLabel/label/secondLabel
// ===========================================================================

describe('parseDescription — embedded qualifier labels (Labels.init)', () => {
  it('both qualifiers: a --> b : "1" uses "many"', () => {
    const ast = parse('component a\ncomponent b\na --> b : "1" uses "many"');
    const l = ast.links[0]!;
    expect(l.firstLabel).toBe('1');
    expect(l.label).toBe('uses');
    expect(l.secondLabel).toBe('many');
  });

  it('first only: a --> b : "1" uses', () => {
    const ast = parse('component a\ncomponent b\na --> b : "1" uses');
    const l = ast.links[0]!;
    expect(l.firstLabel).toBe('1');
    expect(l.label).toBe('uses');
    expect(l.secondLabel).toBeUndefined();
  });

  it('second only: a --> b : uses "many"', () => {
    const ast = parse('component a\ncomponent b\na --> b : uses "many"');
    const l = ast.links[0]!;
    expect(l.firstLabel).toBeUndefined();
    expect(l.label).toBe('uses');
    expect(l.secondLabel).toBe('many');
  });

  it('explicit quoted qualifiers win over embedded parsing', () => {
    const ast = parse('component a\ncomponent b\na "1" --> "many" b : uses');
    const l = ast.links[0]!;
    expect(l.firstLabel).toBe('1');
    expect(l.secondLabel).toBe('many');
    expect(l.label).toBe('uses');
  });
});


// ===========================================================================
// ── NOTES AS SVEK ENTITIES — CommandFactoryNote / CommandFactoryNoteOnEntity /
//    CommandFactoryNoteOnLink (net.sourceforge.plantuml.command.note)
// ===========================================================================

describe('notes — floating (CommandFactoryNote)', () => {
  it('single-line `note "text" as N` creates a note leaf', () => {
    const node = firstNode('note "This is a note" as N1');
    expect(node.symbol).toBe('note');
    expect(node.id).toBe('N1');
    expect(node.display).toBe('This is a note');
  });

  it('multi-line `note as N` ... `end note` joins body lines with \\n', () => {
    const ast = parse('note as tott\ntoto\nend note');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]!.symbol).toBe('note');
    expect(ast.nodes[0]!.id).toBe('tott');
    expect(ast.nodes[0]!.display).toBe('toto');
  });

  it('a floating note usable as a link endpoint', () => {
    const ast = parse([
      'component bidon',
      'note "This is a note" as N1',
      'bidon . N1',
    ].join('\n'));
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]!.to).toBe('N1');
  });

  it('component + floating note yields two top-level nodes (not degenerate)', () => {
    const ast = parse('component dummy\nnote as tott\ntoto\nend note');
    expect(ast.nodes).toHaveLength(2);
    expect(ast.nodes.map((n) => n.symbol)).toEqual(['component', 'note']);
    expect(ast.links).toHaveLength(0);
  });
});

describe('notes — on entity (CommandFactoryNoteOnEntity)', () => {
  it('`note right of a: text` attaches a dashed link entity->note, length 1', () => {
    const ast = parse('component a\nnote right of a: test_a');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    expect(note).toBeDefined();
    expect(note!.display).toBe('test_a');
    const link = ast.links[0]!;
    expect(link.from).toBe('a');
    expect(link.to).toBe(note!.id);
    expect(link.length).toBe(1);
    expect(link.style).toBe('dashed');
  });

  it('`note left of a: text` attaches a dashed link note->entity, length 1', () => {
    const ast = parse('component a\nnote left of a: text');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    const link = ast.links[0]!;
    expect(link.from).toBe(note!.id);
    expect(link.to).toBe('a');
    expect(link.length).toBe(1);
  });

  it('`note bottom of a` block attaches entity->note, length 2', () => {
    const ast = parse('component a\nnote bottom of a\nhandwritten seems KO\nend note');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    expect(note!.display).toBe('handwritten seems KO');
    const link = ast.links[0]!;
    expect(link.from).toBe('a');
    expect(link.to).toBe(note!.id);
    expect(link.length).toBe(2);
  });

  it('`note top of a` block attaches note->entity, length 2', () => {
    const ast = parse('component a\nnote top of a\ntext\nend note');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    const link = ast.links[0]!;
    expect(link.from).toBe(note!.id);
    expect(link.to).toBe('a');
    expect(link.length).toBe(2);
  });

  it('`note left: text` (no `of X`) attaches to the last created entity', () => {
    const ast = parse('component a\ncomponent b\nnote left: i7');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    const link = ast.links[0]!;
    expect(link.from).toBe(note!.id);
    expect(link.to).toBe('b');
  });

  it('a body-text line resembling another command is not misparsed inside the block', () => {
    // cumofi-94-lixe862: the note body contains a literal "on note" line.
    const ast = parse('component a\nnote left of a\nhandwritten seems KO\non note\nend note');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    expect(note!.display).toBe('handwritten seems KO\non note');
  });

  it('a note inside a container lands in that container, not top-level', () => {
    const ast = parse([
      'cloud "Network" as Netw {',
      'node "PC1"',
      'note left: i7',
      '}',
    ].join('\n'));
    const cloud = ast.nodes.find((n) => n.id === 'Netw')!;
    const note = cloud.children.find((n) => n.symbol === 'note');
    expect(note).toBeDefined();
    expect(ast.nodes.some((n) => n.symbol === 'note')).toBe(false);
  });

  it('an unresolvable `of X` target is skipped entirely (no note, no link)', () => {
    const ast = parse('component a\nnote right of nosuch: text');
    expect(ast.nodes.some((n) => n.symbol === 'note')).toBe(false);
    expect(ast.links).toHaveLength(0);
  });

  it('`left to right direction` rotates note positions 90° (Position.withRankdir)', () => {
    // RIGHT -> BOTTOM under LR: entity->note becomes length 2, not 1.
    const ast = parse('left to right direction\ncomponent a\nnote right of a: text');
    const link = ast.links[0]!;
    expect(link.length).toBe(2);
  });
});

describe('notes — on link (CommandFactoryNoteOnLink, parsed and dropped)', () => {
  it('single-line `note on link: text` produces no note node', () => {
    const ast = parse('component a\ncomponent b\na --> b\nnote on link: text');
    expect(ast.nodes.some((n) => n.symbol === 'note')).toBe(false);
  });

  it('multi-line `note on link` ... `end note` produces no note node', () => {
    const ast = parse('component a\ncomponent b\na --> b\nnote on link\ntext\nend note');
    expect(ast.nodes.some((n) => n.symbol === 'note')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// Element declaration grammar (CommandCreateElementFull + cleanId) — P2/i12
// ---------------------------------------------------------------------------

describe('cleanId consistency — declaration vs link endpoint (CommandCreateElementFull + DescriptionDiagram.cleanId)', () => {
  it('DE-1: `component [c1]` then a bracket-endpoint link resolve to ONE node', () => {
    const ast = parse('component [c1]\n[c1] --> x');
    const c1Nodes = ast.nodes.filter((n) => n.id === 'c1');
    expect(c1Nodes).toHaveLength(1);
    expect(c1Nodes[0]).toMatchObject({ symbol: 'component', display: 'c1' });
  });

  it('DE-2: a keyword declaration with a trailing color keeps a clean bracket id', () => {
    const ast = parse('component [component1] #GreenYellow\n[component1] --> x');
    expect(ast.nodes.filter((n) => n.id === 'component1')).toHaveLength(1);
    const c1 = ast.nodes.find((n) => n.id === 'component1')!;
    expect(c1.color).toBe('#GreenYellow');
  });

  it('DE-3: standalone `()interface` (no space) declares one interface node', () => {
    const ast = parse('()interface');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]).toMatchObject({ id: 'interface', symbol: 'interface' });
  });

  it('DE-4: cegale-42-loxa672 shape — bracket decl + interface + second bracket via links', () => {
    const ast = parse([
      'component [component1] #GreenYellow',
      '()interface',
      '[component1] -> ()interface',
      '()interface <.. [component2]',
    ].join('\n'));
    expect(ast.nodes).toHaveLength(3);
    expect(ast.nodes.map((n) => n.id).sort()).toEqual(['component1', 'component2', 'interface']);
  });
});

describe('`Admin as :Name:` / `Use as (Name)` — bare CODE, decorated DISPLAY', () => {
  it('AS-1: `Admin as :Main Admin:` parses as actor with id Admin, display "Main Admin"', () => {
    const node = firstNode('Admin as :Main Admin:');
    expect(node).toMatchObject({ id: 'Admin', display: 'Main Admin', symbol: 'actor' });
  });

  it('AS-2: `Use as (Use the application)` parses as usecase with id Use', () => {
    const node = firstNode('Use as (Use the application)');
    expect(node).toMatchObject({ id: 'Use', display: 'Use the application', symbol: 'usecase' });
  });

  it('AS-3: business variant X as :Name:/ produces actor-business', () => {
    const node = firstNode('X as :Name:/');
    expect(node).toMatchObject({ id: 'X', display: 'Name', symbol: 'actor-business' });
  });

  it('AS-4: does not misfire on an ordinary keyword alias (`component Foo as F`)', () => {
    const node = firstNode('component Foo as F');
    expect(node).toMatchObject({ id: 'F', display: 'Foo', symbol: 'component' });
  });
});

describe('Stereotag `$tag` declarations (Stereotag.pattern, CommandCreateClassMultilines.addTags)', () => {
  it('TG-1: `component c $tag1 $tag2` records tags and a clean name/id', () => {
    const node = firstNode('component c $tag1 $tag2');
    expect(node).toMatchObject({ id: 'c', display: 'c', symbol: 'component' });
    expect(node.tags).toEqual(['tag1', 'tag2']);
  });

  it('TG-2: a tagged container declaration records the tag on the group node', () => {
    const ast = parse('component a $a {\n}');
    expect(ast.nodes[0]).toMatchObject({ id: 'a', tags: ['a'] });
  });

  it('TG-3: tag + color + stereotype combine on one declaration', () => {
    const node = firstNode('component c $tag1 << svc >> #blue');
    expect(node).toMatchObject({ id: 'c', stereotype: 'svc', color: '#blue' });
    expect(node.tags).toEqual(['tag1']);
  });

  it('TG-4: a declaration with no `$tag` has no tags field', () => {
    const node = firstNode('component plain');
    expect(node.tags).toBeUndefined();
  });
});

describe('`remove $tag` (CommandRemoveRestore + HideOrShow#isApplyableTag, tag form)', () => {
  it('RT-1: kokebo-27-vafi688 shape — `remove $a` removes exactly the tagged entity', () => {
    const ast = parse([
      'component a $a {',
      '}',
      'component b {',
      '}',
      'remove $a',
    ].join('\n'));
    const removed = effectiveRemovedIds(ast.nodes, ast.links);
    expect(removed.has('a')).toBe(true);
    expect(removed.has('b')).toBe(false);
  });

  it('RT-2: cenoja-47-rodu998 shape — `remove $tag1` removes every entity carrying it', () => {
    const ast = parse([
      'component foo1 $tag1',
      'component foo2',
      'component foo3 $tag1',
      'remove $tag1',
    ].join('\n'));
    expect([...effectiveRemovedIds(ast.nodes, ast.links)].sort()).toEqual(['foo1', 'foo3']);
  });

  it('RT-3: `remove <id>` (plain identifier) still works alongside tag support', () => {
    const ast = parse('component a\ncomponent b\nremove a');
    expect([...effectiveRemovedIds(ast.nodes, ast.links)]).toEqual(['a']);
  });

  it('RT-4: removing an unused tag is a silent no-op', () => {
    const ast = parse('component a $x\nremove $nope');
    expect(effectiveRemovedIds(ast.nodes, ast.links).size).toBe(0);
  });
});

describe('remove cascades to singly-attached notes (CucaDiagram.isRemoved + isNoteWithSingleLinkAttachedTo)', () => {
  it('RT-5: kokebo-27-vafi688 full shape — `remove $a` also removes its note', () => {
    const ast = parse([
      'component a $a {',
      '}',
      'component b {',
      '}',
      'note right of a: test_a',
      'remove $a',
    ].join('\n'));
    // The singly-attached note cascades: it is effectively removed too
    // (CucaDiagram.isNoteWithSingleLinkAttachedTo, evaluated lazily).
    const removed = effectiveRemovedIds(ast.nodes, ast.links);
    expect(removed.has('a')).toBe(true);
    const note = ast.nodes.find((n) => n.symbol === 'note')!;
    expect(removed.has(note.id)).toBe(true);
    expect(removed.has('b')).toBe(false);
  });

  it('RT-6: a note attached to a NON-removed entity survives', () => {
    const ast = parse([
      'component a',
      'component b',
      'note right of b: keep me',
      'remove a',
    ].join('\n'));
    const removed = effectiveRemovedIds(ast.nodes, ast.links);
    const note = ast.nodes.find((n) => n.symbol === 'note')!;
    expect(removed.has(note.id)).toBe(false);
  });
});

// ===========================================================================
// ── SPRITE BLOCKS — `sprite $name [WxH/16z] { base64… }` is pixel data;
//    body lines must never re-dispatch (bivira-53: base64 matched the
//    arrow grammar and auto-created phantom actors)
// ===========================================================================

describe('parseDescription — sprite blocks consumed whole', () => {
  it('block body lines create no nodes or links', () => {
    const ast = parse([
      'sprite $maxime [48x48/16z] {',
      'nLRPjjiW34niWrRy_vzR3SA-QGrftwhZ91myaaOB8g_NVv3jA9NA',
      'tsgNKRfEFl2wkd_b1t-R3xpD_nPiDVdyA6GTpXXBTub_0G00',
      '}',
      'actor PlantUML',
    ].join('\n'));
    expect(ast.nodes.map((n) => n.id)).toEqual(['PlantUML']);
    expect(ast.links).toHaveLength(0);
  });

  it('single-line sprite definition is ignored', () => {
    const ast = parse('sprite $foo [16x16/16] AAAA\ncomponent c');
    expect(ast.nodes.map((n) => n.id)).toEqual(['c']);
  });

  it('container braces still work after a sprite block', () => {
    const ast = parse([
      'sprite $s [8x8/8] {',
      'FF00',
      '}',
      'package P {',
      '  component X',
      '}',
    ].join('\n'));
    const pkg = ast.nodes.find((n) => n.id === 'P')!;
    expect(pkg.children.map((c) => c.id)).toEqual(['X']);
  });
});

// ===========================================================================
// ── URL HYPERLINKS — `[[url]]` (UrlBuilder.OPTIONAL in
//    CommandCreateElementFull) annotates an element without adding DOT
//    structure; must not mangle the id or spawn phantom nodes (gacida-77)
// ===========================================================================

describe('parseDescription — [[url]] hyperlinks stripped', () => {
  it('component with alias + URL parses to one clean node', () => {
    const ast = parse('component foo1 as "My comp" [[My_component_1]]\ncomponent foo2\nfoo1 -> foo2');
    expect(ast.nodes.map((n) => n.id).sort()).toEqual(['foo1', 'foo2']);
    const foo1 = ast.nodes.find((n) => n.id === 'foo1')!;
    expect(foo1.symbol).toBe('component');
    expect(foo1.display).toBe('My comp');
  });

  it('URL with a label is stripped whole', () => {
    const ast = parse('component c [[http://example.com open me]]');
    expect(ast.nodes.map((n) => n.id)).toEqual(['c']);
  });
});

// ===========================================================================
// ── SHORTHAND WITH URL + STEREOTYPE — `() Iface << S >> [[url]]` must parse
//    the shorthand and drop the URL (jazabe-68); en-dash arrows normalize
// ===========================================================================

describe('parseDescription — shorthand with stereotype + URL', () => {
  it('interface shorthand accepts a trailing stereotype and URL', () => {
    const ast = parse('() Interface << Other Stereotype >> [[http://Interface]]');
    expect(ast.nodes.map((n) => n.id)).toEqual(['Interface']);
    expect(ast.nodes[0]!.symbol).toBe('interface');
  });
});

// ===========================================================================
// ── MULTIPLE LINK STEREOTYPES — `A --> B<<v1.0>><<v1.1>>` must parse as ONE
//    link, not spawn a phantom node from the trailing stereotype (golati-24)
// ===========================================================================

describe('parseDescription — consecutive link stereotypes', () => {
  it('double stereotype on a link endpoint does not spawn a phantom', () => {
    const ast = parse('[C]\n[P]<<v1.0>><<v1.1>>\nC -down-> P<<v1.0>><<v1.1>> : both');
    expect(ast.nodes.map((n) => n.id).sort()).toEqual(['C', 'P']);
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'C', to: 'P', label: 'both' });
  });
});
