import type { GConnection } from './gconnection.js';
import type { GPoint } from '../tiles/points.js';

export class GConnectionDownThenUp implements GConnection {
  constructor(private readonly leftMargin: number = 20) {}

  getPoints(from: GPoint, to: GPoint): GPoint[] {
    return [
      from,
      { x: from.x - this.leftMargin, y: from.y },
      { x: from.x - this.leftMargin, y: to.y },
      to,
    ];
  }
}
