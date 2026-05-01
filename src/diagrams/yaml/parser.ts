import type { JsonDiagramAST } from '../json/ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

export function parseYaml(_source: UmlSource): JsonDiagramAST {
  return { root: null, parseError: false, highlights: [] };
}
