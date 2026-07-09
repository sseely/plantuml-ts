import type { UShape } from '../UShape.js';

/**
 * UComment — a single string, the shape that becomes an SVG
 * `<!--...-->` comment node when rendered.
 *
 * Upstream: klimt/shape/UComment.java — ported in full, no
 * unported dependency.
 */
export class UComment implements UShape {
  private readonly comment: string;

  constructor(comment: string) {
    this.comment = comment;
  }

  getComment(): string {
    return this.comment;
  }
}
