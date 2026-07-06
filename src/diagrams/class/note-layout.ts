/**
 * Note-on-entity layout for class diagrams.
 *
 * PlantUML's Svek lays a `note <pos> of <Entity>` out as its own graphviz node
 * connected to the host by a plain connector edge. This module measures notes,
 * contributes the seam node + connector edge, and maps the layout result back
 * to NoteGeo for the renderer. Kept separate from layout.ts so the note feature
 * doesn't grow that already-large module.
 */
import type { ClassNote, NotePosition } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type {
  DotInputNode,
  DotInputEdge,
  DotLayoutResult,
} from '../../core/graph-layout.js';

export interface NoteGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Note body split into render lines. */
  lines: string[];
  /** Routed connector points from the note to its host classifier. */
  connector: Array<{ x: number; y: number }>;
}

const NOTE_HPAD = 8;
const NOTE_VPAD = 6;
const NOTE_FOLD = 10; // folded-corner allowance

/** Edge direction + minlen per note position (Svek note-on-entity). */
const NOTE_EDGE: Record<NotePosition, { fromNote: boolean; minLen: number }> = {
  left: { fromNote: true, minLen: 0 },
  right: { fromNote: false, minLen: 0 },
  top: { fromNote: true, minLen: 1 },
  bottom: { fromNote: false, minLen: 1 },
};

function measureNote(
  text: string,
  theme: Theme,
  measurer: StringMeasurer,
): { width: number; height: number; lines: string[] } {
  const lines = text.split('\n');
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const lineHeight = theme.fontSize * 1.4;
  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, measurer.measure(ln, fontSpec).width);
  return {
    lines,
    width: maxW + NOTE_HPAD * 2 + NOTE_FOLD,
    height: lines.length * lineHeight + NOTE_VPAD * 2,
  };
}

/** Build the seam nodes + connector edges for note-on-entity. */
export function buildNoteGraphParts(
  notes: ClassNote[],
  theme: Theme,
  measurer: StringMeasurer,
): { nodes: DotInputNode[]; edges: DotInputEdge[]; lines: Map<string, string[]> } {
  const nodes: DotInputNode[] = [];
  const edges: DotInputEdge[] = [];
  const lines = new Map<string, string[]>();
  for (const [i, note] of notes.entries()) {
    const m = measureNote(note.text, theme, measurer);
    nodes.push({ id: note.id, width: m.width, height: m.height });
    lines.set(note.id, m.lines);
    // Freestanding (`note as ALIAS`) notes have no host/position — they
    // still become a graph node (pushed above) but get no positional
    // connector edge here; any connector is a regular relationship line.
    if (note.target === undefined || note.position === undefined) continue;
    const dir = NOTE_EDGE[note.position];
    edges.push({
      id: `__noteedge_${i}`,
      from: dir.fromNote ? note.id : note.target,
      to: dir.fromNote ? note.target : note.id,
      attributes: { minLen: dir.minLen },
    });
  }
  return { nodes, edges, lines };
}

/** Map the dot layout result back to NoteGeo for the renderer. */
export function mapNoteGeos(
  notes: ClassNote[],
  lines: Map<string, string[]>,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  result: DotLayoutResult,
): NoteGeo[] {
  const out: NoteGeo[] = [];
  for (const [i, note] of notes.entries()) {
    const pos = posMap.get(note.id);
    if (pos === undefined) continue;
    const edge = result.edges.find((e) => e.id === `__noteedge_${i}`);
    out.push({
      id: note.id,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      lines: lines.get(note.id) ?? [note.text],
      connector: edge?.points ?? [],
    });
  }
  return out;
}
