/**
 * The error diagram for a PREPROCESSOR (TIM) failure — an orphan `!endif`, a
 * call to an unknown function, an include that cannot be resolved.
 *
 * Upstream's flow, which this port mirrors exactly:
 *   `TimLoader#load` catches the `EaterException` and marks the last line of
 *   the debug trace with the message (`StringLocated#withErrorPreprocessor`);
 *   `BlockUml#getDiagram` sees `preprocessorError` and builds this class, which
 *   reads the message straight back off that line
 *   (`getLastLine().getPreprocessorError()`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemErrorPreprocessor.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TimLoader.java#load
 */

import type { StringLocated } from '../tim/StringLocated.js';
import { ErrorUml } from './ErrorUml.js';
import { PSystemError } from './PSystemError.js';

export class PSystemErrorPreprocessor extends PSystemError {
  /**
   * @param input the diagram's source lines (`@start…`/`@end…` included) —
   *              upstream's `UmlSource.create(input, …)`.
   * @param trace the interpreter's debug trace, whose LAST line must already
   *              carry the failure via `withErrorPreprocessor`.
   */
  constructor(input: readonly StringLocated[], trace: readonly StringLocated[]) {
    const lastLine = trace[trace.length - 1];
    super(
      input,
      trace,
      new ErrorUml(
        'SYNTAX_ERROR',
        lastLine?.getPreprocessorError() ?? '',
        0,
        lastLine,
        undefined,
      ),
    );
  }
}
