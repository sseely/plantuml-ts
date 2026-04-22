import { describe, it, expect } from 'vitest';
import { parseUseCase } from '../../../src/diagrams/usecase/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function parse(source: string): ReturnType<typeof parseUseCase> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'usecase' };
  return parseUseCase(block);
}

// ---------------------------------------------------------------------------
// Actor declarations
// ---------------------------------------------------------------------------

describe('actor declarations', () => {
  it('AC-1: parses a simple actor keyword', () => {
    const ast = parse('actor User');
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]).toMatchObject({
      kind: 'actor',
      id: 'User',
      display: 'User',
    });
  });

  it('AC-2: parses actor with quoted name and alias', () => {
    const ast = parse('actor "Admin User" as AU');
    expect(ast.nodes[0]).toMatchObject({
      kind: 'actor',
      id: 'AU',
      display: 'Admin User',
    });
  });

  it('AC-3: parses actor with single-quoted name and alias', () => {
    const ast = parse("actor 'Complex Name' as CN");
    expect(ast.nodes[0]).toMatchObject({
      kind: 'actor',
      id: 'CN',
      display: 'Complex Name',
    });
  });

  it('AC-4: parses actor with color', () => {
    const ast = parse('actor User #pink');
    const node = ast.nodes[0];
    expect(node?.kind).toBe('actor');
    expect(node?.id).toBe('User');
    expect(node?.color).toBe('#pink');
  });

  it('AC-5: parses colon shorthand :Admin Actor:', () => {
    const ast = parse(':Admin Actor:');
    expect(ast.nodes[0]).toMatchObject({
      kind: 'actor',
      id: 'Admin Actor',
      display: 'Admin Actor',
    });
  });

  it('AC-6: actors have empty children array', () => {
    const ast = parse('actor X');
    expect(ast.nodes[0]?.children).toEqual([]);
  });

  it('AC-7: parses actor with unquoted alias (PlainName as Alias form)', () => {
    // "actor User as U" — display=User, id=U
    const ast = parse('actor User as U');
    expect(ast.nodes[0]).toMatchObject({ kind: 'actor', id: 'U', display: 'User' });
  });
});

// ---------------------------------------------------------------------------
// Use case declarations
// ---------------------------------------------------------------------------

describe('use case declarations', () => {
  it('UC-1: parses parenthesis shorthand (Login)', () => {
    const ast = parse('(Login)');
    expect(ast.nodes[0]).toMatchObject({
      kind: 'usecase',
      id: 'Login',
      display: 'Login',
    });
  });

  it('UC-2: parses usecase keyword with plain name', () => {
    const ast = parse('usecase UC1');
    expect(ast.nodes[0]).toMatchObject({ kind: 'usecase', id: 'UC1', display: 'UC1' });
  });

  it('UC-3: parses usecase "Display" as Alias', () => {
    const ast = parse('usecase "Do Thing" as UC1');
    expect(ast.nodes[0]).toMatchObject({
      kind: 'usecase',
      id: 'UC1',
      display: 'Do Thing',
    });
  });

  it('UC-4: parses usecase UC1 as quoted single-quoted name (acceptance criterion 4)', () => {
    // "usecase UC1 as 'Do Thing'" — id = UC1, display = Do Thing
    const ast = parse("usecase UC1 as 'Do Thing'");
    expect(ast.nodes[0]).toMatchObject({
      kind: 'usecase',
      id: 'UC1',
      display: 'Do Thing',
    });
  });

  it('UC-5: parses usecase with parens in keyword form', () => {
    const ast = parse('usecase (Login)');
    expect(ast.nodes[0]).toMatchObject({
      kind: 'usecase',
      id: 'Login',
      display: 'Login',
    });
  });

  it('UC-6: parses usecase with color', () => {
    const ast = parse('usecase UC1 #yellow');
    const node = ast.nodes[0];
    expect(node?.kind).toBe('usecase');
    expect(node?.color).toBe('#yellow');
  });

  it('UC-7: use cases have empty children array', () => {
    const ast = parse('(Pay)');
    expect(ast.nodes[0]?.children).toEqual([]);
  });

  it('UC-8: parses usecase with double-quoted display (id-first form)', () => {
    // usecase UC2 as "Do Another Thing"
    const ast = parse('usecase UC2 as "Do Another Thing"');
    expect(ast.nodes[0]).toMatchObject({ id: 'UC2', display: 'Do Another Thing' });
  });
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

describe('links', () => {
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
// Containers
// ---------------------------------------------------------------------------

describe('containers', () => {
  it('CT-1: single-line rectangle with inline children', () => {
    const ast = parse('rectangle System { (Login) (Logout) }');
    expect(ast.nodes).toHaveLength(1);
    const rect = ast.nodes[0];
    expect(rect?.kind).toBe('rectangle');
    expect(rect?.id).toBe('System');
    expect(rect?.children).toHaveLength(2);
    expect(rect?.children[0]).toMatchObject({ kind: 'usecase', id: 'Login' });
    expect(rect?.children[1]).toMatchObject({ kind: 'usecase', id: 'Logout' });
  });

  it('CT-2: multi-line rectangle block', () => {
    const ast = parse(`
      rectangle System {
        (Login)
        (Logout)
      }
    `);
    const rect = ast.nodes[0];
    expect(rect?.kind).toBe('rectangle');
    expect(rect?.children).toHaveLength(2);
  });

  it('CT-3: package container kind', () => {
    const ast = parse(`
      package "My App" {
        (Login)
      }
    `);
    const node = ast.nodes[0];
    expect(node?.kind).toBe('package');
    expect(node?.id).toBe('My App');
    expect(node?.children[0]?.id).toBe('Login');
  });

  it('CT-4: nested container nodes do not appear in top-level nodes', () => {
    const ast = parse(`
      rectangle Sys {
        (Search)
      }
    `);
    // Only the rectangle itself should be at top level
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]?.children).toHaveLength(1);
  });

  it('CT-5: single-line cloud container', () => {
    const ast = parse('cloud Internet { (Browse) }');
    expect(ast.nodes[0]?.kind).toBe('cloud');
    expect(ast.nodes[0]?.children[0]?.id).toBe('Browse');
  });

  it('CT-6: multi-line block with actor child', () => {
    const ast = parse(`
      rectangle Scope {
        actor Admin
      }
    `);
    const rect = ast.nodes[0];
    expect(rect?.children[0]).toMatchObject({ kind: 'actor', id: 'Admin' });
  });

  it('CT-7: single-line container with colon-actor shorthand in body', () => {
    // covers the :Name: branch in parseInlineBody
    const ast = parse('rectangle HR { :Employee: }');
    const rect = ast.nodes[0];
    expect(rect?.kind).toBe('rectangle');
    expect(rect?.children[0]).toMatchObject({ kind: 'actor', id: 'Employee' });
  });
});

// ---------------------------------------------------------------------------
// Ignored lines
// ---------------------------------------------------------------------------

describe('ignored lines', () => {
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
// Mixed diagrams
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
    expect(ast.nodes).toHaveLength(4);
    expect(ast.links).toHaveLength(3);
    expect(ast.links[2]).toMatchObject({ stereotype: 'include', style: 'dashed' });
  });

  it('MX-2: node ids from paren and colon shorthands are resolved consistently in links', () => {
    const ast = parse(`
      :Customer:
      (Buy Product)
      :Customer: --> (Buy Product)
    `);
    expect(ast.links[0]).toMatchObject({ from: 'Customer', to: 'Buy Product' });
  });
});
