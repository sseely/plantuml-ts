import { describe, it, expect } from 'vitest';
import { parseComponent } from '../../../src/diagrams/component/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type {
  ComponentDiagramAST,
  ComponentLink,
  ComponentNode,
} from '../../../src/diagrams/component/ast.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parse(source: string): ComponentDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'component' };
  return parseComponent(block);
}

function firstNode(source: string): ComponentNode {
  const ast = parse(source);
  const node = ast.nodes[0];
  if (node === undefined) throw new Error('Expected at least one node');
  return node;
}

function firstLink(source: string): ComponentLink {
  const ast = parse(source);
  const link = ast.links[0];
  if (link === undefined) throw new Error('Expected at least one link');
  return link;
}

// ---------------------------------------------------------------------------
// Acceptance criteria 1 — [MyComponent] bracket shorthand
// ---------------------------------------------------------------------------

describe('[Name] bracket shorthand', () => {
  it('produces kind=component with id and display set to the name', () => {
    const node = firstNode('[MyComponent]');
    expect(node.kind).toBe('component');
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
// Acceptance criteria 2 — () Interface shorthand
// ---------------------------------------------------------------------------

describe('() interface shorthand', () => {
  it('produces kind=interface with id and display set to the name', () => {
    const node = firstNode('() Interface1');
    expect(node.kind).toBe('interface');
    expect(node.id).toBe('Interface1');
    expect(node.display).toBe('Interface1');
  });

  it('produces an empty children array', () => {
    const node = firstNode('() Interface1');
    expect(node.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria 3 — explicit component / interface keywords
// ---------------------------------------------------------------------------

describe('explicit component keyword', () => {
  it('bare component Name sets id and display to Name', () => {
    const node = firstNode('component Foo');
    expect(node.kind).toBe('component');
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

describe('explicit interface keyword', () => {
  it('produces kind=interface', () => {
    const node = firstNode('interface IFoo');
    expect(node.kind).toBe('interface');
    expect(node.id).toBe('IFoo');
  });

  it('interface "Long Name" as Alias resolves id to alias', () => {
    const node = firstNode('interface "My Interface" as MI');
    expect(node.id).toBe('MI');
    expect(node.display).toBe('My Interface');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria 4 — single-line package block
// ---------------------------------------------------------------------------

describe('single-line package block', () => {
  it('parses package kind and its inline component children', () => {
    const node = firstNode('package P { [A] [B] }');
    expect(node.kind).toBe('package');
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
    expect(node.children[0]?.kind).toBe('interface');
    expect(node.children[0]?.id).toBe('IFoo');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria 5 — solid arrow with label
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
// Acceptance criteria 6 — dashed arrow
// ---------------------------------------------------------------------------

describe('[A] ..> [B]', () => {
  it('produces style=dashed', () => {
    const link = firstLink('[A] ..> [B]');
    expect(link.style).toBe('dashed');
    expect(link.arrowHead).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria 7 — all container kinds
// ---------------------------------------------------------------------------

describe('container kinds', () => {
  const containerKinds = [
    'node',
    'folder',
    'frame',
    'cloud',
    'database',
    'storage',
  ] as const;

  for (const kind of containerKinds) {
    it(`${kind} keyword produces kind=${kind}`, () => {
      const node = firstNode(`${kind} MyContainer { [Inner] }`);
      expect(node.kind).toBe(kind);
    });
  }
});

// ---------------------------------------------------------------------------
// Acceptance criteria 8 — multi-line block
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
    expect(pkg.kind).toBe('package');
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
    expect(pkg.children[0]?.kind).toBe('interface');
    expect(pkg.children[1]?.kind).toBe('interface');
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
// Acceptance criteria 9 — solid no-arrow link
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
// Ignored directives
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
