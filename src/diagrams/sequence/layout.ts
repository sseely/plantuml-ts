/**
 * Sequence diagram layout engine.
 *
 * Pure function: SequenceDiagramAST + Theme + StringMeasurer → SequenceGeometry.
 * No DOM, no SVG, no async. All coordinates are absolute pixels.
 */

import type {
  SequenceDiagramAST,
  SequenceGeometry,
  SequenceEvent,
  NoteEvent,
  ParticipantGeo,
  EventGeo,
  MessageGeo,
  NoteGeo,
  ActivationGeo,
  FrameGeo,
  DividerGeo,
  SpaceGeo,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutSequence(
  ast: SequenceDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): SequenceGeometry {
  if (ast.participants.length === 0) {
    return {
      totalWidth: 0,
      totalHeight: 0,
      participants: [],
      events: [],
      lifelineEndY: 0,
    };
  }

  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };

  // -------------------------------------------------------------------------
  // Step 1: Participant columns
  // -------------------------------------------------------------------------

  // Sort by order field to get canonical left-to-right sequence
  const sortedParticipants = [...ast.participants].sort(
    (a, b) => a.order - b.order,
  );

  const participantGeos: ParticipantGeo[] = [];
  // Map from participant id → geo (for event processing)
  const participantMap = new Map<string, ParticipantGeo>();
  // Map from participant id → index in sorted order (for direction detection)
  const participantIndex = new Map<string, number>();

  const LEFT_MARGIN = 30;
  let currentX = LEFT_MARGIN;

  for (let i = 0; i < sortedParticipants.length; i++) {
    const p = sortedParticipants[i]!;
    const measured = measurer.measure(p.display, fontSpec);
    const labelWidth = measured.width;
    const width = Math.max(
      theme.sequence.participantMinWidth,
      labelWidth + theme.sequence.participantPadding * 2,
    );
    // Vertical padding of 20px added to measured line height
    const pHeight = measured.height + 20;
    const centerX = currentX + width / 2;

    const geo: ParticipantGeo = {
      id: p.id,
      x: currentX,
      y: 0,
      width,
      height: pHeight,
      centerX,
    };

    participantGeos.push(geo);
    participantMap.set(p.id, geo);
    participantIndex.set(p.id, i);
    currentX += width;
  }

  // Participant height taken from first participant (all use same font metrics).
  // Safe: we returned early above when participants.length === 0.
  const participantHeight = participantGeos[0]!.height;

  // -------------------------------------------------------------------------
  // Step 2: Event y-positions
  // -------------------------------------------------------------------------

  const eventGeos: EventGeo[] = [];
  const dividerGeos: DividerGeo[] = [];
  // Tracks activation start y per participant id
  const activationStart = new Map<string, { y: number; color?: string }>();

  let currentY = participantHeight + theme.sequence.messageSpacing;

  currentY = processEvents(
    ast.events,
    currentY,
    theme,
    measurer,
    participantMap,
    participantIndex,
    activationStart,
    eventGeos,
    dividerGeos,
  );

  // -------------------------------------------------------------------------
  // Step 3: Totals
  // -------------------------------------------------------------------------

  const lifelineEndY = currentY + theme.sequence.lifelineExtension;
  // Footer row: repeat participant height below the lifeline
  const totalHeight = lifelineEndY + participantHeight;

  // Safe: participantGeos is non-empty (guarded by early return above)
  const lastParticipant = participantGeos[participantGeos.length - 1]!;
  const totalWidth = lastParticipant.x + lastParticipant.width + 30;

  // Fill in totalWidth on all DividerGeo entries (Step 3 requirement)
  for (const d of dividerGeos) {
    d.totalWidth = totalWidth;
  }

  return {
    totalWidth,
    totalHeight,
    participants: participantGeos,
    events: eventGeos,
    lifelineEndY,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve participant centerX by id, returning 0 as a safe fallback for
 * participants not in the map (e.g., notes referencing unknown participants).
 */
function centerXOf(participantMap: Map<string, ParticipantGeo>, id: string): number {
  return participantMap.get(id)?.centerX ?? 0;
}

/**
 * Compute the bounding centerX range across all participants.
 * Returns [0, 0] when the map is empty (only possible in degenerate inputs
 * since layoutSequence returns early for empty participants).
 */
function participantCenterXBounds(
  participantMap: Map<string, ParticipantGeo>,
): { minCx: number; maxCx: number } {
  const centerXs = [...participantMap.values()].map((g) => g.centerX);
  if (centerXs.length === 0) return { minCx: 0, maxCx: 0 };
  return { minCx: Math.min(...centerXs), maxCx: Math.max(...centerXs) };
}

// ---------------------------------------------------------------------------
// Internal event processing
// ---------------------------------------------------------------------------

/**
 * Process a list of events, mutating eventGeos and dividerGeos in place.
 * Returns the updated currentY after all events are processed.
 *
 * Uses a shared participantMap and activationStart so that nested frame
 * processing continues to reference the same participant geometry and
 * pending activation records.
 */
function processEvents(
  events: SequenceEvent[],
  startY: number,
  theme: Theme,
  measurer: StringMeasurer,
  participantMap: Map<string, ParticipantGeo>,
  participantIndex: Map<string, number>,
  activationStart: Map<string, { y: number; color?: string }>,
  eventGeos: EventGeo[],
  dividerGeos: DividerGeo[],
): number {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  let currentY = startY;

  for (const event of events) {
    switch (event.kind) {
      case 'message': {
        const fromGeo = participantMap.get(event.from);
        const toGeo = participantMap.get(event.to);

        // Skip gracefully if either participant is unknown
        if (fromGeo === undefined || toGeo === undefined) break;

        const fromX = fromGeo.centerX;
        let toX: number;
        let arrowDirection: MessageGeo['arrowDirection'];

        if (event.from === event.to) {
          // Self-message: offset toX to the right of the lifeline.
          // activationWidth (10) + offset (20) = 30 per spec.
          toX = fromX + theme.sequence.activationWidth + 20;
          arrowDirection = 'self';
        } else {
          toX = toGeo.centerX;
          // participantIndex always has both keys when participantMap does
          const fromIdx = participantIndex.get(event.from) ?? 0;
          const toIdx = participantIndex.get(event.to) ?? 0;
          arrowDirection = fromIdx < toIdx ? 'right' : 'left';
        }

        const messageGeo: MessageGeo = {
          kind: 'message',
          fromX,
          toX,
          y: currentY,
          label: event.label,
          style: event.style,
          arrowDirection,
          ...(event.sequenceNumber !== undefined
            ? { sequenceNumber: event.sequenceNumber }
            : {}),
        };
        eventGeos.push(messageGeo);

        const lineHeight = measurer.measure('M', fontSpec).height;
        currentY += theme.sequence.messageSpacing + lineHeight;

        // Handle auto-activate/deactivate via ++ / -- shorthand on message
        if (event.activates !== undefined) {
          activationStart.set(event.activates, { y: currentY });
        }
        if (event.deactivates !== undefined) {
          emitActivation(
            event.deactivates,
            currentY,
            participantMap,
            activationStart,
            eventGeos,
          );
        }
        break;
      }

      case 'note': {
        const notePadding = 10;
        const lines = event.text.split('\n');
        const lineHeight = measurer.measure('M', fontSpec).height;
        const maxLineWidth = Math.max(
          ...lines.map((line) => measurer.measure(line, fontSpec).width),
        );
        const noteWidth = maxLineWidth + notePadding * 2;
        const noteHeight = lines.length * lineHeight + notePadding * 2;

        const noteGeo = buildNoteGeo(
          event,
          noteWidth,
          noteHeight,
          currentY,
          participantMap,
        );
        eventGeos.push(noteGeo);
        currentY += noteHeight + theme.sequence.messageSpacing;
        break;
      }

      case 'activate': {
        activationStart.set(event.participantId, {
          y: currentY,
          ...(event.color !== undefined ? { color: event.color } : {}),
        });
        break;
      }

      case 'deactivate': {
        emitActivation(
          event.participantId,
          currentY,
          participantMap,
          activationStart,
          eventGeos,
        );
        break;
      }

      case 'frame': {
        const frameStartY = currentY;
        const frameHeaderHeight = 30;
        currentY += frameHeaderHeight;

        // Process each branch in sequence (alt frames have multiple branches)
        for (const branch of event.branches) {
          currentY = processEvents(
            branch,
            currentY,
            theme,
            measurer,
            participantMap,
            participantIndex,
            activationStart,
            eventGeos,
            dividerGeos,
          );
        }

        const frameEndY = currentY;
        const { minCx, maxCx } = participantCenterXBounds(participantMap);

        const frameGeo: FrameGeo = {
          kind: 'frame',
          frameType: event.frameType,
          label: event.label,
          x: minCx - 20,
          y: frameStartY,
          width: maxCx - minCx + 40,
          height: frameEndY - frameStartY,
        };
        eventGeos.push(frameGeo);
        currentY = frameEndY + theme.sequence.messageSpacing;
        break;
      }

      case 'divider': {
        const dividerGeo: DividerGeo = {
          kind: 'divider',
          text: event.text,
          y: currentY,
          totalWidth: 0, // back-filled after totalWidth is computed in Step 3
        };
        eventGeos.push(dividerGeo);
        dividerGeos.push(dividerGeo);
        currentY += 30;
        break;
      }

      case 'delay': {
        // Delay events carry no geometry — advance by one message spacing
        currentY += theme.sequence.messageSpacing;
        break;
      }

      case 'space': {
        const spaceGeo: SpaceGeo = {
          kind: 'space',
          y: currentY,
          height: event.pixels,
        };
        eventGeos.push(spaceGeo);
        // Advance by the requested pixels plus one message spacing gap so that
        // the next element starts clearly after the space region ends
        currentY += event.pixels + theme.sequence.messageSpacing;
        break;
      }
    }
  }

  return currentY;
}

/**
 * Build a NoteGeo from a NoteEvent given pre-computed note dimensions.
 * Extracted to isolate the position-branch logic and simplify processEvents.
 */
function buildNoteGeo(
  event: NoteEvent,
  noteWidth: number,
  noteHeight: number,
  currentY: number,
  participantMap: Map<string, ParticipantGeo>,
): NoteGeo {
  const notePadding = 10;
  let noteX: number;
  let finalNoteWidth = noteWidth;

  if (event.position === 'left') {
    // Safe: parser guarantees at least one participant for 'left' notes
    noteX = centerXOf(participantMap, event.participants[0]!) - noteWidth - notePadding;
  } else if (event.position === 'right') {
    // Safe: parser guarantees at least one participant for 'right' notes
    noteX = centerXOf(participantMap, event.participants[0]!) + notePadding;
  } else {
    // 'over'
    if (event.participants.length === 1) {
      // Safe: length === 1 means [0] is defined
      noteX = centerXOf(participantMap, event.participants[0]!) - noteWidth / 2;
    } else {
      // Span between two (or more) participants
      const centers = event.participants
        .map((id) => centerXOf(participantMap, id))
        .filter((cx) => cx > 0);
      const minCx = Math.min(...centers);
      const maxCx = Math.max(...centers);
      noteX = minCx - notePadding;
      finalNoteWidth = maxCx - minCx + notePadding * 2;
    }
  }

  return {
    kind: 'note',
    x: noteX,
    y: currentY,
    width: finalNoteWidth,
    height: noteHeight,
    text: event.text,
    ...(event.color !== undefined ? { color: event.color } : {}),
  };
}

/**
 * Emit an ActivationGeo for a participant, consuming any pending activation
 * start record. When no record exists, height is 0 (deactivate without prior
 * activate).
 */
function emitActivation(
  participantId: string,
  currentY: number,
  participantMap: Map<string, ParticipantGeo>,
  activationStart: Map<string, { y: number; color?: string }>,
  eventGeos: EventGeo[],
): void {
  const record = activationStart.get(participantId);
  const startY = record?.y ?? currentY;
  const activationGeo: ActivationGeo = {
    kind: 'activation',
    participantId,
    lifelineX: centerXOf(participantMap, participantId),
    y: startY,
    height: currentY - startY,
    ...(record?.color !== undefined ? { color: record.color } : {}),
  };
  eventGeos.push(activationGeo);
  activationStart.delete(participantId);
}
