/**
 * Barrel for `tim/`'s memory / scoping / function model (SI5a batch 2a) and
 * the `CodeIterator` chain + `Eater*` directive parsers (SI5a batch 2b).
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

export type { TContext as ExpressionTContext } from './expression/Knowledge.js';

export {
  ExecutionContexts,
  ExecutionContextIf,
  ExecutionContextWhile,
  ExecutionContextForeach,
  type TMemory,
} from './TMemory.js';
export { TMemoryGlobal } from './TMemoryGlobal.js';
export { TMemoryLocal } from './TMemoryLocal.js';

export type { TContext, TFunction, TWarning, TPreprocessingOptionStore, TPreprocessingArtifact } from './TFunction.js';
export { TFunctionImpl } from './TFunctionImpl.js';

export { Eater } from './Eater.js';
export { StringEater } from './StringEater.js';

export { VariableManager } from './VariableManager.js';

// -- SI5a batch 2b: Eater* directive subclasses --
export { EaterAffectation } from './EaterAffectation.js';
export { EaterAffectationDefine } from './EaterAffectationDefine.js';
export { EaterAssert } from './EaterAssert.js';
export { EaterDeclareReturnFunction } from './EaterDeclareReturnFunction.js';
export { EaterDumpMemory } from './EaterDumpMemory.js';
export { EaterElseIf } from './EaterElseIf.js';
export { EaterForeach, size as eaterForeachSize } from './EaterForeach.js';
export { EaterIf } from './EaterIf.js';
export { EaterIfdef } from './EaterIfdef.js';
export { EaterIfndef } from './EaterIfndef.js';
export { EaterImport } from './EaterImport.js';
export { EaterInclude, PreprocessorIncludeStrategy } from './EaterInclude.js';
export { EaterIncludeDef } from './EaterIncludeDef.js';
export { EaterIncludeSprites } from './EaterIncludeSprites.js';
export { EaterIncludesub } from './EaterIncludesub.js';
export { EaterLegacyDefine } from './EaterLegacyDefine.js';
export { EaterLegacyDefineLong } from './EaterLegacyDefineLong.js';
export { EaterLog } from './EaterLog.js';
export { EaterOption, OptionKey, optionKeyDefaultValue } from './EaterOption.js';
export { EaterReturn } from './EaterReturn.js';
export { EaterStartsub } from './EaterStartsub.js';
export { EaterTheme } from './EaterTheme.js';
export { EaterUndef } from './EaterUndef.js';
export { EaterWhile } from './EaterWhile.js';

// -- SI5a batch 2b: the CodeIterator decorator chain --
export * from './iterator/index.js';
