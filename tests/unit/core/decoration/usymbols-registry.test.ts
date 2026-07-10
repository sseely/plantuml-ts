/**
 * usymbols-registry.test.ts — T10: conformance tests for `USymbols.ts`,
 * the static `USymbol` singleton registry + `fromString` keyword
 * resolution, ported from `decoration/symbol/USymbols.java`.
 *
 * Three groups of table-driven cases, each keyed directly off
 * `USymbols.java`'s own source (verified line-by-line against
 * `USymbols.java:60-182`, quoted in this file's own comments where the
 * mapping is non-obvious):
 *
 * 1. The 35 `record(code, symbol)` registrations, reachable through
 *    `fromString`'s generic map fallback (case-insensitive,
 *    `\W`-stripped) — covers every registered singleton's concrete
 *    class AND (where the constructor is `SName`/`isBusiness`
 *    parameterized) its `getSNames()`/business-flag output.
 * 2. Both `fromString` overloads' special-cased keyword branches
 *    (`package`/`actor`/`component`/`entity`/`circle` for the
 *    style-driven overload; the full skinParam-driven overload's
 *    branch list).
 * 3. A cross-check against `descriptive-keywords.ts`'s `ALL_TYPES` (this
 *    port's parser-facing keyword table) — every keyword either
 *    resolves through `USymbols.fromString`, or is documented here as
 *    an intentional gap (see the "parser cross-check" describe block).
 */
import { describe, expect, it } from 'vitest';
import {
  USymbols,
  fromString,
  ComponentStyle,
  PackageStyle,
  type SkinParamSymbolStyles,
} from '../../../../src/core/decoration/symbol/USymbols.js';
import { ActorStyle } from '../../../../src/core/skin/ActorStyle.js';
import { USymbolAction } from '../../../../src/core/decoration/symbol/USymbolAction.js';
import { USymbolActor } from '../../../../src/core/decoration/symbol/USymbolActor.js';
import { USymbolActorBusiness } from '../../../../src/core/decoration/symbol/USymbolActorBusiness.js';
import { USymbolArtifact } from '../../../../src/core/decoration/symbol/USymbolArtifact.js';
import { USymbolBoundary } from '../../../../src/core/decoration/symbol/USymbolBoundary.js';
import { USymbolCard } from '../../../../src/core/decoration/symbol/USymbolCard.js';
import { USymbolCloud } from '../../../../src/core/decoration/symbol/USymbolCloud.js';
import { USymbolCollections } from '../../../../src/core/decoration/symbol/USymbolCollections.js';
import { USymbolComponent1 } from '../../../../src/core/decoration/symbol/USymbolComponent1.js';
import { USymbolComponent2 } from '../../../../src/core/decoration/symbol/USymbolComponent2.js';
import { USymbolControl } from '../../../../src/core/decoration/symbol/USymbolControl.js';
import { USymbolDatabase } from '../../../../src/core/decoration/symbol/USymbolDatabase.js';
import { USymbolEntityDomain } from '../../../../src/core/decoration/symbol/USymbolEntityDomain.js';
import { USymbolFile } from '../../../../src/core/decoration/symbol/USymbolFile.js';
import { USymbolFolder } from '../../../../src/core/decoration/symbol/USymbolFolder.js';
import { USymbolFrame } from '../../../../src/core/decoration/symbol/USymbolFrame.js';
import { USymbolHexagon } from '../../../../src/core/decoration/symbol/USymbolHexagon.js';
import { USymbolInterface } from '../../../../src/core/decoration/symbol/USymbolInterface.js';
import { USymbolLabel } from '../../../../src/core/decoration/symbol/USymbolLabel.js';
import { USymbolNode } from '../../../../src/core/decoration/symbol/USymbolNode.js';
import { USymbolPerson } from '../../../../src/core/decoration/symbol/USymbolPerson.js';
import { USymbolProcess } from '../../../../src/core/decoration/symbol/USymbolProcess.js';
import { USymbolQueue } from '../../../../src/core/decoration/symbol/USymbolQueue.js';
import { USymbolRectangle } from '../../../../src/core/decoration/symbol/USymbolRectangle.js';
import { USymbolStack } from '../../../../src/core/decoration/symbol/USymbolStack.js';
import { USymbolStorage } from '../../../../src/core/decoration/symbol/USymbolStorage.js';
import { USymbolUsecase } from '../../../../src/core/decoration/symbol/USymbolUsecase.js';
import { ALL_TYPES } from '../../../../src/core/descriptive-keywords.js';

/** Arbitrary-but-fixed style selectors used wherever a test case's
 * resolution path doesn't depend on the style value itself. */
const DEFAULT_ACTOR_STYLE = ActorStyle.STICKMAN;
const DEFAULT_COMPONENT_STYLE = ComponentStyle.UML1;
const DEFAULT_PACKAGE_STYLE = PackageStyle.FOLDER;

