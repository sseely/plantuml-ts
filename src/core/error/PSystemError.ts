/**
 * The error diagram: PlantUML never throws on a malformed document, it RENDERS
 * one. This is the base class holding the text model that
 * `error-renderer.ts` draws — the source listing, the `[From … (line N) ]`
 * stack, the version banner, and the message — exactly as upstream composes
 * them in `PSystemError#getGraphicalFormatted`.
 *
 * Port shape: upstream's `PSystemError` extends `UgDiagram` and *returns a
 * `TextBlock`* from `getTextBlock`, composing it out of `TextBlockRaw` +
 * `TextBlockUtils.mergeTB` + `FontConfiguration`. This port has no
 * `TextBlockRaw`/`GraphicStrings`/`Display` stack (klimt's `TextBlockUtils`
 * here is a partial port whose `addBackcolor` is still a stub), so the class
 * keeps upstream's TEXT methods verbatim — `getTextFromStack`,
 * `getTextFullBody`, `getTextError`, `header`, `getPureAsciiFormatted`,
 * `score` — and the visual composition (which font, which colour, in which
 * order) lives next door in `error-renderer.ts`, drawing through the house SVG
 * emitter (`src/core/svg.ts`). The line CONTENT and its ORDER are upstream's;
 * only the drawing seam differs.
 *
 * Two upstream members are deliberately NOT ported:
 * - the time-based decorations (`addMessagePatreon` / `addMessageLiberapay` /
 *   `addMessageDedication`, selected by `System.currentTimeMillis() / 60000 %
 *   60`) and `addMessageArecibo`. `src/` may not read a clock (CLAUDE.md: no
 *   `Date.now()` — output must be reproducible), and all four draw bundled
 *   raster assets this port does not vendor. Upstream itself ships the switch
 *   that turns them off: `PSystemError.disableTimeBasedErrorDecorations()`.
 *   This port behaves as if that switch were permanently on.
 * - `getWarningOrError()`, which reads `getTitle()` off `UgDiagram` — no title
 *   layer here, and no caller.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemError.java
 */

import type { LineLocation } from '../tim/LineLocation.js';
import type { StringLocated } from '../tim/StringLocated.js';
import { fullDescription } from '../version.js';
import type { ErrorUml } from './ErrorUml.js';

/**
 * Upstream truncates a source listing longer than this, printing the first 5
 * lines, a `... ( skipping N lines )` marker, and the last 20.
 * @see ~/git/plantuml/.../error/PSystemError.java#getTextFullBody
 */
const MAX_TRACE_LINES_SHOWN = 40;
const HEAD_LINES = 5;
const TAIL_LINES = 20;

/** Upstream truncates any single listed line at this width. */
const MAX_LINE_LENGTH = 120;

/** Upstream shows the Welcome block only for a source shorter than this. */
const WELCOME_MAX_SOURCE_LINES = 5;

export abstract class PSystemError {
  /** The lines the interpreter actually executed, last one being the failure. */
  protected readonly trace: readonly StringLocated[];

  protected readonly singleError: ErrorUml;

  /**
   * The diagram's own source lines (`@start…` through `@end…`) — upstream's
   * `UmlSource`. Only its line COUNT is read (see
   * {@link getTotalLineCountLessThan5}); this port does not need the rest of
   * `UmlSource`'s surface, so it holds the lines directly rather than porting
   * the class.
   * @see ~/git/plantuml/.../core/UmlSource.java
   */
  protected readonly source: readonly StringLocated[];

  protected constructor(
    source: readonly StringLocated[],
    trace: readonly StringLocated[],
    singleError: ErrorUml,
  ) {
    this.source = source;
    this.trace = trace;
    this.singleError = singleError;
  }

  /** @see ~/git/plantuml/.../error/PSystemError.java#getLastLine */
  getLastLine(): StringLocated | undefined {
    return this.trace[this.trace.length - 1];
  }

  /** @see ~/git/plantuml/.../error/PSystemError.java#getLineLocation */
  getLineLocation(): LineLocation | undefined {
    return this.getLastLine()?.getLocation();
  }

