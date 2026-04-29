import type { GConnection } from './gconnection.js';
import type { GPoint } from '../tiles/points.js';

export class GConnectionSideThenVerticalThenSide implements GConnection {
  getPoints(from: GPoint, to: GPoint): GPoint[] {
    if (from.x === to.x) {
      return [from, to];
    }
    return [from, { x: from.x, y: to.y }, to];
  }
}
