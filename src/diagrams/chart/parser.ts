import type { UmlSource } from '../../core/block-extractor.js';
import type {
  ChartAnnotationDef,
  ChartAxisDef,
  ChartDiagramAST,
  ChartSeriesDef,
  GridMode,
  LabelPosition,
  LegendPosition,
  MarkerShape,
  Orientation,
  SeriesType,
  StackMode,
} from './ast.js';

// ---------------------------------------------------------------------------
// Regex patterns (case-insensitive)
// ---------------------------------------------------------------------------

// h-axis or x-axis
const RE_HAXIS =
  /^\s*[hx]-axis(?:\s+"([^"]+)")?(?:\s+(-?[0-9.]+)\s*-?->\s*(-?[0-9.]+))?(?:\s+\[([^\]]*)\])?(?:\s+spacing\s+([0-9]+))?(?:\s+(label-right))?(?:\s+(grid))?\s*$/i;

// v-axis or y-axis (NOT v2 or y2)
const RE_VAXIS =
  /^\s*([vy]-axis)(?:\s+"([^"]+)")?(?:\s+(-?[0-9.]+)\s*-?->\s*(-?[0-9.]+))?(?:\s+\[([^\]]*)\])?(?:\s+ticks\s+\[([^\]]*)\])?(?:\s+spacing\s+([0-9.]+))?(?:\s+(label-top))?(?:\s+(grid))?\s*$/i;

// v2-axis or y2-axis (secondary)
const RE_V2AXIS =
  /^\s*([vy]2-axis)(?:\s+"([^"]+)")?(?:\s+(-?[0-9.]+)\s*-?->\s*(-?[0-9.]+))?(?:\s+\[([^\]]*)\])?(?:\s+ticks\s+\[([^\]]*)\])?(?:\s+spacing\s+([0-9.]+))?(?:\s+(label-top))?(?:\s+(grid))?\s*$/i;

