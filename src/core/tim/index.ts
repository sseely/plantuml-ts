/**
 * Barrel for `tim/`'s memory / scoping / function model, ported in mission
 * SI5a batch 2a.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/
 */

export type { LineLocation, TLineType } from './StringLocated.js';
export { StringLocated } from './StringLocated.js';

export { EaterException } from './EaterException.js';

export { TMode } from './TMode.js';

export { TVariableScope, lazzyParse } from './TVariableScope.js';

export { TFunctionType, isLegacyTFunctionType } from './TFunctionType.js';

export { TFunctionArgument } from './TFunctionArgument.js';

export { TFunctionSignature } from './TFunctionSignature.js';

export type { Trie } from './Trie.js';
export { TrieImpl } from './TrieImpl.js';

export type { TContext } from './expression/Knowledge.js';

export {
  ExecutionContexts,
  type ExecutionContextIf,
  type ExecutionContextWhile,
  type ExecutionContextForeach,
  type TMemory,
} from './TMemory.js';
export { TMemoryGlobal } from './TMemoryGlobal.js';
export { TMemoryLocal } from './TMemoryLocal.js';

export type { TFunction } from './TFunction.js';
export { TFunctionImpl } from './TFunctionImpl.js';

export { Eater } from './Eater.js';
export { StringEater } from './StringEater.js';

export { VariableManager } from './VariableManager.js';
