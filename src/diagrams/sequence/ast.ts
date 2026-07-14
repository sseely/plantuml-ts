/**
 * AST and Geometry type definitions for PlantUML sequence diagrams.
 */

import type { DiagramAnnotations } from '../../core/annotations/index.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';

// ---------------------------------------------------------------------------
// AST Types
// ---------------------------------------------------------------------------

export type ParticipantType =
  | 'participant'
  | 'actor'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'database'
  | 'collections'
  | 'queue';

export interface Participant {
  id: string;
  display: string;
  type: ParticipantType;
  color?: string;
  order: number; // first-appearance order (0-based)
  /** Box group id this participant belongs to (from `box` / `end box`). */
  boxId?: string;
}

export type MessageStyle =
  | 'sync'
  | 'async'
  | 'reply'
  | 'replyAsync'
  | 'lost'
  | 'found';

export interface MessageEvent {
  kind: 'message';
  from: string; // participant id
  to: string; // participant id
  label: string;
  style: MessageStyle;
  activates?: string; // participant id to auto-activate (++ shorthand)
  deactivates?: string; // participant id to auto-deactivate (-- shorthand)
  sequenceNumber?: number;
}

export interface NoteEvent {
  kind: 'note';
  position: 'left' | 'right' | 'over';
  participants: string[];
  text: string;
  color?: string;
}

export interface FrameEvent {
  kind: 'frame';
  frameType:
    | 'loop'
    | 'alt'
    | 'opt'
    | 'par'
    | 'break'
    | 'critical'
    | 'group';
  label: string;
  branches: SequenceEvent[][]; // alt has multiple; others have one
}

export interface ActivationEvent {
  kind: 'activate' | 'deactivate';
  participantId: string;
  color?: string;
}

export interface DividerEvent {
  kind: 'divider';
  text: string;
}

export interface DelayEvent {
  kind: 'delay';
  text?: string;
}

export interface SpaceEvent {
  kind: 'space';
  pixels: number;
}

export type SequenceEvent =
  | MessageEvent
  | NoteEvent
  | FrameEvent
  | ActivationEvent
  | DividerEvent
  | DelayEvent
  | SpaceEvent;

/**
 * A named group of participants enclosed by `box` / `end box`.
 * Rendered as a colored background rectangle in the diagram header zone.
 */
export interface BoxGroup {
  id: string;
  label: string;
  color: string;
  participantIds: string[];
}

export interface SequenceDiagramAST {
  participants: Participant[];
  events: SequenceEvent[];
  autonumber: { enabled: boolean; start: number; current: number };
  options: {
    hideFootbox: boolean;
    messageAlign: 'left' | 'center' | 'right';
  };
  /** Box groups declared with `box` / `end box`. */
  boxes: BoxGroup[];
  /**
   * title/caption/legend/header/footer/mainframe chrome, populated by
   * {@link matchAnnotationCommand} at the parser's command-dispatch position
   * (mission G0b, decisions.md D3). Optional (unlike `participants`/`events`)
   * so pre-existing hand-authored AST literal fixtures compile unchanged; a
   * real `parseSequence()` call always sets it via `createAnnotations()` —
   * `isEmpty()` distinguishes "no chrome present" from "not yet populated".
   */
  annotations?: DiagramAnnotations;
  /**
   * `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4),
   * populated by {@link matchSpriteCommand} at the SAME dispatch position
   * as {@link matchAnnotationCommand} (tried immediately after it, mirroring
   * upstream's `CommonCommands.addTitleCommands` then `addCommonCommands2`
   * registration order). Optional so hand-authored AST literal fixtures
   * compile unchanged; a real `parseSequence()` call always sets it via
   * `createSpriteRegistry()`.
   */
  sprites?: SpriteRegistry;
}

// ---------------------------------------------------------------------------
// Geometry Types (consumed by layout stage)
// ---------------------------------------------------------------------------

export interface ParticipantGeo {
  id: string;
  display: string;
  type: ParticipantType;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
}

export interface MessageGeo {
  kind: 'message';
  fromX: number;
  toX: number;
  y: number;
  label: string;
  style: MessageStyle;
  sequenceNumber?: number;
  arrowDirection: 'right' | 'left' | 'self';
}

export interface NoteGeo {
  kind: 'note';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
}

export interface ActivationGeo {
  kind: 'activation';
  participantId: string;
  lifelineX: number;
  y: number;
  height: number;
  color?: string;
}

export interface FrameGeo {
  kind: 'frame';
  frameType: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DividerGeo {
  kind: 'divider';
  text: string;
  y: number;
  totalWidth: number;
}

export interface SpaceGeo {
  kind: 'space';
  y: number;
  height: number;
}

export type EventGeo =
  | MessageGeo
  | NoteGeo
  | ActivationGeo
  | FrameGeo
  | DividerGeo
  | SpaceGeo;

/**
 * Geometry for a single box group background rectangle.
 * Spans from y=0 to totalHeight, covering all participant columns in the group.
 */
export interface BoxGeo {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

export interface SequenceGeometry {
  totalWidth: number;
  totalHeight: number;
  participants: ParticipantGeo[];
  events: EventGeo[];
  lifelineEndY: number;
  /** Y where non-rectangular footer shapes (actor, database) start.
   *  Equals lifelineEndY + label-zone height so the label appears above the shape. */
  footerShapeY: number;
  /** Background rectangles for box groups (rendered at z=0, behind lifelines). */
  boxes: BoxGeo[];
}
