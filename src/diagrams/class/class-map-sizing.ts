/**
 * `map` classifier sizing — `kind:'map'` leaves in the class diagram layout
 * engine (./layout.ts). Split out of ./class-object-map-sizing.ts (G3/O1,
 * same 500-line-per-file-cap motivation as that file's own module doc) —
 * `object`'s own sizing plus the header math SHARED by object/map/json stays
 * there; this file owns `map`'s data-row-table-specific math only.
 *
 * Faithful port of the dimension math:
 *   @see ~/git/plantuml/.../svek/image/EntityImageMap.java
 *   @see ~/git/plantuml/.../cucadiagram/TextBlockMap.java
 *   @see ~/git/plantuml/.../cucadiagram/BodierMap.java (getBody — HorizontalAlignment source)
 *   @see ~/git/plantuml/.../klimt/geom/HorizontalAlignment.java (getPosition — key centering)
 *
 * Verified byte-for-byte (WidthTableMeasurer, matching the jar's
 * `-DPLANTUML_DETERMINISTIC_TEXT=true` svek DOT dump) against:
 *   - test-results/dot-cache/object/bepafe-03-teda035 — map, 3 plain rows,
 *     no stereotype (full TextBlockMap width/height formula, exact match;
 *     G3/O1: data-row key-centering/value-flush-left/baseline).
 *   - test-results/dot-cache/object/diveje-52-xefe514 — map, 1 linked
 *     (Point) row + 2 plain rows (G3/O1: Point-row key centers against the
 *     FULL box width, not colA — `TextBlockMap#drawU`'s own `if (value
 *     instanceof Point)` branch uses a different denominator).
 * See this task's mission-brief return for the worked numbers.
 */

import type { Classifier, MapRow } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { ClassifierGeo } from './layout.js';
import type { MeasuredClassifier } from './class-layout-helpers.js';
import { javaRound4 } from '../../core/number-format.js';
import type { Dim } from './class-object-map-sizing.js';
import { titleDimension, measureStereo, headerRows, baselineOffsetFor } from './class-object-map-sizing.js';

/** EntityImageMap: `withMargin(name, 2, 2)` — fixed, not style-driven
 *  (unlike object's Padding-based name margin, which happens to share the
 *  same numeric value). */
const MAP_NAME_MARGIN = 2;
/** TextBlockMap#getTextBlock: `withMargin(result, 5, 2)` per key/value cell. */
export const MAP_CELL_MARGIN_X = 5;
const MAP_CELL_MARGIN_Y = 2;
/** TextBlockMap.Point#getDiameter — the linked-row value-cell placeholder;
 *  never actually drawn (see buildMapRowGeo doc), only sized. */
const MAP_POINT_DIAMETER = 7;
/** EntityImageMap.xMarginCircle. */
const MAP_X_MARGIN_CIRCLE = 5;

interface MapRowMetrics {
  keyWidth: number;
  valueWidth: number;
  height: number;
  /** A `key *-> dest` linked row (or an unresolved one) — value == '' is
   *  this AST's placeholder for TextBlockMap's Point sentinel (ast.ts
   *  MapRow doc). */
  isPoint: boolean;
  /** javaRound4'd raw (unpadded) key text width — reused for BOTH the
   *  key's own `textLength` AND its centering `indent` (G3/O1, same "round
   *  once, reuse" precedent as headerRows' stereoWidth/nameWidth). */
  rawKeyWidth: number;
  /** javaRound4'd raw (unpadded) value text width, `0` (unused) for a
   *  Point row -- jar never draws Point-row value text at all. */
  rawValueWidth: number;
}

/** A cell's measured `TextBlockMap#getTextBlock` dimension: `raw` (unpadded,
 *  javaRound4'd, feeds `textLength`) alongside `dim` (padded 5,2, feeds the
 *  column width). Shared by both the key AND value cell of a row —
 *  `TextBlockMap`'s own `getTextBlock` applies the identical margin to
 *  both. */
