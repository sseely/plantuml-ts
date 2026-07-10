import { ActorStyle } from '../../skin/ActorStyle.js';
import type { USymbol } from './USymbol.js';
import { USymbolAction } from './USymbolAction.js';
import { USymbolActor } from './USymbolActor.js';
import { USymbolActorBusiness } from './USymbolActorBusiness.js';
import { USymbolArtifact } from './USymbolArtifact.js';
import { USymbolBoundary } from './USymbolBoundary.js';
import { USymbolCard } from './USymbolCard.js';
import { USymbolCloud } from './USymbolCloud.js';
import { USymbolCollections } from './USymbolCollections.js';
import { USymbolComponent1 } from './USymbolComponent1.js';
import { USymbolComponent2 } from './USymbolComponent2.js';
import { USymbolControl } from './USymbolControl.js';
import { USymbolDatabase } from './USymbolDatabase.js';
import { USymbolEntityDomain } from './USymbolEntityDomain.js';
import { USymbolFile } from './USymbolFile.js';
import { USymbolFolder } from './USymbolFolder.js';
import { USymbolFrame } from './USymbolFrame.js';
import { USymbolHexagon } from './USymbolHexagon.js';
import { USymbolInterface } from './USymbolInterface.js';
import { USymbolLabel } from './USymbolLabel.js';
import { USymbolNode } from './USymbolNode.js';
import { USymbolPerson } from './USymbolPerson.js';
import { USymbolProcess } from './USymbolProcess.js';
import { USymbolQueue } from './USymbolQueue.js';
import { USymbolRectangle } from './USymbolRectangle.js';
import { USymbolStack } from './USymbolStack.js';
import { USymbolStorage } from './USymbolStorage.js';
import { USymbolUsecase } from './USymbolUsecase.js';

/**
 * USymbols — the static registry of every concrete descriptive/deployment
 * `USymbol` singleton, plus the `fromString` keyword-resolution logic.
 *
 * Upstream: decoration/symbol/USymbols.java (~150 ln, `public abstract
 * class USymbols` — a static-only holder, never instantiated). Ported in
 * full: the 35 `record(code, symbol)` registrations (identical order),
 * the private `all` map + `record` helper, and both `fromString`
 * overloads.
 *
 * Scope reduction on two upstream collaborator types this file's
 * `fromString` overloads take as parameters (reported, same reasoning as
 * `USymbol.ts`'s `SName` reduction and `ActorStyle.ts`'s deferred
 * `toUSymbol`):
 *
 * - `ComponentStyle` (skin/ComponentStyle.java) and `PackageStyle`
 *   (svek/PackageStyle.java) are ported here ONLY as their `toUSymbol()`
 *   resolution logic (`componentStyleToUSymbol`/`packageStyleToUSymbol`)
 *   — the sole method either type contributes to keyword resolution.
 *   Their `drawU`/`fromString`/private `drawXxx` drawing methods belong
 *   to the package/component rendering pipeline, not symbol resolution,
 *   and have no caller in this task's write-set; deferred to whichever
 *   task ports that rendering path.
 * - `ISkinParam` (style/ISkinParam.java) is represented here by
 *   {@link SkinParamSymbolStyles}, a minimal structural interface
 *   capturing only the two accessor methods the second `fromString`
 *   overload calls (`actorStyle()`, `componentStyle()`). Porting the
 *   full `ISkinParam` interface (~100+ members) here would be
 *   speculative — no code in this task's write-set needs more.
 * - `ActorStyle#toUSymbol()` (skin/ActorStyle.java) is implemented here
 *   as the free function {@link actorStyleToUSymbol}: `ActorStyle.ts`
 *   (out of this task's write-set) explicitly deferred porting it
 *   pending this file's existence — see that file's own doc comment.
 *
 * Reachability finding (verified against `USymbols.java:98-182`,
 * reported): the two `fromString` overloads are NOT equivalent —
 * overload 2 (the `ISkinParam`-driven one, `fromStringWithSkinParam`
 * here) has no `circle` branch at all, unlike overload 1
 * (`fromStringWithStyles`). A caller resolving raw source keywords
 * through the `ISkinParam` overload alone will never resolve `circle`
 * to `INTERFACE` — this is upstream's own asymmetry (bug-for-bug per
 * this project's porting discipline), not an omission in this port.
 * Any future integration (T14/T17) resolving the `circle` keyword must
 * either call the 4-arg overload or special-case `circle` before
 * calling `fromString`, exactly as upstream callers must.
 */

