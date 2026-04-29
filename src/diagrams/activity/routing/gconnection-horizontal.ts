import type { GConnection } from './gconnection.js';
import type { GPoint } from '../tiles/points.js';

export class GConnectionHorizontal implements GConnection {
  getPoints(from: GPoint, to: GPoint): GPoint[] {
    if (from.y === to.y) {
      return [from, to];
    }
    return [from, { x: to.x, y: from.y }, to];
  }
}
