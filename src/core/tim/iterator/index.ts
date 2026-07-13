/**
 * Barrel for `tim/iterator/` -- the pull-based `CodeIterator` decorator
 * chain, ported in mission SI5a batch 2b.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/
 */

export type { CodePosition } from './CodePosition.js';
export type { CodeIterator } from './CodeIterator.js';
export { AbstractCodeIterator } from './AbstractCodeIterator.js';
export { CodeIteratorImpl } from './CodeIteratorImpl.js';

export { Sub } from './Sub.js';
export { buildCodeIterator, type CodeIteratorChainDeps } from './buildCodeIterator.js';

export { CodeIteratorIf } from './CodeIteratorIf.js';
export { CodeIteratorForeach } from './CodeIteratorForeach.js';
export { CodeIteratorWhile } from './CodeIteratorWhile.js';
export { CodeIteratorProcedure } from './CodeIteratorProcedure.js';
export { CodeIteratorReturnFunction } from './CodeIteratorReturnFunction.js';
export { CodeIteratorSub } from './CodeIteratorSub.js';
export { CodeIteratorAffectation } from './CodeIteratorAffectation.js';
export { CodeIteratorLegacyDefine } from './CodeIteratorLegacyDefine.js';
export { CodeIteratorInnerComment } from './CodeIteratorInnerComment.js';
export { CodeIteratorLongComment } from './CodeIteratorLongComment.js';
export { CodeIteratorShortComment } from './CodeIteratorShortComment.js';
