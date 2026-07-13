/**
 * Sequence diagram plugin — wires together parser, layout, and renderer
 * for use with the DiagramRegistry dispatcher.
 */

import type { DiagramPlugin, RenderFragment } from '../../core/dispatcher.js';
import type { UmlSource } from '../../core/block-extractor.js';
import type { SequenceDiagramAST, SequenceGeometry } from './ast.js';
import { hasDescriptiveSignal } from '../../core/descriptive-keywords.js';
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
      // Upstream's sequence factory fails on descriptive element lines, so the
      // description factory claims use-case/deployment blocks even when they
      // contain a bare `actor`. Decline anything with a descriptive signal
      // (e.g. `actor Bob` + `(Login)`) before the arrow/actor patterns match.
      if (hasDescriptiveSignal(lines)) return false;
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

    render(geo: SequenceGeometry, theme): RenderFragment {
      return renderSequence(geo, theme);
    },
  };
