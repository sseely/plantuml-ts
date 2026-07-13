/**
 * Shared regex constants, style/color/marker resolution, and per-series
 * parsing helpers for the chart diagram parser. Split out of parser.ts
 * (mission G0b/T6) purely to keep both files under the project's 500-line
 * file cap -- no behavior change; every export here is verbatim code
 * moved from parser.ts.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { ChartAxisDef, ChartSeriesDef, ChartDiagramAST, MarkerShape } from './ast.js';
import { parseStyleBlock } from '../../core/skinparam.js';
import type { StyleMap } from '../../core/skinparam.js';

// Hex digits → #RRGGBB; CSS named color (e.g. "red") → use as-is.
export function resolveSeriesColor(raw: string): string {
  return /^[0-9a-fA-F]{3,8}$/.test(raw) ? `#${raw}` : raw;
}

// Build a StyleMap from source. Prefers preprocessor-extracted rawStyles when
// present (the preprocessor strips <style> blocks from source.lines before
// chart parse sees them). Falls back to scanning source.lines directly so
// that unit tests that construct UmlSource literals still work.
export function extractStyleMap(source: UmlSource): StyleMap {
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
export function colorFromStereo(
  stereo: string | undefined,
  styleMap: StyleMap,
  type: 'bar' | 'line' | 'area' | 'scatter',
): string | null {
  // #lizard forgives -- pre-existing faithful port of ChartRenderer's
  // per-series-type color resolution (already over CCN threshold before
  // mission G0b/T6 moved it here verbatim from parser.ts).
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
export function markerShapeFromStereo(
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
export function markerSizeFromStereo(
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
export const RE_HAXIS =
  /^\s*[hx]-axis(?:\s+"([^"]+)")?(?:\s+(-?[0-9.]+)\s*-?->\s*(-?[0-9.]+))?(?:\s+\[([^\]]*)\])?(?:\s+spacing\s+([0-9]+))?(?:\s+(label-right))?(?:\s+(grid))?\s*$/i;

// v-axis or y-axis (NOT v2 or y2)
export const RE_VAXIS =
  /^\s*([vy]-axis)(?:\s+"([^"]+)")?(?:\s+(-?[0-9.]+)\s*-?->\s*(-?[0-9.]+))?(?:\s+\[([^\]]*)\])?(?:\s+ticks\s+\[([^\]]*)\])?(?:\s+spacing\s+([0-9.]+))?(?:\s+(label-top))?(?:\s+(grid))?\s*$/i;

// v2-axis or y2-axis (secondary)
export const RE_V2AXIS =
  /^\s*([vy]2-axis)(?:\s+"([^"]+)")?(?:\s+(-?[0-9.]+)\s*-?->\s*(-?[0-9.]+))?(?:\s+\[([^\]]*)\])?(?:\s+ticks\s+\[([^\]]*)\])?(?:\s+spacing\s+([0-9.]+))?(?:\s+(label-top))?(?:\s+(grid))?\s*$/i;

// bar <<stereo>>? "name"? [data] #color? v2? labels?
export const RE_BAR =
  /^\s*bar(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?\s*$/i;

// line <<stereo>>? "name"? [data] #color? v2? labels?
export const RE_LINE =
  /^\s*line(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?\s*$/i;

// area <<stereo>>? "name"? [data] #color? v2? labels?
export const RE_AREA =
  /^\s*area(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?\s*$/i;

// scatter <<stereo>>? "name"? [data] #color? v2? labels? <<marker>>?
export const RE_SCATTER =
  /^\s*scatter(?:\s+(<<[^>]+>>))?(?:\s+"([^"]+)")?\s+\[([^\]]*)\](?:\s+#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}|\w+))?(?:\s+([vy]2))?(?:\s+(labels))?(?:\s+<<(circle|square|triangle)>>)?\s*$/i;

// legend left|right|top|bottom
export const RE_LEGEND = /^\s*legend\s+(left|right|top|bottom)\s*$/i;

// stackMode grouped|stacked
export const RE_STACKMODE = /^\s*stackMode\s+(grouped|stacked)\s*$/i;

// orientation vertical|horizontal
export const RE_ORIENTATION = /^\s*orientation\s+(vertical|horizontal)\s*$/i;

// annotation "text" at (xPos, yPos) <<arrow>>?
export const RE_ANNOTATION =
  /^\s*annotation\s+"([^"]+)"\s+at\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)(?:\s+<<(arrow)>>)?\s*$/i;

// grid h-axis|v-axis (standalone)
export const RE_GRID = /^\s*grid\s+([hx]-axis|[vy]-axis)\s*$/i;

// ---------------------------------------------------------------------------
// Default axis factory
// ---------------------------------------------------------------------------

export function makeAxis(): ChartAxisDef {
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

export function includeValue(axis: ChartAxisDef, value: number): void {
  if (!axis.autoScale) return;
  if (value < axis.min) axis.min = value;
  if (value > axis.max) axis.max = value;
}

// ---------------------------------------------------------------------------
// Helper: parse comma-separated labels from a bracket content string.
// Strips surrounding quotes from each label.
// ---------------------------------------------------------------------------

export function parseLabels(data: string): string[] {
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

export function parseCustomTicks(ticksStr: string): Map<number, string> | null {
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

export function parseCoordinatePairs(
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

export function parseYValues(data: string): number[] | null {
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

export function stereoToMarker(stereo: string | undefined): MarkerShape {
  if (stereo === undefined) return 'circle';
  const inner = stereo.replace(/^<<\s*/, '').replace(/\s*>>$/, '').toLowerCase();
  if (inner === 'square') return 'square';
  if (inner === 'triangle') return 'triangle';
  return 'circle';
}

// ---------------------------------------------------------------------------
// Helper: validate and add a series to the AST (mirrors Java addSeries)
// ---------------------------------------------------------------------------

export function addSeries(
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