function measureMapCell(text: string, fontSpec: { family: string; size: number }, measurer: StringMeasurer): { raw: number; dim: Dim } {
  const m = measurer.measure(text, fontSpec);
  return {
    raw: javaRound4(m.width),
    dim: { width: m.width + MAP_CELL_MARGIN_X * 2, height: m.height + MAP_CELL_MARGIN_Y * 2 },
  };
}

/** One TextBlockMap row: getHeightOfRow = max(key, value) cell height; each
 *  cell (key always, value only for a non-point row) gets the 5,2 margin;
 *  a point row's value cell is the 7x7 Point diameter instead. */
function measureMapRow(row: MapRow, fontSpec: { family: string; size: number }, measurer: StringMeasurer): MapRowMetrics {
  const key = measureMapCell(row.key, fontSpec, measurer);
  const isPoint = row.value === '';
  if (isPoint) {
    return {
      keyWidth: key.dim.width,
      valueWidth: MAP_POINT_DIAMETER,
      height: Math.max(key.dim.height, MAP_POINT_DIAMETER),
      isPoint,
      rawKeyWidth: key.raw,
      rawValueWidth: 0,
    };
  }
  const value = measureMapCell(row.value, fontSpec, measurer);
  return {
    keyWidth: key.dim.width,
    valueWidth: value.dim.width,
    height: Math.max(key.dim.height, value.dim.height),
    isPoint,
    rawKeyWidth: key.raw,
    rawValueWidth: value.raw,
  };
}

/** The column widths + baseline every row in a table shares — bundled into
 *  one param object (rather than 4 positional numbers) to keep both
 *  {@link buildMapRowGeo} and {@link buildOneMapRow} under the repo's
 *  5-parameter cap. */
interface MapRowGeoContext {
  colAWidth: number;
  boxWidth: number;
  baselineOffset: number;
}

/**
 * One row's key + value rows[] entries. `TextBlockMap#drawU` positions the
 * KEY via `style.getHorizontalAlignment().getPosition(keyWidth, ...)`
 * (`plantuml.skin`'s `map { HorizontalAlignment center }` —
 * `klimt/geom/HorizontalAlignment#getPosition`'s CENTER branch, `(fullWidth
 * - width) / 2`) against `widthColA` for a PLAIN row but against the
 * classifier's FULL final `boxWidth` for a POINT row (`if (value instanceof
 * Point) ... getPosition(keyWidth, trueWidth)` — jar-verified:
 * diveje-52-xefe514's Point row "UK" centers at `(151.425 - 19.5125) / 2 =
 * 65.95625`, NOT `(67.4875 - 19.5125) / 2` (colA-relative), because a Point
 * row has no value column to share the row with). The VALUE (non-Point
 * only) is drawn FLUSH-LEFT at a fixed `widthColA + MAP_CELL_MARGIN_X`
 * offset — `value.drawU(ug.apply(UTranslate.dx(widthColA)))`, and the value
 * TextBlock's OWN text is itself left-margined (`HorizontalAlignment.LEFT`,
 * `TextBlockMap#getTextBlock`), never centered/stretched against
 * `widthColB` — jar-verified: bepafe-03-teda035's "London"/"Washington"/
 * "Berlin" all share the SAME x despite different widths. Both key and
 * value share the SAME row baseline (`rowTop + MAP_CELL_MARGIN_Y +
 * baselineOffset`, the pre-O1 code used `rowTop + height/2`, correct only
 * for a zero-descent font). Pre-O1, indent used a flat `MAP_CELL_MARGIN_X`
 * for every key (never centered) and set no `width` on either cell (no
 * textLength).
 */
