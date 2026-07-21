/**
 * Unit tests for the state diagram layout engine.
 *
 * Uses the synchronous dot layout engine. All tests are synchronous.
 *
 * Two assertion families were updated for the T3 svek-faithful flat-state
 * rewrite (mission A4 state-dot-sync, mechanisms.md §1) — the pre-existing
 * greenfield sizing constants they encoded are gone:
 *   - "final node" pseudostate size: was 24x24 (invented), is now 22x22
 *     (CircleEnd.java SIZE=22 — distinct from CircleStart's 20x20).
 *   - "normal state minimum width": was >=80 (invented MIN_WIDTH), is now
 *     >=50 (EntityImageState.java MIN_WIDTH=50).
 * Every other assertion in this file is unaffected (either flat-diagram
 * values that already matched svek, or composite-diagram cases which still
 * route through the LEGACY pipeline in layout.ts, unchanged by T3 — see
 * layout.ts's `hasAnyComposite` dispatch doc).
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
// G4 S9: stereotype threading (StateBorderColor<<X>> cascade prerequisite)
// ---------------------------------------------------------------------------

describe('layoutState — state stereotype threading', () => {
  it('threads State.stereotype onto the flat-pipeline StateNodeGeo', () => {
    const ast: StateDiagramAST = {
      states: [makeState('a', { stereotype: 'meblue' })],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'a');
    expect(state?.stereotype).toBe('meblue');
  });

  it('leaves stereotype undefined for a state with no <<tag>>', () => {
    const ast: StateDiagramAST = {
      states: [makeState('a')],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'a');
    expect(state?.stereotype).toBeUndefined();
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
// Mission G4 S3, mechanism 6: composite headerLines/bodyLines threading
// ---------------------------------------------------------------------------

describe('layoutState -- composite headerLines/bodyLines (mechanism 6)', () => {
  it('an autonom composite (no crossing links) carries measured headerLines for its own title', () => {
    const child = makeState('Child');
    const composite = makeState('Composite', { children: [child] });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.headerLines).toEqual([{ text: 'Composite', width: measurer.measure('Composite', { family: theme.fontFamily, size: theme.fontSize }).width }]);
  });

  it('an autonom composite with a description line carries measured bodyLines', () => {
    const child = makeState('Child');
    const composite = makeState('Composite', { children: [child], description: ['entry / go();'] });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.bodyLines).toEqual([
      { text: 'entry / go();', width: measurer.measure('entry / go();', { family: theme.fontFamily, size: theme.fontSize }).width },
    ]);
  });

  it('an autonom composite with NO description line carries an empty bodyLines array', () => {
    const child = makeState('Child');
    const composite = makeState('Composite', { children: [child] });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.bodyLines).toEqual([]);
  });

  it('a per-composite #color override threads through onto the materialized StateNodeGeo', () => {
    const child = makeState('Child');
    const composite = makeState('Composite', { children: [child], color: '#red' });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.color).toBe('#red');
  });

  // G4 S9: StateBorderColor<<X>> cascade prerequisite -- a composite's OWN
  // stereotype must reach its materialized StateNodeGeo the SAME way #color
  // does (jar-verified `semala-31-joji042`: `state a<<meblue>>` with
  // concurrent regions -- see `state-render-colors.ts#resolveStateBorder`).
  it('a composite stereotype threads through onto the materialized StateNodeGeo (autonom pipeline)', () => {
    const child = makeState('Child');
    const composite = makeState('Composite', { children: [child], stereotype: 'meblue' });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.stereotype).toBe('meblue');
  });

  it('a concurrent-region-owning composite stereotype ALSO threads through', () => {
    const region1 = [makeState('R1A')];
    const region2 = [makeState('R2A')];
    const composite = makeState('Composite', { concurrentRegions: [region1, region2], stereotype: 'meblue' });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.stereotype).toBe('meblue');
  });

  it('a concurrent-region-owning composite ALSO carries headerLines for its own title (not just plain autonom composites)', () => {
    const region1 = [makeState('R1A')];
    const region2 = [makeState('R2A')];
    const composite = makeState('Composite', { concurrentRegions: [region1, region2] });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.headerLines).toEqual([{ text: 'Composite', width: measurer.measure('Composite', { family: theme.fontFamily, size: theme.fontSize }).width }]);
  });

  it('a NON-autonom (cluster) composite does NOT carry headerLines -- the boundary a link crossing forces', () => {
    // A --> B crosses Composite's own boundary (B is declared elsewhere),
    // forcing the non-autonom/cluster classification (state-composite-
    // classify.ts) -- this port does not yet thread headerLines through
    // the cluster path (renderer-composite-box.ts's own doc comment names
    // this as a deliberate, non-regressing deferral).
    const a = makeState('A');
    const composite = makeState('Composite', { children: [a] });
    const b = makeState('B');
    const ast: StateDiagramAST = {
      states: [composite, b],
      transitions: [{ from: 'A', to: 'B' }],
    };
    const result = layoutState(ast, theme, measurer);
    const comp = result.states.find((s) => s.id === 'Composite');
    expect(comp?.headerLines).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Mission G4 S6, mechanisms 13/14: concurrent-region separator lines +
// per-region pseudo-node scope-id collision
// ---------------------------------------------------------------------------

describe('layoutState -- concurrent regions (mechanisms 13/14)', () => {
  it('each concurrent region\'s own [*] pseudo-node gets a DISTINCT id -- no cross-region collision', () => {
    // Per diagnosis.md (S5 ledger): `buildConcurrentRegionPass` passed
    // `owner.id` (not a per-region scope id) as the `scopeId` param, so
    // EVERY region's own `[*]` pseudo-anchor collapsed onto the SAME
    // `__init_<owner.id>` string id -- `renderer-uid.ts#buildStateUidPlan`
    // keys its `ent%04d` uid Map by that string, so the LAST region visited
    // silently overwrote every earlier region's own uid, producing
    // duplicate `id="entXXXX"` attributes on sibling `<g>` elements (jar-
    // verified via `nelupe-49-xova546`'s own pretty-printed XML dump).
    const region1 = [makeState('A')];
    const region2 = [makeState('B')];
    const owner = makeState('Owner', {
      concurrentRegions: [region1, region2],
      transitions: [makeTransition('[*]', 'A'), makeTransition('[*]', 'B')],
    });
    const ast: StateDiagramAST = { states: [owner], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const ownerGeo = result.states.find((s) => s.id === 'Owner');
    const initialIds = ownerGeo!.children.filter((c) => c.kind === 'initial').map((c) => c.id);
    expect(initialIds).toHaveLength(2);
    expect(new Set(initialIds).size).toBe(2);
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
// mission G4 S15: crossStart/circleEnd threading (flat pipeline)
// ---------------------------------------------------------------------------

describe('layoutState — crossStart/circleEnd threading (mission G4 S15)', () => {
  it('threads Transition.circleEnd onto TransitionGeo.circleEnd', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A'), makeState('B')],
      transitions: [makeTransition('A', 'B', { circleEnd: true })],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.transitions[0]?.circleEnd).toBe(true);
    expect(result.transitions[0]?.crossStart).toBeUndefined();
  });

  it('threads Transition.crossStart onto TransitionGeo.crossStart', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A'), makeState('B')],
      transitions: [makeTransition('A', 'B', { crossStart: true })],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.transitions[0]?.crossStart).toBe(true);
    expect(result.transitions[0]?.circleEnd).toBeUndefined();
  });

  it('an ordinary transition carries neither flag', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A'), makeState('B')],
      transitions: [makeTransition('A', 'B')],
    };
    const result = layoutState(ast, theme, measurer);
    expect(result.transitions[0]?.crossStart).toBeUndefined();
    expect(result.transitions[0]?.circleEnd).toBeUndefined();
  });

  it('threads circleEnd/crossStart through the COMPOSITE pipeline too (an inner transition owned by a composite)', () => {
    const child1 = makeState('D1');
    const child2 = makeState('D2');
    const composite = makeState('DOuter', {
      children: [child1, child2],
      transitions: [makeTransition('D1', 'D2', { circleEnd: true })],
    });
    const ast: StateDiagramAST = { states: [composite], transitions: [] };
    const result = layoutState(ast, theme, measurer);
    const outer = result.states.find((s) => s.id === 'DOuter');
    const innerT = outer?.transitions.find((tr) => tr.from === 'D1');
    expect(innerT?.circleEnd).toBe(true);
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

  it('final node has width=22 and height=22 (CircleEnd.java SIZE=22)', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A')],
      transitions: [makeTransition('A', '[*]')],
    };
    const result = layoutState(ast, theme, measurer);
    const finalNode = result.states.find((s) => s.kind === 'final');
    expect(finalNode?.width).toBe(22);
    expect(finalNode?.height).toBe(22);
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
  it('short display name still produces width >= 50 (EntityImageState.java MIN_WIDTH=50)', () => {
    const ast: StateDiagramAST = {
      states: [makeState('Hi', { display: 'Hi' })],
      transitions: [],
    };
    const result = layoutState(ast, theme, measurer);
    const state = result.states.find((s) => s.id === 'Hi');
    expect(state?.width).toBeGreaterThanOrEqual(50);
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

// mission G4 S2: previously asserted the RAW, unresolved `'[*]'` AST token
// leaking straight into TransitionGeo -- jar-verified broken (gefefe-91-
// xoge233/moleco-69-sida106: `<path id="[*]-to-IDLE">` instead of jar's
// `id="*start*-to-IDLE"`, since `renderer.ts#svgEndpointId` only recognizes
// the shared `INITIAL_ID`/`FINAL_ID` anchor ids, never the literal AST
// token). `buildFlatTransitionGeos` now resolves through the SAME
// `endpointId` (state-dot-graph.ts) the DOT graph itself already used —
// see that function's own doc comment.
describe('layoutState — TransitionGeo resolves [*] to the shared start/end anchor id', () => {
  it('from field resolves to the shared INITIAL_ID anchor for an initial transition', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A')],
      transitions: [makeTransition('[*]', 'A')],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t?.from).toBe('__initial__');
    expect(t?.to).toBe('A');
  });

  it('to field resolves to the shared FINAL_ID anchor for a final transition', () => {
    const ast: StateDiagramAST = {
      states: [makeState('A')],
      transitions: [makeTransition('A', '[*]')],
    };
    const result = layoutState(ast, theme, measurer);
    const t = result.transitions[0];
    expect(t?.from).toBe('A');
    expect(t?.to).toBe('__final__');
  });
});

// ---------------------------------------------------------------------------
// Composite state: label width floor
// ---------------------------------------------------------------------------

describe('layoutState — composite label width floor', () => {
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

// ---------------------------------------------------------------------------
// Transition label at middle waypoint
// ---------------------------------------------------------------------------

describe('layoutState — transition label at middle waypoint', () => {
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

describe('layoutState — guard and action combined label', () => {
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

describe('layoutState — composite state with internal transitions', () => {
  it('composite with child-to-child transition attaches the inner transition to its OWN node, not the top level', () => {
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
    // mission G4 S5 (transition-nesting mechanism): jar nests a composite
    // pass's own internal transitions INSIDE that pass's own <g>, never as
    // flat top-level siblings -- see plans/g4-state-svg/ledger.md S5.
    const outer = result.states.find((s) => s.id === 'Outer');
    expect(outer).toBeDefined();
    const innerT = outer?.transitions.find((tr) => tr.label?.text === 'next');
    expect(innerT).toBeDefined();
    // Not duplicated at the top level.
    expect(result.transitions.find((tr) => tr.label?.text === 'next')).toBeUndefined();
  });

  it('composite with many children attaches transitions for all inner edges to its OWN node', () => {
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
    const bigOuter = result.states.find((s) => s.id === 'BigOuter');
    expect(bigOuter).toBeDefined();
    // Inner transitions attach to the composite's OWN node (mission G4 S5),
    // not the top-level StateGeometry.transitions array.
    expect(bigOuter?.transitions.length).toBeGreaterThan(0);
    expect(result.transitions.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Empty states with non-empty transitions (dotNodes.length === 0 path)
// ---------------------------------------------------------------------------

describe('layoutState — empty states with transitions', () => {
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

describe('layoutState — parallel transitions between same states', () => {
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
