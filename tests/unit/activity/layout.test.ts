/**
 * Unit tests for the activity diagram layout engine.
 *
 * Tests use FormulaMeasurer for deterministic text measurement.
 * All tests are synchronous.
 */

import { describe, it, expect } from 'vitest';
import { layoutActivity } from '../../../src/diagrams/activity/layout.js';
import type {
  ActivityDiagramAST,
  ActivityAction,
  ActivityStart,
  ActivityFork,
  ActivityIf,
  ActivityWhile,
  ActivityRepeat,
  ActivityNote,
  ActivitySplit,
  ActivityBreak,
} from '../../../src/diagrams/activity/ast.js';
import type { ActivityNodeGeo } from '../../../src/diagrams/activity/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();
const theme = defaultTheme;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findByKind(nodes: ActivityNodeGeo[], kind: string): ActivityNodeGeo {
  const found = nodes.find((n) => n.kind === kind);
  if (found === undefined) {
    throw new Error(`No node with kind '${kind}' found`);
  }
  return found;
}

function findAllByKind(
  nodes: ActivityNodeGeo[],
  kind: string,
): ActivityNodeGeo[] {
  return nodes.filter((n) => n.kind === kind);
}

function makeStart(): ActivityStart {
  return { kind: 'start' };
}

function makeAction(label: string, swimlane?: string): ActivityAction {
  const node: ActivityAction = { kind: 'action', label };
  if (swimlane !== undefined) {
    node.swimlane = swimlane;
  }
  return node;
}

function makeBreak(): ActivityBreak {
  return { kind: 'break' };
}

// ---------------------------------------------------------------------------
// Test 1: start node is above first action
// ---------------------------------------------------------------------------

describe('layoutActivity — start above first action', () => {
  it('places start node at a lower y than the first action node', () => {
    const ast: ActivityDiagramAST = {
      nodes: [makeStart(), makeAction('Step 1')],
      swimlanes: [],
    };

    const geo = layoutActivity(ast, theme, measurer);

    const startNode = findByKind(geo.nodes, 'start');
    const actionNode = findByKind(geo.nodes, 'action');

    expect(startNode.y).toBeLessThan(actionNode.y);
  });
});

// ---------------------------------------------------------------------------
// Test 2: sequential actions have increasing y
// ---------------------------------------------------------------------------

describe('layoutActivity — sequential actions', () => {
  it('places three sequential actions at strictly increasing y values', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('First'),
        makeAction('Second'),
        makeAction('Third'),
      ],
      swimlanes: [],
    };

    const geo = layoutActivity(ast, theme, measurer);
    const actions = findAllByKind(geo.nodes, 'action');

    expect(actions).toHaveLength(3);
    // Nodes are placed sequentially: each subsequent one is below the prior
    expect(actions[0]!.y).toBeLessThan(actions[1]!.y);
    expect(actions[1]!.y).toBeLessThan(actions[2]!.y);
  });
});

// ---------------------------------------------------------------------------
// Test 3: fork bar x spans all branches
// ---------------------------------------------------------------------------

describe('layoutActivity — fork bar spans branches', () => {
  it('fork-bar width covers both branch action widths combined', () => {
    const forkNode: ActivityFork = {
      kind: 'fork',
      branches: [
        [makeAction('Branch A')],
        [makeAction('Branch B')],
      ],
    };

    const ast: ActivityDiagramAST = {
      nodes: [forkNode],
      swimlanes: [],
    };

    const geo = layoutActivity(ast, theme, measurer);

    const forkBar = findByKind(geo.nodes, 'fork-bar');
    const branchActions = findAllByKind(geo.nodes, 'action');

    expect(branchActions).toHaveLength(2);

    // The fork bar must be at least as wide as both branch columns combined
    const combinedBranchWidth =
      branchActions[0]!.width + branchActions[1]!.width;
    expect(forkBar.width).toBeGreaterThanOrEqual(combinedBranchWidth);
  });
});

// ---------------------------------------------------------------------------
// Test 4: node after if block is positioned below all branch content
// ---------------------------------------------------------------------------