// bar <<stereo>>? "name"? [data] #color? v2? labels?
const RE_BAR =
  /^\s*bar(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?\s*$/i;

// line <<stereo>>? "name"? [data] #color? v2? labels?
const RE_LINE =
  /^\s*line(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?\s*$/i;

// area <<stereo>>? "name"? [data] #color? v2? labels?
const RE_AREA =
  /^\s*area(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?\s*$/i;

// scatter <<stereo>>? "name"? [data] #color? v2? labels? <<marker>>?
const RE_SCATTER =
  /^\s*scatter(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?(?:\s+<<(circle|square|triangle)>>)?\s*$/i;

// legend left|right|top|bottom
const RE_LEGEND = /^\s*legend\s+(left|right|top|bottom)\s*$/i;

// stackMode grouped|stacked
const RE_STACKMODE = /^\s*stackMode\s+(grouped|stacked)\s*$/i;

// orientation vertical|horizontal
const RE_ORIENTATION = /^\s*orientation\s+(vertical|horizontal)\s*$/i;

// annotation "text" at (xPos, yPos) <<arrow>>?
const RE_ANNOTATION =
  /^\s*annotation\s+"([^"]+)"\s+at\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)(?:\s+<<(arrow)>>)?\s*$/i;

// grid h-axis|v-axis (standalone)
const RE_GRID = /^\s*grid\s+([hx]-axis|[vy]-axis)\s*$/i;

// ---------------------------------------------------------------------------
// Default axis factory
// ---------------------------------------------------------------------------

function makeAxis(): ChartAxisDef {
  return {
    title: '',
    min: 0,
    max: 100,
    autoScale: true,
    labels: [],
    customTicks: null,
    tickSpacing: null,
    labelPosition: 'default',
    gridMode: 'off',
  };
}

// ---------------------------------------------------------------------------
// Helper: expand axis range to include a value (only when autoScale)
// ---------------------------------------------------------------------------

function includeValue(axis: ChartAxisDef, value: number): void {
  if (!axis.autoScale) return;
  if (value < axis.min) axis.min = value;
  if (value > axis.max) axis.max = value;
}

// ---------------------------------------------------------------------------
// Helper: parse comma-separated labels from a bracket content string.
// Strips surrounding quotes from each label.
// ---------------------------------------------------------------------------

function parseLabels(data: string): string[] {
  if (data.trim() === '') return [];
  return data.split(',').map((part) => {
    const s = part.trim();
    if (s.startsWith('"') && s.endsWith('"') && s.length > 1) {
      return s.slice(1, -1);
    }
    return s;
  });
}

// ---------------------------------------------------------------------------
// Helper: parse custom ticks string: `0:"Low", 50:"Mid", 100:"High"`
// Returns null on parse failure.
// ---------------------------------------------------------------------------

function parseCustomTicks(ticksStr: string): Map<number, string> | null {
  const result = new Map<number, string>();
  if (ticksStr.trim() === '') return result;

  for (const pair of ticksStr.split(',')) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx < 0) return null;
    const valueStr = pair.slice(0, colonIdx).trim();
    let label = pair.slice(colonIdx + 1).trim();
    if (label.startsWith('"') && label.endsWith('"') && label.length > 1) {
      label = label.slice(1, -1);
    } else {
      return null;
    }
    const n = Number(valueStr);
    if (isNaN(n)) return null;
    result.set(n, label);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: parse coordinate pairs from data string like (x1,y1),(x2,y2),...
// Returns null on parse failure.
// ---------------------------------------------------------------------------

function parseCoordinatePairs(
  data: string,
): { xValues: number[]; yValues: number[] } | null {
  const cleaned = data.replace(/\s+/g, '');
  const pairs = cleaned.split('),(');
  const xValues: number[] = [];
  const yValues: number[] = [];
  for (const pair of pairs) {
    const trimmed = pair.replace(/^[[(]+/, '').replace(/[\])+]+$/, '');
    const parts = trimmed.split(',');
    if (parts.length !== 2) return null;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (isNaN(x) || isNaN(y)) return null;
    xValues.push(x);
    yValues.push(y);
  }
  if (xValues.length === 0) return null;
  return { xValues, yValues };
}

// ---------------------------------------------------------------------------
// Helper: parse simple y-values list
// Returns null on parse failure.
// ---------------------------------------------------------------------------

function parseYValues(data: string): number[] | null {
  if (data.trim() === '') return [];
  const parts = data.split(',');
  const result: number[] = [];
  for (const part of parts) {
    const n = Number(part.trim());
    if (isNaN(n)) return null;
    result.push(n);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: extract marker shape from stereo string like <<circle>>
// ---------------------------------------------------------------------------

function stereoToMarker(stereo: string | undefined): MarkerShape {
  if (stereo === undefined) return 'circle';
  const inner = stereo.replace(/^<<\s*/, '').replace(/\s*>>$/, '').toLowerCase();
  if (inner === 'square') return 'square';
  if (inner === 'triangle') return 'triangle';
  return 'circle';
}

// ---------------------------------------------------------------------------
// Helper: validate and add a series to the AST (mirrors Java addSeries)
// ---------------------------------------------------------------------------

function addSeries(
  ast: ChartDiagramAST,
  series: ChartSeriesDef,
): void {
  if (series.xValues !== null) {
    // Coordinate pairs only for line or scatter
    if (series.type !== 'line' && series.type !== 'scatter') {
      ast.errors.push(
        'Coordinate pair notation (x:y) is only supported for line and scatter charts',
      );
      return;
    }

    // Coordinate pairs require numeric h-axis (not categorical)
    if (ast.hAxis.labels.length > 0) {
      ast.errors.push(
        'Coordinate pair notation requires numeric h-axis (e.g., h-axis "x" -5 --> 5), not categorical labels',
      );
      return;
    }

    // Coordinate pairs require explicit h-axis range
    if (ast.hAxis.autoScale) {
      ast.errors.push(
        'Coordinate pair notation requires explicit h-axis range (e.g., h-axis "x" -5 --> 5)',
      );
      return;
    }

    // All series must use the same format
    if (ast.series.length > 0 && ast.series[0]!.xValues === null) {
      ast.errors.push(
        'All series must use the same data format (either all coordinate pairs or all index-based)',
      );
      return;
    }

    // Validate x-coordinates within axis range
    for (const x of series.xValues) {
      if (x < ast.hAxis.min || x > ast.hAxis.max) {
        ast.errors.push(
          `X-coordinate ${x} is outside h-axis range [${ast.hAxis.min}, ${ast.hAxis.max}]`,
        );
        return;
      }
    }
  } else {
    // Index-based: ensure consistency
    if (ast.series.length > 0 && ast.series[0]!.xValues !== null) {
      ast.errors.push(
        'All series must use the same data format (either all coordinate pairs or all index-based)',
      );
      return;
    }
  }

  ast.series.push(series);

  // Auto-scale the appropriate y-axis
  const targetAxis =
    series.useSecondaryAxis && ast.v2Axis !== null ? ast.v2Axis : ast.vAxis;
  for (const v of series.values) {
    includeValue(targetAxis, v);
  }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseChart(source: UmlSource): ChartDiagramAST {
  const ast: ChartDiagramAST = {
    hAxis: makeAxis(),
    vAxis: makeAxis(),
    v2Axis: null,
    series: [],
    legendPosition: 'none',
    stackMode: 'grouped',
    orientation: 'vertical',
    annotations: [],
    errors: [],
  };

  // Per-type series counters for default naming (mirrors Java: uses series.size())
  // Java uses `diagram.getSeries().size()` at the time of insertion, so we can
  // just check `ast.series.length` when building the name.

  for (const rawLine of source.lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    let m: RegExpExecArray | null;

    // --- v2-axis / y2-axis (must be checked before v-axis) ---
    if ((m = RE_V2AXIS.exec(line)) !== null) {
      if (ast.v2Axis === null) ast.v2Axis = makeAxis();
      const axis = ast.v2Axis;
      const title = m[2];
      const minStr = m[3];
      const maxStr = m[4];
      const ticksStr = m[6];
      const spacingStr = m[7];
      const labelTop = m[8];
      const grid = m[9];

      if (title !== undefined) axis.title = title;
      if (minStr !== undefined && maxStr !== undefined) {
        axis.min = Number(minStr);
        axis.max = Number(maxStr);
        axis.autoScale = false;
      }
      if (ticksStr !== undefined) {
        const ticks = parseCustomTicks(ticksStr);
        if (ticks !== null) axis.customTicks = ticks;
      }
      if (spacingStr !== undefined) {
        const sp = Number(spacingStr);
        if (sp > 0) axis.tickSpacing = sp;
      }
      if (labelTop !== undefined) axis.labelPosition = 'top' satisfies LabelPosition;
      if (grid !== undefined) axis.gridMode = 'major' satisfies GridMode;
      continue;
    }

    // --- v-axis / y-axis ---
    if ((m = RE_VAXIS.exec(line)) !== null) {
      const axis = ast.vAxis;
      const title = m[2];
      const minStr = m[3];
      const maxStr = m[4];
      const labelsStr = m[5];
      const ticksStr = m[6];
      const spacingStr = m[7];
      const labelTop = m[8];
      const grid = m[9];

      if (labelsStr !== undefined) {
        axis.labels = parseLabels(labelsStr);
        continue;
      }
      if (title !== undefined) axis.title = title;
      if (minStr !== undefined && maxStr !== undefined) {
        axis.min = Number(minStr);
        axis.max = Number(maxStr);
        axis.autoScale = false;
      }
      if (ticksStr !== undefined) {
        const ticks = parseCustomTicks(ticksStr);
        if (ticks !== null) axis.customTicks = ticks;
      }
      if (spacingStr !== undefined) {
        const sp = Number(spacingStr);
        if (sp > 0) axis.tickSpacing = sp;
      }
      if (labelTop !== undefined) axis.labelPosition = 'top' satisfies LabelPosition;
      if (grid !== undefined) axis.gridMode = 'major' satisfies GridMode;
      continue;
    }

    // --- h-axis / x-axis ---
    if ((m = RE_HAXIS.exec(line)) !== null) {
      const axis = ast.hAxis;
      const title = m[1];
      const minStr = m[2];
      const maxStr = m[3];
      const labelsStr = m[4];
      const spacingStr = m[5];
      const labelRight = m[6];
      const grid = m[7];

      if (spacingStr !== undefined) {
        const sp = parseInt(spacingStr, 10);
        if (sp > 0) axis.tickSpacing = sp;
      }
      if (labelRight !== undefined) {
        axis.labelPosition = 'right' satisfies LabelPosition;
      }
      if (grid !== undefined) axis.gridMode = 'major' satisfies GridMode;

      if (minStr !== undefined && maxStr !== undefined) {
        if (title !== undefined) axis.title = title;
        axis.min = Number(minStr);
        axis.max = Number(maxStr);
        axis.autoScale = false;
      } else {
        if (title !== undefined) axis.title = title;
        if (labelsStr !== undefined) {
          axis.labels = parseLabels(labelsStr);
        }
      }
      continue;
    }

    // --- grid (standalone command) ---
    if ((m = RE_GRID.exec(line)) !== null) {
      const axisToken = m[1]!.toLowerCase();
      if (axisToken === 'h-axis' || axisToken === 'x-axis') {
        ast.hAxis.gridMode = 'major';
      } else {
        ast.vAxis.gridMode = 'major';
      }
      continue;
    }

    // --- bar ---
    if ((m = RE_BAR.exec(line)) !== null) {
      const data = m[3] ?? '';
      const values = parseYValues(data);
      if (values === null) {
        ast.errors.push('Invalid number format in bar data');
        continue;
      }
      const name = m[2] !== undefined ? m[2] : `bar${ast.series.length}`;
      const colorRaw = m[4];
      const secondary = m[5];
      const showLabels = m[6] !== undefined;

      const series: ChartSeriesDef = {
        name,
        type: 'bar' satisfies SeriesType,
        values,
        xValues: null,
        color: colorRaw !== undefined ? `#${colorRaw}` : null,
        useSecondaryAxis: secondary !== undefined,
        showLabels,
        markerShape: 'circle',
      };
      addSeries(ast, series);
      continue;
    }

    // --- line ---
    if ((m = RE_LINE.exec(line)) !== null) {
      const stereo = m[1];
      const data = m[3] ?? '';
      const colorRaw = m[4];
      const secondary = m[5];
      const showLabels = m[6] !== undefined;
      const name = m[2] !== undefined ? m[2] : `line${ast.series.length}`;

      let series: ChartSeriesDef;
      if (data.includes('(')) {
        const parsed = parseCoordinatePairs(data);
        if (parsed === null) {
          ast.errors.push('Invalid coordinate pair format in line data');
          continue;
        }
        series = {
          name,
          type: 'line',
          values: parsed.yValues,
          xValues: parsed.xValues,
          color: colorRaw !== undefined ? `#${colorRaw}` : null,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape: stereoToMarker(stereo),
        };
      } else {
        const values = parseYValues(data);
        if (values === null) {
          ast.errors.push('Invalid number format in line data');
          continue;
        }
        series = {
          name,
          type: 'line',
          values,
          xValues: null,
          color: colorRaw !== undefined ? `#${colorRaw}` : null,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape: stereoToMarker(stereo),
        };
      }
      addSeries(ast, series);
      continue;
    }

    // --- area ---
    if ((m = RE_AREA.exec(line)) !== null) {
      const data = m[3] ?? '';
      const values = parseYValues(data);
      if (values === null) {
        ast.errors.push('Invalid number format in area data');
        continue;
      }
      const name = m[2] !== undefined ? m[2] : `area${ast.series.length}`;
      const colorRaw = m[4];
      const secondary = m[5];
      const showLabels = m[6] !== undefined;

      const series: ChartSeriesDef = {
        name,
        type: 'area' satisfies SeriesType,
        values,
        xValues: null,
        color: colorRaw !== undefined ? `#${colorRaw}` : null,
        useSecondaryAxis: secondary !== undefined,
        showLabels,
        markerShape: 'circle',
      };
      addSeries(ast, series);
      continue;
    }

    // --- scatter ---
    if ((m = RE_SCATTER.exec(line)) !== null) {
      const stereo = m[1];
      const data = m[3] ?? '';
      const colorRaw = m[4];
      const secondary = m[5];
      const showLabels = m[6] !== undefined;
      const markerStr = m[7];
      const name = m[2] !== undefined ? m[2] : `scatter${ast.series.length}`;

      let markerShape: MarkerShape;
      if (markerStr !== undefined) {
        const ml = markerStr.toLowerCase();
        markerShape =
          ml === 'square' ? 'square' : ml === 'triangle' ? 'triangle' : 'circle';
      } else {
        markerShape = stereoToMarker(stereo);
      }

      let series: ChartSeriesDef;
      if (data.includes('(')) {
        const parsed = parseCoordinatePairs(data);
        if (parsed === null) {
          ast.errors.push('Invalid coordinate pair format in scatter data');
          continue;
        }
        series = {
          name,
          type: 'scatter',
          values: parsed.yValues,
          xValues: parsed.xValues,
          color: colorRaw !== undefined ? `#${colorRaw}` : null,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape,
        };
      } else {
        const values = parseYValues(data);
        if (values === null) {
          ast.errors.push('Invalid number format in scatter data');
          continue;
        }
        series = {
          name,
          type: 'scatter',
          values,
          xValues: null,
          color: colorRaw !== undefined ? `#${colorRaw}` : null,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape,
        };
      }
      addSeries(ast, series);
      continue;
    }

    // --- legend ---
    if ((m = RE_LEGEND.exec(line)) !== null) {
      const pos = m[1]!.toLowerCase() as LegendPosition;
      ast.legendPosition = pos;
      continue;
    }

    // --- stackMode ---
    if ((m = RE_STACKMODE.exec(line)) !== null) {
      ast.stackMode = m[1]!.toLowerCase() as StackMode;
      continue;
    }

    // --- orientation ---
    if ((m = RE_ORIENTATION.exec(line)) !== null) {
      ast.orientation = m[1]!.toLowerCase() as Orientation;
      continue;
    }

    // --- annotation ---
    if ((m = RE_ANNOTATION.exec(line)) !== null) {
      const text = m[1]!;
      const xPosStr = m[2]!.trim();
      const yPosStr = m[3]!.trim();
      const arrowStr = m[4];

      const yPos = Number(yPosStr);
      if (isNaN(yPos)) {
        ast.errors.push(`Y position must be a numeric value: ${yPosStr}`);
        continue;
      }

      const xPosNum = Number(xPosStr);
      const xPos: number | string = isNaN(xPosNum) ? xPosStr : xPosNum;

      const annotation: ChartAnnotationDef = {
        text,
        xPos,
        yPos,
        hasArrow: arrowStr !== undefined,
      };
      ast.annotations.push(annotation);
      continue;
    }
  }

  return ast;
}
