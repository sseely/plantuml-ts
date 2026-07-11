/**
 * Note-on-entity layout for class diagrams.
 *
 * PlantUML's Svek lays a `note <pos> of <Entity>` out as its own graphviz
 * node connected to the host by a connector edge. This module measures
 * notes, groups same-side notes on the same host into a single merged svek
 * node (see `groupNotes`), contributes the seam nodes + connector edges, and
 * maps the layout result back to `NoteGeo[]` for the renderer — one geo per
 * ORIGINAL note, stacked within its group's laid-out box. Kept separate from
 * layout.ts so the note feature doesn't grow that already-large module.
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

interface NoteMeasurement {
  width: number;
  height: number;
  lines: string[];
}

function measureNote(
  text: string,
  theme: Theme,
  measurer: StringMeasurer,
): NoteMeasurement {
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

/**
 * A run of one or more `ClassNote`s that collapse into a single svek node —
 * upstream merges every note attached to the SAME SIDE of the SAME HOST into
 * one graphviz box, even when each targets a different `::member` suffix
 * (verified against the oracle: kugasi-68-josu446, sanusa-54-keda128,
 * tenobo-24-liga464 each have 2+ `note left/right of Host::member`
 * statements on one side of one host, and the oracle svek DOT emits exactly
 * ONE node for that side, not one per statement). Freestanding notes (no
 * target/position) and notes on different sides or hosts never merge — each
 * gets its own singleton group.
 */
interface NoteGroup {
  /** Dot node id — the first member note's id, reused so downstream
   *  position lookups have a stable key. */
  id: string;
  target?: string;
  position?: NotePosition;
  /**
   * Member-anchored (`Class::member`) notes route as an invisible
   * layout-only edge; plain-classifier notes (including package anchors)
   * get a visible connector — verified against the oracle (kugasi/sanusa/
   * tenobo's `::member` notes are `style=invis`; dibinu/cejili's
   * plain-entity notes and pecabi/sanixi's package notes are not).
   */
  invis: boolean;
  /** Indices into the original `notes` array, in stacking order. */
  memberIndices: number[];
}

/** A singleton group for a freestanding note or a note's first appearance
 *  on a given (host, side). */
function newGroup(note: ClassNote, i: number): NoteGroup {
  return {
    id: note.id,
    ...(note.target !== undefined ? { target: note.target } : {}),
    ...(note.position !== undefined ? { position: note.position } : {}),
    invis: note.target !== undefined && note.targetPort !== undefined,
    memberIndices: [i],
  };
}

/** Only an EXPLICIT `of <Entity>` note is merge-eligible — a bare
 *  `note <pos>` (implicitTarget, falls back to lastEntity) never merges,
 *  even onto the same (host, side) as an explicit one (zepeki-75-pifo352). */
function mergeKey(note: ClassNote): string | undefined {
  if (note.target === undefined || note.position === undefined) return undefined;
  if (note.implicitTarget === true) return undefined;
  return `${note.target}|${note.position}`;
}

function groupNotes(notes: ClassNote[]): NoteGroup[] {
  const groups: NoteGroup[] = [];
  const bySameSideHost = new Map<string, NoteGroup>();
  for (const [i, note] of notes.entries()) {
    const key = mergeKey(note);
    const existing = key === undefined ? undefined : bySameSideHost.get(key);
    if (existing !== undefined) {
      existing.memberIndices.push(i);
      continue;
    }
    const group = newGroup(note, i);
    if (key !== undefined) bySameSideHost.set(key, group);
    groups.push(group);
  }
  return groups;
}

/** Merged box for a group: as wide as its widest member, tall enough to
 *  stack all of them (the renderer draws each member as its own
 *  folded-corner box within this reserved column — see mapNoteGeos). */
function groupNodeSize(
  group: NoteGroup,
  notes: ClassNote[],
  measurements: Map<string, NoteMeasurement>,
): { width: number; height: number } {
  const sizes = group.memberIndices.map((i) => measurements.get(notes[i]!.id)!);
  return {
    width: Math.max(...sizes.map((m) => m.width)),
    height: sizes.reduce((sum, m) => sum + m.height, 0),
  };
}

/** The group's connector edge, or `undefined` for a freestanding note (no
 *  host/position — any connector for it is a regular relationship line). A
 *  package/namespace target routes to its `zaent-*` point anchor. */
function groupEdge(group: NoteGroup, anchors: ReadonlyMap<string, string>): DotInputEdge | undefined {
  if (group.target === undefined || group.position === undefined) return undefined;
  const dir = NOTE_EDGE[group.position];
  const to = anchors.get(group.target) ?? group.target;
  const attributes: NonNullable<DotInputEdge['attributes']> = { minLen: dir.minLen };
  if (group.invis) attributes.invis = true;
  return {
    id: `__noteedge_${group.id}`,
    from: dir.fromNote ? group.id : to,
    to: dir.fromNote ? to : group.id,
    attributes,
  };
}

/**
 * Build the seam nodes + connector edges for note-on-entity.
 *
 * `anchors` maps a package/namespace id to its `zaent-*` point-anchor id
 * (see class-layout-helpers.ts's `packageEndpointAnchors`) — a
 * `note <pos> of <package>` target routes its connector to that anchor
 * instead of the package's own id, the same substitution relationship
 * edges get when a package is used as an endpoint.
 */
export function buildNoteGraphParts(
  notes: ClassNote[],
  theme: Theme,
  measurer: StringMeasurer,
  anchors: ReadonlyMap<string, string>,
): {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  measurements: Map<string, NoteMeasurement>;
  groups: NoteGroup[];
} {
  const measurements = new Map<string, NoteMeasurement>();
  for (const note of notes) measurements.set(note.id, measureNote(note.text, theme, measurer));

  const groups = groupNotes(notes);
  const nodes: DotInputNode[] = groups.map((group) => ({
    id: group.id,
    ...groupNodeSize(group, notes, measurements),
  }));
  const edges: DotInputEdge[] = [];
  for (const group of groups) {
    const edge = groupEdge(group, anchors);
    if (edge !== undefined) edges.push(edge);
  }
  return { nodes, edges, measurements, groups };
}

/**
 * Map the dot layout result back to `NoteGeo[]` for the renderer. Each
 * original note keeps its own visual box — a merged group's members stack
 * vertically within the group's laid-out bounding rect (matches the oracle
 * SVG: same-side notes render as separate folded-corner boxes flush against
 * each other, sharing one reserved layout column). Only the group's first
 * member carries the connector; the rest render with no connector line (a
 * single shared line would be visually ambiguous once split across boxes).
 */
export function mapNoteGeos(
  notes: ClassNote[],
  measurements: Map<string, NoteMeasurement>,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  result: DotLayoutResult,
  groups: NoteGroup[],
): NoteGeo[] {
  const out: NoteGeo[] = [];
  for (const group of groups) {
    const pos = posMap.get(group.id);
    if (pos === undefined) continue;
    const edge = result.edges.find((e) => e.id === `__noteedge_${group.id}`);
    let yOffset = 0;
    for (const [memberOrder, i] of group.memberIndices.entries()) {
      const note = notes[i]!;
      const m = measurements.get(note.id)!;
      out.push({
        id: note.id,
        x: pos.x,
        y: pos.y + yOffset,
        width: pos.width,
        height: m.height,
        lines: m.lines,
        connector: memberOrder === 0 ? (edge?.points ?? []) : [],
      });
      yOffset += m.height;
    }
  }
  return out;
}
