/**
 * Skinparam resolution pipeline for plantuml-js.
 *
 * Provides two public entry points:
 *   - resolveSkinparam: maps a raw skinparam map onto a Theme
 *   - parseStyleBlock: converts the content of a <style> block into a
 *     skinparam-compatible map
 *
 * Key normalisation follows SkinParam.cleanForKeySlow in upstream
 * SkinParam.java, which is NOT a simple toLowerCase(). The exact sequence
 * is preserved here so that keys like "classArrowColor",
 * "sequenceArrowColor", and "arrowColor" all normalise to "arrowcolor".
 */

import { deepMergeTheme } from './theme.js';
import type { Theme } from './theme.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SkinparamResult {
  theme: Theme;
  unknown: string[];
}

// ---------------------------------------------------------------------------
// Key normalisation — mirrors SkinParam.cleanForKeySlow
// ---------------------------------------------------------------------------

/**
 * Normalise a raw skinparam key to its canonical lowercase form.
 *
 * Ported from SkinParam.java:cleanForKeySlow. The sequence matters:
 *  1. Trim whitespace and convert to lowercase
 *  2. Strip underscores and dots (so "class_background_color" == "classbackgroundcolor")
 *  3. Collapse "sequenceparticipant" / "sequenceactor" prefixes to plain
 *     "participant" / "actor" (upstream stores these without the "sequence" prefix)
 *  4. Collapse diagram-type arrow prefixes — activityarrow, classarrow,
 *     componentarrow, objectarrow, sequencearrow, statearrow, usecasearrow —
 *     all become plain "arrow" so they share one slot in the mapping table
 *  5. Normalise "align" suffix to "alignment"
 */
function normaliseKey(raw: string): string {
  let key = raw.trim().toLowerCase();
  // Step 1: strip underscores and dots
  key = key.replace(/[_.]/g, '');
  // Step 2: collapse sequenceparticipant / sequenceactor prefix
  key = key.replace(/sequence(participant|actor)/g, '$1');
  // Step 3: collapse diagram-type arrow prefixes to plain "arrow"
  key = key.replace(
    /(?:activity|class|component|object|sequence|state|usecase)arrow/g,
    'arrow',
  );
  // Step 4: normalise "align" suffix to "alignment"
  key = key.replace(/align$/, 'alignment');
  return key;
}

// ---------------------------------------------------------------------------
// resolveSkinparam
// ---------------------------------------------------------------------------

/**
 * Map a raw skinparam key→value map onto a Theme, returning both the merged
 * Theme and a list of any keys that could not be mapped.
 *
 * The caller supplies a `base` Theme; matched keys are merged on top via
 * deepMergeTheme. Unmatched keys and stereotype-qualified keys (containing
 * "<<") are collected in `unknown[]` — they do not cause errors.
 *
 * Key normalisation follows SkinParam.cleanForKeySlow (see normaliseKey).
 */
