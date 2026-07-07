/**
 * Regression tests for the descriptive-signal dispatch guard (D3).
 *
 * Drives the *real* singleton registry (populated by importing src/index.js for
 * its registration side effects) through the public `extractBlocks` →
 * `registry.resolve` path. These are the "on-call" detectors for misrouting:
 * before the guard, `class.accepts` (`^interface\s`) and `sequence.accepts`
 * (`actor`) stole descriptive diagrams (the `cocice` fixture — one of every
 * element keyword — collapsed into the class renderer).
 */

import { describe, it, expect } from 'vitest';
// Side effect: registers every plugin into the singleton in production order.
import '../../../src/index.js';
import { registry } from '../../../src/core/dispatcher.js';
import { extractBlocks } from '../../../src/core/block-extractor.js';

/** Resolve a full @startuml block to the plugin type the dispatcher picks. */
function resolveType(puml: string): string {
  const blocks = extractBlocks(puml.split('\n'));
  expect(blocks).toHaveLength(1);
  const [block] = blocks;
  if (block === undefined) throw new Error('no block extracted');
  return registry.resolve(block).type;
}

// The cocice fixture: one of every descriptive element keyword, including
// `interface  interface` and a bare `actor`. (oracle/corpus-cache/class/
// cocice-93-xezi825/input.puml)
const COCICE = `@startuml
skinparam roundCorner 10
actor actor
agent agent
artifact artifact
boundary boundary
card card
cloud cloud
component component
control control
database database
entity entity
file file
folder folder
frame frame
interface  interface
node node
package package
queue queue
stack stack
rectangle rectangle
storage storage
usecase usecase
@enduml`;

describe('descriptive dispatch guard — class is no longer stolen', () => {
  it('routes the cocice all-keywords fixture away from class', () => {
    expect(resolveType(COCICE)).not.toBe('class');
  });

  it('keeps a pure interface block on the class plugin', () => {
    const puml = `@startuml
interface Foo
interface Bar
@enduml`;
    expect(resolveType(puml)).toBe('class');
  });

  it('keeps a class block with relations on the class plugin', () => {
    const puml = `@startuml
class Foo {
  +id: int
}
Foo --|> Bar
@enduml`;
    expect(resolveType(puml)).toBe('class');
  });
});

describe('descriptive dispatch guard — sequence is no longer stolen', () => {
  it('keeps a bare actor + message on the sequence plugin', () => {
    const puml = `@startuml
actor Bob
Bob -> Alice : hi
@enduml`;
    expect(resolveType(puml)).toBe('sequence');
  });

  it('routes actor + use-case shorthand away from sequence', () => {
    const puml = `@startuml
actor Bob
(Login)
@enduml`;
    expect(resolveType(puml)).not.toBe('sequence');
  });
});

describe('descriptive dispatch guard — keyword-named class in a relationship', () => {
  it('keeps a class NAMED like a descriptive keyword on the class plugin', () => {
    // `Queue`/`Entity` are descriptive keywords, but here they are CLASS names
    // used as relationship endpoints — not `queue`/`entity` element decls.
    const puml = `@startuml
class Queue
class QueueEntry
Queue "1" -- "*" QueueEntry
@enduml`;
    expect(resolveType(puml)).toBe('class');
  });

  it('still routes a genuine descriptive element declaration to description', () => {
    const puml = `@startuml
entity Entity {
  * id
}
@enduml`;
    expect(resolveType(puml)).not.toBe('class');
  });
});
