/**
 * Sequence diagram SVG renderer.
 *
 * Pure function: SequenceGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type {
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
  text,
  path,
  svgRoot,
} from '../../core/svg.js';
import { creoleToSvg } from '../../core/creole.js';
import { arrowHeadRef } from '../../core/svg.js';

// ---------------------------------------------------------------------------
// Activation constants
// ---------------------------------------------------------------------------

const ACTIVATION_HALF_WIDTH = 5; // activationWidth / 2

// ---------------------------------------------------------------------------
// Participant helpers
// ---------------------------------------------------------------------------

function renderParticipantBox(p: ParticipantGeo, theme: Theme): string {
  const box = rect(p.x, p.y, p.width, p.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
  const label = `<text x="${p.centerX}" y="${p.y + p.height / 2}" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" fill="${theme.colors.text}" text-anchor="middle" dominant-baseline="middle">${creoleToSvg(p.id)}</text>`;
  return box + label;
}

function renderFooterBox(
  p: ParticipantGeo,
  lifelineEndY: number,
  theme: Theme,
): string {
  const footerY = lifelineEndY;
  const box = rect(p.x, footerY, p.width, p.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
  const label = `<text x="${p.centerX}" y="${footerY + p.height / 2}" font-family="${theme.fontFamily}" font-size="${theme.fontSize}" fill="${theme.colors.text}" text-anchor="middle" dominant-baseline="middle">${creoleToSvg(p.id)}</text>`;
  return box + label;
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
  const box = rect(note.x, note.y, note.width, note.height, {
    fill,
    stroke: theme.colors.border,
  });
  const lines = note.text.split('\n');
  const lineHeight = theme.fontSize * 1.4;
  const textEls = lines
    .map((lineText, i) =>
      text(note.x + 8, note.y + lineHeight + i * lineHeight, lineText, {
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize,
        fill: theme.colors.text,
      }),
    )
    .join('');
  return box + textEls;
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a sequence diagram geometry into an SVG string.
 */
export function renderSequence(geo: SequenceGeometry, theme: Theme): string {
  const children: string[] = [];

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
    children.push(renderFooterBox(p, geo.lifelineEndY, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children);
}