export function resolveSkinparam(
  skinparams: ReadonlyMap<string, string>,
  base: Theme,
): SkinparamResult {
  const unknown: string[] = [];

  // Accumulate partial overrides; only populate what we actually see.
  let fontFamily: string | undefined;
  let fontSize: number | undefined;
  let background: string | undefined;
  let border: string | undefined;
  let text: string | undefined;
  let arrow: string | undefined;
  let noteBackground: string | undefined;
  let classBackground: string | undefined;
  let interfaceBackground: string | undefined;
  let enumBackground: string | undefined;
  let actorStroke: string | undefined;
  let packageBackground: string | undefined;
  let packageBorder: string | undefined;

  for (const [rawKey, value] of skinparams) {
    // Stereotype-qualified keys are unsupported — Theme has no stereotype concept.
    if (rawKey.includes('<<')) {
      unknown.push(normaliseKey(rawKey));
      continue;
    }

    const key = normaliseKey(rawKey);

    switch (key) {
      case 'backgroundcolor':
        background = value;
        break;
      case 'bordercolor':
        border = value;
        break;
      case 'fontcolor':
      case 'defaultfontcolor':
        text = value;
        break;
      case 'arrowcolor':
      case 'defaultarrowcolor':
        arrow = value;
        break;
      case 'notebackgroundcolor':
        noteBackground = value;
        break;
      case 'fontname':
      case 'defaultfontname':
        fontFamily = value;
        break;
      case 'fontsize':
      case 'defaultfontsize':
        fontSize = Number(value);
        break;
      case 'classbackgroundcolor':
        classBackground = value;
        break;
      case 'interfacebackgroundcolor':
        interfaceBackground = value;
        break;
      case 'enumbackgroundcolor':
        enumBackground = value;
        break;
      case 'actorbordercolor':
        actorStroke = value;
        break;
      case 'packagebackgroundcolor':
        packageBackground = value;
        break;
      case 'packagebordercolor':
        packageBorder = value;
        break;
      default:
        unknown.push(key);
    }
  }

  // Build a Partial<Theme> only for the keys that were actually seen.
  const hasGraphOverride =
    classBackground !== undefined ||
    interfaceBackground !== undefined ||
    enumBackground !== undefined ||
    actorStroke !== undefined ||
    packageBackground !== undefined ||
    packageBorder !== undefined;

  const hasColorsOverride =
    background !== undefined ||
    border !== undefined ||
    text !== undefined ||
    arrow !== undefined ||
    noteBackground !== undefined ||
    hasGraphOverride;

  const partial: Partial<Theme> = {};

  if (fontFamily !== undefined) partial.fontFamily = fontFamily;
  if (fontSize !== undefined) partial.fontSize = fontSize;

  if (hasColorsOverride) {
    const graphOverride: Partial<Theme['colors']['graph']> = {};
    if (classBackground !== undefined) graphOverride.classBackground = classBackground;
    if (interfaceBackground !== undefined)
      graphOverride.interfaceBackground = interfaceBackground;
    if (enumBackground !== undefined) graphOverride.enumBackground = enumBackground;
    if (actorStroke !== undefined) graphOverride.actorStroke = actorStroke;
    if (packageBackground !== undefined) graphOverride.packageBackground = packageBackground;
    if (packageBorder !== undefined) graphOverride.packageBorder = packageBorder;

    const colorsOverride: Partial<Theme['colors']> = {};
    if (background !== undefined) colorsOverride.background = background;
    if (border !== undefined) colorsOverride.border = border;
    if (text !== undefined) colorsOverride.text = text;
    if (arrow !== undefined) colorsOverride.arrow = arrow;
    if (noteBackground !== undefined) colorsOverride.noteBackground = noteBackground;
    if (hasGraphOverride) {
      colorsOverride.graph = graphOverride as Theme['colors']['graph'];
    }

    partial.colors = colorsOverride as Theme['colors'];
  }

  const theme = deepMergeTheme(base, partial);
  return { theme, unknown };
}

// ---------------------------------------------------------------------------
// parseStyleBlock
// ---------------------------------------------------------------------------

/**
 * Parse the raw string content of a single `<style>` block into a
 * skinparam-compatible key→value map.
 *
 * The input must NOT include the surrounding `<style>` / `</style>` tags —
 * those are stripped by the preprocessor before calling this function.
 *
 * Algorithm (matches upstream style block parsing):
 *  1. Split on newlines; strip any trailing \r from each line (CRLF support)
 *  2. Skip lines that open a selector block: /^\s*[\w.#*\[: -]+\s*\{/
 *  3. Skip lines that close a block: /^\s*\}\s*$/
 *  4. For the remaining lines, attempt to match /^\s*([\w-]+)\s*:\s*(.+)$/
 *     — key becomes match[1].toLowerCase(), value is match[2].trim()
 *  5. All other lines are silently skipped
 *
 * Returns a Map<string, string> that can be passed directly to resolveSkinparam.
 */
export function parseStyleBlock(raw: string): Map<string, string> {
  const result = new Map<string, string>();
  if (raw.length === 0) return result;

  const selectorOpen = /^\s*[\w.#*\[: -]+\s*\{/;
  const blockClose = /^\s*\}\s*$/;
  const declaration = /^\s*([\w-]+)\s*:\s*(.+)$/;

  for (const rawLine of raw.split('\n')) {
    // Strip trailing \r so that CRLF line endings are handled cleanly.
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (selectorOpen.test(line)) continue;
    if (blockClose.test(line)) continue;
    const m = declaration.exec(line);
    if (m !== null) {
      // m[1] and m[2] are guaranteed non-null by the capture groups in `declaration`.
      result.set(m[1]!.toLowerCase(), m[2]!.trim());
    }
    // Lines matching none of the above are silently skipped
  }

  return result;
}
