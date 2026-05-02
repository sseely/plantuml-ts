import { describe, it, expect } from 'vitest';
import { parseChart } from '../../../src/diagrams/chart/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function src(lines: string[]): UmlSource {
  return { lines, type: 'chart' };
}

// ---------------------------------------------------------------------------
// AC tests (Acceptance Criteria from the task spec)
// ---------------------------------------------------------------------------

describe('parseChart — acceptance criteria', () => {
  it('AC1: categorical h-axis, numeric v-axis, bar series', () => {
    const ast = parseChart(
      src([
        'h-axis ["Jan","Feb","Mar"]',
        'v-axis "Y" 0 --> 100',
        'bar "sales" [10, 50, 30]',
      ]),
    );

    expect(ast.hAxis.labels).toEqual(['Jan', 'Feb', 'Mar']);
    expect(ast.vAxis.min).toBe(0);
    expect(ast.vAxis.max).toBe(100);
    expect(ast.series).toHaveLength(1);
    expect(ast.series[0]!.values).toEqual([10, 50, 30]);
    expect(ast.errors).toEqual([]);
  });

  it('AC2: line with coordinate pairs but no explicit h-axis range → error', () => {
    const ast = parseChart(
      src(['line [(1,10),(2,20)]']),
    );

    expect(ast.errors.length).toBeGreaterThan(0);
    expect(
      ast.errors.some((e) => e.toLowerCase().includes('explicit h-axis range')),
    ).toBe(true);
  });

  it('AC3: mixed index-based and coordinate-pair series → error', () => {
    const ast = parseChart(
      src([
        'h-axis "x" -5 --> 5',
        'line [10, 20, 30]',
        'line [(1,10),(2,20)]',
      ]),
    );

    expect(ast.errors.length).toBeGreaterThan(0);
    expect(
      ast.errors.some((e) => e.toLowerCase().includes('same data format')),
    ).toBe(true);
  });

  it('AC4: h-axis numeric range and v2-axis', () => {
    const ast = parseChart(
      src([
        'h-axis "x" -5 --> 5',
        'v2-axis "y2" 0 --> 200',
      ]),
    );

    expect(ast.hAxis.min).toBe(-5);
    expect(ast.hAxis.max).toBe(5);
    expect(ast.hAxis.autoScale).toBe(false);
    expect(ast.v2Axis).not.toBeNull();
    expect(ast.v2Axis!.max).toBe(200);
    expect(ast.errors).toEqual([]);
  });

  it('AC5: v-axis custom ticks', () => {
    const ast = parseChart(
      src(['v-axis ticks [0:"Low", 50:"Mid", 100:"High"]']),
    );

    expect(ast.vAxis.customTicks).not.toBeNull();
    expect(ast.vAxis.customTicks!.size).toBe(3);
    expect(ast.vAxis.customTicks!.get(0)).toBe('Low');
    expect(ast.vAxis.customTicks!.get(50)).toBe('Mid');
    expect(ast.vAxis.customTicks!.get(100)).toBe('High');
    expect(ast.errors).toEqual([]);
  });

  it('AC6: annotation with arrow', () => {
    const ast = parseChart(
      src(['annotation "peak" at (3, 85) <<arrow>>']),
    );

    expect(ast.annotations).toHaveLength(1);
    expect(ast.annotations[0]!.text).toBe('peak');
    expect(ast.annotations[0]!.xPos).toBe(3);
    expect(ast.annotations[0]!.yPos).toBe(85);
    expect(ast.annotations[0]!.hasArrow).toBe(true);
    expect(ast.errors).toEqual([]);
  });

  it('AC7: bar with no name defaults to "bar0"', () => {
    const ast = parseChart(src(['bar [10, 20, 30]']));

    expect(ast.series[0]!.name).toBe('bar0');
    expect(ast.errors).toEqual([]);
  });

  it('AC8: standalone "grid h-axis" → hAxis.gridMode = major', () => {
    const ast = parseChart(src(['grid h-axis']));

    expect(ast.hAxis.gridMode).toBe('major');
    expect(ast.errors).toEqual([]);
  });

  it('AC9: orientation horizontal', () => {
    const ast = parseChart(src(['orientation horizontal']));

    expect(ast.orientation).toBe('horizontal');
    expect(ast.errors).toEqual([]);
  });

  it('AC10: legend right', () => {
    const ast = parseChart(src(['legend right']));

    expect(ast.legendPosition).toBe('right');
    expect(ast.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

describe('parseChart — defaults', () => {
  it('empty source produces correct defaults', () => {
    const ast = parseChart(src([]));

    expect(ast.hAxis.title).toBe('');
    expect(ast.hAxis.min).toBe(0);
    expect(ast.hAxis.max).toBe(100);
    expect(ast.hAxis.autoScale).toBe(true);
    expect(ast.hAxis.labels).toEqual([]);
    expect(ast.hAxis.customTicks).toBeNull();
    expect(ast.hAxis.tickSpacing).toBeNull();
    expect(ast.hAxis.labelPosition).toBe('default');
    expect(ast.hAxis.gridMode).toBe('off');

    expect(ast.vAxis.title).toBe('');
    expect(ast.vAxis.min).toBe(0);
    expect(ast.vAxis.max).toBe(100);
    expect(ast.vAxis.autoScale).toBe(true);

    expect(ast.v2Axis).toBeNull();
    expect(ast.series).toEqual([]);
    expect(ast.legendPosition).toBe('none');
    expect(ast.stackMode).toBe('grouped');
    expect(ast.orientation).toBe('vertical');
    expect(ast.annotations).toEqual([]);
    expect(ast.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// h-axis command
// ---------------------------------------------------------------------------

describe('parseChart — h-axis', () => {
  it('parses unquoted categorical labels', () => {
    const ast = parseChart(src(['h-axis [Jan, Feb, Mar]']));
    expect(ast.hAxis.labels).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('parses numeric range and sets autoScale=false', () => {
    const ast = parseChart(src(['h-axis "Time" 0 --> 10']));
    expect(ast.hAxis.title).toBe('Time');
    expect(ast.hAxis.min).toBe(0);
    expect(ast.hAxis.max).toBe(10);
    expect(ast.hAxis.autoScale).toBe(false);
  });

  it('parses negative range', () => {
    const ast = parseChart(src(['h-axis -10 --> 10']));
    expect(ast.hAxis.min).toBe(-10);
    expect(ast.hAxis.max).toBe(10);
    expect(ast.hAxis.autoScale).toBe(false);
  });

  it('parses spacing option', () => {
    const ast = parseChart(src(['h-axis [A, B, C] spacing 2']));
    expect(ast.hAxis.tickSpacing).toBe(2);
  });

  it('parses label-right option', () => {
    const ast = parseChart(src(['h-axis [A, B] label-right']));
    expect(ast.hAxis.labelPosition).toBe('right');
  });

  it('parses grid suffix on h-axis command', () => {
    const ast = parseChart(src(['h-axis [A, B] grid']));
    expect(ast.hAxis.gridMode).toBe('major');
  });

  it('x-axis alias works', () => {
    const ast = parseChart(src(['x-axis [Q1, Q2]']));
    expect(ast.hAxis.labels).toEqual(['Q1', 'Q2']);
  });
});

// ---------------------------------------------------------------------------
// v-axis command
// ---------------------------------------------------------------------------

describe('parseChart — v-axis', () => {
  it('parses title and range', () => {
    const ast = parseChart(src(['v-axis "Value" 0 --> 500']));
    expect(ast.vAxis.title).toBe('Value');
    expect(ast.vAxis.min).toBe(0);
    expect(ast.vAxis.max).toBe(500);
    expect(ast.vAxis.autoScale).toBe(false);
  });

  it('parses categorical labels for horizontal bar mode', () => {
    const ast = parseChart(src(['v-axis [Alpha, Beta, Gamma]']));
    expect(ast.vAxis.labels).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('parses tick spacing as float', () => {
    const ast = parseChart(src(['v-axis 0 --> 100 spacing 12.5']));
    expect(ast.vAxis.tickSpacing).toBe(12.5);
  });

  it('parses label-top', () => {
    const ast = parseChart(src(['v-axis label-top']));
    expect(ast.vAxis.labelPosition).toBe('top');
  });

  it('parses grid suffix on v-axis command', () => {
    const ast = parseChart(src(['v-axis 0 --> 100 grid']));
    expect(ast.vAxis.gridMode).toBe('major');
  });

  it('y-axis alias works', () => {
    const ast = parseChart(src(['y-axis "Y" 0 --> 50']));
    expect(ast.vAxis.title).toBe('Y');
    expect(ast.vAxis.max).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// v2-axis command
// ---------------------------------------------------------------------------

describe('parseChart — v2-axis', () => {
  it('creates v2Axis on first occurrence', () => {
    const ast = parseChart(src(['v2-axis "Right" 0 --> 1000']));
    expect(ast.v2Axis).not.toBeNull();
    expect(ast.v2Axis!.title).toBe('Right');
    expect(ast.v2Axis!.min).toBe(0);
    expect(ast.v2Axis!.max).toBe(1000);
    expect(ast.v2Axis!.autoScale).toBe(false);
  });

  it('y2-axis alias works', () => {
    const ast = parseChart(src(['y2-axis 0 --> 50']));
    expect(ast.v2Axis).not.toBeNull();
    expect(ast.v2Axis!.max).toBe(50);
  });

  it('v2-axis with custom ticks', () => {
    const ast = parseChart(
      src(['v2-axis ticks [0:"Min", 100:"Max"]']),
    );
    expect(ast.v2Axis!.customTicks!.size).toBe(2);
    expect(ast.v2Axis!.customTicks!.get(0)).toBe('Min');
    expect(ast.v2Axis!.customTicks!.get(100)).toBe('Max');
  });
});

// ---------------------------------------------------------------------------
// bar command
// ---------------------------------------------------------------------------

describe('parseChart — bar series', () => {
  it('parses bar with quoted name', () => {
    const ast = parseChart(src(['bar "Revenue" [100, 200, 300]']));
    expect(ast.series[0]!.name).toBe('Revenue');
    expect(ast.series[0]!.type).toBe('bar');
    expect(ast.series[0]!.values).toEqual([100, 200, 300]);
    expect(ast.series[0]!.xValues).toBeNull();
  });

  it('parses bar with hex color', () => {
    const ast = parseChart(src(['bar [10, 20] #FF0000']));
    expect(ast.series[0]!.color).toBe('#FF0000');
  });

  it('parses bar with labels flag', () => {
    const ast = parseChart(src(['bar [10, 20] labels']));
    expect(ast.series[0]!.showLabels).toBe(true);
  });

  it('default names increment per bar series added', () => {
    const ast = parseChart(
      src([
        'bar [1, 2]',
        'bar [3, 4]',
        'bar [5, 6]',
      ]),
    );
    expect(ast.series[0]!.name).toBe('bar0');
    expect(ast.series[1]!.name).toBe('bar1');
    expect(ast.series[2]!.name).toBe('bar2');
  });

  it('auto-scales vAxis when autoScale=true', () => {
    const ast = parseChart(src(['bar [10, 50, 200]']));
    // autoScale starts true; includeValue expands only when value < min or > max
    // Initial max=100, value 200 > 100 → max expands to 200
    expect(ast.vAxis.max).toBe(200);
  });

  it('does not auto-scale vAxis when explicit range given', () => {
    const ast = parseChart(
      src(['v-axis 0 --> 100', 'bar [200, 300]']),
    );
    // autoScale=false after explicit range
    expect(ast.vAxis.max).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// line command
// ---------------------------------------------------------------------------

describe('parseChart — line series', () => {
  it('parses line with y-values', () => {
    const ast = parseChart(src(['line [5, 10, 15]']));
    expect(ast.series[0]!.type).toBe('line');
    expect(ast.series[0]!.values).toEqual([5, 10, 15]);
    expect(ast.series[0]!.xValues).toBeNull();
  });

  it('parses line with coordinate pairs (explicit h-axis)', () => {
    const ast = parseChart(
      src([
        'h-axis "x" 0 --> 10',
        'line [(1,5),(3,15),(7,20)]',
      ]),
    );
    expect(ast.series[0]!.xValues).toEqual([1, 3, 7]);
    expect(ast.series[0]!.values).toEqual([5, 15, 20]);
    expect(ast.errors).toEqual([]);
  });

  it('parses line stereo <<circle>> → markerShape circle', () => {
    const ast = parseChart(src(['line <<circle>> [1, 2, 3]']));
    expect(ast.series[0]!.markerShape).toBe('circle');
  });

  it('parses line stereo <<square>> → markerShape square', () => {
    const ast = parseChart(src(['line <<square>> [1, 2, 3]']));
    expect(ast.series[0]!.markerShape).toBe('square');
  });

  it('parses line stereo <<triangle>> → markerShape triangle', () => {
    const ast = parseChart(src(['line <<triangle>> [1, 2, 3]']));
    expect(ast.series[0]!.markerShape).toBe('triangle');
  });

  it('parses line with secondary axis flag', () => {
    const ast = parseChart(src(['line [10, 20] v2']));
    expect(ast.series[0]!.useSecondaryAxis).toBe(true);
  });

  it('default name: line0', () => {
    const ast = parseChart(src(['line [1, 2, 3]']));
    expect(ast.series[0]!.name).toBe('line0');
  });

  it('coordinate pairs on bar → error', () => {
    const ast = parseChart(
      src([
        'h-axis "x" 0 --> 10',
        'bar [(1,5),(2,10)]',
      ]),
    );
    // bar data with parens is treated as parse failure (invalid number format),
    // not coordinate-pair error — the bar regex captures data and parseYValues
    // fails on "(1" etc.
    expect(ast.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// area command
// ---------------------------------------------------------------------------

describe('parseChart — area series', () => {
  it('parses area series', () => {
    const ast = parseChart(src(['area "Sales" [10, 20, 30]']));
    expect(ast.series[0]!.type).toBe('area');
    expect(ast.series[0]!.name).toBe('Sales');
    expect(ast.series[0]!.values).toEqual([10, 20, 30]);
  });

  it('default name: area0', () => {
    const ast = parseChart(src(['area [1, 2]']));
    expect(ast.series[0]!.name).toBe('area0');
  });
});

// ---------------------------------------------------------------------------
// scatter command
// ---------------------------------------------------------------------------

describe('parseChart — scatter series', () => {
  it('parses scatter with y-values', () => {
    const ast = parseChart(src(['scatter [1, 2, 3]']));
    expect(ast.series[0]!.type).toBe('scatter');
    expect(ast.series[0]!.xValues).toBeNull();
  });

  it('parses scatter with coordinate pairs', () => {
    const ast = parseChart(
      src([
        'h-axis "x" 0 --> 10',
        'scatter [(2,4),(5,8)]',
      ]),
    );
    expect(ast.series[0]!.xValues).toEqual([2, 5]);
    expect(ast.series[0]!.values).toEqual([4, 8]);
    expect(ast.errors).toEqual([]);
  });

  it('parses scatter with explicit <<triangle>> marker', () => {
    const ast = parseChart(src(['scatter [1, 2] <<triangle>>']));
    expect(ast.series[0]!.markerShape).toBe('triangle');
  });

  it('default name: scatter0', () => {
    const ast = parseChart(src(['scatter [1, 2]']));
    expect(ast.series[0]!.name).toBe('scatter0');
  });
});

// ---------------------------------------------------------------------------
// legend command
// ---------------------------------------------------------------------------

describe('parseChart — legend', () => {
  it.each([
    ['legend left', 'left'],
    ['legend right', 'right'],
    ['legend top', 'top'],
    ['legend bottom', 'bottom'],
  ] as const)('%s → legendPosition=%s', (line, expected) => {
    const ast = parseChart(src([line]));
    expect(ast.legendPosition).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// stackMode command
// ---------------------------------------------------------------------------

describe('parseChart — stackMode', () => {
  it('parses stackMode grouped', () => {
    const ast = parseChart(src(['stackMode grouped']));
    expect(ast.stackMode).toBe('grouped');
  });

  it('parses stackMode stacked', () => {
    const ast = parseChart(src(['stackMode stacked']));
    expect(ast.stackMode).toBe('stacked');
  });
});

// ---------------------------------------------------------------------------
// orientation command
// ---------------------------------------------------------------------------

describe('parseChart — orientation', () => {
  it('parses orientation vertical', () => {
    const ast = parseChart(src(['orientation vertical']));
    expect(ast.orientation).toBe('vertical');
  });

  it('parses orientation horizontal', () => {
    const ast = parseChart(src(['orientation horizontal']));
    expect(ast.orientation).toBe('horizontal');
  });
});

// ---------------------------------------------------------------------------
// annotation command
// ---------------------------------------------------------------------------

describe('parseChart — annotation', () => {
  it('parses annotation without arrow', () => {
    const ast = parseChart(src(['annotation "note" at (5, 40)']));
    expect(ast.annotations[0]!.text).toBe('note');
    expect(ast.annotations[0]!.xPos).toBe(5);
    expect(ast.annotations[0]!.yPos).toBe(40);
    expect(ast.annotations[0]!.hasArrow).toBe(false);
  });

  it('parses annotation with categorical x-pos', () => {
    const ast = parseChart(
      src(['annotation "peak" at (Jan, 95)']),
    );
    expect(ast.annotations[0]!.xPos).toBe('Jan');
    expect(ast.annotations[0]!.yPos).toBe(95);
  });

  it('multiple annotations accumulate', () => {
    const ast = parseChart(
      src([
        'annotation "a" at (1, 10)',
        'annotation "b" at (2, 20) <<arrow>>',
      ]),
    );
    expect(ast.annotations).toHaveLength(2);
    expect(ast.annotations[1]!.hasArrow).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// grid command (standalone)
// ---------------------------------------------------------------------------

describe('parseChart — grid command', () => {
  it('grid v-axis → vAxis.gridMode = major', () => {
    const ast = parseChart(src(['grid v-axis']));
    expect(ast.vAxis.gridMode).toBe('major');
    expect(ast.hAxis.gridMode).toBe('off');
  });

  it('grid h-axis → hAxis.gridMode = major', () => {
    const ast = parseChart(src(['grid h-axis']));
    expect(ast.hAxis.gridMode).toBe('major');
    expect(ast.vAxis.gridMode).toBe('off');
  });

  it('grid x-axis alias', () => {
    const ast = parseChart(src(['grid x-axis']));
    expect(ast.hAxis.gridMode).toBe('major');
  });

  it('grid y-axis alias', () => {
    const ast = parseChart(src(['grid y-axis']));
    expect(ast.vAxis.gridMode).toBe('major');
  });
});

// ---------------------------------------------------------------------------
// block-extractor integration
// ---------------------------------------------------------------------------

describe('block-extractor — chart type', () => {
  it('@startchart/@endchart produces type=chart', async () => {
    const { extractBlocks } = await import(
      '../../../src/core/block-extractor.js'
    );
    const blocks = extractBlocks([
      '@startchart',
      'bar [1,2,3]',
      '@endchart',
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('chart');
    expect(blocks[0]!.lines).toEqual(['bar [1,2,3]']);
  });
});

// ---------------------------------------------------------------------------
// Validation edge cases
// ---------------------------------------------------------------------------

describe('parseChart — validation', () => {
  it('x-coordinate outside h-axis range → error', () => {
    const ast = parseChart(
      src([
        'h-axis "x" 0 --> 5',
        'line [(10,20)]',
      ]),
    );
    expect(ast.errors.some((e) => e.includes('outside h-axis range'))).toBe(
      true,
    );
  });

  it('second series mixing formats (coord then index) → error', () => {
    const ast = parseChart(
      src([
        'h-axis "x" 0 --> 10',
        'line [(1,2),(3,4)]',
        'line [10, 20]',
      ]),
    );
    expect(ast.errors.some((e) => e.includes('same data format'))).toBe(true);
  });

  it('coordinate pairs on bar type → error', () => {
    const ast = parseChart(
      src([
        'h-axis "x" 0 --> 10',
        // bar parses data as y-values; "(1" is not a valid number
        'bar [(1,2),(3,4)]',
      ]),
    );
    expect(ast.errors.length).toBeGreaterThan(0);
  });

  it('auto-scale expands vAxis for large values', () => {
    const ast = parseChart(src(['bar [0, 150, 300]']));
    expect(ast.vAxis.max).toBe(300);
    expect(ast.vAxis.min).toBe(0);
  });

  it('auto-scale expands vAxis for negative values', () => {
    const ast = parseChart(src(['bar [-50, 0, 50]']));
    expect(ast.vAxis.min).toBe(-50);
  });

  it('v2Axis auto-scales when secondary series added', () => {
    const ast = parseChart(
      src([
        'v2-axis "R"',
        'line [500, 1000] v2',
      ]),
    );
    expect(ast.v2Axis!.max).toBe(1000);
  });
});