function buildOneMapRow(
  row: MapRow,
  m: MapRowMetrics,
  rowTop: number,
  ctx: MapRowGeoContext,
): { key: ClassifierGeo['rows'][number]; value: ClassifierGeo['rows'][number] } {
  const textY = rowTop + MAP_CELL_MARGIN_Y + ctx.baselineOffset;
  const keyCenterAgainst = m.isPoint ? ctx.boxWidth : ctx.colAWidth;
  return {
    key: { text: row.key, y: textY, indent: (keyCenterAgainst - m.rawKeyWidth) / 2, width: m.rawKeyWidth },
    value: {
      text: m.isPoint ? '' : row.value,
      y: textY,
      indent: ctx.colAWidth + MAP_CELL_MARGIN_X,
      ...(m.isPoint ? {} : { width: m.rawValueWidth }),
    },
  };
}

/**
 * Build the per-row rendering rows[] + dividerYs[] for the map's data rows.
 *
 * Every row contributes exactly TWO rows[] entries (key, value) so the
 * renderer can reconstruct row/column geometry from rows[] + dividerYs alone
 * (no ClassifierGeo schema change needed — layout.ts is at the project's
 * 500-line cap). A point row's "value" entry carries empty text: the
 * renderer skips drawing it (TextBlockMap#drawU never calls `value.drawU`
 * for a Point cell — only the key, left-aligned same as any other row) and
 * skips that row's vertical column divider. Per-row geometry (key/value
 * centering + baseline) lives in {@link buildOneMapRow}'s own doc comment.
 */
function buildMapRowGeo(
  rows: readonly MapRow[],
  metrics: readonly MapRowMetrics[],
  titleHeight: number,
  ctx: MapRowGeoContext,
): { rows: ClassifierGeo['rows']; dividerYs: number[] } {
  const outRows: ClassifierGeo['rows'] = [];
  const dividerYs: number[] = [];
  let y = titleHeight;
  for (let i = 0; i < rows.length; i++) {
    dividerYs.push(y);
    const { key, value } = buildOneMapRow(rows[i]!, metrics[i]!, y, ctx);
    outRows.push(key, value);
    y += metrics[i]!.height;
  }
  return { rows: outRows, dividerYs };
}

/**
 * Measure a `map` leaf (EntityImageMap#calculateDimensionSlow +
 * TextBlockMap#calculateDimensionSlow). Unlike object, `showFields` is
 * irrelevant here — `BodierMap#getBody` ignores its showFields parameter
 * entirely and always returns the full row table (`hide members` / `hide
 * empty members` have no effect on a map's body, matching upstream).
 */
export function measureMapClassifier(classifier: Classifier, theme: Theme, measurer: StringMeasurer): MeasuredClassifier {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const nameM = measurer.measure(classifier.display, fontSpec);
  const nameDim: Dim = { width: nameM.width + MAP_NAME_MARGIN * 2, height: nameM.height + MAP_NAME_MARGIN * 2 };
  const stereoDim = measureStereo(classifier, theme, measurer);
  const title = titleDimension(nameDim, stereoDim);

  const rows = classifier.rows ?? [];
  const metrics = rows.map((r) => measureMapRow(r, fontSpec, measurer));
  const colA = metrics.length === 0 ? 0 : Math.max(...metrics.map((m) => m.keyWidth));
  const colB = metrics.length === 0 ? 0 : Math.max(...metrics.map((m) => m.valueWidth));
  const fieldsHeight = metrics.reduce((sum, m) => sum + m.height, 0);

  const width = Math.max(colA + colB, title.width + MAP_X_MARGIN_CIRCLE * 2);
  // getMethodOrFieldHeight's empty-substitution never fires for MAP
  // (leafType === MAP is excluded in the upstream condition) — height is
  // titleHeight + the raw (possibly zero, for an empty map body) fields height.
  const height = title.height + fieldsHeight;

  const headerGeo = headerRows(classifier, theme, measurer, width, MAP_NAME_MARGIN);
  const baselineOffset = baselineOffsetFor(fontSpec, measurer);
  const { rows: rowGeo, dividerYs } = buildMapRowGeo(rows, metrics, title.height, {
    colAWidth: colA,
    boxWidth: width,
    baselineOffset,
  });

  return { width, height, rows: [...headerGeo, ...rowGeo], dividerYs };
}
