/**
 * Class diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { SyncPlugin } from '../../core/dispatcher.js';
import type { ClassDiagramAST } from './ast.js';
import type { ClassGeometry } from './layout.js';
import { classAccepts } from './class-dispatch.js';
import { parseClass } from './parser.js';
import { layoutClass } from './layout.js';
import { renderClass } from './renderer.js';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const classPlugin: SyncPlugin<ClassDiagramAST, ClassGeometry> = {
  type: 'class',

  // Class-vs-description routing mirrors upstream's factory-selection outcome
  // (ClassDiagramFactory is tried before DescriptionDiagramFactory; the class
  // factory owns mixed class+descriptive blocks under `allowmixing` and any
  // block of native class constructs). See class-dispatch.ts (mission A3 ADR-2).
  accepts: classAccepts,

  parse(block) {
    return parseClass(block);
  },

  layoutSync(ast, theme, measurer) {
    return layoutClass(ast, theme, measurer);
  },

  render(geo, theme) {
    return renderClass(geo, theme);
  },
};