/**
 * `ComponentStyle` (skin/ComponentStyle.java) — scoped down to the
 * three-member enum + `toUSymbol()` dispatch; see this module's doc
 * comment for what is deliberately not ported.
 */
export const ComponentStyle = {
  UML1: 'UML1',
  UML2: 'UML2',
  RECTANGLE: 'RECTANGLE',
} as const;
export type ComponentStyle = (typeof ComponentStyle)[keyof typeof ComponentStyle];

/**
 * `PackageStyle` (svek/PackageStyle.java) — scoped down to the
 * twelve-member enum + `toUSymbol()` dispatch; see this module's doc
 * comment for what is deliberately not ported. Matches upstream:
 * `AGENT`/`STORAGE`/`COMPONENT1`/`COMPONENT2`/`ARTIFACT` fall through
 * to `null` (upstream's `toUSymbol()` has no branch for them either).
 */
export const PackageStyle = {
  FOLDER: 'FOLDER',
  RECTANGLE: 'RECTANGLE',
  NODE: 'NODE',
  FRAME: 'FRAME',
  CLOUD: 'CLOUD',
  DATABASE: 'DATABASE',
  AGENT: 'AGENT',
  STORAGE: 'STORAGE',
  COMPONENT1: 'COMPONENT1',
  COMPONENT2: 'COMPONENT2',
  ARTIFACT: 'ARTIFACT',
  CARD: 'CARD',
} as const;
export type PackageStyle = (typeof PackageStyle)[keyof typeof PackageStyle];

/**
 * Minimal structural projection of `ISkinParam` (style/ISkinParam.java)
 * — only the two accessor methods `fromString(symbol, skinParam)`
 * (upstream's `ISkinParam`-taking overload) calls. See this module's
 * doc comment.
 */
export interface SkinParamSymbolStyles {
  actorStyle(): ActorStyle;
  componentStyle(): ComponentStyle;
}

const all = new Map<string, USymbol>();

function record(code: string, symbol: USymbol): USymbol {
  all.set(code.toUpperCase(), symbol);
  return symbol;
}

export const ACTION = record('ACTION', new USymbolAction('action'));
export const ACTOR_AWESOME = record('ACTOR_AWESOME', new USymbolActor(ActorStyle.AWESOME));
export const ACTOR_HOLLOW = record('ACTOR_HOLLOW', new USymbolActor(ActorStyle.HOLLOW));
export const ACTOR_STICKMAN = record('ACTOR_STICKMAN', new USymbolActor(ActorStyle.STICKMAN));
export const ACTOR_STICKMAN_BUSINESS = record('ACTOR_STICKMAN_BUSINESS', new USymbolActorBusiness());
export const AGENT = record('AGENT', new USymbolRectangle('agent'));
export const ARCHIMATE = record('ARCHIMATE', new USymbolRectangle('archimate'));
export const ARTIFACT = record('ARTIFACT', new USymbolArtifact());
export const BOUNDARY = record('BOUNDARY', new USymbolBoundary());
export const CARD = record('CARD', new USymbolCard());
export const CLOUD = record('CLOUD', new USymbolCloud());
export const COLLECTIONS = record('COLLECTIONS', new USymbolCollections());
export const COMPONENT_RECTANGLE = record('COMPONENT_RECTANGLE', new USymbolRectangle('component'));
export const COMPONENT1 = record('COMPONENT1', new USymbolComponent1());
export const COMPONENT2 = record('COMPONENT2', new USymbolComponent2());
export const CONTROL = record('CONTROL', new USymbolControl());
export const DATABASE = record('DATABASE', new USymbolDatabase());
export const ENTITY_DOMAIN = record('ENTITY_DOMAIN', new USymbolEntityDomain());
export const FILE = record('FILE', new USymbolFile());
export const FOLDER = record('FOLDER', new USymbolFolder('folder', false));
export const FRAME = record('FRAME', new USymbolFrame('frame'));
export const GROUP = record('GROUP', new USymbolFrame('group'));
export const HEXAGON = record('HEXAGON', new USymbolHexagon());
export const INTERFACE = record('INTERFACE', new USymbolInterface());
export const LABEL = record('LABEL', new USymbolLabel());
export const NODE = record('NODE', new USymbolNode());
// SName.package_ (style/SName.java) — trailing underscore because
// `package` is a Java reserved word; preserved verbatim (see this
// project's CLAUDE.md naming-preservation rule) rather than renamed.
export const PACKAGE = record('PACKAGE', new USymbolFolder('package_', true));
export const PARTITION = record('PARTITION', new USymbolFrame('partition'));
export const PERSON = record('PERSON', new USymbolPerson());
export const PROCESS = record('PROCESS', new USymbolProcess('process'));
export const QUEUE = record('QUEUE', new USymbolQueue());
export const RECTANGLE = record('RECTANGLE', new USymbolRectangle('rectangle'));
export const STACK = record('STACK', new USymbolStack());
export const STORAGE = record('STORAGE', new USymbolStorage());
export const USECASE = record('USECASE', new USymbolUsecase(false));
export const USECASE_BUSINESS = record('USECASE_BUSINESS', new USymbolUsecase(true));

