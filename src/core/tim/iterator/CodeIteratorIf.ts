/**
 * Interprets `!if` / `!ifdef` / `!ifndef` / `!elseif` / `!else` / `!endif`
 * inline as it's pulled through: each directive line is consumed and
 * never re-emitted; ordinary lines are skipped (not emitted) while any
 * enclosing `!if` on the stack is currently false.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorIf.java
 */

import type { StringLocated, TLineType } from '../StringLocated.js';
import { EaterElseIf } from '../EaterElseIf.js';
import { EaterException } from '../EaterException.js';
import { EaterIf } from '../EaterIf.js';
import { EaterIfdef } from '../EaterIfdef.js';
import { EaterIfndef } from '../EaterIfndef.js';
import { ExecutionContextIf } from '../TMemory.js';
import type { TMemory } from '../TMemory.js';
import type { TContext } from '../TFunction.js';
import { AbstractCodeIterator } from './AbstractCodeIterator.js';
import type { CodeIterator } from './CodeIterator.js';

const CONDITIONAL_DIRECTIVES: ReadonlySet<TLineType> = new Set([
  'IF',
  'IFDEF',
  'IFNDEF',
  'ELSE',
  'ELSEIF',
  'ENDIF',
]);

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodeIteratorIf.java
 */
export class CodeIteratorIf extends AbstractCodeIterator {
  private readonly context: TContext;
  private readonly memory: TMemory;
  private readonly logs: StringLocated[];

  constructor(source: CodeIterator, context: TContext, memory: TMemory, logs: StringLocated[]) {
    super(source);
    this.context = context;
    this.memory = memory;
    this.logs = logs;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  peek(): StringLocated | null {
    while (true) {
      const result = this.source.peek();
      if (result === null) return null;

      const type = result.getType();

      if (CONDITIONAL_DIRECTIVES.has(type)) {
        this.logs.push(result);
        this.processConditionalDirective(result, type);
        this.next();
        continue;
      }

      if (this.shouldSkipLine()) {
        this.logs.push(result);
        this.next();
        continue;
      }

      return result;
    }
  }

  private processConditionalDirective(line: StringLocated, type: TLineType): void {
    switch (type) {
      case 'IF':
        this.executeIf(line);
        break;
      case 'IFDEF':
        this.executeIfdef(line);
        break;
      case 'IFNDEF':
        this.executeIfndef(line);
        break;
      case 'ELSE':
        this.executeElse(line);
        break;
      case 'ELSEIF':
        this.executeElseIf(line);
        break;
      case 'ENDIF':
        this.executeEndif(line);
        break;
      default:
        break;
    }
  }

  private shouldSkipLine(): boolean {
    return this.memory.peekIf() !== undefined && !this.areAllIfOk();
  }

  private areAllIfOk(): boolean {
    return this.memory.areAllIfOk(this.context, this.memory);
  }

  // --- Execution methods ---

  private executeIf(s: StringLocated): void {
    let isTrue: boolean;
    if (this.areAllIfOk()) {
      const condition = new EaterIf(s);
      condition.analyze(this.context, this.memory);
      isTrue = condition.isTrue();
    } else {
      isTrue = false;
    }

    this.memory.addIf(ExecutionContextIf.fromValue(isTrue));
  }

  private executeIfdef(s: StringLocated): void {
    const condition = new EaterIfdef(s);
    condition.analyze(this.context, this.memory);
    const isTrue = condition.isTrue(this.context, this.memory);
    this.memory.addIf(ExecutionContextIf.fromValue(isTrue));
  }

  private executeIfndef(s: StringLocated): void {
    const condition = new EaterIfndef(s);
    condition.analyze(this.context, this.memory);
    const isTrue = condition.isTrue(this.context, this.memory);
    this.memory.addIf(ExecutionContextIf.fromValue(isTrue));
  }

  private executeElseIf(s: StringLocated): void {
    const poll = this.getRequiredIfContext(s, 'elseif');
    poll.enteringElseIf();

    if (!poll.hasBeenBurn()) {
      const condition = new EaterElseIf(s);
      condition.analyze(this.context, this.memory);
      if (condition.isTrue()) poll.nowInSomeElseIf();
    }
  }

  private executeElse(s: StringLocated): void {
    const poll = this.getRequiredIfContext(s, 'else');
    poll.nowInElse();
  }

  private executeEndif(s: StringLocated): void {
    const poll = this.memory.pollIf();
    if (poll === undefined) throw new EaterException('No if related to this endif', s);
  }

  // --- Helper methods ---

  private getRequiredIfContext(s: StringLocated, directive: string): ExecutionContextIf {
    const poll = this.memory.peekIf();
    if (poll === undefined) throw new EaterException(`No if related to this ${directive}`, s);

    return poll;
  }
}
