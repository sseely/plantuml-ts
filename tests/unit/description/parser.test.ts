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
import { scopedKey } from '../../../src/diagrams/description/namespace-groups.js';
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

  it('an `as alias` after the bracket name overrides the id, keeping the bracket text as display', () => {
    const node = firstNode('[Consumer] as consumer_service');
    expect(node.id).toBe('consumer_service');
    expect(node.display).toBe('Consumer');
  });

  // CommandCreateElementFull.java's "CODE, STEREOTYPE, as, DISPLAY"
  // alternative (getRegexConcat:95-100, the CODE3 branch) allows the
  // stereotype to sit BEFORE `as alias`, not just after it. Our
  // parseBracketDeclaration tried the `as` match first (`RE_BRACKET_ALIAS`
  // anchored at the start of the leftover text), so a leading
  // `<<stereotype>>` blocked the alias match entirely -- the alias was
  // silently discarded and a later bare reference to it (e.g. a link)
  // auto-created a SEPARATE phantom entity instead of reusing the aliased
  // one (zozutu-82-pupa220: nodeCount/degree/shapeOk).
  it('a <<stereotype>> BEFORE `as alias` still applies the alias', () => {
    const node = firstNode('[Consumer] <<service>> as consumer_service');
    expect(node.id).toBe('consumer_service');
    expect(node.display).toBe('Consumer');
    expect(node.stereotype).toBe('service');
  });

  it('a <<stereotype>> AFTER `as alias` still applies the alias (existing order)', () => {
    const node = firstNode('[Consumer] as consumer_service <<service>>');
    expect(node.id).toBe('consumer_service');
    expect(node.stereotype).toBe('service');
  });
});

