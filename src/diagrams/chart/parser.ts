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
import { parseStyleBlock } from '../../core/skinparam.js';
import type { StyleMap } from '../../core/skinparam.js';

// Hex digits → #RRGGBB; CSS named color (e.g. "red") → use as-is.
function resolveSeriesColor(raw: string): string {
  return /^[0-9a-fA-F]{3,8}$/.test(raw) ? `#${raw}` : raw;
}

// Build a StyleMap from source. Prefers preprocessor-extracted rawStyles when
// present (the preprocessor strips <style> blocks from source.lines before
// chart parse sees them). Falls back to scanning source.lines directly so
// that unit tests that construct UmlSource literals still work.
function extractStyleMap(source: UmlSource): StyleMap {
  // Use preprocessor-extracted style strings when available
  if (source.rawStyles !== undefined && source.rawStyles.length > 0) {
    const merged: StyleMap = new Map();
    for (const raw of source.rawStyles) {
      const sm = parseStyleBlock(raw);
      sm.forEach((props, selector) => {
        const existing = merged.get(selector) ?? new Map<string, string>();
        props.forEach((v, k) => existing.set(k, v));
        merged.set(selector, existing);
      });
    }
    return merged;
  }
  // Fallback: scan lines for inline <style>…</style> (unit test path)
  let content = '';
  let inside = false;
  for (const rawLine of source.lines) {
    const line = rawLine.trim();
    if (/^<style>/i.test(line)) { inside = true; continue; }
    if (/^<\/style>/i.test(line)) { inside = false; continue; }
    if (inside) content += rawLine + '\n';
  }
  return content.length > 0 ? parseStyleBlock(content) : new Map<string, Map<string, string>>();
}

// Resolve series color from a stereotype's style-class entry.
// Priority mirrors ChartRenderer.java per series type:
//   bar/area  → BackGroundColor, LineColor fallback
//   line      → LineColor, BackGroundColor fallback
//   scatter   → MarkerColor, LineColor fallback
function colorFromStereo(
  stereo: string | undefined,
  styleMap: StyleMap,
  type: 'bar' | 'line' | 'area' | 'scatter',
): string | null {
  if (stereo === undefined) return null;
  const name = stereo.replace(/^<<\s*/, '').replace(/\s*>>$/, '').toLowerCase();
  const decls = styleMap.get(`.${name}`);
  if (decls === undefined) return null;
  if (type === 'scatter') {
    return decls.get('markercolor') ?? decls.get('linecolor') ?? null;
  }
  if (type === 'line') {
    return decls.get('linecolor') ?? decls.get('backgroundcolor') ?? null;
  }
  // bar, area
  return decls.get('backgroundcolor') ?? decls.get('linecolor') ?? null;
}

// Resolve MarkerShape from a stereotype's style-class entry (scatter/line).
function markerShapeFromStereo(
  stereo: string | undefined,
  styleMap: StyleMap,
): MarkerShape | null {
  if (stereo === undefined) return null;
  const name = stereo.replace(/^<<\s*/, '').replace(/\s*>>$/, '').toLowerCase();
  const decls = styleMap.get(`.${name}`);
  if (decls === undefined) return null;
  const shape = decls.get('markershape')?.toLowerCase();
  if (shape === 'square') return 'square';
  if (shape === 'triangle') return 'triangle';
  if (shape === 'circle') return 'circle';
  return null;
}

// Resolve MarkerSize from a stereotype's style-class entry.
function markerSizeFromStereo(
  stereo: string | undefined,
  styleMap: StyleMap,
): number | null {
  if (stereo === undefined) return null;
  const name = stereo.replace(/^<<\s*/, '').replace(/\s*>>$/, '').toLowerCase();
  const decls = styleMap.get(`.${name}`);
  if (decls === undefined) return null;
  const raw = decls.get('markersize');
  if (raw === undefined) return null;
  const n = parseFloat(raw);
  return isFinite(n) && n > 0 ? n : null;
}

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

// title <text>
const RE_TITLE = /^\s*title\s+(.+?)\s*$/i;

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
    title: '',
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

  const styleMap = extractStyleMap(source);

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
      const stereo = m[1];
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
      const color =
        colorRaw !== undefined
          ? resolveSeriesColor(colorRaw)
          : (colorFromStereo(stereo, styleMap, 'bar') ?? null);

      const series: ChartSeriesDef = {
        name,
        type: 'bar' satisfies SeriesType,
        values,
        xValues: null,
        color,
        useSecondaryAxis: secondary !== undefined,
        showLabels,
        markerShape: 'circle',
        markerSize: null,
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
      const color =
        colorRaw !== undefined
          ? resolveSeriesColor(colorRaw)
          : (colorFromStereo(stereo, styleMap, 'line') ?? null);

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
          color,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape: stereoToMarker(stereo),
          markerSize: null,
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
          color,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape: stereoToMarker(stereo),
          markerSize: null,
        };
      }
      addSeries(ast, series);
      continue;
    }

    // --- area ---
    if ((m = RE_AREA.exec(line)) !== null) {
      const stereo = m[1];
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
      const color =
        colorRaw !== undefined
          ? resolveSeriesColor(colorRaw)
          : (colorFromStereo(stereo, styleMap, 'area') ?? null);

      const series: ChartSeriesDef = {
        name,
        type: 'area' satisfies SeriesType,
        values,
        xValues: null,
        color,
        useSecondaryAxis: secondary !== undefined,
        showLabels,
        markerShape: 'circle',
        markerSize: null,
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
      const color =
        colorRaw !== undefined
          ? resolveSeriesColor(colorRaw)
          : (colorFromStereo(stereo, styleMap, 'scatter') ?? null);

      let markerShape: MarkerShape;
      if (markerStr !== undefined) {
        const ml = markerStr.toLowerCase();
        markerShape =
          ml === 'square' ? 'square' : ml === 'triangle' ? 'triangle' : 'circle';
      } else {
        // Style-class MarkerShape overrides stereo-name-based shape
        markerShape =
          markerShapeFromStereo(stereo, styleMap) ?? stereoToMarker(stereo);
      }
      const markerSize = markerSizeFromStereo(stereo, styleMap);

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
          color,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape,
          markerSize,
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
          color,
          useSecondaryAxis: secondary !== undefined,
          showLabels,
          markerShape,
          markerSize,
        };
      }
      addSeries(ast, series);
      continue;
    }

    // --- title ---
    if ((m = RE_TITLE.exec(line)) !== null) {
      ast.title = m[1]!;
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