/** A `SkinParamSymbolStyles` stub that always answers the same styles. */
function stubSkinParam(
  actorStyle: ActorStyle = DEFAULT_ACTOR_STYLE,
  componentStyle: ComponentStyle = DEFAULT_COMPONENT_STYLE,
): SkinParamSymbolStyles {
  return {
    actorStyle: () => actorStyle,
    componentStyle: () => componentStyle,
  };
}

describe('USymbols registry — record() singletons', () => {
  // Group 1: every `record(code, symbol)` registration from
  // USymbols.java:60-95, reached through fromString's generic map
  // fallback (case-insensitive, \W-stripped — never special-cased by
  // either overload). Each row: [input text, expected class,
  // expected getSNames() OR undefined when not constructor-parameterized].
  const registryCases: readonly [string, new (...args: never[]) => object, readonly string[] | undefined][] = [
    ['ACTION', USymbolAction, ['action']],
    ['actor_stickman', USymbolActor, ['actor']],
    ['Actor_Hollow', USymbolActor, ['actor']],
    ['ACTOR_AWESOME', USymbolActor, ['actor']],
    ['actor_stickman_business', USymbolActorBusiness, ['business']],
    ['agent', USymbolRectangle, ['agent']],
    ['ARCHIMATE', USymbolRectangle, ['archimate']],
    ['artifact', USymbolArtifact, ['artifact']],
    ['boundary', USymbolBoundary, ['boundary']],
    ['card', USymbolCard, ['card']],
    ['cloud', USymbolCloud, ['cloud']],
    ['collections', USymbolCollections, ['collections']],
    ['component_rectangle', USymbolRectangle, ['component']],
    ['component1', USymbolComponent1, ['component']],
    ['component2', USymbolComponent2, ['component']],
    ['control', USymbolControl, ['control']],
    ['database', USymbolDatabase, ['database']],
    ['entity_domain', USymbolEntityDomain, ['entity']],
    ['file', USymbolFile, ['file']],
    ['folder', USymbolFolder, ['folder']],
    ['frame', USymbolFrame, ['frame']],
    ['group', USymbolFrame, ['group']],
    ['hexagon', USymbolHexagon, ['hexagon']],
    ['interface', USymbolInterface, ['interface']],
    ['label', USymbolLabel, ['label']],
    ['node', USymbolNode, ['node']],
    ['package', USymbolFolder, ['package_']],
    ['partition', USymbolFrame, ['partition']],
    ['person', USymbolPerson, ['person']],
    ['process', USymbolProcess, ['process']],
    ['queue', USymbolQueue, ['queue']],
    ['rectangle', USymbolRectangle, ['rectangle']],
    ['stack', USymbolStack, ['stack']],
    ['storage', USymbolStorage, ['storage']],
    ['usecase', USymbolUsecase, ['usecase']],
    ['usecase_business', USymbolUsecase, ['usecase', 'business']],
  ];

  it.each(registryCases)('%s resolves to %s', (input, expectedClass, expectedSNames) => {
    const result = fromString(input, DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE);
    expect(result).toBeInstanceOf(expectedClass);
    if (expectedSNames !== undefined) {
      expect(result?.getSNames()).toEqual(expectedSNames);
    }
  });

  it('is case-insensitive, and \\W-strips (but does not remove) underscores (StringUtils.goUpperCase + regex \\W, which excludes "_")', () => {
    // Underscore is a \\w char in both Java and JS regex, so it survives
    // the strip — this is why the registry key is "COMPONENT_RECTANGLE"
    // (with underscore) rather than "COMPONENTRECTANGLE".
    expect(fromString('Component_Rectangle', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBe(
      USymbols.COMPONENT_RECTANGLE,
    );
    // A hyphen, by contrast, IS \\W and gets stripped — so it does NOT
    // reproduce the underscore-joined registry key.
    expect(fromString('Component-Rectangle', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBeNull();
    expect(fromString('  ', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBeNull();
  });

  it('every USymbols.* named export is a distinct singleton reused across lookups', () => {
    expect(fromString('rectangle', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBe(
      USymbols.RECTANGLE,
    );
    expect(USymbols.RECTANGLE).not.toBe(USymbols.AGENT);
    expect(USymbols.FOLDER).not.toBe(USymbols.PACKAGE);
  });
});

describe('fromString(s, actorStyle, componentStyle, packageStyle) — overload 1', () => {
  it('s === null returns null (USymbols.java:100-101)', () => {
    expect(fromString(null, DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBeNull();
  });

  it.each([
    [PackageStyle.FOLDER, USymbols.PACKAGE],
    [PackageStyle.RECTANGLE, USymbols.RECTANGLE],
    [PackageStyle.NODE, USymbols.NODE],
    [PackageStyle.FRAME, USymbols.FRAME],
    [PackageStyle.CLOUD, USymbols.CLOUD],
    [PackageStyle.DATABASE, USymbols.DATABASE],
    [PackageStyle.CARD, USymbols.CARD],
  ] as const)('"package" + PackageStyle.%s resolves to packageStyle.toUSymbol()', (packageStyle, expected) => {
    expect(fromString('package', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, packageStyle)).toBe(expected);
  });

  it.each([PackageStyle.AGENT, PackageStyle.STORAGE, PackageStyle.COMPONENT1, PackageStyle.COMPONENT2, PackageStyle.ARTIFACT] as const)(
    '"package" + PackageStyle.%s resolves to null (no branch in PackageStyle#toUSymbol())',
    (packageStyle) => {
      expect(fromString('package', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, packageStyle)).toBeNull();
    },
  );

  it.each([
    [ActorStyle.STICKMAN, USymbols.ACTOR_STICKMAN],
    [ActorStyle.STICKMAN_BUSINESS, USymbols.ACTOR_STICKMAN_BUSINESS],
    [ActorStyle.AWESOME, USymbols.ACTOR_AWESOME],
    [ActorStyle.HOLLOW, USymbols.ACTOR_HOLLOW],
  ] as const)('"actor" + ActorStyle.%s resolves to actorStyle.toUSymbol()', (actorStyle, expected) => {
    expect(fromString('actor', actorStyle, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBe(expected);
  });

  it.each([
    [ComponentStyle.UML1, USymbols.COMPONENT1],
    [ComponentStyle.UML2, USymbols.COMPONENT2],
    [ComponentStyle.RECTANGLE, USymbols.COMPONENT_RECTANGLE],
  ] as const)('"component" + ComponentStyle.%s resolves to componentStyle.toUSymbol()', (componentStyle, expected) => {
    expect(fromString('component', DEFAULT_ACTOR_STYLE, componentStyle, DEFAULT_PACKAGE_STYLE)).toBe(expected);
  });

  it('"entity" resolves to ENTITY_DOMAIN regardless of style params', () => {
    expect(fromString('ENTITY', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBe(
      USymbols.ENTITY_DOMAIN,
    );
  });

  it('"circle" resolves to INTERFACE (only reachable via this overload)', () => {
    expect(fromString('circle', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBe(
      USymbols.INTERFACE,
    );
  });

  it('an unregistered code resolves to null', () => {
    expect(fromString('not-a-real-symbol', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBeNull();
  });
});

describe('fromString(symbol, skinParam) — overload 2', () => {
  // Group 2b: every branch of USymbols.java:122-182, in source order.
  const directCases: readonly [string, unknown][] = [
    ['artifact', USymbols.ARTIFACT],
    ['folder', USymbols.FOLDER],
    ['file', USymbols.FILE],
    ['package', USymbols.PACKAGE],
    ['rectangle', USymbols.RECTANGLE],
    ['person', USymbols.PERSON],
    ['hexagon', USymbols.HEXAGON],
    ['label', USymbols.LABEL],
    ['collections', USymbols.COLLECTIONS],
    ['node', USymbols.NODE],
    ['frame', USymbols.FRAME],
    ['cloud', USymbols.CLOUD],
    ['action', USymbols.ACTION],
    ['process', USymbols.PROCESS],
    ['database', USymbols.DATABASE],
    ['queue', USymbols.QUEUE],
    ['stack', USymbols.STACK],
    ['storage', USymbols.STORAGE],
    ['agent', USymbols.AGENT],
    ['actor/', USymbols.ACTOR_STICKMAN_BUSINESS],
    ['boundary', USymbols.BOUNDARY],
    ['control', USymbols.CONTROL],
    ['entity', USymbols.ENTITY_DOMAIN],
    ['card', USymbols.CARD],
    ['interface', USymbols.INTERFACE],
    ['()', USymbols.INTERFACE],
  ];

  it.each(directCases)('"%s" resolves to the fixed singleton', (input, expected) => {
    expect(fromString(input, stubSkinParam())).toBe(expected);
  });

  it('"ACTOR/" is matched case-insensitively too', () => {
    expect(fromString('ACTOR/', stubSkinParam())).toBe(USymbols.ACTOR_STICKMAN_BUSINESS);
  });

  it('"actor" (no slash) delegates to skinParam.actorStyle().toUSymbol()', () => {
    expect(fromString('actor', stubSkinParam(ActorStyle.AWESOME))).toBe(USymbols.ACTOR_AWESOME);
    expect(fromString('actor', stubSkinParam(ActorStyle.HOLLOW))).toBe(USymbols.ACTOR_HOLLOW);
  });

  it('"component" delegates to skinParam.componentStyle().toUSymbol()', () => {
    expect(fromString('component', stubSkinParam(DEFAULT_ACTOR_STYLE, ComponentStyle.UML2))).toBe(USymbols.COMPONENT2);
  });

  it('"circle" resolves to null — asymmetry with overload 1 (no branch in USymbols.java:122-182)', () => {
    expect(fromString('circle', stubSkinParam())).toBeNull();
  });

  it('an unrecognized symbol resolves to null (falls through every branch)', () => {
    expect(fromString('not-a-real-symbol', stubSkinParam())).toBeNull();
  });
});

describe('parser cross-check — descriptive-keywords.ts ALL_TYPES vs USymbols.fromString', () => {
  // Keywords with no USymbol registration at all — `port` has no analog
  // in USymbols.java's registry (verified: grepped, no PORT/PORTIN/
  // PORTOUT record()). Ports are a distinct rendering concept (interface
  // lollipop connection points), not a `USymbol` shape — reported gap,
  // not a bug to fix here (per this task's Read-set instructions: report,
  // don't fix the parser).
  const NO_USYMBOL_ANALOG = new Set(['port', 'portin', 'portout']);

  // "usecase/" and "actor/" are the two ALL_TYPES entries that resolve
  // DIFFERENTLY than their parser-facing semantic tags
  // ('usecase-business'/'actor-business') would suggest — verified
  // directly against USymbols.java:98-182 (grepped: no "usecase/" branch
  // in EITHER overload; "actor/" is special-cased ONLY in overload 2,
  // USymbols.java:162-163).
  //
  // Overload 1 (style-driven) falls through to the generic map lookup
  // for both: stripping the trailing "/" (a \W char) yields "usecase"
  // / "actor". "USECASE" IS a registered map key (-> plain USECASE, not
  // USECASE_BUSINESS); bare "ACTOR" is NOT registered (only
  // ACTOR_AWESOME/ACTOR_HOLLOW/ACTOR_STICKMAN/ACTOR_STICKMAN_BUSINESS
  // are), so "actor/" resolves to null via overload 1.
  //
  // Overload 2 (skinParam-driven) has an explicit "actor/" branch
  // (-> ACTOR_STICKMAN_BUSINESS) but no "usecase/" branch at all
  // (-> null).
  //
  // Upstream's REAL resolution path for both business variants is a
  // direct reference to the registry constant from the command
  // factories, bypassing `fromString` entirely: `USymbols
  // .USECASE_BUSINESS` (`CommandCreateElementFull.java:289`,
  // `CommandCreateElementMultilines.java:179-180`,
  // `CommandLinkElement.java:369-370`) and `USymbols
  // .ACTOR_STICKMAN_BUSINESS` (via `ActorStyle#toUSymbol()`, reachable
  // when `skinparam actorStyle` is unset and the `actor/` keyword is
  // used — see `abel/Entity.java:412-413`, which favors
  // `USECASE_BUSINESS` directly over any `fromString` call). Any future
  // T14/T17 integration resolving either business form must reference
  // the `USymbols.*_BUSINESS` constant directly (mirroring upstream),
  // not rely on `fromString` to resolve the raw "actor/"/"usecase/" text
  // uniformly across both overloads — reported here, not fixed (this
  // task's write-set is `USymbols.ts` + this test file only).
  it('"usecase/" resolves to plain USECASE via overload 1, and to null via overload 2', () => {
    expect(fromString('usecase/', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBe(
      USymbols.USECASE,
    );
    expect(fromString('usecase/', stubSkinParam())).toBeNull();
  });

  it('"actor/" resolves to null via overload 1 (no bare "ACTOR" registry key), and to ACTOR_STICKMAN_BUSINESS via overload 2', () => {
    expect(fromString('actor/', DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBeNull();
    expect(fromString('actor/', stubSkinParam())).toBe(USymbols.ACTOR_STICKMAN_BUSINESS);
  });

  const OVERLOAD1_NULL_KEYWORDS = new Set(['usecase/', 'actor/']);

  it.each(ALL_TYPES.filter((keyword) => !NO_USYMBOL_ANALOG.has(keyword) && !OVERLOAD1_NULL_KEYWORDS.has(keyword)))(
    'keyword "%s" resolves to a non-null USymbol via overload 1',
    (keyword) => {
      expect(fromString(keyword, DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).not.toBeNull();
    },
  );

  it.each([...NO_USYMBOL_ANALOG])('keyword "%s" has no USymbol analog (reported gap, not fixed here)', (keyword) => {
    expect(fromString(keyword, DEFAULT_ACTOR_STYLE, DEFAULT_COMPONENT_STYLE, DEFAULT_PACKAGE_STYLE)).toBeNull();
    expect(fromString(keyword, stubSkinParam())).toBeNull();
  });
});
