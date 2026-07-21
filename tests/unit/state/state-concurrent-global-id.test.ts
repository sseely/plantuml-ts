import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { concurrentRegionScopeId } from '../../../src/diagrams/state/state-parse-state.js';

/**
 * Mission G4 S14 (CONC-region bare-name global numbering) -- jar's real
 * `net.atmp.CucaDiagram#cpt2` is ONE diagram-wide counter, ticked once per
 * `--`/`||` concurrent-region separator in DOCUMENT (parse) order,
 * regardless of which composite state owns it
 * (`StateDiagram#concurrentState`'s own `getUniqueSequence2(CONCURRENT_
 * PREFIX)`, StateDiagram.java:194-208). This port's internal
 * `concurrentRegionScopeId` key stays owner-local (unchanged, still the
 * dedup key used for firing-order/pass lookups) -- `ast.concurrentGlobalIds`
 * is a SEPARATE, additive translation table from that internal key to jar's
 * global number, consumed only by the renderer's `localScopeName` to
 * produce the byte-correct `CONC<n>` in `*start*CONC<n>-to-X` path ids.
 * @see plans/g4-state-svg/ledger.md (S14)
 */

function parse(source: string) {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

describe('CONC-region global numbering (mission G4 S14)', () => {
  it('a single composite with one `--` gets global number 1', () => {
    const ast = parse(`
      state State1 {
        [*] -> State1a
        State1a --> [*]
        --
        [*] -> State1b
        State1b --> [*]
      }
    `);
    expect(ast.concurrentGlobalIds?.get(concurrentRegionScopeId('State1', 1))).toBe(1);
  });

  it('second composite (own local region 1) continues the GLOBAL counter, not restarting at 1', () => {
    // lalava-26-zosi801's own shape: two sibling composites, each with
    // exactly one `--` (so exactly one concurrentRegions[0] each). Owner-
    // local numbering would give BOTH composites region "1" -- jar's real
    // diagram-global counter gives State1's region "1" and State2's "2".
    const ast = parse(`
      state State1 {
        [*] -> State1a
        State1a --> [*]
        --
        [*] -> State1b
        State1b --> [*]
      }

      state State2 {
        [*] -> State2a
        State2a --> [*]
        --
        [*] -> State2b
        State2b --> [*]
      }
    `);
    expect(ast.concurrentGlobalIds?.get(concurrentRegionScopeId('State1', 1))).toBe(1);
    expect(ast.concurrentGlobalIds?.get(concurrentRegionScopeId('State2', 1))).toBe(2);
  });

  it('a composite with two `--` separators (three regions) ticks the global counter twice', () => {
    const ast = parse(`
      state Comp {
        [*] -> A
        --
        [*] -> B
        --
        [*] -> C
      }
    `);
    expect(ast.concurrentGlobalIds?.get(concurrentRegionScopeId('Comp', 1))).toBe(1);
    expect(ast.concurrentGlobalIds?.get(concurrentRegionScopeId('Comp', 2))).toBe(2);
  });

  it('pass TWO replay does not double-tick the global counter', () => {
    // A forward reference forces a second parser pass over the same `--`
    // line -- the global counter must still land on 1, not 2.
    const ast = parse(`
      state State1 {
        [*] -> State1a
        --
        [*] -> State1b
      }
      State1a --> Later
      state Later
    `);
    expect(ast.concurrentGlobalIds?.get(concurrentRegionScopeId('State1', 1))).toBe(1);
  });

  it('a diagram with no `--` separators has an empty concurrentGlobalIds map', () => {
    const ast = parse(`
      [*] --> Idle
      Idle --> Running
    `);
    expect(ast.concurrentGlobalIds?.size ?? 0).toBe(0);
  });
});
