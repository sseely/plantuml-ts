// pending graphviz-ts adapter — see plans/burn-graphviz-engines/handoff-adapter.md
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
    transitions: [],
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

describe.skip('layoutState — empty AST', () => {
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

describe.skip('layoutState — single standalone state', () => {
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

describe.skip('layoutState — [*] → A → B → [*] ordering', () => {
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

describe.skip('layoutState — composite state with 2 children', () => {
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

describe.skip('layoutState — fork pseudostate sizing', () => {
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

describe.skip('layoutState — transition with label', () => {
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

describe.skip('layoutState — transition label derived from guard and action', () => {
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

describe.skip('layoutState — transition without label', () => {
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

describe.skip('layoutState — pseudostate fixed sizes', () => {
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

describe.skip('layoutState — normal state minimum width', () => {
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

describe.skip('layoutState — TransitionGeo preserves original [*] from/to', () => {
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
// Composite state: label width floor
// ---------------------------------------------------------------------------

describe.skip('layoutState — composite label width floor', () => {
  it('composite width accommodates a long display name', () => {
    const child = makeState('X');
    const longDisplay = 'Very Long Composite State Name';
    const composite = makeState('Comp', { display: longDisplay, children: [child] });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Comp');
    expect(comp).toBeDefined();
    const labelWidth = measurer.measure(longDisplay, { family: theme.fontFamily, size: theme.fontSize }).width;
    expect(comp!.width).toBeGreaterThanOrEqual(labelWidth);
  });
});

// ---------------------------------------------------------------------------
// Overall diagram dimensions
// ---------------------------------------------------------------------------

describe.skip('layoutState — overall dimensions', () => {
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

// ---------------------------------------------------------------------------
// Transition label at middle waypoint
// ---------------------------------------------------------------------------

describe.skip('layoutState — transition label at middle waypoint', () => {
  it('label x/y is near the middle of the edge points, not the start', () => {
    // A transition that gets routed with multiple waypoints:
    // composite state with children forces the outer edge to arc around it.
    const child = makeState('Inner');
    const composite = makeState('Composite', { children: [child] });
    const ast: StateDiagramAST = {
      states: [composite, makeState('Target')],
      transitions: [makeTransition('Composite', 'Target', { label: 'done' })],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions.find((tr) => tr.label?.text === 'done');
    expect(t).toBeDefined();
    expect(t!.label).toBeDefined();
    // The label must not be at the start point
    const startPoint = t!.points[0]!;
    const labelX = t!.label!.x;
    const labelY = t!.label!.y;
    // Label must be some distance from the start point
    const distFromStart = Math.sqrt(
      (labelX - startPoint.x) ** 2 + (labelY - startPoint.y) ** 2,
    );
    expect(distFromStart).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// Guard + action combined label
// ---------------------------------------------------------------------------

describe.skip('layoutState — guard and action combined label', () => {
  it('transition with both guard and action produces "[guard] / action" label', () => {
    const ast: StateDiagramAST = {
      states: [makeState('X'), makeState('Y')],
      transitions: [makeTransition('X', 'Y', { guard: 'ready', action: 'doIt' })],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t?.label?.text).toBe('[ready] / doIt');
  });
});

// ---------------------------------------------------------------------------
// Composite state with inner transitions (covers innerTransitionGeos path)
// ---------------------------------------------------------------------------

describe.skip('layoutState — composite state with internal transitions', () => {
  it('composite with child-to-child transition produces inner transition geos', () => {
    const child1 = makeState('C1');
    const child2 = makeState('C2');
    const innerTransition = makeTransition('C1', 'C2', { label: 'next' });
    const composite = makeState('Outer', {
      children: [child1, child2],
      transitions: [innerTransition],
    });
    const ast: StateDiagramAST = {
      states: [composite],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    // The inner transition should appear in the top-level result
    const innerT = result.transitions.find((tr) => tr.label?.text === 'next');
    expect(innerT).toBeDefined();
  });

  it('composite with many children produces transitions for all inner edges', () => {
    // A chain of 3 children forces longer edges that may have >2 waypoints
    const c1 = makeState('IC1');
    const c2 = makeState('IC2');
    const c3 = makeState('IC3');
    const composite = makeState('BigOuter', {
      children: [c1, c2, c3],
      transitions: [
        makeTransition('[*]', 'IC1'),
        makeTransition('IC1', 'IC2', { label: 'step' }),
        makeTransition('IC2', 'IC3'),
        makeTransition('IC3', '[*]'),
      ],
    });
    const ast: StateDiagramAST = {
      states: [composite],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.states.find((s) => s.id === 'BigOuter')).toBeDefined();
    // Inner transitions are propagated to top-level
    expect(result.transitions.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Empty states with non-empty transitions (dotNodes.length === 0 path)
// ---------------------------------------------------------------------------

describe.skip('layoutState — empty states with transitions', () => {
  it('returns empty geometry when states array is empty even with transitions', () => {
    // This exercises the dotNodes.length === 0 early return inside layoutLevel
    const ast: StateDiagramAST = {
      states: [],
      transitions: [makeTransition('A', 'B')],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.states).toHaveLength(0);
    expect(result.transitions).toHaveLength(0);
    expect(result.totalWidth).toBe(0);
    expect(result.totalHeight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multiple transitions between same pair (forces >2 waypoints via parallel routing)
// ---------------------------------------------------------------------------

describe.skip('layoutState — parallel transitions between same states', () => {
  it('two transitions between same state pair produce edges with >=2 waypoints', () => {
    const ast: StateDiagramAST = {
      states: [makeState('P'), makeState('Q')],
      transitions: [
        makeTransition('P', 'Q', { label: 'event1' }),
        makeTransition('P', 'Q', { label: 'event2' }),
      ],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.transitions).toHaveLength(2);
    // Both transitions should have labels
    const t1 = result.transitions.find((t) => t.label?.text === 'event1');
    const t2 = result.transitions.find((t) => t.label?.text === 'event2');
    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
  });
});
