/**
 * `muteClassifierToGroup` creationIndex reuse (G2 N8, N2's diagnosed-but-
 * unfixed off-by-one).
 *
 * Upstream mutates the SAME `Entity` object in place when a classifier
 * declaration is reopened as a `package`/`namespace` block of the same
 * qualified id (`Entity#muteToGroupType`, `CucaDiagram#gotoGroup` --
 * `class-container.ts`'s own file doc comment) rather than allocating a
 * fresh uid. This port instead deletes the classifier row and creates a
 * brand-new `Namespace` object — `openNamespaceBlock`/`muteClassifierToGroup`
 * (class-container.ts) now thread the deleted classifier's own
 * `creationIndex` into the replacement `Namespace` (via
 * `ensureNamespaceChain`'s `reuseCreationIndex` param, class-namespace.ts)
 * instead of letting it consume the next counter slot.
 *
 * `reuseCreationIndex` only fires for a reopen whose FULL qualified id
 * exactly matches an already-muted classifier (the `openNamespaceBlock`
 * call site's own `effectiveId`) — an intermediate segment of a dotted
 * chain that happens to also be an existing classifier id is a separate,
 * NOT-yet-investigated case (no corpus fixture exercises it; not asserted
 * here).
 *
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:342-363 (gotoGroup)
 * @see ~/git/plantuml/.../abel/Entity.java:201-204 (muteToGroupType)
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('muteClassifierToGroup creationIndex reuse (G2 N8)', () => {
  it('a non-dotted package reopening an auto-created classifier reuses its ' +
    'OWN creationIndex, not a fresh counter slot (bejusa-95-gafo325 style)', () => {
    // 1=VCAN_DRV (explicit declaration); 2=PCAN_DRV (auto-created as the
    // relationship's endpoint); 3=the relationship itself; `package PCAN_DRV
    // { class Bus }` then reopens PCAN_DRV -- the resulting Namespace must
    // keep creationIndex 2 (REUSED from the muted classifier), so Bus (the
    // next NEW thing created) lands on 4, not 3 (which it would steal if the
    // reopen wrongly bumped the counter for itself).
    const ast = parse(`
      class VCAN_DRV
      VCAN_DRV *-- PCAN_DRV
      package PCAN_DRV {
        class Bus
      }
    `);
    const vcan = ast.classifiers.find((c) => c.id === 'VCAN_DRV')!;
    const pcanNs = ast.namespaces.find((n) => n.id === 'PCAN_DRV')!;
    const bus = ast.classifiers.find((c) => c.id === 'PCAN_DRV.Bus')!;
    expect(vcan.creationIndex).toBe(1);
    expect(pcanNs.creationIndex).toBe(2); // reused from the muted PCAN_DRV classifier
    expect(bus.creationIndex).toBe(4);
    // The muted classifier itself no longer exists as a top-level classifier.
    expect(ast.classifiers.some((c) => c.id === 'PCAN_DRV')).toBe(false);
  });

  it('opening a package with NO prior same-name classifier still assigns ' +
    'a fresh creationIndex as before (no reuse to be had)', () => {
    const ast = parse(`
      class A
      package P {
        class Q
      }
    `);
    const a = ast.classifiers.find((c) => c.id === 'A')!;
    const p = ast.namespaces.find((n) => n.id === 'P')!;
    const q = ast.classifiers.find((c) => c.id === 'P.Q')!;
    expect(a.creationIndex).toBe(1);
    expect(p.creationIndex).toBe(2);
    expect(q.creationIndex).toBe(3);
  });

  it('a dotted reopen whose FULL id exactly matches an existing classifier ' +
    'reuses it too (not just single-segment ids)', () => {
    // A dotted class DECLARATION ("class a.X") implies its own enclosing
    // namespace chain up front: "a" (index 1, namespace) and "a.X" (index 2,
    // classifier, member of "a"). "Q --> a.X" then creates Q (index 3) and
    // the relationship itself (index 4). `package a.X { class Y }` reopens
    // the FULL "a.X" id -- "a" already exists (no new index consumed at
    // all), and the reused "a.X" namespace keeps index 2 (NOT a fresh 5,
    // which class Y -- the next genuinely new thing -- would otherwise
    // steal); Y lands on 5.
    const ast = parse(`
      class a.X
      Q --> a.X
      package a.X {
        class Y
      }
    `);
    const q = ast.classifiers.find((c) => c.id === 'Q')!;
    const y = ast.classifiers.find((c) => c.id === 'a.X.Y')!;
    const aNs = ast.namespaces.find((n) => n.id === 'a')!;
    const axNs = ast.namespaces.find((n) => n.id === 'a.X')!;
    expect(aNs.creationIndex).toBe(1);
    expect(axNs.creationIndex).toBe(2); // reused from the muted "a.X" classifier
    expect(q.creationIndex).toBe(3);
    expect(y.creationIndex).toBe(5);
    // The muted "a.X" classifier no longer exists as a top-level classifier
    // (only the namespace remains).
    expect(ast.classifiers.some((c) => c.id === 'a.X')).toBe(false);
  });
});
