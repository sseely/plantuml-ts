import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { SymbolContext } from '../decoration/symbol/SymbolContext.js';
import { ActorStickMan } from './ActorStickMan.js';

/**
 * ActorStyle — the actor-drawing-style selector `USymbolActor`'s
 * constructor takes and `USymbolActorBusiness` hardcodes to
 * `STICKMAN_BUSINESS`.
 *
 * Upstream: skin/ActorStyle.java — a 4-value enum (`STICKMAN`,
 * `STICKMAN_BUSINESS`, `AWESOME`, `HOLLOW`) with `toUSymbol()` (dispatches
 * to a `USymbols.ACTOR_*` registry constant) and `getTextBlock(Fashion)`
 * (dispatches to `ActorStickMan`/`ActorAwesome`/`ActorHollow`).
 *
 * As-const object, not a TS `enum` (project convention — see
 * `HorizontalAlignment.ts`).
 *
 * Reachability finding (T9, verified against `USymbols.java:98-120,163-
 * 165` and this port's `skinparam.ts`): `actor`'s USymbol resolves via
 * `skinParam.actorStyle().toUSymbol()`, defaulting to `ActorStyle
 * .STICKMAN` — `HOLLOW`/`AWESOME` are reachable ONLY when a user sets
 * `skinparam actorStyle Hollow|Awesome`. This port's `skinparam.ts` has
 * no `actorStyle()` accessor at all (grepped: no match), so `HOLLOW`/
 * `AWESOME` have no caller anywhere in this codebase — `getTextBlock`
 * for those two branches is therefore intentionally NOT ported (throws
 * with a clear deferral message) rather than guessed at from
 * `ActorHollow.java`/`ActorAwesome.java`, which this task did not port.
 * `STICKMAN`/`STICKMAN_BUSINESS` (both reachable — the latter via the
 * `actor/` keyword spelling, `USymbols.java:162`) are ported in full.
 *
 * `toUSymbol()` (deferred, reported): requires the `USymbols` registry
 * class, which is not part of this port (no `USymbols.ts` file exists —
 * see `USymbol.ts`'s own doc comment on this scope reduction). No caller
 * in this task's write-set needs it; `USymbolActor`'s constructor takes
 * an `ActorStyle` value directly, never round-trips through
 * `toUSymbol()`.
 */
export const ActorStyle = {
  STICKMAN: 'STICKMAN',
  STICKMAN_BUSINESS: 'STICKMAN_BUSINESS',
  AWESOME: 'AWESOME',
  HOLLOW: 'HOLLOW',
} as const;
export type ActorStyle = (typeof ActorStyle)[keyof typeof ActorStyle];

/**
 * `ActorStyle#getTextBlock(Fashion)` — a free function here since TS
 * cannot attach instance methods to an as-const string-union "enum".
 */
export function actorStyleGetTextBlock(style: ActorStyle, symbolContext: SymbolContext): TextBlock {
  if (style === ActorStyle.STICKMAN) return new ActorStickMan(symbolContext, false);
  if (style === ActorStyle.STICKMAN_BUSINESS) return new ActorStickMan(symbolContext, true);
  throw new Error(
    `ActorStyle.getTextBlock: ${style} not ported — ActorHollow/ActorAwesome have no caller in this ` +
      'codebase (no skinparam actorStyle wiring exists yet); see this module\'s doc comment',
  );
}