  /** @see ~/git/plantuml/.../error/PSystemError.java#getErrorsUml */
  getErrorsUml(): readonly ErrorUml[] {
    return [this.singleError];
  }

  /** @see ~/git/plantuml/.../error/PSystemError.java#getFirstError */
  getFirstError(): ErrorUml {
    return this.singleError;
  }

  /** @see ~/git/plantuml/.../core/UmlSource.java#getTotalLineCountLessThan5 */
  getTotalLineCountLessThan5(): boolean {
    return this.source.length < WELCOME_MAX_SOURCE_LINES;
  }

  /**
   * The `[From <resource> (line N) ]` header — one entry per level of the
   * include stack, innermost first. `LineLocation#getPosition` is 0-based; the
   * printed line number is 1-based.
   * @see ~/git/plantuml/.../error/PSystemError.java#getTextFromStack
   */
  getTextFromStack(): string[] {
    const result: string[] = [];
    let lineLocation = this.getLineLocation();
    if (lineLocation !== undefined) {
      append(result, lineLocation);
      while (lineLocation.getParent() !== undefined) {
        lineLocation = lineLocation.getParent()!;
        append(result, lineLocation);
      }
    }
    return result;
  }

  /**
   * The source listing: a leading blank line, then every executed line, the
   * last of which is the one that failed (the renderer underlines it).
   * @see ~/git/plantuml/.../error/PSystemError.java#getTextFullBody
   */
  getTextFullBody(): string[] {
    const result: string[] = [' '];
    const traceSize = this.trace.length;
    if (traceSize > MAX_TRACE_LINES_SHOWN) {
      for (const s of this.trace.slice(0, HEAD_LINES)) addToResult(result, s);

      result.push('...');
      const skipped = traceSize - HEAD_LINES - TAIL_LINES;
      result.push(`... ( skipping ${String(skipped)} lines )`);
      result.push('...');
      for (const s of this.trace.slice(traceSize - TAIL_LINES, traceSize)) addToResult(result, s);
    } else {
      for (const s of this.trace) addToResult(result, s);
    }
    return result;
  }

  /** @see ~/git/plantuml/.../error/PSystemError.java#getTextError */
  getTextError(): string[] {
    return [` ${this.singleError.getError()}`];
  }

  /**
   * The version banner drawn above the listing.
   * @see ~/git/plantuml/.../error/PSystemError.java#header
   */
  header(): string[] {
    return [fullDescription()];
  }

  /**
   * The plain-text rendering of the whole error — upstream's `-ttxt` / CLI
   * output, and the most convenient assertion target in tests.
   * @see ~/git/plantuml/.../error/PSystemError.java#getPureAsciiFormatted
   */
  getPureAsciiFormatted(): string[] {
    const result = this.getTextFromStack();
    result.push(...this.getTextFullBody());
    result.push('^^^^^');
    result.push(...this.getTextError());
    return result;
  }

  /** @see ~/git/plantuml/.../error/PSystemError.java#getDescription */
  getDescription(): string {
    return '(Error)';
  }

  /**
   * How "good" this error is, when several diagram parsers each fail on the
   * same source and the best one must be picked (`PSystemErrorUtils#merge`).
   * @see ~/git/plantuml/.../error/PSystemError.java#score
   */
  score(): number {
    return this.trace.length * 10 + this.singleError.score();
  }
}

/** @see ~/git/plantuml/.../error/PSystemError.java#append */
function append(result: string[], lineLocation: LineLocation): void {
  result.push(
    `[From ${lineLocation.getDescription()} (line ${String(lineLocation.getPosition() + 1)}) ]`,
  );
}

/** @see ~/git/plantuml/.../error/PSystemError.java#addToResult */
function addToResult(result: string[], s: StringLocated): void {
  let tmp = s.getString();
  if (tmp.length > MAX_LINE_LENGTH) tmp = `${tmp.substring(0, MAX_LINE_LENGTH)} ...`;

  result.push(tmp);
}
