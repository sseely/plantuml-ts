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
      footerShapeY: 0,
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
  const LABEL_H_PADDING = 8; // min px between a message label edge and a lifeline
  // Actors and database cylinders are taller than plain boxes.
  const ACTOR_HEIGHT = 90;
  const DB_HEIGHT = 80;
  const DB_MIN_WIDTH = 40; // cylinders are narrower than plain boxes

  // Pre-scan: find the widest message label between each adjacent participant pair
  // so we can widen the gap enough for labels to fit between the lifelines.
  const adjMaxLabelW: number[] = new Array(sortedParticipants.length - 1).fill(0);
  function scanMsgLabels(events: readonly SequenceEvent[]): void {
    for (const ev of events) {
      if (ev.kind === 'message' && ev.from !== ev.to) {
        const fi = sortedParticipants.findIndex((p) => p.id === ev.from);
        const ti = sortedParticipants.findIndex((p) => p.id === ev.to);
        if (fi >= 0 && ti >= 0 && Math.abs(fi - ti) === 1) {
          const pairIdx = Math.min(fi, ti);
          const w = measurer.measure(ev.label, fontSpec).width;
          adjMaxLabelW[pairIdx] = Math.max(adjMaxLabelW[pairIdx]!, w);
        }
      } else if (ev.kind === 'frame') {
        for (const branch of ev.branches) scanMsgLabels(branch);
      }
    }
  }
  scanMsgLabels(ast.events);

  // Pre-compute each participant's column width.
  // Database cylinders use a smaller minimum and tighter padding so they
  // appear narrower relative to plain participant boxes.
  const participantWidths: number[] = sortedParticipants.map((p) => {
    const lw = measurer.measure(p.display, fontSpec).width;
    if (p.type === 'database') {
      return Math.max(DB_MIN_WIDTH, lw + theme.sequence.participantPadding);
    }
    return Math.max(theme.sequence.participantMinWidth, lw + theme.sequence.participantPadding * 2);
  });

  let currentX = LEFT_MARGIN;

  for (let i = 0; i < sortedParticipants.length; i++) {
    const p = sortedParticipants[i]!;
    const width = participantWidths[i]!;
    const measured = measurer.measure(p.display, fontSpec);
    const boxHeight = measured.height + 20;
    const pHeight =
      p.type === 'actor' ? Math.max(boxHeight, ACTOR_HEIGHT) :
      p.type === 'database' ? Math.max(boxHeight, DB_HEIGHT) :
      boxHeight;
    const centerX = currentX + width / 2;

    const geo: ParticipantGeo = {
      id: p.id,
      display: p.display,
      type: p.type,
      x: currentX,
      y: 0,
      width,
      height: pHeight,
      centerX,
    };

    participantGeos.push(geo);
    participantMap.set(p.id, geo);
    participantIndex.set(p.id, i);

    if (i < sortedParticipants.length - 1) {
      const nextWidth = participantWidths[i + 1]!;
      // Minimum center-to-center gap so the widest adjacent message label fits.
      const minCenterGap = (adjMaxLabelW[i] ?? 0) + LABEL_H_PADDING * 2;
      const naturalCenterGap = width / 2 + theme.sequence.participantGap + nextWidth / 2;
      const centerGap = Math.max(naturalCenterGap, minCenterGap);
      const edgeGap = centerGap - width / 2 - nextWidth / 2;
      currentX += width + edgeGap;
    }
  }

  // Use the tallest participant height so all lifelines start at the same Y.
  const maxParticipantHeight = Math.max(...participantGeos.map((g) => g.height));
  // Bottom-align headers: shift each participant's y so its bottom sits at
  // maxParticipantHeight. This preserves natural box proportions while keeping
  // all lifelines starting at the same Y coordinate.
  for (const g of participantGeos) {
    g.y = maxParticipantHeight - g.height;
  }

  // -------------------------------------------------------------------------
  // Step 2: Event y-positions
  // -------------------------------------------------------------------------

  const eventGeos: EventGeo[] = [];
  const dividerGeos: DividerGeo[] = [];
  // Tracks activation start y per participant id
  const activationStart = new Map<string, { y: number; color?: string }>();

  let currentY = maxParticipantHeight + theme.sequence.messageSpacing;

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
  // Non-rectangular footer shapes (actor, database) get their label above the
  // shape. Reserve a label-height zone between the lifeline end and the shape.
  const hasNonRectFooter = sortedParticipants.some(
    (p) => p.type === 'actor' || p.type === 'database',
  );
  const footerLabelH = hasNonRectFooter ? theme.fontSize + 8 : 0;
  const footerShapeY = lifelineEndY + footerLabelH;
  const BOTTOM_MARGIN = 5;
  const totalHeight = footerShapeY + maxParticipantHeight + BOTTOM_MARGIN;

  // Safe: participantGeos is non-empty (guarded by early return above)
  const lastParticipant = participantGeos[participantGeos.length - 1]!;
  const RIGHT_MARGIN = 30;
  let totalWidth = lastParticipant.x + lastParticipant.width + RIGHT_MARGIN;

  // Expand totalWidth if any message label overflows the right edge.
  // Labels are rendered centered at midX with text-anchor="middle", so the
  // right edge of the label is midX + labelWidth/2. A long label on a
  // rightward message near the last participant can clip without this check.
  for (const geo of eventGeos) {
    if (geo.kind !== 'message') continue;
    const labelText =
      geo.sequenceNumber !== undefined
        ? `${geo.sequenceNumber}: ${geo.label}`
        : geo.label;
    const labelWidth = measurer.measure(labelText, fontSpec).width;
    const midX =
      geo.arrowDirection === 'self'
        ? geo.fromX + 20
        : (geo.fromX + geo.toX) / 2;
    const labelRightEdge = midX + labelWidth / 2 + RIGHT_MARGIN;
    if (labelRightEdge > totalWidth) {
      totalWidth = labelRightEdge;
    }
  }

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
    footerShapeY,
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
  // Tracks the y of the most recent message arrow so that an explicit
  // `activate` immediately following a message aligns with the arrow.
  let lastMessageY: number | undefined;

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
        lastMessageY = messageGeo.y;

        const lineHeight = measurer.measure('M', fontSpec).height;
        currentY += theme.sequence.messageSpacing + lineHeight;

        // Handle auto-activate/deactivate via ++ / -- shorthand on message
        if (event.activates !== undefined) {
          // Activation starts at the arrow y, not after the post-arrow spacing advance.
          activationStart.set(event.activates, { y: messageGeo.y });
        }
        if (event.deactivates !== undefined) {
          // End at the arrow y. If that would give zero/negative height (the
          // activate and deactivate land at the same y), fall back to the
          // post-spacing currentY so the bar is always visible.
          const deactStartY = activationStart.get(event.deactivates)?.y;
          const deactEndY =
            deactStartY !== undefined && messageGeo.y <= deactStartY
              ? currentY
              : messageGeo.y;
          emitActivation(
            event.deactivates,
            deactEndY,
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
        // Use the last message arrow y when available so the bar top aligns
        // with its triggering arrow, not with the post-arrow spacing position.
        activationStart.set(event.participantId, {
          y: lastMessageY ?? currentY,
          ...(event.color !== undefined ? { color: event.color } : {}),
        });
        lastMessageY = undefined;
        break;
      }

      case 'deactivate': {
        // End at the last message arrow y. If that would give zero/negative
        // height (activate and deactivate at the same y), fall back to
        // post-spacing currentY so the bar is always visible.
        const deactStartY = activationStart.get(event.participantId)?.y;
        const rawEndY = lastMessageY ?? currentY;
        const deactEndY =
          deactStartY !== undefined && rawEndY <= deactStartY
            ? currentY
            : rawEndY;
        emitActivation(
          event.participantId,
          deactEndY,
          participantMap,
          activationStart,
          eventGeos,
        );
        lastMessageY = undefined;
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
