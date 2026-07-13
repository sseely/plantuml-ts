import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { HighlightDirective, JsonDiagramAST } from '../json/ast.js';
import type { UmlSource } from '../../core/block-extractor.js';
import { parseYamlLines } from './yaml-parser.js';
import { monomorphToJson } from './monomorph.js';

/**
 * Parse a single `#highlight` directive line into a HighlightDirective.
 *
 * Port of Highlighted.build() / Highlighted.toList() from
 * net.sourceforge.plantuml.yaml.Highlighted.
 *
 * Algorithm:
 *   1. Strip `#highlight ` prefix
 *   2. Capture and strip optional trailing `<<stereotype>>` via regex
 *   3. Split by `/`, trim each segment, strip surrounding double-quotes
 */
function parseYamlHighlightLine(line: string): HighlightDirective {
  // Strip "#highlight " prefix (11 chars)
  let rest = line.slice('#highlight '.length).trim();

  // Capture optional trailing <<stereotype>>
  const stereotypeMatch = /\s*<<([^<>]*)>>\s*$/.exec(rest);
  const styleClass = stereotypeMatch ? stereotypeMatch[1]!.trim().toLowerCase() : '';
  rest = stereotypeMatch ? rest.slice(0, rest.length - stereotypeMatch[0].length).trim() : rest;

  // Split on "/" and clean each segment
  const path = rest.split('/').map((segment) => {
    const s = segment.trim();
    // Strip surrounding double-quotes if present
    if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
      return s.slice(1, -1);
    }
    return s;
  });

  return { path, styleClass };
}

/** True for anything shaped like a `title` directive (single-line or the
 *  bare multiline opener) — kept OUT of the shared annotation matcher below
 *  so title parsing stays on its existing bespoke path, unchanged, per the
 *  T6 spec (T8 migrates yaml's title to shared chrome; two mechanisms must
 *  not both consume `title` in the interim). */
function isTitleShapedLine(t: string): boolean {
  return /^title\b/i.test(t);
}

/** Tries the shared annotation matcher for a pre-body, non-title line.
 *  Returns the new loop index when consumed, or `null` when not
 *  applicable (body already started, or the line is title-shaped). */
function tryAnnotationDirective(
  lines: readonly string[],
  i: number,
  bodyStarted: boolean,
  trimmed: string,
  annotations: DiagramAnnotations,
): number | null {
  if (bodyStarted || isTitleShapedLine(trimmed)) return null;
  const match = matchAnnotationCommand(lines, i, annotations);
  return match !== null ? i + match.consumed - 1 : null;
}

export function parseYaml(source: UmlSource): JsonDiagramAST {
  const highlights: HighlightDirective[] = [];
  const bodyLines: string[] = [];
  let title: string | undefined;
  let inStyleBlock = false;
  const annotations = createAnnotations();
  const lines = source.lines;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();

    // Strip @startyaml/@endyaml wrapper lines (block-extractor usually strips
    // these but be defensive — the source.lines may or may not include them)
    if (/^@startyaml\s*$/i.test(t) || /^@endyaml\s*$/i.test(t)) continue;

    // <style> blocks stripped before YAML parsing
    if (t === '<style>') { inStyleBlock = true; continue; }
    if (inStyleBlock) { if (t === '</style>') inStyleBlock = false; continue; }

    // #highlight lines — extract before YAML body
    if (t.startsWith('#highlight ')) {
      highlights.push(parseYamlHighlightLine(t));
      continue;
    }

    // caption/legend/header/footer/mainframe (mission G0b/T6) — same
    // before-body-only scope as the directive strip below; title is
    // excluded so it keeps flowing through the bespoke branch there.
    const annotationI = tryAnnotationDirective(lines, i, bodyLines.length !== 0, t, annotations);
    if (annotationI !== null) {
      i = annotationI;
      continue;
    }

    // Directive lines before YAML body (only skip if no body lines yet)
    if (bodyLines.length === 0) {
      if (/^title\s+/i.test(t)) {
        title = t.replace(/^title\s+/i, '').trim();
        continue;
      }
      if (/^(?:skinparam|scale|skin|hide|!assume|!pragma)\s/i.test(t)) continue;
    }

    // Skip leading blank lines, but include blank lines within the body
    if (t === '') {
      if (bodyLines.length > 0) bodyLines.push(line);
      continue;
    }

    bodyLines.push(line);
  }

  let root: unknown = null;
  try {
    if (bodyLines.some((l) => l.trim() !== '')) {
      const monomorph = parseYamlLines(bodyLines);
      root = monomorphToJson(monomorph);
    }
  } catch {
    // parse errors: root stays null
  }

  // #lizard forgives -- pre-existing faithful port of the YAML diagram
  // entry point (already over threshold before mission G0b/T6 added the
  // annotation-matcher check above).
  return title !== undefined
    ? { root, parseError: false, highlights, title, annotations }
    : { root, parseError: false, highlights, annotations };
}
