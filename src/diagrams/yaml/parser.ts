import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
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

export function parseYaml(source: UmlSource): JsonDiagramAST {
  const highlights: HighlightDirective[] = [];
  const bodyLines: string[] = [];
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

    // title/caption/legend/header/footer/mainframe (mission G0b/T8) — same
    // before-body-only scope as the directive strip below. Title used to be
    // excluded here and captured into a bespoke `title` field (T6); T8
    // migrated it onto `annotations.title` like the other five (json's
    // migration covers yaml since both share JsonDiagramAST/layoutJson).
    if (bodyLines.length === 0) {
      const annotationMatch = matchAnnotationCommand(lines, i, annotations);
      if (annotationMatch !== null) {
        i += annotationMatch.consumed - 1;
        continue;
      }
    }

    // Directive lines before YAML body (only skip if no body lines yet).
    // `title ` no longer reaches here (consumed by the matcher above).
    if (bodyLines.length === 0) {
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
  // annotation-matcher check; T8 removed the bespoke title field/branch but
  // did not reduce the function below threshold).
  return { root, parseError: false, highlights, annotations };
}