/**
 * `ActorStyle#toUSymbol()` (skin/ActorStyle.java) — see this module's
 * doc comment for why it lives here rather than in `ActorStyle.ts`.
 */
export function actorStyleToUSymbol(actorStyle: ActorStyle): USymbol {
  if (actorStyle === ActorStyle.STICKMAN) return ACTOR_STICKMAN;
  if (actorStyle === ActorStyle.AWESOME) return ACTOR_AWESOME;
  if (actorStyle === ActorStyle.HOLLOW) return ACTOR_HOLLOW;
  if (actorStyle === ActorStyle.STICKMAN_BUSINESS) return ACTOR_STICKMAN_BUSINESS;
  throw new Error(`actorStyleToUSymbol: unhandled ActorStyle ${actorStyle as string}`);
}

/** `ComponentStyle#toUSymbol()` (skin/ComponentStyle.java). */
export function componentStyleToUSymbol(componentStyle: ComponentStyle): USymbol {
  if (componentStyle === ComponentStyle.UML1) return COMPONENT1;
  if (componentStyle === ComponentStyle.UML2) return COMPONENT2;
  if (componentStyle === ComponentStyle.RECTANGLE) return COMPONENT_RECTANGLE;
  throw new Error(`componentStyleToUSymbol: unhandled ComponentStyle ${componentStyle as string}`);
}

/** `PackageStyle#toUSymbol()` (svek/PackageStyle.java). */
export function packageStyleToUSymbol(packageStyle: PackageStyle): USymbol | null {
  if (packageStyle === PackageStyle.NODE) return NODE;
  if (packageStyle === PackageStyle.CARD) return CARD;
  if (packageStyle === PackageStyle.DATABASE) return DATABASE;
  if (packageStyle === PackageStyle.CLOUD) return CLOUD;
  if (packageStyle === PackageStyle.FRAME) return FRAME;
  if (packageStyle === PackageStyle.RECTANGLE) return RECTANGLE;
  if (packageStyle === PackageStyle.FOLDER) return PACKAGE;
  return null;
}

/** Case-insensitive comparison against a known-lowercase literal. */
function equalsIgnoreCase(value: string, lowercaseLiteral: string): boolean {
  return value.toLowerCase() === lowercaseLiteral;
}

/**
 * `USymbols.fromString(String, ActorStyle, ComponentStyle, PackageStyle)`
 * — resolution driven by explicit style selectors rather than a full
 * `ISkinParam`. `circle` is reachable ONLY through this overload (see
 * this module's doc comment).
 */
function fromStringWithStyles(
  s: string | null,
  actorStyle: ActorStyle,
  componentStyle: ComponentStyle,
  packageStyle: PackageStyle,
): USymbol | null {
  if (s === null) return null;
  if (equalsIgnoreCase(s, 'package')) return packageStyleToUSymbol(packageStyle);
  if (equalsIgnoreCase(s, 'actor')) return actorStyleToUSymbol(actorStyle);
  if (equalsIgnoreCase(s, 'component')) return componentStyleToUSymbol(componentStyle);
  if (equalsIgnoreCase(s, 'entity')) return ENTITY_DOMAIN;
  if (equalsIgnoreCase(s, 'circle')) return INTERFACE;
  return all.get(s.replace(/\W/g, '').toUpperCase()) ?? null;
}

/**
 * `USymbols.fromString(String, ISkinParam)` — resolution driven by a
 * live skin-param object. Has NO `circle` branch (see this module's
 * doc comment) — upstream's own asymmetry, preserved bug-for-bug.
 */
