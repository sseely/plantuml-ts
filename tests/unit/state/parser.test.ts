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
  // Region 0 (before the FIRST `--`) is `owner.children` -- it is not a
  // synthetic sub-group upstream (state-parse-state.ts's popScope doc,
  // verified via darime-88-moda428's oracle SVG qualified names). Only
  // subsequent separators allocate a `concurrentRegions` entry.
  it('concurrentRegions has exactly 1 region (region 0 is children)', () => {
    const ast = parse(`
      state S {
        [*] --> A
        --
        [*] --> B
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.concurrentRegions).toHaveLength(1);
  });

  it('children contains state A, concurrentRegions[0] contains state B', () => {
    const ast = parse(`
      state S {
        [*] --> A
        --
        [*] --> B
      }
    `);
    const s = findState(ast, 'S');
    const region0 = s?.children ?? [];
    const region1 = s?.concurrentRegions[0] ?? [];
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
// Additional coverage — `##[dashed|dotted|bold]color` LINECOLOR (mission
// A4 Phase L, Gap 2). Before this fix, a `##...`/`#line.dashed` suffix was
// simply unconsumed by every declaration rule's COLOR_OPT, so the WHOLE
// declaration line failed to match any command and was silently DROPPED --
// the state existed only if some OTHER line (a description line, a
// transition endpoint) happened to auto-create it. These pins assert the
// declaration line is no longer dropped (state exists, with the right
// display/kind) AND that the raw LINECOLOR blob is captured.
// @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:108
// -----------------------------------------------------------------------
describe('##[style]color LINECOLOR on state declarations (Phase L Gap 2)', () => {
  it('does not drop a plain declaration with a bare "##[dashed]" suffix (sesafu/xekebe)', () => {
    const ast = parse('state "Dashed 2" as State_2 ##[dashed]');
    const s = findState(ast, 'State_2');
    expect(s?.display).toBe('Dashed 2');
    expect(s?.lineColor).toBe('##[dashed]');
  });

  it('does not drop a plain declaration with the legacy "#line.dashed" COLOR form (sesafu/xekebe)', () => {
    const ast = parse('state "Dashed 4" as State_4 #line.dashed');
    const s = findState(ast, 'State_4');
    expect(s?.display).toBe('Dashed 4');
    expect(s?.color).toBe('#line.dashed');
  });

  it('captures "##[style]color" (style + color) on a composite opener (vedapo)', () => {
    const ast = parse('state Foo1 ##[dotted]blue {\n}');
    const s = findState(ast, 'Foo1');
    expect(s?.lineColor).toBe('##[dotted]blue');
  });

  it('captures LINECOLOR on a stereotyped pseudostate declaration', () => {
    const ast = parse('state c1 <<choice>> ##[bold]red');
    const s = findState(ast, 'c1');
    expect(s?.kind).toBe('choice');
    expect(s?.lineColor).toBe('##[bold]red');
  });

  it('captures LINECOLOR on a frame opener', () => {
    const ast = parse('frame F1 ##[dashed]green {\n}');
    const s = findState(ast, 'F1');
    expect(s?.container).toBe('frame');
    expect(s?.lineColor).toBe('##[dashed]green');
  });

  it('combines COLOR and LINECOLOR on the same declaration', () => {
    const ast = parse('state Active #pink ##[dotted]blue');
    const s = findState(ast, 'Active');
    expect(s?.color).toBe('#pink');
    expect(s?.lineColor).toBe('##[dotted]blue');
  });

  it('still supports the inline ADDFIELD description after LINECOLOR', () => {
    const ast = parse('state Active ##[dashed] : some text');
    const s = findState(ast, 'Active');
    expect(s?.lineColor).toBe('##[dashed]');
    expect(s?.description).toEqual(['some text']);
  });
});

// ---------------------------------------------------------------------------
// Additional coverage — stereotypes
// ---------------------------------------------------------------------------

describe('stereotype kinds', () => {
  const cases: Array<[string, string]> = [
    ['join', 'join'],
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

  // Mission A4 Phase L iter 15 (livuni-63-fira764): `Stereogroup.java` has
  // NO `junction` case -- `<<junction>>` is an unrecognized stereotype
  // string upstream, so it keeps kind='normal' (rect/rounded), never the
  // invented diamond-shaped 'junction' StateKind this port used to produce.
  it('<<junction>> is NOT a recognized upstream pseudostate -- kind stays normal', () => {
    const ast = parse('state j <<junction>>');
    const s = findState(ast, 'j');
    expect(s?.kind).toBe('normal');
    expect(s?.stereotype).toBe('junction');
  });

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

// ---------------------------------------------------------------------------
// Reverse-order `id as "quoted"` declaration form (mission A4 Phase L
// iter 15) -- CommandCreateState's CODE1/DISPLAY1 alternative: bare id
// FIRST, then mandatory `as`, then the quoted display -- the reverse of
// the already-working `"quoted" as id` form (CODE2/DISPLAY2).
// @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:84-90 (CODE1/DISPLAY1)
// ---------------------------------------------------------------------------

describe('reverse-order id as "quoted" declaration form', () => {
  it('cmd 9 (xuzapa-55-xoli880): state BB1 as "bbbb_label1" sets id=BB1 display=bbbb_label1', () => {
    const ast = parse('state BB1 as "bbbb_label1"');
    const s = findState(ast, 'BB1');
    expect(s).toBeDefined();
    expect(s?.id).toBe('BB1');
    expect(s?.display).toBe('bbbb_label1');
  });

  it('cmd 9 with inline ADDFIELD: state BB2 as "bbbb_label2" : blah', () => {
    const ast = parse('state BB2 as "bbbb_label2" : blah');
    const s = findState(ast, 'BB2');
    expect(s).toBeDefined();
    expect(s?.id).toBe('BB2');
    expect(s?.display).toBe('bbbb_label2');
    expect(s?.description).toEqual(['blah']);
  });

  it('cmd 9 (sezoxa-56-jefi030): state name as "longer name definition" #blue', () => {
    const ast = parse('state name as "longer name definition" #blue');
    const s = findState(ast, 'name');
    expect(s).toBeDefined();
    expect(s?.id).toBe('name');
    expect(s?.display).toBe('longer name definition');
    expect(s?.color).toBe('#blue');
  });

  it('cmd 6 (composite open, sosoxe-55-demi451): state A as "A on several lines" { ... } sets id/display and opens a scope', () => {
    const ast = parse(`
      state A as "A on several lines with text" {
        X : aaa
      }
    `);
    const a = findState(ast, 'A');
    expect(a).toBeDefined();
    expect(a?.id).toBe('A');
    expect(a?.display).toBe('A on several lines with text');
    expect(a?.children.map((c) => c.id)).toContain('X');
  });

  it('cmd 8 (stereotyped leaf, nuduni-60-mupe742): state start1 as "Start 1" <<start>>', () => {
    const ast = parse('state start1 as "Start 1" <<start>>');
    const s = findState(ast, 'start1');
    expect(s).toBeDefined();
    expect(s?.id).toBe('start1');
    expect(s?.display).toBe('Start 1');
    expect(s?.kind).toBe('initial');
  });

  it('bare quoted declaration with no "as" at all (xuzapa): state "aaaa bis" : blahbis sets id=display=raw text', () => {
    const ast = parse('state "aaaa bis" : blahbis');
    const s = findState(ast, 'aaaa bis');
    expect(s).toBeDefined();
    expect(s?.id).toBe('aaaa bis');
    expect(s?.display).toBe('aaaa bis');
    expect(s?.description).toEqual(['blahbis']);
  });

  it('plain bare id alone still resolves display=id (no regression)', () => {
    const ast = parse('state Plain');
    const s = findState(ast, 'Plain');
    expect(s).toBeDefined();
    expect(s?.display).toBe('Plain');
  });
});

// ---------------------------------------------------------------------------
// History pseudostates — [H] and [H*]
//
// Bare `[H]`/`[H*]` resolve to a SYNTHETIC composite-namespaced id
// (`"*historical*"`/`"*deephistory*"` + the owning group's name, root scope
// = no suffix) mirroring `StateDiagram#getHistorical`/`getDeepHistory`'s
// 0-arg overload — NOT the literal bracket text. Mission A4 Phase L
// iteration 14: the literal-id convention let two SIBLING composites, each
// declaring their own local `[H]`, collide into a single shared id, which
// corrupted `isAutarkic`'s whole-diagram boundary check (a transition
// referencing one composite's `[H]` looked like it also touched every
// OTHER composite's subtree, since `subtreeIds()` is a flat id set) and
// produced a duplicate DOT node id spanning two different `subgraph`
// blocks (movuva-53-jude799/pasosa-28-zudu135).
// ---------------------------------------------------------------------------

describe('history pseudostate — [H] shallow (root scope)', () => {
  it('[H] as transition from-endpoint auto-creates a state with kind=history', () => {
    const ast = parse('[H] --> Active');
    const s = findState(ast, '*historical*');
    expect(s).toBeDefined();
    expect(s?.kind).toBe('history');
  });

  it('[H] as transition to-endpoint auto-creates a state with kind=history', () => {
    const ast = parse('Active --> [H]');
    const s = findState(ast, '*historical*');
    expect(s).toBeDefined();
    expect(s?.kind).toBe('history');
  });

  it('[H] produces a transition with from="*historical*"', () => {
    const ast = parse('[H] --> Active');
    const t = findTransition(ast, '*historical*', 'Active');
    expect(t).toBeDefined();
    expect(t?.from).toBe('*historical*');
    expect(t?.to).toBe('Active');
  });

  it('[H] produces a transition with to="*historical*"', () => {
    const ast = parse('Active --> [H]');
    const t = findTransition(ast, 'Active', '*historical*');
    expect(t).toBeDefined();
  });

  it('[H] state is not duplicated when referenced in multiple transitions', () => {
    const ast = parse(`
      [H] --> A
      [H] --> B
    `);
    const copies = ast.states.filter((s) => s.id === '*historical*');
    expect(copies).toHaveLength(1);
  });

  it('[H] inside composite state creates a history pseudostate NAMESPACED by that composite', () => {
    const ast = parse(`
      state Comp {
        [H] --> A
      }
    `);
    const comp = findState(ast, 'Comp');
    expect(comp).toBeDefined();
    const hState = comp?.children.find((c) => c.kind === 'history');
    expect(hState).toBeDefined();
    expect(hState?.id).toBe('*historical*Comp');
  });

  it('[H] with label parses transition label correctly', () => {
    const ast = parse('Active --> [H] : resume');
    const t = findTransition(ast, 'Active', '*historical*');
    expect(t?.label).toBe('resume');
  });

  it('two DIFFERENT composites each declaring their own bare [H] get DISTINCT, non-colliding entities', () => {
    const ast = parse(`
      state CompA {
        [H] --> A1
      }
      state CompB {
        [H] --> B1
      }
    `);
    const a = findState(ast, 'CompA');
    const b = findState(ast, 'CompB');
    const hA = a?.children.find((c) => c.kind === 'history');
    const hB = b?.children.find((c) => c.kind === 'history');
    expect(hA?.id).toBe('*historical*CompA');
    expect(hB?.id).toBe('*historical*CompB');
    expect(hA).not.toBe(hB);
  });
});

describe('history pseudostate — [H*] deep (root scope)', () => {
  it('[H*] as transition from-endpoint auto-creates a state with kind=deepHistory', () => {
    const ast = parse('[H*] --> Active');
    const s = findState(ast, '*deephistory*');
    expect(s).toBeDefined();
    expect(s?.kind).toBe('deepHistory');
  });

  it('[H*] as transition to-endpoint auto-creates a state with kind=deepHistory', () => {
    const ast = parse('Active --> [H*]');
    const s = findState(ast, '*deephistory*');
    expect(s).toBeDefined();
    expect(s?.kind).toBe('deepHistory');
  });

  it('[H*] produces a transition with to="*deephistory*"', () => {
    const ast = parse('State2 --> [H*] : DeepResume');
    const t = findTransition(ast, 'State2', '*deephistory*');
    expect(t).toBeDefined();
    expect(t?.label).toBe('DeepResume');
  });

  it('[H*] is not duplicated across multiple transitions', () => {
    const ast = parse(`
      A --> [H*]
      B --> [H*]
    `);
    const copies = ast.states.filter((s) => s.id === '*deephistory*');
    expect(copies).toHaveLength(1);
  });
});

describe('history pseudostate — compound StateId[H] form', () => {
  it('Comp[H] resolves to a synthetic child NESTED inside Comp, not a literal "Comp[H]" leaf', () => {
    const ast = parse('[*] --> Comp[H]');
    const t = findTransition(ast, '[*]', 'Comp[H]');
    expect(ast.states.filter((s) => s.id === 'Comp[H]')).toHaveLength(0);
    expect(t).toBeUndefined();
    const resolved = findTransition(ast, '[*]', '*historical*Comp');
    expect(resolved).toBeDefined();
    const comp = findState(ast, 'Comp');
    expect(comp).toBeDefined();
    const hState = comp?.children.find((c) => c.kind === 'history');
    expect(hState?.id).toBe('*historical*Comp');
  });

  it('Comp[H*] compound deep history nests a deepHistory child inside Comp', () => {
    const ast = parse('A --> Comp[H*] : ev1');
    const t = findTransition(ast, 'A', '*deephistory*Comp');
    expect(t).toBeDefined();
    expect(t?.label).toBe('ev1');
    const comp = findState(ast, 'Comp');
    const hState = comp?.children.find((c) => c.kind === 'deepHistory');
    expect(hState?.id).toBe('*deephistory*Comp');
  });

  it('Comp[H] reuses the SAME synthetic child Comp already declares via its own bare [H]', () => {
    const ast = parse(`
      state Comp {
        [H] --> Inner
      }
      Outside --> Comp[H]
    `);
    const comp = findState(ast, 'Comp');
    const historyChildren = comp?.children.filter((c) => c.kind === 'history') ?? [];
    expect(historyChildren).toHaveLength(1);
    const outsideEdge = findTransition(ast, 'Outside', '*historical*Comp');
    expect(outsideEdge).toBeDefined();
  });
});

describe('history pseudostate — no regression for diagrams without history nodes', () => {
  it('diagram with only [*] and normal states is unaffected', () => {
    const ast = parse(`
      [*] --> Idle
      Idle --> Running
      Running --> [*]
    `);
    expect(ast.states.filter((s) => s.kind === 'history')).toHaveLength(0);
    expect(ast.states.filter((s) => s.kind === 'deepHistory')).toHaveLength(0);
    expect(ast.transitions).toHaveLength(3);
  });
});
