import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State, Transition } from '../../../src/diagrams/state/ast.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

/**
 * Like `parse` but preserves empty lines so the `line === ''` branch
 * inside the parser loop is exercised.
 */
function parseRaw(source: string): StateDiagramAST {
  const lines = source.split('\n').map((l) => l.trim());
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

function findState(ast: StateDiagramAST, id: string): State | undefined {
  return ast.states.find((s) => s.id === id);
}

function findTransition(
  ast: StateDiagramAST,
  from: string,
  to: string,
): Transition | undefined {
  return ast.transitions.find((t) => t.from === from && t.to === to);
}

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 1
// ---------------------------------------------------------------------------

describe('acceptance criterion 1 — initial pseudostate transition', () => {
  it('creates transition from=[*] to=Active', () => {
    const ast = parse('[*] --> Active');
    const t = findTransition(ast, '[*]', 'Active');
    expect(t).toBeDefined();
    expect(t?.from).toBe('[*]');
    expect(t?.to).toBe('Active');
  });

  it('auto-creates Active as kind=normal', () => {
    const ast = parse('[*] --> Active');
    const s = findState(ast, 'Active');
    expect(s).toBeDefined();
    expect(s?.kind).toBe('normal');
  });

  it('does NOT create a State node for [*]', () => {
    const ast = parse('[*] --> Active');
    const pseudo = ast.states.find((s) => s.id === '[*]');
    expect(pseudo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 2
// ---------------------------------------------------------------------------

describe('acceptance criterion 2 — quoted display name with alias', () => {
  it('parses state id=MS display="My State" kind=normal', () => {
    const ast = parse("state 'My State' as MS");
    const s = findState(ast, 'MS');
    expect(s).toBeDefined();
    expect(s?.id).toBe('MS');
    expect(s?.display).toBe('My State');
    expect(s?.kind).toBe('normal');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 3
// ---------------------------------------------------------------------------

describe('acceptance criterion 3 — final transition with label', () => {
  it('creates transition to=[*] with label "done"', () => {
    const ast = parse('Active --> [*] : done');
    const t = findTransition(ast, 'Active', '[*]');
    expect(t).toBeDefined();
    expect(t?.to).toBe('[*]');
    expect(t?.label).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 4
// ---------------------------------------------------------------------------

describe('acceptance criterion 4 — composite state with nested transitions', () => {
  it('Composite state has children A and B', () => {
    const ast = parse(`
      state Composite {
        A --> B
      }
    `);
    const composite = findState(ast, 'Composite');
    expect(composite).toBeDefined();
    expect(composite?.children.map((c) => c.id)).toContain('A');
    expect(composite?.children.map((c) => c.id)).toContain('B');
  });

  it('nested transitions are stored on the composite state', () => {
    const ast = parse(`
      state Composite {
        A --> B
      }
    `);
    const composite = findState(ast, 'Composite');
    const t = composite?.transitions.find((tr) => tr.from === 'A' && tr.to === 'B');
    expect(t).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 5
// ---------------------------------------------------------------------------

describe('acceptance criterion 5 — concurrent regions', () => {
  it('concurrentRegions has exactly 2 regions', () => {
    const ast = parse(`
      state S {
        [*] --> A
        --
        [*] --> B
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.concurrentRegions).toHaveLength(2);
  });

  it('first region contains state A, second region contains state B', () => {
    const ast = parse(`
      state S {
        [*] --> A
        --
        [*] --> B
      }
    `);
    const s = findState(ast, 'S');
    const region0 = s?.concurrentRegions[0] ?? [];
    const region1 = s?.concurrentRegions[1] ?? [];
    expect(region0.some((st) => st.id === 'A')).toBe(true);
    expect(region1.some((st) => st.id === 'B')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 6 & 7
// ---------------------------------------------------------------------------

describe('acceptance criterion 6 — choice pseudostate', () => {
  it('parses state choice <<choice>> as kind=choice', () => {
    const ast = parse('state choice <<choice>>');
    const s = findState(ast, 'choice');
    expect(s?.kind).toBe('choice');
  });
});

describe('acceptance criterion 7 — fork pseudostate', () => {
  it('parses state F <<fork>> as kind=fork', () => {
    const ast = parse('state F <<fork>>');
    const s = findState(ast, 'F');
    expect(s?.kind).toBe('fork');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 8
// ---------------------------------------------------------------------------

describe('acceptance criterion 8 — guard and action in label', () => {
  it('parses guard and action from "A --> B : [guard] / action"', () => {
    const ast = parse('A --> B : [guard] / action');
    const t = findTransition(ast, 'A', 'B');
    expect(t).toBeDefined();
    expect(t?.guard).toBe('guard');
    expect(t?.action).toBe('action');
  });

  it('includes raw label text when guard and action are both present', () => {
    const ast = parse('A --> B : [guard] / action');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.label).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria — criterion 9
// ---------------------------------------------------------------------------

describe('acceptance criterion 9 — state color', () => {
  it('parses color from "state Active #pink"', () => {
    const ast = parse('state Active #pink');
    const s = findState(ast, 'Active');
    expect(s?.color).toBe('#pink');
  });
});

// ---------------------------------------------------------------------------
// Additional coverage — stereotypes
// ---------------------------------------------------------------------------

describe('stereotype kinds', () => {
  const cases: Array<[string, string]> = [
    ['join', 'join'],
    ['junction', 'junction'],
    ['history', 'history'],
    ['deepHistory', 'deepHistory'],
  ];

  for (const [stereotype, expectedKind] of cases) {
    it(`<<${stereotype}>> maps to kind=${expectedKind}`, () => {
      const ast = parse(`state S <<${stereotype}>>`);
      const s = findState(ast, 'S');
      expect(s?.kind).toBe(expectedKind);
    });
  }

  it('stores stereotype string on the State node', () => {
    const ast = parse('state C <<choice>>');
    const s = findState(ast, 'C');
    expect(s?.stereotype).toBe('choice');
  });

  it('quoted alias with stereotype parses correctly', () => {
    // Exercises the match[1]/match[2] branch inside command 5.
    const ast = parse("state 'My Choice' as MC <<choice>>");
    const s = findState(ast, 'MC');
    expect(s).toBeDefined();
    expect(s?.display).toBe('My Choice');
    expect(s?.kind).toBe('choice');
  });

  it('stereotype with color', () => {
    const ast = parse('state F <<fork>> #blue');
    const s = findState(ast, 'F');
    expect(s?.kind).toBe('fork');
    expect(s?.color).toBe('#blue');
  });
});

// ---------------------------------------------------------------------------
// Additional coverage — ignored lines
// ---------------------------------------------------------------------------

describe('ignored lines', () => {
  it('ignores skinparam lines', () => {
    const ast = parse(`
      skinparam backgroundColor white
      [*] --> Active
    `);
    expect(ast.states).toHaveLength(1);
    expect(ast.transitions).toHaveLength(1);
  });

  it('ignores title lines', () => {
    const ast = parse(`
      title My Diagram
      [*] --> Active
    `);
    expect(ast.transitions).toHaveLength(1);
  });

  it('ignores scale lines', () => {
    const ast = parse(`
      scale 2
      A --> B
    `);
    expect(ast.transitions).toHaveLength(1);
  });

  it('ignores comment lines starting with a tick', () => {
    const ast = parse(`
      ' this is a comment
      A --> B
    `);
    expect(ast.transitions).toHaveLength(1);
  });

  it('ignores hide and show lines', () => {
    const ast = parse(`
      hide empty description
      show all
      A --> B
    `);
    expect(ast.transitions).toHaveLength(1);
  });

  it('skips blank lines when present in the raw input', () => {
    // Use parseRaw so empty lines are not stripped before reaching the parser.
    const ast = parseRaw('\n\nA --> B\n\n');
    expect(ast.transitions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Additional coverage — transitions
// ---------------------------------------------------------------------------

describe('transitions', () => {
  it('parses simple A --> B transition', () => {
    const ast = parse('A --> B');
    const t = findTransition(ast, 'A', 'B');
    expect(t).toBeDefined();
    expect(t?.guard).toBeUndefined();
    expect(t?.action).toBeUndefined();
  });

  it('parses label-only transition', () => {
    const ast = parse('A --> B : some event');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.label).toBe('some event');
    expect(t?.guard).toBeUndefined();
    expect(t?.action).toBeUndefined();
  });

  it('parses guard-only label', () => {
    const ast = parse('A --> B : [condition]');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.guard).toBe('condition');
  });

  it('parses action-only label with leading slash', () => {
    const ast = parse('A --> B : / doSomething');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.action).toBe('doSomething');
  });

  it('auto-creates both endpoint states for an undeclared transition', () => {
    const ast = parse('X --> Y');
    expect(findState(ast, 'X')).toBeDefined();
    expect(findState(ast, 'Y')).toBeDefined();
  });

  it('does not duplicate states when same state appears in multiple transitions', () => {
    const ast = parse(`
      [*] --> A
      A --> B
      B --> [*]
    `);
    const aCopies = ast.states.filter((s) => s.id === 'A');
    expect(aCopies).toHaveLength(1);
  });

  it('transition with no label produces no label/guard/action properties', () => {
    const ast = parse('A --> B');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.label).toBeUndefined();
    expect(t?.guard).toBeUndefined();
    expect(t?.action).toBeUndefined();
  });

  it('empty guard brackets produce no guard property', () => {
    const ast = parse('A --> B : []');
    const t = findTransition(ast, 'A', 'B');
    // empty guard — no guard property
    expect(t?.guard).toBeUndefined();
  });

  it('empty guard with trailing rest becomes label', () => {
    const ast = parse('A --> B : [] extra');
    const t = findTransition(ast, 'A', 'B');
    // empty guard + non-empty rest → label = raw text
    expect(t?.label).toBe('[] extra');
  });

  it('empty guard followed by slash with no action', () => {
    // [] / → empty guard, empty action → both undefined, label=raw
    const ast = parse('A --> B : [] /');
    const t = findTransition(ast, 'A', 'B');
    expect(t?.guard).toBeUndefined();
    expect(t?.action).toBeUndefined();
    expect(t?.label).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Additional coverage — explicit state declarations
// ---------------------------------------------------------------------------

describe('state declarations', () => {
  it('declared state is not duplicated when also referenced in a transition', () => {
    const ast = parse(`
      state Active
      [*] --> Active
    `);
    const copies = ast.states.filter((s) => s.id === 'Active');
    expect(copies).toHaveLength(1);
  });

  it('plain state declaration produces kind=normal', () => {
    const ast = parse('state Idle');
    const s = findState(ast, 'Idle');
    expect(s?.kind).toBe('normal');
    expect(s?.display).toBe('Idle');
  });

  it('plain state with quoted alias uses alias as id', () => {
    // Exercises match[1]/match[2] branch in command 6 (plain declaration).
    const ast = parse("state 'Long Name' as LN");
    expect(findState(ast, 'LN')).toBeDefined();
    expect(findState(ast, 'Long Name')).toBeUndefined();
    expect(findState(ast, 'LN')?.display).toBe('Long Name');
  });

  it('composite state is present in parent states list', () => {
    const ast = parse(`
      state Outer {
        A --> B
      }
    `);
    expect(findState(ast, 'Outer')).toBeDefined();
  });

  it('declaration after auto-creation updates display and kind', () => {
    // A is first referenced in a transition (auto-created kind=normal, display="A")
    // then explicitly declared with a color — declareState must update in-place.
    const ast = parse(`
      [*] --> A
      state A #red
    `);
    const s = findState(ast, 'A');
    expect(s?.color).toBe('#red');
    // should still be exactly one copy
    const copies = ast.states.filter((st) => st.id === 'A');
    expect(copies).toHaveLength(1);
  });

  it('declaration after auto-creation with stereotype updates kind in-place', () => {
    const ast = parse(`
      [*] --> C
      state C <<choice>>
    `);
    const s = findState(ast, 'C');
    expect(s?.kind).toBe('choice');
    expect(s?.stereotype).toBe('choice');
    const copies = ast.states.filter((st) => st.id === 'C');
    expect(copies).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Additional coverage — unclosed composite scope fallback
// ---------------------------------------------------------------------------

describe('unclosed composite scope fallback', () => {
  it('gracefully handles missing closing brace', () => {
    // Missing `}` — parser must close scope automatically.
    const ast = parse(`
      state Outer {
        A --> B
    `);
    // Outer should still be in the state list.
    const outer = findState(ast, 'Outer');
    expect(outer).toBeDefined();
    // The nested transition A→B should be stored on Outer.transitions (not hoisted).
    expect(outer?.transitions.find((t) => t.from === 'A' && t.to === 'B')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Additional coverage — composite state with color and quoted alias
// ---------------------------------------------------------------------------

describe('composite state with color and stereotype', () => {
  it('accepts color on composite state opening line', () => {
    const ast = parse(`
      state Outer #yellow {
        A --> B
      }
    `);
    const s = findState(ast, 'Outer');
    expect(s?.color).toBe('#yellow');
  });

  it('accepts quoted alias on composite state opening line', () => {
    // Exercises match[1]/match[2] branch in command 4.
    const ast = parse(`
      state 'My Composite' as MC {
        A --> B
      }
    `);
    const s = findState(ast, 'MC');
    expect(s).toBeDefined();
    expect(s?.display).toBe('My Composite');
    expect(s?.children.map((c) => c.id)).toContain('A');
  });

  it('composite state concurrentRegions is empty for non-concurrent composite', () => {
    const ast = parse(`
      state Outer {
        A --> B
      }
    `);
    const s = findState(ast, 'Outer');
    expect(s?.concurrentRegions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Double-quote support for display-name-with-alias form
// ---------------------------------------------------------------------------

describe('double-quote display name with alias', () => {
  it('cmd 4: "Processing" as Proc { creates composite state with correct id and display', () => {
    const ast = parse(`
      state "Processing" as Proc {
        [*] --> Inner
      }
    `);
    const s = findState(ast, 'Proc');
    expect(s).toBeDefined();
    expect(s?.id).toBe('Proc');
    expect(s?.display).toBe('Processing');
    expect(s?.children.length).toBeGreaterThan(0);
  });

  it("cmd 4: 'Quoted' as Q { still works (single-quote regression)", () => {
    const ast = parse(`
      state 'Quoted' as Q {
        [*] --> Inner
      }
    `);
    const s = findState(ast, 'Q');
    expect(s).toBeDefined();
    expect(s?.id).toBe('Q');
    expect(s?.display).toBe('Quoted');
    expect(s?.children.length).toBeGreaterThan(0);
  });

  it('cmd 6: state "Leaf" as L (no brace) sets id=L and display=Leaf', () => {
    const ast = parse('state "Leaf" as L');
    const s = findState(ast, 'L');
    expect(s).toBeDefined();
    expect(s?.id).toBe('L');
    expect(s?.display).toBe('Leaf');
  });

  it('full canonical parse: Proc has children Validating and Executing', () => {
    const ast = parse(`
      [*] --> Idle
      state Idle
      state "Processing" as Proc {
        [*] --> Validating
        Validating --> Executing : valid
        Validating --> [*] : invalid
        Executing --> [*] : done
      }
      Idle --> Proc : start [has items]
      Idle --> [*] : shutdown
      Proc --> Idle : completed
      Proc --> [*] : cancelled
    `);

    const proc = findState(ast, 'Proc');
    expect(proc).toBeDefined();
    expect(proc?.display).toBe('Processing');
    expect(proc?.children).toHaveLength(2);
    expect(proc?.children.map((c) => c.id)).toContain('Validating');
    expect(proc?.children.map((c) => c.id)).toContain('Executing');

    expect(findState(ast, 'Idle')).toBeDefined();

    expect(findTransition(ast, '[*]', 'Idle')).toBeDefined();
    expect(findTransition(ast, 'Idle', 'Proc')).toBeDefined();
  });
});
