/**
 * Geometry primitives and hook name constants for the activity tile system.
 */

export interface GPoint {
  x: number;
  y: number;
}

export type HookName =
  | 'NORTH'
  | 'SOUTH'
  | 'EAST'
  | 'WEST'
  | 'NORTH_BORDER'
  | 'SOUTH_BORDER';

export const NORTH_HOOK: HookName = 'NORTH';
export const SOUTH_HOOK: HookName = 'SOUTH';
export const EAST_HOOK: HookName = 'EAST';
export const WEST_HOOK: HookName = 'WEST';