describe('layoutActivity — node after if block is below all branches', () => {
  it('places the node after endif below max branch bottom; no if-merge in geometry; branches are side-by-side', () => {
    const ifNode: ActivityIf = {
      kind: 'if',
      condition: 'ok?',
      thenLabel: 'yes',
      elseLabel: 'no',
      thenBranch: [makeAction('Yes path')],
      elseBranch: [makeAction('No path')],
      elseIfBranches: [],
    };
    const afterAction = makeAction('After');

    const ast: ActivityDiagramAST = {
      nodes: [ifNode, afterAction],
      swimlanes: [],
    };

    const geo = layoutActivity(ast, theme, measurer);

    // if-merge must not appear in geometry
    const mergeNode = geo.nodes.find((n) => n.kind === 'if-merge');
    expect(mergeNode).toBeUndefined();

    const allActions = findAllByKind(geo.nodes, 'action');
    expect(allActions).toHaveLength(3);

    const afterNode = allActions.find((a) => a.label === 'After')!;
    const branchActions = allActions.filter((a) => a.label !== 'After');
    expect(afterNode).toBeDefined();
    expect(branchActions).toHaveLength(2);

    const maxBranchY = Math.max(
      ...branchActions.map((n) => n.y + n.height),
    );

    // Node after endif must be below all branch content
    expect(afterNode.y).toBeGreaterThanOrEqual(maxBranchY);

    // Branches must be side-by-side (similar y), not stacked vertically
    const yDiff = Math.abs(branchActions[0]!.y - branchActions[1]!.y);
    expect(yDiff).toBeLessThan(36); // ACTION_HEIGHT tolerance
  });
});

// ---------------------------------------------------------------------------
// Test 5: swimlane actions have non-overlapping x ranges
// ---------------------------------------------------------------------------

