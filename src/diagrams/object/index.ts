/**
 * Object diagram plugin — wires together parser, class layout, and class renderer
 * for use with the DiagramRegistry dispatcher.
 *
 * Object diagrams share the class diagram layout and renderer. Only the parser
 * differs: object instances use "field = value" members instead of typed methods.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ClassDiagramAST } from '../class/ast.js';
import type { ClassGeometry } from '../class/layout.js';
import { parseObject } from './parser.js';
import { layoutClass } from '../class/layout.js';
import { renderClass } from '../class/renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

// `object` must be followed by a token that can start nameAndCode()
// (CODE = [^%s{}%g<>]+, or a quoted DISPLAY) — CommandCreateEntityObject
// (objectdiagram/command/CommandCreateEntityObject.java:71-80,
// command/NameAndCodeParser.java:46-49). Without the name-start guard, a
// class-diagram relationship line like `Object <|-- Foo` (class named
// Object) false-triggers object dispatch. Keyword stays case-insensitive
// (upstream compiles commands with Pattern.CASE_INSENSITIVE,
// regex/Pattern2.java:114).
const OBJECT_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^object\s+[^\s{}<>]/i,
  /^object\s*$/i,
];

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const objectPlugin: SyncPlugin<ClassDiagramAST, ClassGeometry> = {
  type: 'object',

  accepts(lines: readonly string[]): boolean {
    return lines
      .slice(0, 20)
      .some((l) => OBJECT_ACCEPTS_PATTERNS.some((p) => p.test(l.trim())));
  },

  parse(block) {
    return parseObject(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutClass(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderClass(geo, theme);
  },
};
