/**
 * Public geometry types for the state-diagram layout engine. Split out of
 * ./layout.ts (which re-exports them, preserving the public import path used
 * by ./renderer.ts and ./index.ts) so the composite-pass modules can share
 * them without an import cycle through layout.ts.
 */

import type { StateKind } from './ast.js';

export interface StateNodeGeo {
  id: string;
  kind: StateKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: StateNodeGeo[];
}

export interface TransitionGeo {
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
}

export interface StateGeometry {
  totalWidth: number;
  totalHeight: number;
  states: StateNodeGeo[];
  transitions: TransitionGeo[];
}
