import type { GPoint } from '../tiles/points.js';

export interface GConnection {
  getPoints(from: GPoint, to: GPoint): GPoint[];
}
