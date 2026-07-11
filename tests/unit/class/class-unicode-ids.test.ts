/**
 * Unicode identifiers in relationship endpoints — upstream
 * `CommandLinkClass.getClassIdentifier()` is `[%pLN_$]+` with dotted
 * segments, where `%pLN` expands to Unicode `\p{L}\p{N}`
 * (regex/Pattern2.java:56), NOT ASCII `\w`. Pinned by Phase L iteration 1
 * of mission object-dot-sync (fixtures beleso-08-ruca459 /
 * fikojo-87-tine499 / sarepa-89-cevi460: `bamboo <-- <unicode-id>` lost
 * its edge).
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java#getClassIdentifier
 * @see ~/git/plantuml/.../regex/Pattern2.java:56 (%pLN)
 */

import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('unicode relationship endpoints (CommandLinkClass %pLN)', () => {
  it('parses a Kannada endpoint (beleso-08-ruca459 shape)', () => {
    const ast = parse('object "Kannada : bambu" as ಬಬ\nobject bamboo\nbamboo <-- ಬಬ');
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['bamboo', 'ಬಬ']);
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.from).toBe('ಬಬ');
    expect(ast.relationships[0]!.to).toBe('bamboo');
  });

  it('parses a CJK endpoint (fikojo-87-tine499 shape)', () => {
    const ast = parse('object "Kannada : bambu" as 概要\nobject bamboo\nbamboo <-- 概要');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.from).toBe('概要');
  });

  it('accepts $ in identifier atoms per upstream [%pLN_$]', () => {
    const ast = parse('class $conf\nclass B\n$conf --> B');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.from).toBe('$conf');
  });

  it('still parses plain-ASCII dotted endpoints (regression guard)', () => {
    const ast = parse('class a.B\nclass C\na.B <|-- C');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.type).toBe('extension');
  });

  it('unicode endpoint with member port suffix', () => {
    const ast = parse('class 概要\nclass B\n概要::メンバ --> B');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.fromPort).toBe('メンバ');
  });
});
