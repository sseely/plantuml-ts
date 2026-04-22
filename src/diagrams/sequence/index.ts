/**
 * Sequence diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { DiagramPlugin } from '../../core/dispatcher.js';
import type { UmlSource } from '../../core/block-extractor.js';
import type { SequenceDiagramAST, SequenceGeometry } from './ast.js';
import { parseSequence } from './parser.js';
import { layoutSequence } from './layout.js';
import { renderSequence } from './renderer.js';

// ---------------------------------------------------------------------------
// Accepts heuristics
// ---------------------------------------------------------------------------

/** Patterns that appear in sequence diagrams but not other diagram types. */
const SEQUENCE_PATTERNS: readonly RegExp[] = [
  /->>?|-->>?/,
  /^(participant|actor|boundary|control|entity|database|collections|queue)\s/,
];

function isSequenceLine(line: string): boolean {
  return SEQUENCE_PATTERNS.some((p) => p.test(line));
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const sequencePlugin: DiagramPlugin<SequenceDiagramAST, SequenceGeometry> =
  {
    type: 'sequence',

    accepts(lines: readonly string[]): boolean {
      return lines.slice(0, 20).some((l) => isSequenceLine(l));
    },

    parse(source: UmlSource): SequenceDiagramAST {
      return parseSequence(source.lines);
    },

    layout(
      ast: SequenceDiagramAST,
      theme,
      measurer,
    ): Promise<SequenceGeometry> {
      return Promise.resolve(layoutSequence(ast, theme, measurer));
    },

    layoutSync(
      ast: SequenceDiagramAST,
      theme,
      measurer,
    ): SequenceGeometry {
      return layoutSequence(ast, theme, measurer);
    },

    render(geo: SequenceGeometry, theme): string {
      return renderSequence(geo, theme);
    },
  };
