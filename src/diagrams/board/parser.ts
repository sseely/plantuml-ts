import type { BoardDiagramAST, BoardActivity, BoardNode } from './ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

export function parseBoard(source: UmlSource): BoardDiagramAST {
  const activities: BoardActivity[] = [];
  const stack: BoardNode[] = [];

  for (const line of source.lines) {
    const t = line.trim();
    if (t === '') continue;
    if (/^@startboard\s*$/i.test(t) || /^@endboard\s*$/i.test(t)) continue;

    let plusCount = 0;
    while (plusCount < t.length && t[plusCount] === '+') plusCount++;
    const label = t.slice(plusCount).trim();
    if (label === '') continue;

    if (plusCount === 0) {
      const root: BoardNode = { name: label, stage: 0, children: [] };
      activities.push({ name: label, root });
      stack.length = 0;
      stack.push(root);
    } else if (stack.length > 0) {
      const newNode: BoardNode = { name: label, stage: plusCount, children: [] };
      while (stack.length > 1 && stack[stack.length - 1]!.stage >= plusCount) {
        stack.pop();
      }
      stack[stack.length - 1]!.children.push(newNode);
      stack.push(newNode);
    }
  }

  return { activities };
}
