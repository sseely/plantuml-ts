/**
 * Sequence diagram SVG renderer.
 *
 * Pure function: SequenceGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type {
  BoxGeo,
  SequenceGeometry,
  ParticipantGeo,
  EventGeo,
  MessageGeo,
  NoteGeo,
  ActivationGeo,
  FrameGeo,
  DividerGeo,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import {
  rect,
  line,
  ellipse,
  text,
  path,
  svgRoot,
  noteBox,
  arrowHeadRef,
} from '../../core/svg.js';

// ---------------------------------------------------------------------------
// Activation constants
// ---------------------------------------------------------------------------

const ACTIVATION_HALF_WIDTH = 5; // activationWidth / 2

// ---------------------------------------------------------------------------
// Participant helpers
// ---------------------------------------------------------------------------

function renderLabel(cx: number, cy: number, label: string, theme: Theme): string {
  return text(cx, cy, label, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  });
}

function renderActorShape(cx: number, topY: number, height: number, theme: Theme): string {
  const headR = 10;
  const bodyTop = topY + headR * 2 + 2;
  const bodyLen = height * 0.35;
  const bodyBot = bodyTop + bodyLen;
  const armY = bodyTop + bodyLen * 0.3;
  const armSpan = 14;
  const legSpan = 12;
  const parts: string[] = [];
  // Head
  parts.push(`<circle cx="${cx}" cy="${topY + headR}" r="${headR}" fill="${theme.colors.background}" stroke="${theme.colors.border}" stroke-width="1.5"/>`);
  // Body
  parts.push(line(cx, bodyTop, cx, bodyBot, { stroke: theme.colors.border, strokeWidth: 1.5 }));
  // Arms
  parts.push(line(cx - armSpan, armY, cx + armSpan, armY, { stroke: theme.colors.border, strokeWidth: 1.5 }));
  // Legs — end 8px above the label zone so the label has clear breathing room
  parts.push(line(cx, bodyBot, cx - legSpan, topY + height - theme.fontSize - 8, { stroke: theme.colors.border, strokeWidth: 1.5 }));
  parts.push(line(cx, bodyBot, cx + legSpan, topY + height - theme.fontSize - 8, { stroke: theme.colors.border, strokeWidth: 1.5 }));
  return parts.join('');
}

function renderDatabaseShape(x: number, topY: number, width: number, height: number, theme: Theme): string {
  // With sweep=1 the arc nadir sits capRy below bodyBot. labelH must satisfy
  // labelH > 1.15*(capRy_fraction*height) + fontSize + 4 to keep the label
  // top clear of the arc. fontSize+12 gives ~3 px of clearance at fontSize=14.
  const labelH = theme.fontSize + 14;
  const bodyH = height - labelH;
  const capRy = Math.max(4, bodyH * 0.15);
  const bodyTop = topY + capRy;
  const bodyBot = topY + bodyH;
  const cx = x + width / 2;
  const rx = width / 2 - 2;
  const parts: string[] = [];
  // Body rect
  parts.push(rect(x + 2, bodyTop, width - 4, bodyH - capRy, {
    fill: theme.colors.background,
    stroke: 'none',
  }));
  // Top ellipse (full, visible)
  parts.push(ellipse(cx, bodyTop, rx, capRy, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
    'stroke-width': '1.5',
  }));
  // Side lines
  parts.push(line(x + 2, bodyTop, x + 2, bodyBot, { stroke: theme.colors.border, strokeWidth: 1.5 }));
  parts.push(line(x + width - 2, bodyTop, x + width - 2, bodyBot, { stroke: theme.colors.border, strokeWidth: 1.5 }));
  // Bottom arc — sweep=0 (counter-clockwise from left to right) routes through
  // (cx, bodyBot+capRy), bowing the arc downward for a convex cylinder bottom.
  parts.push(`<path d="M ${x + 2},${bodyBot} A ${rx},${capRy} 0 0,0 ${x + width - 2},${bodyBot}" fill="${theme.colors.background}" stroke="${theme.colors.border}" stroke-width="1.5"/>`);
  return parts.join('');
}

function renderParticipantBox(p: ParticipantGeo, theme: Theme): string {
  const labelY = p.y + p.height - theme.fontSize / 2 - 4;
  if (p.type === 'actor') {
    return (
      renderActorShape(p.centerX, p.y, p.height, theme) +
      renderLabel(p.centerX, labelY, p.display, theme)
    );
  }
  if (p.type === 'database') {
    return (
      renderDatabaseShape(p.x, p.y, p.width, p.height, theme) +
      renderLabel(p.centerX, p.y + p.height - theme.fontSize / 2 - 4, p.display, theme)
    );
  }
  const box = rect(p.x, p.y, p.width, p.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
  return box + renderLabel(p.centerX, p.y + p.height / 2, p.display, theme);
}

function renderFooterBox(
  p: ParticipantGeo,
  lifelineEndY: number,
  footerShapeY: number,
  theme: Theme,
): string {
  // Rectangular participants: box starts at lifelineEndY, label inside.
  // Non-rectangular (actor, database): label above the shape at lifelineEndY,
  // shape starts at footerShapeY (= lifelineEndY + label-zone height).
  if (p.type === 'actor') {
    const labelY = lifelineEndY + theme.fontSize / 2 + 4;
    return (
      renderLabel(p.centerX, labelY, p.display, theme) +
      renderActorShape(p.centerX, footerShapeY, p.height, theme)
    );
  }
  if (p.type === 'database') {
    const labelY = lifelineEndY + theme.fontSize / 2 + 4;
    return (
      renderLabel(p.centerX, labelY, p.display, theme) +
      renderDatabaseShape(p.x, footerShapeY, p.width, p.height, theme)
    );
  }
  const box = rect(p.x, lifelineEndY, p.width, p.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
  return box + renderLabel(p.centerX, lifelineEndY + p.height / 2, p.display, theme);
}

function renderLifeline(
  p: ParticipantGeo,
  lifelineEndY: number,
  theme: Theme,
): string {
  const startY = p.y + p.height;
  return line(p.centerX, startY, p.centerX, lifelineEndY, {
    stroke: theme.colors.lifeline,
    strokeDasharray: '5,5',
  });
}

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------

function arrowStyleForMessage(style: MessageGeo['style']): {
  dashed: boolean;
  markerEnd?: string;
  markerStart?: string;
} {
  switch (style) {
    case 'sync':
      return { dashed: false, markerEnd: `url(#${arrowHeadRef('sync')})` };
    case 'async':
      return { dashed: false, markerEnd: `url(#${arrowHeadRef('async')})` };
    case 'reply':
      return { dashed: true, markerEnd: `url(#${arrowHeadRef('reply')})` };
    case 'replyAsync':
      return { dashed: true, markerEnd: `url(#${arrowHeadRef('replyAsync')})` };
    case 'lost':
      return { dashed: false, markerEnd: `url(#${arrowHeadRef('lost')})` };
    case 'found':
      return { dashed: false, markerStart: `url(#${arrowHeadRef('found')})` };
  }
}

function renderMessage(msg: MessageGeo, theme: Theme): string {
  const label =
    msg.sequenceNumber !== undefined
      ? `${msg.sequenceNumber}: ${msg.label}`
      : msg.label;

  const { dashed, markerEnd, markerStart } = arrowStyleForMessage(msg.style);
  const strokeDasharray = dashed ? '5,5' : undefined;

  let lineEl: string;

  if (msg.arrowDirection === 'self') {
    // Three-segment right-loop path: right, down, back left
    const loopWidth = 40;
    const loopHeight = 20;
    const x1 = msg.fromX;
    const y1 = msg.y;
    const d =
      `M ${x1} ${y1} ` +
      `H ${x1 + loopWidth} ` +
      `V ${y1 + loopHeight} ` +
      `H ${x1}`;
    lineEl = path(d, {
      stroke: theme.colors.arrow,
      strokeWidth: 1,
      ...(strokeDasharray !== undefined ? { strokeDasharray } : {}),
      ...(markerEnd !== undefined ? { markerEnd } : {}),
    });
  } else {
    lineEl = line(msg.fromX, msg.y, msg.toX, msg.y, {
      stroke: theme.colors.arrow,
      strokeWidth: 1,
      ...(strokeDasharray !== undefined ? { strokeDasharray } : {}),
      ...(markerEnd !== undefined ? { markerEnd } : {}),
      ...(markerStart !== undefined ? { markerStart } : {}),
    });
  }

  const midX = msg.arrowDirection === 'self'
    ? msg.fromX + 20
    : (msg.fromX + msg.toX) / 2;
  const labelEl = text(midX, msg.y - 5, label, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
    textAnchor: 'middle',
  });

  return lineEl + labelEl;
}

// ---------------------------------------------------------------------------
// Activation helpers
// ---------------------------------------------------------------------------

function renderActivation(act: ActivationGeo, theme: Theme): string {
  const x = act.lifelineX - ACTIVATION_HALF_WIDTH;
  const fill = act.color ?? theme.colors.activation;
  return rect(x, act.y, ACTIVATION_HALF_WIDTH * 2, act.height, {
    fill,
    stroke: theme.colors.border,
  });
}

// ---------------------------------------------------------------------------
// Note helpers
// ---------------------------------------------------------------------------

function renderNote(note: NoteGeo, theme: Theme): string {
  const fill = note.color ?? theme.colors.noteBackground;
  const { x, y, width: w, height: h } = note;
  const noteShape = noteBox(x, y, w, h, {
    fill,
    stroke: theme.colors.border,
    strokeWidth: 1.5,
  });
  const lines = note.text.split('\n');
  const lineHeight = theme.fontSize * 1.4;
  const textCenterX = x + w / 2;
  const textEls = lines
    .map((lineText, i) =>
      text(textCenterX, y + lineHeight + i * lineHeight, lineText, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        fill: theme.colors.text,
        textAnchor: 'middle',
      }),
    )
    .join('');
  return noteShape + textEls;
}

// ---------------------------------------------------------------------------
// Frame helpers
// ---------------------------------------------------------------------------

function renderFrame(frame: FrameGeo, theme: Theme): string {
  const border = rect(frame.x, frame.y, frame.width, frame.height, {
    fill: 'none',
    stroke: theme.colors.frame,
    strokeDasharray: '5,5',
  });
  // Small tab at top-left for label
  const tabWidth = Math.min(80, frame.width);
  const tabHeight = 20;
  const tab = rect(frame.x, frame.y, tabWidth, tabHeight, {
    fill: theme.colors.frame,
    stroke: theme.colors.frame,
  });
  const labelText = `${frame.frameType} ${frame.label}`.trim();
  const labelEl = text(frame.x + 4, frame.y + tabHeight - 4, labelText, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize - 2,
    fill: theme.colors.background,
  });
  return border + tab + labelEl;
}

// ---------------------------------------------------------------------------
// Divider helpers
// ---------------------------------------------------------------------------

function renderDivider(divider: DividerGeo, theme: Theme): string {
  const lineEl = line(0, divider.y, divider.totalWidth, divider.y, {
    stroke: theme.colors.divider,
    strokeWidth: 1,
  });
  const midX = divider.totalWidth / 2;
  const textEl = text(midX, divider.y - 4, divider.text, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
    textAnchor: 'middle',
  });
  return lineEl + textEl;
}

// ---------------------------------------------------------------------------
// Event dispatcher
// ---------------------------------------------------------------------------

function renderEvent(event: EventGeo, theme: Theme): string {
  switch (event.kind) {
    case 'message':
      return renderMessage(event, theme);
    case 'activation':
      return renderActivation(event, theme);
    case 'note':
      return renderNote(event, theme);
    case 'frame':
      return renderFrame(event, theme);
    case 'divider':
      return renderDivider(event, theme);
    case 'space':
      // Space geos add no visible elements
      return '';
  }
}

// ---------------------------------------------------------------------------
// Box background helpers
// ---------------------------------------------------------------------------

const BOX_DEFAULT_COLOR = '#EEEEEE';
const BOX_LABEL_FONT_SIZE = 11;
const BOX_LABEL_PADDING = 4;

function renderBoxBackground(box: BoxGeo, theme: Theme): string {
  const fill = box.color !== '' ? box.color : BOX_DEFAULT_COLOR;
  const boxRect = rect(box.x, box.y, box.width, box.height, {
    fill,
    stroke: theme.colors.border,
  });
  if (box.label === '') return boxRect;
  const labelEl = text(
    box.x + BOX_LABEL_PADDING,
    box.y + BOX_LABEL_FONT_SIZE + BOX_LABEL_PADDING,
    box.label,
    {
      fontFamily: theme.fontFamily,
      fontSize: BOX_LABEL_FONT_SIZE,
      fill: theme.colors.text,
    },
  );
  return boxRect + labelEl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a sequence diagram geometry into an SVG string.
 */
export function renderSequence(geo: SequenceGeometry, theme: Theme): string {
  const children: string[] = [];

  // 0. Box backgrounds (lowest z-order — behind lifelines and participants)
  for (const box of geo.boxes) {
    children.push(renderBoxBackground(box, theme));
  }

  // 1. Lifelines (behind everything else)
  for (const p of geo.participants) {
    children.push(renderLifeline(p, geo.lifelineEndY, theme));
  }

  // 2. Participant header boxes
  for (const p of geo.participants) {
    children.push(renderParticipantBox(p, theme));
  }

  // 3. Events (messages, activations, notes, frames, dividers)
  for (const event of geo.events) {
    children.push(renderEvent(event, theme));
  }

  // 4. Footer boxes (always emitted — see design note in task spec)
  for (const p of geo.participants) {
    children.push(renderFooterBox(p, geo.lifelineEndY, geo.footerShapeY, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}
