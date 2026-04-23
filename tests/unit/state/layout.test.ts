/**
 * Unit tests for the state diagram layout engine.
 *
 * Uses the synchronous dot layout engine. All tests are synchronous.
 */

import { describe, it, expect } from 'vitest';
import { layoutState } from '../../../src/diagrams/state/layout.js';
import type {
  StateDiagramAST,
  State,
  Transition,
} from '../../../src/diagrams/state/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();
const theme = defaultTheme;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  id: string,
  overrides: Partial<State> = {},
): State {
  return {
    id,
    display: id,
    kind: 'normal',
    children: [],
    concurrentRegions: [],
    ...overrides,
  };
}

function makeTransition(
  from: string,
  to: string,
  overrides: Partial<Transition> = {},
): Transition {
  return { from, to, ...overrides };
}

const EMPTY_AST: StateDiagramAST = { states: [], transitions: [] };

// ---------------------------------------------------------------------------
// Empty AST
// ---------------------------------------------------------------------------

describe('layoutState — empty AST', () => {
  it('resolves without error', () => {
    const result = layoutState(EMPTY_AST, theme, measurer);
    expect(result).toBeDefined();
  });

  it('returns empty states array', () => {
    const result = layoutState(EMPTY_AST, theme, measurer);
    expect(result.states).toEqual([]);
  });

  it('returns empty transitions array', () => {
    const result = layoutState(EMPTY_AST, theme, measurer);
    expect(result.transitions).toEqual([]);
  });

  it('returns totalWidth of 0', () => {
    const result = layoutState(EMPTY_AST, theme, measurer);
    expect(result.totalWidth).toBe(0);
  });

  it('returns totalHeight of 0', () => {
    const result = layoutState(EMPTY_AST, theme, measurer);
    expect(result.totalHeight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Single standalone state
// ---------------------------------------------------------------------------

describe('layoutState — single standalone state', () => {
  const ast: StateDiagramAST = {
    states: [makeState('Idle')],
    transitions: [],
  };

  it('state has width > 0', () => {
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'Idle');
    expect(state?.width).toBeGreaterThan(0);
  });

  it('state has height > 0', () => {
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'Idle');
    expect(state?.height).toBeGreaterThan(0);
  });

  it('state kind is preserved', () => {
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'Idle');
    expect(state?.kind).toBe('normal');
  });

  it('state display is preserved', () => {
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'Idle');
    expect(state?.display).toBe('Idle');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 1: [*] → A → B → [*] layered top-to-bottom
// ---------------------------------------------------------------------------

describe('layoutState — [*] → A → B → [*] ordering', () => {
  const ast: StateDiagramAST = {
    states: [makeState('A'), makeState('B')],
    transitions: [
      makeTransition('[*]', 'A'),
      makeTransition('A', 'B'),
      makeTransition('B', '[*]'),
    ],
  };

  it('resolves without error', () => {
    expect(layoutState(ast, theme, measurer)).toBeDefined();
  });

  it('initial pseudostate is above state A (y(initial) < y(A))', () => {
    const result = layoutState(ast, theme, measurer);
    const initial = result.states.find((s) => s.kind === 'initial');
    const stateA = result.states.find((s) => s.id === 'A');
    expect(initial).toBeDefined();
    expect(stateA).toBeDefined();
    expect(initial!.y).toBeLessThan(stateA!.y);
  });

  it('state A is above state B (y(A) < y(B))', () => {
    const result = layoutState(ast, theme, measurer);
    const stateA = result.states.find((s) => s.id === 'A');
    const stateB = result.states.find((s) => s.id === 'B');
    expect(stateA).toBeDefined();
    expect(stateB).toBeDefined();
    expect(stateA!.y).toBeLessThan(stateB!.y);
  });

  it('state B is above the final pseudostate (y(B) < y(final))', () => {
    const result = layoutState(ast, theme, measurer);
    const stateB = result.states.find((s) => s.id === 'B');
    const finalState = result.states.find((s) => s.kind === 'final');
    expect(stateB).toBeDefined();
    expect(finalState).toBeDefined();
    expect(stateB!.y).toBeLessThan(finalState!.y);
  });

  it('produces one TransitionGeo per AST transition', () => {
    const result = layoutState(ast, theme, measurer);
    expect(result.transitions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 2: composite state encompasses children
// ---------------------------------------------------------------------------

describe('layoutState — composite state with 2 children', () => {
  const child1 = makeState('Child1');
  const child2 = makeState('Child2');
  const composite = makeState('Composite', { children: [child1, child2] });

  const ast: StateDiagramAST = {
    states: [composite],
    transitions: [],
  };

  it('composite node appears in result', () => {
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp).toBeDefined();
  });

  it('composite node has 2 child StateNodeGeo entries', () => {
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.children).toHaveLength(2);
  });

  it('composite bounding box encompasses child1 (absolute coords)', () => {
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    const c1 = comp?.children.find((c) => c.id === 'Child1');
    expect(comp).toBeDefined();
    expect(c1).toBeDefined();
    // Child absolute x/y must be within parent bounds
    expect(c1!.x).toBeGreaterThanOrEqual(comp!.x);
    expect(c1!.y).toBeGreaterThanOrEqual(comp!.y);
    expect(c1!.x + c1!.width).toBeLessThanOrEqual(comp!.x + comp!.width + 1); // +1 tolerance
  });

  it('composite bounding box encompasses child2 (absolute coords)', () => {
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    const c2 = comp?.children.find((c) => c.id === 'Child2');
    expect(comp).toBeDefined();
    expect(c2).toBeDefined();
    expect(c2!.x).toBeGreaterThanOrEqual(comp!.x);
    expect(c2!.y).toBeGreaterThanOrEqual(comp!.y);
    expect(c2!.y + c2!.height).toBeLessThanOrEqual(comp!.y + comp!.height + 1);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 3: fork node width > height (bar shape)
// ---------------------------------------------------------------------------

describe('layoutState — fork pseudostate sizing', () => {
  const ast: StateDiagramAST = {
    states: [makeState('Fork1', { kind: 'fork' })],
    transitions: [],
  };

  it('fork node width > height', () => {
    const result = layoutState(ast, theme, measurer);
    const fork = result.states.find((s) => s.kind === 'fork');
    expect(fork).toBeDefined();
    expect(fork!.width).toBeGreaterThan(fork!.height);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 4: transition with label sets label.text
// ---------------------------------------------------------------------------

describe('layoutState — transition with label', () => {
  const ast: StateDiagramAST = {
    states: [makeState('A'), makeState('B')],
    transitions: [
      makeTransition('A', 'B', { label: 'go' }),
    ],
  };

  it('TransitionGeo has label.text set', () => {
    const result = layoutState(ast, theme, measurer);
    const transition = result.transitions[0];
    expect(transition).toBeDefined();
    expect(transition!.label?.text).toBe('go');
  });
});

// ---------------------------------------------------------------------------
// Guard / action label combinations
// ---------------------------------------------------------------------------

describe('layoutState — transition label derived from guard and action', () => {
  it('guard-only transition has label with guard text', () => {
    const ast: StateDiagramAST = {
      states: [makeState('X'), makeState('Y')],
      transitions: [makeTransition('X', 'Y', { guard: 'ready' })],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t?.label?.text).toBe('[ready]');
  });

  it('action-only transition has label with action text', () => {
    const ast: StateDiagramAST = {
      states: [makeState('X'), makeState('Y')],
      transitions: [makeTransition('X', 'Y', { action: 'doIt' })],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t?.label?.text).toBe('/ doIt');
  });
});

// ---------------------------------------------------------------------------
// Transition with no label
// ---------------------------------------------------------------------------

describe('layoutState — transition without label', () => {
  it('TransitionGeo has no label property when transition has no label', () => {
    const ast: StateDiagramAST = {
      states: [makeState('P'), makeState('Q')],
      transitions: [makeTransition('P', 'Q')],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t).toBeDefined();
    expect(t!.label).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Pseudostate fixed sizes
// ---------------------------------------------------------------------------

describe('layoutState — pseudostate fixed sizes', () => {
  it('initial node has width=20 and height=20', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A')],
      transitions: [makeTransition('[*]', 'A')],
    };
    const result = layoutState(ast, theme, measurer);
    const initial = result.states.find((s) => s.kind === 'initial');
    expect(initial?.width).toBe(20);
    expect(initial?.height).toBe(20);
  });

  it('final node has width=24 and height=24', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A')],
      transitions: [makeTransition('A', '[*]')],
    };
    const result = layoutState(ast, theme, measurer);
    const finalNode = result.states.find((s) => s.kind === 'final');
    expect(finalNode?.width).toBe(24);
    expect(finalNode?.height).toBe(24);
  });

  it('join node has width > height (bar shape)', () => {
    const ast: StateDiagramAST = {
      states: [makeState('J', { kind: 'join' })],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    const join = result.states.find((s) => s.kind === 'join');
    expect(join).toBeDefined();
    expect(join!.width).toBeGreaterThan(join!.height);
  });
});

// ---------------------------------------------------------------------------
// Normal state minimum width
// ---------------------------------------------------------------------------

describe('layoutState — normal state minimum width', () => {
  it('short display name still produces width >= 80', () => {
    const ast: StateDiagramAST = {
      states: [makeState('Hi', { display: 'Hi' })],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'Hi');
    expect(state?.width).toBeGreaterThanOrEqual(80);
  });

  it('long display name produces width > 80', () => {
    const longLabel = 'A very long state name that exceeds eighty pixels';
    const ast: StateDiagramAST = {
      states: [makeState('S', { display: longLabel })],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'S');
    // FormulaMeasurer: length * size * 0.55 = 49 * 14 * 0.55 ≈ 377 + 20 > 80
    expect(state?.width).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// TransitionGeo from/to fields
// ---------------------------------------------------------------------------

describe('layoutState — TransitionGeo preserves original [*] from/to', () => {
  it('from field is [*] for initial transition', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A')],
      transitions: [makeTransition('[*]', 'A')],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t?.from).toBe('[*]');
    expect(t?.to).toBe('A');
  });

  it('to field is [*] for final transition', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A')],
      transitions: [makeTransition('A', '[*]')],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t?.from).toBe('A');
    expect(t?.to).toBe('[*]');
  });
});

// ---------------------------------------------------------------------------
// Overall diagram dimensions
// ---------------------------------------------------------------------------

describe('layoutState — overall dimensions', () => {
  it('non-empty diagram has totalWidth > 0', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A'), makeState('B')],
      transitions: [makeTransition('A', 'B')],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.totalWidth).toBeGreaterThan(0);
  });

  it('non-empty diagram has totalHeight > 0', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A'), makeState('B')],
      transitions: [makeTransition('A', 'B')],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.totalHeight).toBeGreaterThan(0);
  });
});
