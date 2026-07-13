import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import type { BoardDiagramAST, BoardActivity, BoardNode } from './ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

/** Counts a leading run of `+` characters (the node's nesting depth). */
function countLeadingPlus(t: string): number {
  let plusCount = 0;
  while (plusCount < t.length && t[plusCount] === '+') plusCount++;
  return plusCount;
}

/** Inserts one `+`-prefixed board node: a new root activity when
 *  `plusCount === 0`, otherwise a child of the deepest stack entry whose
 *  `stage` is less than `plusCount`. Mutates `activities`/`stack` in place. */
function insertBoardNode(
  activities: BoardActivity[],
  stack: BoardNode[],
  plusCount: number,
  label: string,
): void {
  if (plusCount === 0) {
    const root: BoardNode = { name: label, stage: 0, children: [] };
    activities.push({ name: label, root });
    stack.length = 0;
    stack.push(root);
    return;
  }
  if (stack.length === 0) return;
  const newNode: BoardNode = { name: label, stage: plusCount, children: [] };
  while (stack.length > 1 && stack[stack.length - 1]!.stage >= plusCount) {
    stack.pop();
  }
  stack[stack.length - 1]!.children.push(newNode);
  stack.push(newNode);
}

export function parseBoard(source: UmlSource): BoardDiagramAST {
  const activities: BoardActivity[] = [];
  const stack: BoardNode[] = [];
  const annotations = createAnnotations();
  const lines = source.lines;

  for (let i = 0; i < lines.length; ) {
    const t = lines[i]!.trim();
    if (t === '') {
      i++;
      continue;
    }
    if (/^@startboard\s*$/i.test(t) || /^@endboard\s*$/i.test(t)) {
      i++;
      continue;
    }

    // title/caption/legend/header/footer/mainframe (mission G0b/T6): tried
    // BEFORE the `+`-prefix node grammar below, mirroring upstream
    // CommonCommands being registered first — board has no other "ignore"
    // mechanism, so without this every chrome directive would otherwise be
    // misread as a board activity/node label.
    const annotationMatch = matchAnnotationCommand(lines, i, annotations);
    if (annotationMatch !== null) {
      i += annotationMatch.consumed;
      continue;
    }

    const plusCount = countLeadingPlus(t);
    const label = t.slice(plusCount).trim();
    if (label !== '') insertBoardNode(activities, stack, plusCount, label);
    i++;
  }

  return { activities, annotations };
}