describe('layoutActivity — swimlane actions do not overlap', () => {
  it('places actions in different swimlanes at non-overlapping x ranges', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('Alice work', 'Alice'),
        makeAction('Bob review', 'Bob'),
      ],
      swimlanes: ['Alice', 'Bob'],
    };

    const geo = layoutActivity(ast, theme, measurer);

    const actions = findAllByKind(geo.nodes, 'action');
    expect(actions).toHaveLength(2);

    const aliceAction = actions.find((a) => a.label === 'Alice work')!;
    const bobAction = actions.find((a) => a.label === 'Bob review')!;

    expect(aliceAction).toBeDefined();
    expect(bobAction).toBeDefined();

    // x ranges must not overlap: one ends before the other begins
    const aliceLeft = aliceAction.x;
    const aliceRight = aliceAction.x + aliceAction.width;
    const bobLeft = bobAction.x;
    const bobRight = bobAction.x + bobAction.width;

    const nonOverlapping = aliceRight <= bobLeft || bobRight <= aliceLeft;
    expect(nonOverlapping).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 6: while loop layout
// ---------------------------------------------------------------------------

describe('layoutActivity — while loop', () => {
  it('places a while-header diamond node above the body action', () => {
    const whileNode: ActivityWhile = {
      kind: 'while',
      condition: 'more items?',
      body: [makeAction('Process item')],
    };
    const ast: ActivityDiagramAST = {
      nodes: [whileNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const header = findByKind(geo.nodes, 'while-header');
    const action = findByKind(geo.nodes, 'action');
    expect(header.y).toBeLessThan(action.y);
  });
});

// ---------------------------------------------------------------------------
// Test 7: repeat loop layout
// ---------------------------------------------------------------------------

describe('layoutActivity — repeat loop', () => {
  it('produces a repeat-start node and a repeat-cond condition node', () => {
    const repeatNode: ActivityRepeat = {
      kind: 'repeat',
      body: [makeAction('Do something')],
      condition: 'again?',
    };
    const ast: ActivityDiagramAST = {
      nodes: [repeatNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    // repeat-start is the entry point diamond
    const repeatStart = findByKind(geo.nodes, 'repeat-start');
    // repeat-cond is the exit condition hexagon below the body
    const condNode = findByKind(geo.nodes, 'repeat-cond');
    expect(repeatStart).toBeDefined();
    expect(condNode).toBeDefined();
    expect(repeatStart.y).toBeLessThan(condNode.y);
  });
});

// ---------------------------------------------------------------------------
// Test 8: note in layout
// ---------------------------------------------------------------------------

describe('layoutActivity — note node', () => {
  it('produces a note node with the correct label', () => {
    const noteNode: ActivityNote = {
      kind: 'note',
      text: 'Important info',
      position: 'left',
    };
    const ast: ActivityDiagramAST = {
      nodes: [noteNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const noteGeo = findByKind(geo.nodes, 'note');
    expect(noteGeo).toBeDefined();
    expect(noteGeo.label).toBe('Important info');
  });

  it('note right is placed to the right of the preceding action', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('Step'),
        { kind: 'note', text: 'side note', position: 'right' },
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const action = findByKind(geo.nodes, 'action');
    const note = findByKind(geo.nodes, 'note');
    expect(note.x).toBeGreaterThan(action.x + action.width);
  });

  it('note left is placed to the left of the preceding action', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('Step'),
        { kind: 'note', text: 'side note', position: 'left' },
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const action = findByKind(geo.nodes, 'action');
    const note = findByKind(geo.nodes, 'note');
    expect(note.x + note.width).toBeLessThan(action.x);
  });

  it('note shares the same top-y as the preceding action', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('Step'),
        { kind: 'note', text: 'side note', position: 'right' },
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const action = findByKind(geo.nodes, 'action');
    const note = findByKind(geo.nodes, 'note');
    expect(note.y).toBe(action.y);
  });

  it('flow continues from the action, not the note (note has no outgoing flow edge)', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('A'),
        { kind: 'note', text: 'annotation', position: 'right' },
        makeAction('B'),
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const actions = geo.nodes.filter((n) => n.kind === 'action');
    expect(actions).toHaveLength(2);
    // Action B should be directly below action A, not below the note
    const actionA = actions[0]!;
    const actionB = actions[1]!;
    expect(actionB.y).toBeGreaterThan(actionA.y + actionA.height);
    expect(actionB.x).toBeCloseTo(actionA.x, 0);
  });
});

// ---------------------------------------------------------------------------
// Test 9: split bar spans branches
// ---------------------------------------------------------------------------

describe('layoutActivity — split bar spans branches', () => {
  it('split-bar width covers both branch action widths combined', () => {
    const splitNode: ActivitySplit = {
      kind: 'split',
      branches: [
        [makeAction('Branch X')],
        [makeAction('Branch Y')],
      ],
    };
    const ast: ActivityDiagramAST = {
      nodes: [splitNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const splitBar = findByKind(geo.nodes, 'split-bar');
    const branchActions = findAllByKind(geo.nodes, 'action');
    expect(splitBar).toBeDefined();
    expect(branchActions).toHaveLength(2);
    const combinedWidth = branchActions[0]!.width + branchActions[1]!.width;
    expect(splitBar.width).toBeGreaterThanOrEqual(combinedWidth);
  });
});

// ---------------------------------------------------------------------------
// Empty AST (no nodes)
// ---------------------------------------------------------------------------

describe('layoutActivity — empty AST', () => {
  it('returns zero dimensions for empty nodes array', () => {
    const ast: ActivityDiagramAST = {
      nodes: [],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    expect(geo.totalWidth).toBe(0);
    expect(geo.totalHeight).toBe(0);
    expect(geo.nodes).toHaveLength(0);
    expect(geo.edges).toHaveLength(0);
    expect(geo.swimlanes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Action with color
// ---------------------------------------------------------------------------

describe('layoutActivity — action with color', () => {
  it('action with color produces a node with the color property set', () => {
    const ast: ActivityDiagramAST = {
      nodes: [{ kind: 'action', label: 'Colored action', color: '#FF0000' }],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const actionNode = geo.nodes.find((n) => n.kind === 'action');
    expect(actionNode).toBeDefined();
    expect(actionNode!.color).toBe('#FF0000');
  });
});

// ---------------------------------------------------------------------------
// Stop/end/kill nodes
// ---------------------------------------------------------------------------

describe('layoutActivity — stop, end, kill nodes', () => {
  it('stop node produces a node with kind "stop"', () => {
    const ast: ActivityDiagramAST = {
      nodes: [{ kind: 'stop' }],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const stopNode = geo.nodes.find((n) => n.kind === 'stop');
    expect(stopNode).toBeDefined();
    expect(stopNode!.width).toBeGreaterThan(0);
  });

  it('end node produces a node with kind "end"', () => {
    const ast: ActivityDiagramAST = {
      nodes: [{ kind: 'end' }],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const endNode = geo.nodes.find((n) => n.kind === 'end');
    expect(endNode).toBeDefined();
  });

  it('kill node produces a node with kind "kill"', () => {
    const ast: ActivityDiagramAST = {
      nodes: [{ kind: 'kill' }],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const killNode = geo.nodes.find((n) => n.kind === 'kill');
    expect(killNode).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// If node with empty branches (covers empty branch stub path)
// ---------------------------------------------------------------------------

describe('layoutActivity — if node with empty branches', () => {
  it('if node with empty then/else branches produces a split node without crashing', () => {
    const ifNode: ActivityIf = {
      kind: 'if',
      condition: 'x?',
      thenLabel: 'yes',
      elseLabel: 'no',
      thenBranch: [],
      elseBranch: [],
      elseIfBranches: [],
    };
    const ast: ActivityDiagramAST = {
      nodes: [ifNode, makeAction('After')],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const splitNode = geo.nodes.find((n) => n.kind === 'if-split');
    expect(splitNode).toBeDefined();
    // Action after the empty if still appears
    const afterNode = geo.nodes.find((n) => n.kind === 'action' && n.label === 'After');
    expect(afterNode).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Detach node
// ---------------------------------------------------------------------------

describe('layoutActivity — detach node', () => {
  it('detach node produces a stop-like node', () => {
    const ast: ActivityDiagramAST = {
      nodes: [{ kind: 'detach' }],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    // detach maps to 'stop' in layout
    const node = geo.nodes.find((n) => n.kind === 'stop');
    expect(node).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Nested if blocks (covers sub-exit propagation path at line 643)
// ---------------------------------------------------------------------------

describe('layoutActivity — nested if blocks', () => {
  it('nested if inside outer if propagates sub-exit ids', () => {
    const innerIf: ActivityIf = {
      kind: 'if',
      condition: 'inner?',
      thenBranch: [makeAction('InnerYes')],
      elseBranch: [makeAction('InnerNo')],
      elseIfBranches: [],
    };
    const outerIf: ActivityIf = {
      kind: 'if',
      condition: 'outer?',
      thenBranch: [innerIf],
      elseBranch: [makeAction('OuterNo')],
      elseIfBranches: [],
    };
    const ast: ActivityDiagramAST = {
      nodes: [outerIf, makeAction('After')],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    // Should produce nodes without error
    const splitNodes = geo.nodes.filter((n) => n.kind === 'if-split');
    expect(splitNodes.length).toBeGreaterThanOrEqual(2); // outer + inner
    const afterNode = geo.nodes.find((n) => n.kind === 'action' && n.label === 'After');
    expect(afterNode).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 10: break inside repeat — acceptance criteria 1-5
// ---------------------------------------------------------------------------

describe('layoutActivity — break inside repeat loop', () => {
  it('AC1: repeat body with break produces a break geo node of kind "break"', () => {
    const repeatNode: ActivityRepeat = {
      kind: 'repeat',
      body: [makeAction('Do work'), makeBreak()],
      condition: 'again?',
    };
    const ast: ActivityDiagramAST = {
      nodes: [repeatNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const breakNode = geo.nodes.find((n) => n.kind === 'break');
    expect(breakNode).toBeDefined();
  });

  it('AC2: sequence [action, break, action] in repeat body yields one breakGeo', () => {
    // We verify this via the layout output: one 'break' node exists
    const repeatNode: ActivityRepeat = {
      kind: 'repeat',
      body: [makeAction('Before'), makeBreak(), makeAction('After break')],
      condition: 'again?',
    };
    const ast: ActivityDiagramAST = {
      nodes: [repeatNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const breakNodes = findAllByKind(geo.nodes, 'break');
    expect(breakNodes).toHaveLength(1);
  });

  it('AC3: repeat with break produces a break-exit diamond below the condition hexagon', () => {
    const repeatNode: ActivityRepeat = {
      kind: 'repeat',
      body: [makeAction('Work'), makeBreak()],
      condition: 'again?',
    };
    const ast: ActivityDiagramAST = {
      nodes: [repeatNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);

    // The condition node is repeat-cond (hexagon); break-exit is while-header (diamond)
    const condNode = findByKind(geo.nodes, 'repeat-cond');
    const breakExitDiamond = findByKind(geo.nodes, 'while-header');
    expect(condNode).toBeDefined();
    expect(breakExitDiamond).toBeDefined();

    // The break-exit diamond must be below the condition hexagon
    expect(breakExitDiamond.y).toBeGreaterThan(condNode.y);
  });

  it('AC4: an edge connects the break geo to the break-exit diamond', () => {
    const repeatNode: ActivityRepeat = {
      kind: 'repeat',
      body: [makeAction('Work'), makeBreak()],
      condition: 'again?',
    };
    const ast: ActivityDiagramAST = {
      nodes: [repeatNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);

    const breakNode = geo.nodes.find((n) => n.kind === 'break');
    expect(breakNode).toBeDefined();

    const breakExitDiamond = findByKind(geo.nodes, 'while-header');

    // Find an edge whose last point lands at (or near) the break-exit diamond top
    const breakExitTopX = breakExitDiamond.x + breakExitDiamond.width / 2;
    const breakExitTopY = breakExitDiamond.y;

    const connectingEdge = geo.edges.find((e) => {
      const last = e.points[e.points.length - 1];
      return (
        last !== undefined &&
        Math.abs(last.x - breakExitTopX) < 2 &&
        Math.abs(last.y - breakExitTopY) < 2
      );
    });
    expect(connectingEdge).toBeDefined();
  });

  it('AC5: repeat loop without break has no break-exit diamond (backward compat)', () => {
    const repeatNode: ActivityRepeat = {
      kind: 'repeat',
      body: [makeAction('Do something')],
      condition: 'again?',
    };
    const ast: ActivityDiagramAST = {
      nodes: [repeatNode],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);

    // One repeat-cond (hexagon condition); no while-header (break-exit) diamond
    const repeatConds = findAllByKind(geo.nodes, 'repeat-cond');
    const whileHeaders = findAllByKind(geo.nodes, 'while-header');
    expect(repeatConds).toHaveLength(1);
    expect(whileHeaders).toHaveLength(0);
  });

  it('break-exit diamond becomes exit point: node after repeat is below it', () => {
    const repeatNode: ActivityRepeat = {
      kind: 'repeat',
      body: [makeAction('Work'), makeBreak()],
      condition: 'again?',
    };
    const afterAction = makeAction('After repeat');
    const ast: ActivityDiagramAST = {
      nodes: [repeatNode, afterAction],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);

    const breakExitDiamond = findByKind(geo.nodes, 'while-header');
    const afterNode = geo.nodes.find(
      (n) => n.kind === 'action' && n.label === 'After repeat',
    );
    expect(afterNode).toBeDefined();
    expect(afterNode!.y).toBeGreaterThan(breakExitDiamond.y);
  });
});

// ---------------------------------------------------------------------------
// Test 11: arrow-label pending label applied to next edge
// ---------------------------------------------------------------------------

describe('layoutActivity — arrow-label pending label on next edge', () => {
  it('AC3: edge between two actions has label and color from arrow-label node', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('Action A'),
        { kind: 'arrow-label', label: 'x', color: 'blue' },
        makeAction('Action B'),
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);

    const labeledEdge = geo.edges.find((e) => e.label === 'x');
    expect(labeledEdge).toBeDefined();
    expect(labeledEdge!.color).toBe('blue');
  });

  it('AC4: arrow-label at end of sequence is silently discarded (no crash)', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('Action A'),
        { kind: 'arrow-label', label: 'orphan', color: 'red' },
      ],
      swimlanes: [],
    };
    // Should not throw
    expect(() => layoutActivity(ast, theme, measurer)).not.toThrow();
  });

  it('pending label is consumed: only one edge carries the label', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('A'),
        { kind: 'arrow-label', label: 'tagged', color: 'green' },
        makeAction('B'),
        makeAction('C'),
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const taggedEdges = geo.edges.filter((e) => e.label === 'tagged');
    expect(taggedEdges).toHaveLength(1);
  });

  it('arrow-label without color leaves edge color undefined', () => {
    const ast: ActivityDiagramAST = {
      nodes: [
        makeAction('A'),
        { kind: 'arrow-label', label: 'plain' },
        makeAction('B'),
      ],
      swimlanes: [],
    };
    const geo = layoutActivity(ast, theme, measurer);
    const edge = geo.edges.find((e) => e.label === 'plain');
    expect(edge).toBeDefined();
    expect(edge!.color).toBeUndefined();
  });
});
