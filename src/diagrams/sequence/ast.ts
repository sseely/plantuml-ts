/**
 * AST and Geometry type definitions for PlantUML sequence diagrams.
 */

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

export interface SequenceDiagramAST {
  participants: Participant[];
  events: SequenceEvent[];
  autonumber: { enabled: boolean; start: number; current: number };
  options: {
    hideFootbox: boolean;
    messageAlign: 'left' | 'center' | 'right';
  };
}

// ---------------------------------------------------------------------------
// Geometry Types (consumed by layout stage)
// ---------------------------------------------------------------------------

export interface ParticipantGeo {
  id: string;
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

export interface SequenceGeometry {
  totalWidth: number;
  totalHeight: number;
  participants: ParticipantGeo[];
  events: EventGeo[];
  lifelineEndY: number;
}
