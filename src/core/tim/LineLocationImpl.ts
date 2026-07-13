/**
 * The only `LineLocation` implementation, exactly as upstream: an immutable
 * `(description, parent, position)` triple whose `oneLineRead()` returns the
 * NEXT position rather than mutating. `ReadLineReader` starts one at position
 * `-1` and advances it per line read, so the first line of a resource is
 * position 0.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/LineLocationImpl.java
 */

import type { LineLocation } from './LineLocation.js';

export class LineLocationImpl implements LineLocation {
  private readonly desc: string;
  private readonly position: number;
  private readonly parent: LineLocation | undefined;

  constructor(desc: string, parent: LineLocation | undefined, position = -1) {
    this.desc = desc;
    this.parent = parent;
    this.position = position;
  }

  toString(): string {
    return `${this.desc} : ${String(this.position)}`;
  }

  /** @see ~/git/plantuml/.../utils/LineLocationImpl.java#oneLineRead */
  oneLineRead(): LineLocationImpl {
    return new LineLocationImpl(this.desc, this.parent, this.position + 1);
  }

  getPosition(): number {
    return this.position;
  }

  getDescription(): string {
    return this.desc;
  }

  getParent(): LineLocation | undefined {
    return this.parent;
  }

  /** @see ~/git/plantuml/.../utils/LineLocationImpl.java#isStandardLibrary */
  private isStandardLibrary(): boolean {
    return this.desc.startsWith('<');
  }

  /** @see ~/git/plantuml/.../utils/LineLocationImpl.java#compareTo */
  compareTo(other: LineLocationImpl): number {
    if (this.isStandardLibrary() && !other.isStandardLibrary()) return -1;

    if (!this.isStandardLibrary() && other.isStandardLibrary()) return 1;

    return this.position - other.position;
  }
}