function fromStringWithSkinParam(symbol: string, skinParam: SkinParamSymbolStyles): USymbol | null {
  if (equalsIgnoreCase(symbol, 'artifact')) return ARTIFACT;
  if (equalsIgnoreCase(symbol, 'folder')) return FOLDER;
  if (equalsIgnoreCase(symbol, 'file')) return FILE;
  if (equalsIgnoreCase(symbol, 'package')) return PACKAGE;
  if (equalsIgnoreCase(symbol, 'rectangle')) return RECTANGLE;
  if (equalsIgnoreCase(symbol, 'person')) return PERSON;
  if (equalsIgnoreCase(symbol, 'hexagon')) return HEXAGON;
  if (equalsIgnoreCase(symbol, 'label')) return LABEL;
  if (equalsIgnoreCase(symbol, 'collections')) return COLLECTIONS;
  if (equalsIgnoreCase(symbol, 'node')) return NODE;
  if (equalsIgnoreCase(symbol, 'frame')) return FRAME;
  if (equalsIgnoreCase(symbol, 'cloud')) return CLOUD;
  if (equalsIgnoreCase(symbol, 'action')) return ACTION;
  if (equalsIgnoreCase(symbol, 'process')) return PROCESS;
  if (equalsIgnoreCase(symbol, 'database')) return DATABASE;
  if (equalsIgnoreCase(symbol, 'queue')) return QUEUE;
  if (equalsIgnoreCase(symbol, 'stack')) return STACK;
  if (equalsIgnoreCase(symbol, 'storage')) return STORAGE;
  if (equalsIgnoreCase(symbol, 'agent')) return AGENT;
  if (equalsIgnoreCase(symbol, 'actor/')) return ACTOR_STICKMAN_BUSINESS;
  if (equalsIgnoreCase(symbol, 'actor')) return actorStyleToUSymbol(skinParam.actorStyle());
  if (equalsIgnoreCase(symbol, 'component')) return componentStyleToUSymbol(skinParam.componentStyle());
  if (equalsIgnoreCase(symbol, 'boundary')) return BOUNDARY;
  if (equalsIgnoreCase(symbol, 'control')) return CONTROL;
  if (equalsIgnoreCase(symbol, 'entity')) return ENTITY_DOMAIN;
  if (equalsIgnoreCase(symbol, 'card')) return CARD;
  if (equalsIgnoreCase(symbol, 'interface')) return INTERFACE;
  if (equalsIgnoreCase(symbol, '()')) return INTERFACE;
  return null;
  // #lizard forgives -- mirrors USymbols.java's own 28-branch if-chain
  // (fromString(String, ISkinParam)) verbatim; splitting it would
  // diverge from upstream's structure for no behavioral gain.
}

export function fromString(
  s: string | null,
  actorStyle: ActorStyle,
  componentStyle: ComponentStyle,
  packageStyle: PackageStyle,
): USymbol | null;
export function fromString(symbol: string, skinParam: SkinParamSymbolStyles): USymbol | null;
export function fromString(
  s: string | null,
  actorStyleOrSkinParam: ActorStyle | SkinParamSymbolStyles,
  componentStyle?: ComponentStyle,
  packageStyle?: PackageStyle,
): USymbol | null {
  if (componentStyle !== undefined && packageStyle !== undefined) {
    return fromStringWithStyles(s, actorStyleOrSkinParam as ActorStyle, componentStyle, packageStyle);
  }
  return fromStringWithSkinParam(s as string, actorStyleOrSkinParam as SkinParamSymbolStyles);
}

/**
 * The `USymbols` static registry, mirroring upstream's `USymbols.XXX`
 * static-field access pattern (`USymbols.ACTION`, `USymbols.fromString`,
 * …) as a single namespace object — TS has no direct analog of a
 * non-instantiable static-only Java class.
 */
export const USymbols = {
  ACTION,
  ACTOR_AWESOME,
  ACTOR_HOLLOW,
  ACTOR_STICKMAN,
  ACTOR_STICKMAN_BUSINESS,
  AGENT,
  ARCHIMATE,
  ARTIFACT,
  BOUNDARY,
  CARD,
  CLOUD,
  COLLECTIONS,
  COMPONENT_RECTANGLE,
  COMPONENT1,
  COMPONENT2,
  CONTROL,
  DATABASE,
  ENTITY_DOMAIN,
  FILE,
  FOLDER,
  FRAME,
  GROUP,
  HEXAGON,
  INTERFACE,
  LABEL,
  NODE,
  PACKAGE,
  PARTITION,
  PERSON,
  PROCESS,
  QUEUE,
  RECTANGLE,
  STACK,
  STORAGE,
  USECASE,
  USECASE_BUSINESS,
  fromString,
} as const;
