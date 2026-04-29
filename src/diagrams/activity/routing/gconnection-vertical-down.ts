import type { GConnection } from './gconnection.js';
import type { GPoint } from '../tiles/points.js';

export class GConnectionVerticalDown implements GConnection {
  getPoints(from: GPoint, to: GPoint): GPoint[] {
    return [from, to];
  }
}