// CommandCreateElementFull.java's single `StereotypePattern.optional
// ("STEREOTYPE")` (:110) captures ANY run of consecutive `<<..>>` blocks
// via regex backtracking against the line-end anchor (RegexLeaf.end():115)
// -- `component 3 <<1>> <<2>> <<3>>` only matches CommandCreateElementFull
// AT ALL because the non-greedy `.+?` backtracks past the intervening
// `>> <<` text until nothing is left unconsumed (verified: oracle stacks
// each tag as its own rendered line, growing the entity's HEIGHT only,
// never its width or id). Our extractNodeStereotype matched just the
// FIRST `<<..>>` occurrence, leaving the rest glued onto the id/display
// (`3 <<2>> <<3>>`) -- a later bare reference to the real id ("3") then
// missed it and auto-created a phantom entity instead
// (mamase-39-buto560: nodeCount/edgeCount/degree/minlen/shapeOk).
describe('parseDescription — consecutive stereotypes on an element declaration', () => {
  it('consumes ALL consecutive <<..>> blocks, keeping the id clean', () => {
    const ast = parse('component 3 <<1>> <<2>> <<3>>\ncomponent 4 <<1>> <<2>>\n3 .. 4');
    expect(ast.nodes.map((n) => n.id)).toEqual(['3', '4']);
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: '3', to: '4' });
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

  // CommandCreateElementFull.java's leading SYMBOL group (getRegexConcat:84)
  // matches a literal `()` as its OWN token (`(?:(ALL_TYPES|\(\))[%s]+)?`) --
  // the SAME slot the `interface`/`component`/etc. keywords occupy -- so
  // `() "text" as alias` reduces to the ordinary "DISPLAY as CODE" alias
  // form (DISPLAY2=`"text"`, CODE2=`alias`) once the leading `()` is
  // stripped, identical to `interface "text" as alias`. Our rule 8 only
  // allowed a restricted tag/stereotype/color/url trailer (SHORTHAND_TRAILER)
  // after the name -- an `as ALIAS` clause made the whole line fail to
  // match ANY rule and silently drop the declaration (josoxo-49-taci997:
  // clusterOk -- the alias then auto-created as a phantom entity in
  // whatever container happened to be open at its first LINK reference).
  it('a quoted interface with an `as alias` clause uses the alias as id', () => {
    const node = firstNode('() "API" as iface1');
    expect(node.symbol).toBe('interface');
    expect(node.id).toBe('iface1');
    expect(node.display).toBe('API');
  });

  it('a bare interface name with an `as alias` clause uses the alias as id', () => {
    const node = firstNode('() Foo as bar');
    expect(node.symbol).toBe('interface');
    expect(node.id).toBe('bar');
    expect(node.display).toBe('Foo');
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

  it('component "Long Name"as Alias — zero space before "as" (DISPLAY2 branch, CommandCreateElementFull.java:88-94: RegexLeaf("as") has no leading spaceZeroOrMore)', () => {
    const node = firstNode('component "Long Name"as LN');
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
// Bare quoted declaration, no keyword, no alias (CommandCreateElementFull's
// CODE1 branch with SYMBOL omitted: java:84,88,236-268,273-275 — `symbol ==
// null` defaults to `LeafType.DESCRIPTION` / `actorStyle().toUSymbol()`.
// `isForbidden` (java:134-138) excludes a PURE bare token from this branch
// (`^[\p{L}0-9_.]+$`), so only a quoted line qualifies here.)
// ---------------------------------------------------------------------------

describe('bare quoted declaration (CommandCreateElementFull, SYMBOL omitted)', () => {
  it('a standalone quoted line with no keyword/alias becomes an actor-symbol leaf', () => {
    const node = firstNode('"Only one actor -->Transparent: KO"');
    expect(node.symbol).toBe('actor');
    expect(node.id).toBe('Only one actor -->Transparent: KO');
    expect(node.display).toBe('Only one actor -->Transparent: KO');
  });

  it('keeps trailing color/stereotype decorations', () => {
    const node = firstNode('"Lone" #blue');
    expect(node.symbol).toBe('actor');
    expect(node.id).toBe('Lone');
    expect(node.color).toBe('#blue');
  });

  it('a single bare-quoted declaration with no links degenerates (0 groups, 0 links, 1 leaf)', () => {
    const ast = parse('"Only one actor -->Transparent: KO"');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.links).toHaveLength(0);
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

// CucaDiagram.quarkInContext: a container id is a GLOBAL quark identity --
// reopening the SAME container id later in the source (`cloud "..." as
// LocalNet { ... }` appearing twice) reuses the SAME group entity; new
// body lines become additional children of that ONE group, not a
// duplicate sibling cluster (tajuki-26-bime046: clusterOk, oracle merges
// to a single 5-member cluster; we produced two separate 2/3-member ones).
describe('parseDescription — reopening an already-declared container merges into it', () => {
  it('a second `KEYWORD "..." as SameId { ... }` block adds to the SAME group', () => {
    const ast = parse(
      'cloud "local network" as LocalNet {\nnode "PC1" as PC1\n}\n' +
      'cloud "local network" as LocalNet {\nnode "N1" as N1\n}',
    );
    expect(ast.nodes).toHaveLength(1);
    const group = ast.nodes[0]!;
    expect(group.id).toBe('LocalNet');
    expect(group.children.map((c) => c.id)).toEqual(['PC1', 'N1']);
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
// (mission dot-oracle-sync, phase 2 iteration 5). `@unlinked` is covered
// separately below (`ast.removeUnlinked`); `<<stereotype>>` form (node AND
// link removal) is covered in its own describe block further down
// (description-dot-100 mission, I3) -- wildcard `*`-in-pattern matching and
// composite multi-label stereotypes remain out of scope for both forms.
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

// ---------------------------------------------------------------------------
// `single` ARROW_STYLE keyword (WithLinkType.goSingle/isSingle) — a link-ADD
// dedup flag, not a render style. CucaDiagram.addLink drops a `single` link
// when the diagram already holds any OTHER link connecting the same two
// entities (Link.sameConnections — endpoint identity, either direction,
// ignoring style). Regression case: silito-78-vubi253 (a `!definelong` macro
// invoked 3x with identical `-[single]->` body emitted 3 identical links
// instead of 1).
// ---------------------------------------------------------------------------

describe('link grammar — single keyword (add-time dedup, not a render style)', () => {
  it('LG-10: a -[single]-> b — parses with single=true, link kept (first of its pair)', () => {
    const ast = parse('a -[single]-> b');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b', single: true });
  });

  it('LG-11: three identical single links between the same pair collapse to one', () => {
    const ast = parse(['a -[single]-> b', 'a -[single]-> b', 'a -[single]-> b'].join('\n'));
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('LG-12: a single link dedups against a same-pair link in EITHER direction', () => {
    const ast = parse(['a -[single]-> b', 'b -[single]-> a'].join('\n'));
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('LG-13: single dedup does not cross different endpoint pairs', () => {
    const ast = parse(['a -[single]-> b', 'a -[single]-> c', 'c -[single]-> b'].join('\n'));
    expect(ast.links).toHaveLength(3);
  });

  it('LG-14: non-single links never dedup, even between the same pair', () => {
    const ast = parse(['a --> b', 'a --> b', 'a --> b'].join('\n'));
    expect(ast.links).toHaveLength(3);
  });

  it('LG-15: a single link still dedups against a prior NON-single link on the same pair', () => {
    const ast = parse(['a --> b', 'a -[single]-> b'].join('\n'));
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b' });
    expect(ast.links[0]!.single).toBeUndefined();
  });

  it('LG-16: both endpoints are still auto-created even when the link itself is dropped', () => {
    const ast = parse(['a -[single]-> b', 'a -[single]-> b'].join('\n'));
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'b']);
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

  // CommandFactoryNoteOnEntity.getRegexConcatMultiLine/SingleLine
  // (command/note/CommandFactoryNoteOnEntity.java:88-160): a `<<stereotype>>`
  // token is optional between the `of X` target and the trailing `#color`/
  // `:`/block-open -- our OPEN_BRACE/OPEN_PLAIN/SINGLE regexes had no such
  // segment, so the WHOLE opening line failed to match and the block's body
  // lines fell through to be misparsed one-by-one as ordinary commands
  // (jegure-48-cesi766: nodeCount/edgeCount/degree/minlen/shapeOk).
  it('`note bottom of a <<tag>>` block (stereotype after target) still attaches', () => {
    const ast = parse('component a\nnote bottom of a <<legendnote>>\nLegend\ntext\nend note');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    expect(note!.display).toBe('Legend\ntext');
    const link = ast.links[0]!;
    expect(link.from).toBe('a');
    expect(link.to).toBe(note!.id);
    expect(link.length).toBe(2);
  });

  it('`note left of a <<tag>>: text` (single-line, stereotype before colon) still attaches', () => {
    const ast = parse('component a\nnote left of a <<legendnote>>: text');
    const note = ast.nodes.find((n) => n.symbol === 'note');
    expect(note!.display).toBe('text');
    const link = ast.links[0]!;
    expect(link.from).toBe(note!.id);
    expect(link.to).toBe('a');
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

// ---------------------------------------------------------------------------
// `remove <<stereotype>>` (HideOrShow.isApplyable's `<<...>>`-prefixed WHAT
// form, HideOrShow.java:60-61,88-97) -- matches ENTITIES by
// `leaf.getStereotype()` (single-label exact match; this port's `stereotype`
// field has no `getMultipleLabels()` composite-stereotype equivalent) AND,
// independently, LINKS carrying that same stereotype (Link.isRemoved,
// net/sourceforge/plantuml/abel/Link.java:492-498, folds
// `cucaDiagram.isStereotypeRemoved(stereotype)` -- CucaDiagram.java:739-745
// -- which reuses the SAME `removed` HideOrShow list, evaluated via
// `HideOrShow.isApplyable(Stereotype)`, HideOrShow.java:71-75). A link's own
// removal is NOT gated on its endpoints: an untagged sibling link between
// the same two nodes survives. Wildcard (`*` inside the stereotype pattern,
// HideOrShow.match:113-119) and composite multi-label stereotypes stay out
// of scope -- no fixture in this port's corpus exercises either, and this
// port's `stereotype` field is a single string, not upstream's
// `Stereotype#getMultipleLabels()` list. radiga-95-junu817 / zodare-91-
// rira454 (description-dot-100 mission, I3) are exact instances of this
// shape (see plans/description-dot-100/decision-journal.md, I3).
// ---------------------------------------------------------------------------

describe('remove <<stereotype>> (HideOrShow stereotype form: nodes AND links)', () => {
  it('removes a node carrying the exact stereotype; untagged siblings survive', () => {
    const ast = parse([
      'node ServA',
      'node ServB',
      'node ServC <<TypeA>>',
      'remove <<TypeA>>',
    ].join('\n'));
    const removed = effectiveRemovedIds(ast.nodes, ast.links);
    expect(removed.has('ServC')).toBe(true);
    expect(removed.has('ServA')).toBe(false);
    expect(removed.has('ServB')).toBe(false);
  });

  it('removes a link carrying the exact stereotype, independent of its endpoints', () => {
    const ast = parse([
      'node ServA',
      'node ServB',
      'ServA --> ServB <<TypeA>> : TypeA',
      'ServA --> ServB <<TypeB>> : TypeB',
      'remove <<TypeA>>',
    ].join('\n'));
    expect(ast.links).toHaveLength(2);
    expect(ast.links[0]!.removed).toBe(true);
    expect(ast.links[1]!.removed).toBeUndefined();
    // Neither endpoint is itself stereotyped -- both nodes stay unremoved;
    // only the stereotyped LINK is dropped (Link.isRemoved's independent
    // stereotype branch, distinct from its `cl1.isRemoved() || cl2.isRemoved()`
    // endpoint-cascade branch).
    const removed = effectiveRemovedIds(ast.nodes, ast.links);
    expect(removed.has('ServA')).toBe(false);
    expect(removed.has('ServB')).toBe(false);
  });

  it('radiga-95-junu817 / zodare-91-rira454 shape: removes the stereotyped node AND its stereotyped link in one pass', () => {
    const ast = parse([
      'node ServA',
      'node ServB',
      'node ServC <<TypeA>>',
      'ServA --> ServB <<TypeA>> : TypeA',
      'ServA --> ServB <<TypeB>> : TypeB',
      'remove <<TypeA>>',
    ].join('\n'));
    const removed = effectiveRemovedIds(ast.nodes, ast.links);
    expect(removed.has('ServC')).toBe(true);
    expect(ast.links[0]!.removed).toBe(true);
    expect(ast.links[1]!.removed).toBeUndefined();
  });

  it('restore <<stereotype>> clears the link-removed marker', () => {
    const ast = parse([
      'node ServA',
      'node ServB',
      'ServA --> ServB <<TypeA>> : TypeA',
      'remove <<TypeA>>',
      'restore <<TypeA>>',
    ].join('\n'));
    expect(ast.links[0]!.removed).toBeUndefined();
  });

  it('a stereotype pattern matching nothing is a silent no-op', () => {
    const ast = parse([
      'node ServA',
      'ServA --> ServA <<TypeA>>',
      'remove <<Ghost>>',
    ].join('\n'));
    expect(effectiveRemovedIds(ast.nodes, ast.links).size).toBe(0);
    expect(ast.links[0]!.removed).toBeUndefined();
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

// ===========================================================================
// ── MULTI-LINE ELEMENT BODY — `component c [ … ]`
//    (CommandCreateElementMultilines TYPE1): one node, body lines are the
//    description (label content), not phantom nodes (fasave-91)
// ===========================================================================

describe('parseDescription — multi-line [ … ] element bodies', () => {
  it('component with a multi-line bracket description is one node', () => {
    const ast = parse('component c [\na\nabc\na b c d\n]\ncomponent d');
    expect(ast.nodes.map((n) => n.id)).toEqual(['c', 'd']);
    expect(ast.nodes[0]!.symbol).toBe('component');
  });

  it('body lines do not spawn nodes even when they look like declarations', () => {
    const ast = parse('rectangle r [\ncomponent fake\n[bracket]\n]\nactor A');
    expect(ast.nodes.map((n) => n.id)).toEqual(['r', 'A']);
  });

  it('single-line bracket body closes on the same line', () => {
    const ast = parse('component c [ inline desc ]\ncomponent d');
    expect(ast.nodes.map((n) => n.id)).toEqual(['c', 'd']);
  });
});

// ===========================================================================
// ── COLOR/STYLE TOKENS — `#green;line:blue`, `#line:blue`, `#red;line.dashed`
//    (ColorParser.exp1) must parse cleanly, not leak into the id (gafegu-06,
//    gocexi-61: a mangled port id measured wide and became plaintext)
// ===========================================================================

describe('parseDescription — color tokens with inline style', () => {
  it('port with #color;style suffix keeps a clean id', () => {
    const ast = parse('component c {\nport "8030" as p83 #green;line:blue\n}');
    const comp = ast.nodes.find((n) => n.id === 'c')!;
    expect(comp.children.map((n) => n.id)).toEqual(['p83']);
  });

  it('style-only #line:blue does not leak into the id', () => {
    const ast = parse('component c {\nport "8030" as p83 #line:blue\n}');
    const comp = ast.nodes.find((n) => n.id === 'c')!;
    expect(comp.children.map((n) => n.id)).toEqual(['p83']);
  });
});

// LINK_LINE_RE's trailing `[#color]` token (CommandLinkElement.java:118,
// ColorParser.simpleColor -- klimt/color/ColorParser.java:43-46) accepted
// only bare `#\w+`, so a link's inline `#base;key:value` style suffix
// (`#coral;text:red`) left `;text:red : link3` unconsumed and failed the
// WHOLE line's match -- the link (and its label) silently dropped
// (gekage-52-dato745, rekisu-47-pesa949: edgeCount/degree/minlen/labelOk).
describe('parseDescription — link inline color with style suffix (ColorParser PART2)', () => {
  it('a link with a #base;key:value color+style suffix still parses, with its label', () => {
    const ast = parse('component a\ncomponent b\na --> b #coral;text:red : link1');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b', label: 'link1' });
  });

  it('a link with a bare #name color suffix (no style keys) still parses, with its label', () => {
    const ast = parse('component a\nactor b\na --> b #red : example');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b', label: 'example' });
  });

  it('a link with a #key:value-only style suffix (no leading color) still parses', () => {
    const ast = parse('component a\ncomponent b\na --> b #line:green : link2');
    expect(ast.links).toHaveLength(1);
    expect(ast.links[0]).toMatchObject({ from: 'a', to: 'b', label: 'link2' });
  });
});

// ===========================================================================
// ── SHORTHAND_TRAILER permissive color charset (T19) — the paren/colon
//    shorthand declarations (usecase, actor, business variants, interface)
//    previously restricted their trailing `#color` token to `#\w+`
//    (word chars only), so a `;`/`:`/`.`-bearing inline style
//    (`#orange;line:blue`, `#line.dashed`) failed the WHOLE line's outer
//    pattern match and silently dropped the entity (mofuba-79-came821:
//    `(dummy) #orange;line:yellow` never became a node). Widened to the
//    same charset `extractColor`/RE_COLOR already uses for the bracket
//    and keyword-dispatch paths.
// ===========================================================================

describe('parseDescription — shorthand trailer with semicolon-style inline color', () => {
  it('paren (usecase) shorthand with a full #back;line:color suffix is not dropped', () => {
    const ast = parse('(dummy) #orange;line:yellow');
    expect(ast.nodes.map((n) => n.id)).toEqual(['dummy']);
    expect(ast.nodes[0]).toMatchObject({ symbol: 'usecase', color: '#orange;line:yellow' });
  });

  it('paren shorthand with a bare #line.dashed style suffix is not dropped', () => {
    const ast = parse('(uc) #line.dashed');
    expect(ast.nodes.map((n) => n.id)).toEqual(['uc']);
    expect(ast.nodes[0]).toMatchObject({ symbol: 'usecase', color: '#line.dashed' });
  });

  it('colon (actor) shorthand with a full inline-style suffix is not dropped', () => {
    const ast = parse(':Bob: #aliceblue;line:blue;line.dotted;text:blue');
    expect(ast.nodes.map((n) => n.id)).toEqual(['Bob']);
    expect(ast.nodes[0]).toMatchObject({
      symbol: 'actor',
      color: '#aliceblue;line:blue;line.dotted;text:blue',
    });
  });

  it('two paren-shorthand siblings both survive when each carries an inline-style suffix', () => {
    const ast = parse('usecase foo #orange;line:blue\n(dummy) #orange;line:yellow');
    expect(ast.nodes.map((n) => n.id)).toEqual(['foo', 'dummy']);
  });
});

// ===========================================================================
// ── CODE as :wrapped: — `actor Admin as :Main Admin:` (bare code, wrapped
//    display) must yield id=code, not the whole string (dopova-50)
// ===========================================================================

describe('parseDescription — CODE as wrapped-display', () => {
  it('actor with a colon-wrapped display keeps the bare id', () => {
    const ast = parse('actor Admin as :Main Admin:');
    expect(ast.nodes[0]).toMatchObject({ id: 'Admin', symbol: 'actor' });
    expect(ast.nodes[0]!.display).toBe('Main Admin');
  });
});

// ===========================================================================
// ── newpage (CommandNewpage) — descdiagram/command/CommandNewpage.java:76-88
//    finalizes the current page and starts a fresh, independent diagram.
//    Mirrors class/parser.ts#startNewPage (T7).
// ===========================================================================

describe('parseDescription — newpage', () => {
  it('a source with no newpage has no pages field', () => {
    const ast = parse('actor a\na --> (do)');
    expect(ast.pages).toBeUndefined();
  });

  it('splits into one page per newpage boundary; the returned AST is page 0', () => {
    const ast = parse(`
      actor a
      actor b
      actor c
      m --> (do)
      newpage
      actor z
      z --> (zz)
    `);
    expect(ast.pages).toHaveLength(2);
    // The top-level AST IS page 0 (self-referential — see ast.ts doc comment).
    expect(ast.pages![0]).toBe(ast);
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'm', 'do']);
    expect(ast.links).toHaveLength(1);
  });

  it('page 1 is a fully independent diagram — its own node/link/container state', () => {
    const ast = parse(`
      actor a
      a --> (do)
      newpage
      actor z
      z --> (zz)
    `);
    const page1 = ast.pages![1]!;
    expect(page1.nodes.map((n) => n.id)).toEqual(['z', 'zz']);
    expect(page1.links).toHaveLength(1);
    // Page 0's own content is untouched by page 1's parsing (no leakage).
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'do']);
  });

  it('splits into N+1 pages for N newpage occurrences (chained newpages)', () => {
    const ast = parse(`
      actor Alice
      Alice --> (Usecase)
      newpage
      actor Bob
      Bob --> (Usecase)
      newpage
      actor Charline
      Charline --> (Usecase)
      newpage
      actor Derek
      Derek --> (Usecase)
    `);
    expect(ast.pages).toHaveLength(4);
    expect(ast.pages!.map((p) => p.nodes[0]!.id)).toEqual([
      'Alice', 'Bob', 'Charline', 'Derek',
    ]);
  });

  it('each page resolves its own still-unknown mix independently (usecase-ish per page)', () => {
    // Page 0 has an actor/usecase leaf (usecase-ish); page 1 has none, so its
    // auto-created endpoint should mute to 'interface', not 'actor'.
    const ast = parse(`
      actor a
      a --> (do)
      newpage
      [X] --> y
    `);
    const page1 = ast.pages![1]!;
    const y = page1.nodes.find((n) => n.id === 'y');
    expect(y).toBeDefined();
    expect(y!.symbol).toBe('interface');
  });

  it('a literal "newpage" inside a note body is note text, not a page break', () => {
    const ast = parse(`
      actor a
      note right of a
      newpage
      end note
      a --> (do)
    `);
    expect(ast.pages).toBeUndefined();
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', '__note_0', 'do']);
  });
});


// ---------------------------------------------------------------------------
// `set separator` (CommandNamespaceSeparator.java) — mission
// description-dot-100, iteration I1: fidati-41-kofe029/tojitu-03-ruto643/
// bujige-52-gase998. See ast.ts#DescriptionDiagramAST.namespaceSeparator's
// doc for why the parser's default is `null`, not ".".
// ---------------------------------------------------------------------------

describe('`set separator` / `set namespaceseparator` (CommandNamespaceSeparator.java)', () => {
  it('is unset (null) by default — a dotted id is an ordinary flat id', () => {
    const ast = parse(`
      component aaa.bbb.ccc
    `);
    expect(ast.namespaceSeparator).toBeUndefined();
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]!.id).toBe('aaa.bbb.ccc');
    expect(ast.nodes[0]!.display).toBe('aaa.bbb.ccc');
  });

  it('`set separator .` is recorded on the AST', () => {
    const ast = parse(`
      set separator .
      component aaa.bbb.ccc
    `);
    expect(ast.namespaceSeparator).toBe('.');
  });

  it('`set namespaceseparator ::` is recorded on the AST (alternate spelling)', () => {
    const ast = parse(`
      set namespaceseparator ::
      component aaa
    `);
    expect(ast.namespaceSeparator).toBe('::');
  });

  it('`set separator none` records null (case-insensitive)', () => {
    const ast = parse(`
      set separator .
      set separator NONE
      component aaa.bbb.ccc
    `);
    expect(ast.namespaceSeparator).toBeNull();
  });

  it('`set separator null` also disables (CommandNamespaceSeparator.java:78)', () => {
    const ast = parse(`
      set separator null
      component aaa.bbb.ccc
    `);
    expect(ast.namespaceSeparator).toBeNull();
  });

  it('a dotted declaration with no explicit alias defaults display to the leaf segment only (quark.getName())', () => {
    const ast = parse(`
      set separator .
      component aaa.bbb1.ccc01
    `);
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]!.id).toBe('aaa.bbb1.ccc01');
    expect(ast.nodes[0]!.display).toBe('ccc01');
  });

  it('an explicit alias display is NOT overridden by the leaf-segment default', () => {
    const ast = parse(`
      set separator .
      component aaa.bbb1.ccc01 as "My Component"
    `);
    expect(ast.nodes[0]!.id).toBe('aaa.bbb1.ccc01');
    expect(ast.nodes[0]!.display).toBe('My Component');
  });

  it('a non-dotted id is unaffected by an active separator', () => {
    const ast = parse(`
      set separator .
      component plain
    `);
    expect(ast.nodes[0]!.id).toBe('plain');
    expect(ast.nodes[0]!.display).toBe('plain');
  });

  it('a dotted link endpoint resolves into an existing nested container (quarkInContextSafe reuseExistingChild)', () => {
    const ast = parse(`
      set separator .
      node srv1 {
       portin br0
      }
      node srv2 {
       portin br0
      }
      srv1.br0 --> srv2.br0
    `);
    // No bogus flat top-level "srv1.br0"/"srv2.br0" nodes were created.
    expect(ast.nodes.map((n) => n.id)).toEqual(['srv1', 'srv2']);
    const srv1 = ast.nodes.find((n) => n.id === 'srv1')!;
    const srv2 = ast.nodes.find((n) => n.id === 'srv2')!;
    expect(srv1.children.map((c) => c.id)).toEqual(['br0']);
    expect(srv2.children.map((c) => c.id)).toEqual(['br0']);
    expect(ast.links).toHaveLength(1);
    // Container-scoped identity (mission I1b): srv1's br0 and srv2's br0
    // are two DIFFERENT leaves (structurally distinct Quark objects
    // upstream, plasma/Quark.java:54) sharing a bare id -- from/to must
    // resolve to the ancestor-qualified path (scopedKey), not the
    // ambiguous bare 'br0', or the two endpoints collapse into a self-loop
    // and the edge is dropped (description-dot-100 decision journal, I1b).
    expect(ast.links[0]!.from).toBe(scopedKey(['srv1', 'br0']));
    expect(ast.links[0]!.to).toBe(scopedKey(['srv2', 'br0']));
  });

  it('a dotted link endpoint with no matching container falls back to flat auto-create', () => {
    const ast = parse(`
      set separator .
      unknown.thing --> other
    `);
    expect(ast.nodes.map((n) => n.id)).toEqual(['unknown.thing', 'other']);
    expect(ast.links[0]).toMatchObject({ from: 'unknown.thing', to: 'other' });
  });
});

// ---------------------------------------------------------------------------
// `!pragma kermor on` (skin/PragmaKey.java:55) — svek's alternate
// cluster/note DOT-emission path. See description-dot-100
// decision-journal.md I2 for the full mechanism.
// ---------------------------------------------------------------------------

describe('!pragma kermor on', () => {
  it('sets ast.kermor = true', () => {
    const ast = parse('!pragma kermor on\n[A]');
    expect(ast.kermor).toBe(true);
  });

  it('is absent (undefined) when the pragma is not written', () => {
    const ast = parse('[A]');
    expect(ast.kermor).toBeUndefined();
  });

  it('note top/bottom of a GROUP under kermor attaches nothing (no leaf, no link) — CommandFactoryNoteOnEntity.java:322', () => {
    const ast = parse(
      '!pragma kermor on\ncomponent tempSensor {\n}\nnote top of tempSensor\n  hello\nend note',
    );
    expect(ast.nodes).toHaveLength(1); // only tempSensor — no note leaf
    expect(ast.links).toHaveLength(0); // no note-attachment link
  });

  it('note top/bottom of a LEAF under kermor is unaffected (kermor only changes group-target notes)', () => {
    const ast = parse('!pragma kermor on\n[A]\nnote top of A\n  hello\nend note');
    expect(ast.nodes).toHaveLength(2); // A + the note leaf
    expect(ast.links).toHaveLength(1); // the note-attachment link
  });

  it('note top/bottom of a GROUP without kermor is unaffected (prior behavior)', () => {
    const ast = parse('component tempSensor {\n}\nnote top of tempSensor\n  hello\nend note');
    expect(ast.nodes).toHaveLength(2); // tempSensor + the note leaf
    expect(ast.links).toHaveLength(1); // the note-attachment link
  });

  it('single-line note-on-group form is also suppressed under kermor', () => {
    const ast = parse('!pragma kermor on\ncomponent tempSensor {\n}\nnote top of tempSensor : hello');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.links).toHaveLength(0);
  });
});
