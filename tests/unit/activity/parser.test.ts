import { describe, it, expect } from 'vitest';
import { parseActivity } from '../../../src/diagrams/activity/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type {
  ActivityDiagramAST,
  ActivityNode,
  ActivityIf,
  ActivityWhile,
  ActivityRepeat,
  ActivityFork,
  ActivityAction,
  ActivityBreak,
  ActivityArrowLabel,
} from '../../../src/diagrams/activity/ast.js';
import type {
  ActivityNote,
  ActivitySplit,
  ActivityEnd,
  ActivityKill,
  ActivityDetach,
} from '../../../src/diagrams/activity/ast.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function parse(lines: readonly string[]): ActivityDiagramAST {
  const block: UmlSource = { lines, type: 'activity' };
  return parseActivity(block);
}

function firstNode(ast: ActivityDiagramAST): ActivityNode {
  const node = ast.nodes[0];
  if (node === undefined) throw new Error('Expected at least one node');
  return node;
}

// ---------------------------------------------------------------------------
// Test 1 — parses :action; syntax
// ---------------------------------------------------------------------------

describe('parses :action; syntax', () => {
  it('produces an action node with the trimmed label', () => {
    const ast = parse([':Download file;']);
    const node = firstNode(ast);
    expect(node.kind).toBe('action');
    expect((node as ActivityAction).label).toBe('Download file');
  });

  it('does not set swimlane when no swimlane is active', () => {
    const ast = parse([':Download file;']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.swimlane).toBeUndefined();
  });

  it('converts \\n escape sequences in single-line labels to real newlines', () => {
    const ast = parse([':A\\non\\nseveral\\nlines;']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.label).toBe('A\non\nseveral\nlines');
  });
});

// ---------------------------------------------------------------------------
// Test 2 — parses start
// ---------------------------------------------------------------------------

describe('parses start', () => {
  it('produces a node with kind === "start"', () => {
    const ast = parse(['start']);
    expect(firstNode(ast).kind).toBe('start');
  });
});

// ---------------------------------------------------------------------------
// Test 3 — parses stop
// ---------------------------------------------------------------------------

describe('parses stop', () => {
  it('produces a node with kind === "stop"', () => {
    const ast = parse(['stop']);
    expect(firstNode(ast).kind).toBe('stop');
  });
});

// ---------------------------------------------------------------------------
// Test 4 — parses if / else / endif
// ---------------------------------------------------------------------------

describe('parses if / else / endif', () => {
  it('produces an if node', () => {
    const ast = parse([
      'if (condition?) then (yes)',
      '  :A;',
      'else (no)',
      '  :B;',
      'endif',
    ]);
    expect(firstNode(ast).kind).toBe('if');
  });

  it('thenBranch has one action with label "A"', () => {
    const ast = parse([
      'if (condition?) then (yes)',
      '  :A;',
      'else (no)',
      '  :B;',
      'endif',
    ]);
    const node = firstNode(ast) as ActivityIf;
    expect(node.thenBranch).toHaveLength(1);
    expect((node.thenBranch[0] as ActivityAction).label).toBe('A');
  });

  it('elseBranch has one action with label "B"', () => {
    const ast = parse([
      'if (condition?) then (yes)',
      '  :A;',
      'else (no)',
      '  :B;',
      'endif',
    ]);
    const node = firstNode(ast) as ActivityIf;
    expect(node.elseBranch).toHaveLength(1);
    expect((node.elseBranch[0] as ActivityAction).label).toBe('B');
  });

  it('captures the condition text', () => {
    const ast = parse([
      'if (condition?) then (yes)',
      '  :A;',
      'else (no)',
      '  :B;',
      'endif',
    ]);
    const node = firstNode(ast) as ActivityIf;
    expect(node.condition).toBe('condition?');
  });
});

// ---------------------------------------------------------------------------
// Test 5 — parses elseif
// ---------------------------------------------------------------------------

