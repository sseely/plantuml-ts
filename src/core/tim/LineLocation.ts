/**
 * Where a line of source came from: its 0-based position, the resource that
 * produced it, and — for a line pulled in by `!include` — the location of the
 * `!include` line that pulled it.
 *
 * Batch SI6: this replaces the `export type LineLocation = unknown` stand-in
 * that `StringLocated.ts` carried through the TIM port (SI5a). Nothing in
 * `tim/` ever read a location — every use only stored or forwarded it — so an
 * opaque type was sufficient there. The error diagram
 * (`src/core/error/PSystemError.ts`) is the first reader: it walks the parent
 * chain to print `[From <description> (line <position + 1>) ]` above the source
 * listing, exactly as upstream's `PSystemError#getTextFromStack` does.
 *
 * `getParent()` returns `undefined` (not `null`) for a top-level line, per this
 * port's translation table.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/LineLocation.java
 */
export interface LineLocation {
  /** Position of the line, starting at 0. */
  getPosition(): number;

  /**
   * A description of the resource. For a source string this is `"string"`
   * (upstream `SourceStringReader` passes exactly that to `BlockUmlBuilder`);
   * for an included resource it is the include target.
   */
  getDescription(): string;

  /**
   * The location of the `!include` / `!includesub` / `!includedef` line that
   * pulled this resource in, or `undefined` at the top level.
   */
  getParent(): LineLocation | undefined;
}
