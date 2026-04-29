import type { GConnection } from './gconnection.js';
import type { GPoint } from '../tiles/points.js';

export class GConnectionVerticalDownThenBack implements GConnection {
  constructor(private readonly rightMargin: number = 20) {}

  getPoints(from: GPoint, to: GPoint): GPoint[] {
    return [
      from,
      { x: from.x + this.rightMargin, y: from.y },
      { x: from.x + this.rightMargin, y: to.y },
      to,
    ];
  }
}