describe('parses elseif', () => {
  it('elseIfBranches has length 1', () => {
    const ast = parse([
      'if (a?) then',
      '  :A;',
      'elseif (b?) then',
      '  :B;',
      'else',
      '  :C;',
      'endif',
    ]);
    const node = firstNode(ast) as ActivityIf;
    expect(node.elseIfBranches).toHaveLength(1);
  });

  it('elseIfBranches[0].condition is "b?"', () => {
    const ast = parse([
      'if (a?) then',
      '  :A;',
      'elseif (b?) then',
      '  :B;',
      'else',
      '  :C;',
      'endif',
    ]);
    const node = firstNode(ast) as ActivityIf;
    expect(node.elseIfBranches[0]?.condition).toBe('b?');
  });

  it('thenBranch has action "A" and elseBranch has action "C"', () => {
    const ast = parse([
      'if (a?) then',
      '  :A;',
      'elseif (b?) then',
      '  :B;',
      'else',
      '  :C;',
      'endif',
    ]);
    const node = firstNode(ast) as ActivityIf;
    expect((node.thenBranch[0] as ActivityAction).label).toBe('A');
    expect((node.elseBranch[0] as ActivityAction).label).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// Test 6 — parses while loop
// ---------------------------------------------------------------------------

describe('parses while loop', () => {
  it('produces a while node with correct condition', () => {
    const ast = parse(['while (more items?)', '  :Process;', 'endwhile']);
    const node = firstNode(ast) as ActivityWhile;
    expect(node.kind).toBe('while');
    expect(node.condition).toBe('more items?');
  });

  it('body contains one action with label "Process"', () => {
    const ast = parse(['while (more items?)', '  :Process;', 'endwhile']);
    const node = firstNode(ast) as ActivityWhile;
    expect(node.body).toHaveLength(1);
    expect((node.body[0] as ActivityAction).label).toBe('Process');
  });
});

// ---------------------------------------------------------------------------
// Test 7 — parses repeat / repeatwhile
// ---------------------------------------------------------------------------

describe('parses repeat / repeatwhile', () => {
  it('produces a repeat node', () => {
    const ast = parse(['repeat', '  :Do thing;', 'repeatwhile (again?)']);
    const node = firstNode(ast) as ActivityRepeat;
    expect(node.kind).toBe('repeat');
  });

  it('body contains one action with label "Do thing"', () => {
    const ast = parse(['repeat', '  :Do thing;', 'repeatwhile (again?)']);
    const node = firstNode(ast) as ActivityRepeat;
    expect(node.body).toHaveLength(1);
    expect((node.body[0] as ActivityAction).label).toBe('Do thing');
  });

  it('condition is "again?"', () => {
    const ast = parse(['repeat', '  :Do thing;', 'repeatwhile (again?)']);
    const node = firstNode(ast) as ActivityRepeat;
    expect(node.condition).toBe('again?');
  });
});

// ---------------------------------------------------------------------------
// Test 7b — parses repeat with space-separated "repeat while" terminator
// ---------------------------------------------------------------------------

describe('parses repeat with space-separated repeat while terminator', () => {
  it('bare "repeat while" produces a repeat node with empty condition', () => {
    const ast = parse(['repeat', '  :Do thing;', 'repeat while']);
    const node = firstNode(ast) as ActivityRepeat;
    expect(node.kind).toBe('repeat');
    expect(node.condition).toBe('');
  });

  it('"repeat while (some condition)" produces condition "some condition"', () => {
    const ast = parse(['repeat', '  :Do thing;', 'repeat while (some condition)']);
    const node = firstNode(ast) as ActivityRepeat;
    expect(node.condition).toBe('some condition');
  });

  it('"repeatwhile(cond)" (no space, parens) preserves existing behaviour', () => {
    const ast = parse(['repeat', '  :Do thing;', 'repeatwhile(cond)']);
    const node = firstNode(ast) as ActivityRepeat;
    expect(node.condition).toBe('cond');
  });
});

// ---------------------------------------------------------------------------
// Test 8 — parses fork / fork again / end fork
// ---------------------------------------------------------------------------

describe('parses fork / fork again / end fork', () => {
  it('produces a fork node', () => {
    const ast = parse(['fork', '  :A;', 'fork again', '  :B;', 'end fork']);
    expect(firstNode(ast).kind).toBe('fork');
  });

  it('has two branches', () => {
    const ast = parse(['fork', '  :A;', 'fork again', '  :B;', 'end fork']);
    const node = firstNode(ast) as ActivityFork;
    expect(node.branches).toHaveLength(2);
  });

  it('branch[0] has action "A"', () => {
    const ast = parse(['fork', '  :A;', 'fork again', '  :B;', 'end fork']);
    const node = firstNode(ast) as ActivityFork;
    expect((node.branches[0]?.[0] as ActivityAction).label).toBe('A');
  });

  it('branch[1] has action "B"', () => {
    const ast = parse(['fork', '  :A;', 'fork again', '  :B;', 'end fork']);
    const node = firstNode(ast) as ActivityFork;
    expect((node.branches[1]?.[0] as ActivityAction).label).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Test 9 — parses swimlane
// ---------------------------------------------------------------------------

describe('parses swimlane', () => {
  it('first action has swimlane "Alice"', () => {
    const ast = parse(['|Alice|', '  :Do work;', '|Bob|', '  :Review;']);
    const first = ast.nodes[0] as ActivityAction;
    expect(first.swimlane).toBe('Alice');
  });

  it('second action has swimlane "Bob"', () => {
    const ast = parse(['|Alice|', '  :Do work;', '|Bob|', '  :Review;']);
    const second = ast.nodes[1] as ActivityAction;
    expect(second.swimlane).toBe('Bob');
  });

  it('ast.swimlanes contains both lane names in order', () => {
    const ast = parse(['|Alice|', '  :Do work;', '|Bob|', '  :Review;']);
    expect(ast.swimlanes).toEqual(['Alice', 'Bob']);
  });
});

// ---------------------------------------------------------------------------
// Test 10 — parses action color
// ---------------------------------------------------------------------------

describe('parses action color', () => {
  it('produces kind "action" with the correct label', () => {
    const ast = parse([':Action; #lightblue']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.kind).toBe('action');
    expect(node.label).toBe('Action');
  });

  it('captures the color with leading #', () => {
    const ast = parse([':Action; #lightblue']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.color).toBe('#lightblue');
  });
});

// ---------------------------------------------------------------------------
// Test 11 — parses note right : single-line text
// ---------------------------------------------------------------------------

describe('parses note right : single-line text', () => {
  it('produces a note node with kind "note"', () => {
    const ast = parse(['note right : text here']);
    expect(firstNode(ast).kind).toBe('note');
  });

  it('position is "right"', () => {
    const ast = parse(['note right : text here']);
    const node = firstNode(ast) as ActivityNote;
    expect(node.position).toBe('right');
  });

  it('text is "text here"', () => {
    const ast = parse(['note right : text here']);
    const node = firstNode(ast) as ActivityNote;
    expect(node.text).toBe('text here');
  });
});

// ---------------------------------------------------------------------------
// Test 12 — parses note left multi-line
// ---------------------------------------------------------------------------

describe('parses note left multi-line', () => {
  it('produces a note node with kind "note"', () => {
    const ast = parse(['note left', '  line 1', '  line 2', 'end note']);
    expect(firstNode(ast).kind).toBe('note');
  });

  it('position is "left"', () => {
    const ast = parse(['note left', '  line 1', '  line 2', 'end note']);
    const node = firstNode(ast) as ActivityNote;
    expect(node.position).toBe('left');
  });

  it('text includes "line 1"', () => {
    const ast = parse(['note left', '  line 1', '  line 2', 'end note']);
    const node = firstNode(ast) as ActivityNote;
    expect(node.text).toContain('line 1');
  });

  it('text includes "line 2"', () => {
    const ast = parse(['note left', '  line 1', '  line 2', 'end note']);
    const node = firstNode(ast) as ActivityNote;
    expect(node.text).toContain('line 2');
  });
});

// ---------------------------------------------------------------------------
// Test 13 — parses end keyword
// ---------------------------------------------------------------------------

describe('parses end keyword', () => {
  it('produces a node with kind === "end"', () => {
    const ast = parse(['end']);
    const node = firstNode(ast) as ActivityEnd;
    expect(node.kind).toBe('end');
  });
});

// ---------------------------------------------------------------------------
// Test 14 — parses kill keyword
// ---------------------------------------------------------------------------

describe('parses kill keyword', () => {
  it('produces a node with kind === "kill"', () => {
    const ast = parse(['kill']);
    const node = firstNode(ast) as ActivityKill;
    expect(node.kind).toBe('kill');
  });
});

// ---------------------------------------------------------------------------
// Test 15 — parses detach keyword
// ---------------------------------------------------------------------------

describe('parses detach keyword', () => {
  it('produces a node with kind === "detach"', () => {
    const ast = parse(['detach']);
    const node = firstNode(ast) as ActivityDetach;
    expect(node.kind).toBe('detach');
  });
});

// ---------------------------------------------------------------------------
// Test 16 — parses split / split again / end split
// ---------------------------------------------------------------------------

describe('parses split / split again / end split', () => {
  it('produces a split node', () => {
    const ast = parse([
      'split',
      '  :A;',
      'split again',
      '  :B;',
      'end split',
    ]);
    expect(firstNode(ast).kind).toBe('split');
  });

  it('has two branches', () => {
    const ast = parse([
      'split',
      '  :A;',
      'split again',
      '  :B;',
      'end split',
    ]);
    const node = firstNode(ast) as ActivitySplit;
    expect(node.branches).toHaveLength(2);
  });

  it('branch[0] has action "A"', () => {
    const ast = parse([
      'split',
      '  :A;',
      'split again',
      '  :B;',
      'end split',
    ]);
    const node = firstNode(ast) as ActivitySplit;
    expect((node.branches[0]?.[0] as ActivityAction).label).toBe('A');
  });

  it('branch[1] has action "B"', () => {
    const ast = parse([
      'split',
      '  :A;',
      'split again',
      '  :B;',
      'end split',
    ]);
    const node = firstNode(ast) as ActivitySplit;
    expect((node.branches[1]?.[0] as ActivityAction).label).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Test 17 — parses break keyword
// ---------------------------------------------------------------------------

describe('parses break keyword', () => {
  it('produces a node with kind === "break"', () => {
    const ast = parse(['break']);
    expect(firstNode(ast).kind).toBe('break');
  });

  it('is case-insensitive (BREAK)', () => {
    const ast = parse(['BREAK']);
    expect(firstNode(ast).kind).toBe('break');
  });

  it('break inside repeat body is captured as ActivityBreak', () => {
    const ast = parse([
      'repeat',
      '  :Do something;',
      '  break',
      'repeat while (again?)',
    ]);
    const repeatNode = firstNode(ast) as ActivityRepeat;
    expect(repeatNode.kind).toBe('repeat');
    const breakNode = repeatNode.body.find((n) => n.kind === 'break');
    expect(breakNode).toBeDefined();
    expect(breakNode!.kind).toBe('break');
  });

  it('break node has no swimlane when none is active', () => {
    const ast = parse(['break']);
    const node = firstNode(ast) as ActivityBreak;
    expect(node.kind).toBe('break');
    expect(node.swimlane).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test 18 — parses arrow-label lines (-> label ;)
// ---------------------------------------------------------------------------

describe('parses arrow-label with color tag -><back:red> no3 ;', () => {
  it('produces a node with kind === "arrow-label"', () => {
    const ast = parse(['-><back:red> no3 ;']);
    expect(firstNode(ast).kind).toBe('arrow-label');
  });

  it('label is "no3"', () => {
    const ast = parse(['-><back:red> no3 ;']);
    const node = firstNode(ast) as ActivityArrowLabel;
    expect(node.label).toBe('no3');
  });

  it('color is "red"', () => {
    const ast = parse(['-><back:red> no3 ;']);
    const node = firstNode(ast) as ActivityArrowLabel;
    expect(node.color).toBe('red');
  });
});

describe('parses arrow-label with color: tag -><color:blue> x ;', () => {
  it('produces kind "arrow-label" with color "blue"', () => {
    const ast = parse(['-><color:blue> x ;']);
    const node = firstNode(ast) as ActivityArrowLabel;
    expect(node.kind).toBe('arrow-label');
    expect(node.color).toBe('blue');
  });

  it('label is "x"', () => {
    const ast = parse(['-><color:blue> x ;']);
    const node = firstNode(ast) as ActivityArrowLabel;
    expect(node.label).toBe('x');
  });
});

describe('parses bare arrow-label line -> some label ;', () => {
  it('produces kind "arrow-label"', () => {
    const ast = parse(['-> some label ;']);
    expect(firstNode(ast).kind).toBe('arrow-label');
  });

  it('label is "some label"', () => {
    const ast = parse(['-> some label ;']);
    const node = firstNode(ast) as ActivityArrowLabel;
    expect(node.label).toBe('some label');
  });

  it('color is undefined when no color tag is present', () => {
    const ast = parse(['-> some label ;']);
    const node = firstNode(ast) as ActivityArrowLabel;
    expect(node.color).toBeUndefined();
  });
});

describe('action stereotype parsing', () => {
  it('captures <<input>> stereotype on single-line action', () => {
    const ast = parse([':Read data; <<input>>']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.kind).toBe('action');
    expect(node.label).toBe('Read data');
    expect(node.stereotype).toBe('input');
  });

  it('captures <<output>> stereotype on single-line action', () => {
    const ast = parse([':Write result; <<output>>']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.stereotype).toBe('output');
  });

  it('captures <<save>> stereotype on single-line action', () => {
    const ast = parse([':Save file; <<save>>']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.stereotype).toBe('save');
  });

  it('normalises stereotype to lowercase', () => {
    const ast = parse([':Act; <<INPUT>>']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.stereotype).toBe('input');
  });

  it('leaves stereotype undefined when absent', () => {
    const ast = parse([':Plain action;']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.stereotype).toBeUndefined();
  });

  it('captures stereotype from multiline action close line', () => {
    const ast = parse([':Prepare', 'answer; <<save>>']);
    const node = firstNode(ast) as ActivityAction;
    expect(node.kind).toBe('action');
    expect(node.label).toBe('Prepare\nanswer');
    expect(node.stereotype).toBe('save');
  });
});

describe('parses arrow-label line without trailing semicolon', () => {
  it('still produces kind "arrow-label"', () => {
    const ast = parse(['-> no semicolon']);
    expect(firstNode(ast).kind).toBe('arrow-label');
  });

  it('label is "no semicolon"', () => {
    const ast = parse(['-> no semicolon']);
    const node = firstNode(ast) as ActivityArrowLabel;
    expect(node.label).toBe('no semicolon');
  });
});
