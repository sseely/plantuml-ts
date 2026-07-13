import { describe, it, expect, beforeEach } from 'vitest';
import { extractBlocks } from '../../src/core/block-extractor.js';
import {
  DiagramRegistry,
  type SyncPlugin,
} from '../../src/core/dispatcher.js';
import type { UmlSource, DiagramType } from '../../src/core/block-extractor.js';
import { defaultTheme } from '../../src/core/theme.js';
import { FixedMeasurer } from '../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlugin(
  diagramType: DiagramType,
  acceptsFn: (lines: readonly string[]) => boolean,
): SyncPlugin {
  return {
    type: diagramType,
    accepts: acceptsFn,
    parse: (_source: UmlSource) => ({}),
    layoutSync: (_ast: unknown) => ({}),
    render: (_geo: unknown) => '<svg/>',
  };
}

function linesToBlocks(src: string): UmlSource[] {
  return extractBlocks(src.split('\n'));
}

// ---------------------------------------------------------------------------
// Block extraction — structural
// ---------------------------------------------------------------------------

describe('extractBlocks — structural extraction', () => {
  it('extracts a single @startuml / @enduml block', () => {
    const blocks = linesToBlocks('@startuml\nAlice -> Bob\n@enduml');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.lines).toEqual(['Alice -> Bob']);
  });

  it('returns empty array when no @startuml is present', () => {
    const blocks = linesToBlocks('just plain text');
    expect(blocks).toHaveLength(0);
  });

  it('extracts multiple blocks from one string', () => {
    const src =
      '@startuml\nAlice -> Bob\n@enduml\n@startuml\nBob -> Carol\n@enduml';
    const blocks = linesToBlocks(src);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.lines).toEqual(['Alice -> Bob']);
    expect(blocks[1]?.lines).toEqual(['Bob -> Carol']);
  });

  it('trims leading and trailing blank lines inside a block', () => {
    const blocks = linesToBlocks('@startuml\n\nAlice -> Bob\n\n@enduml');
    const lines = blocks[0]?.lines ?? [];
    expect(lines[0]).not.toBe('');
    expect(lines[lines.length - 1]).not.toBe('');
    expect(lines).toEqual(['Alice -> Bob']);
  });

  it('ignores lines before the first @startuml', () => {
    const blocks = linesToBlocks('ignored\n@startuml\nAlice -> Bob\n@enduml');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.lines).toEqual(['Alice -> Bob']);
  });

  it('ignores lines after the last @enduml', () => {
    const blocks = linesToBlocks('@startuml\nAlice -> Bob\n@enduml\nignored');
    expect(blocks).toHaveLength(1);
  });

  it('returns empty array for unclosed block with no @end', () => {
    const blocks = linesToBlocks('@startuml\nAlice -> Bob');
    expect(blocks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Type detection — keyword-suffix markers (@start<type>)
// ---------------------------------------------------------------------------

describe('extractBlocks — @start<type> keyword detection', () => {
  it('detects mindmap type from @startmindmap / @endmindmap', () => {
    const blocks = linesToBlocks('@startmindmap\n* Root\n@endmindmap');
    expect(blocks[0]?.type).toBe('mindmap');
  });

  it('detects gantt type from @startgantt / @endgantt', () => {
    const blocks = linesToBlocks(
      '@startgantt\n[Task] lasts 3 days\n@endgantt',
    );
    expect(blocks[0]?.type).toBe('gantt');
  });

  it('detects wbs type from @startwbs / @endwbs', () => {
    const blocks = linesToBlocks('@startwbs\n+ Root\n@endwbs');
    expect(blocks[0]?.type).toBe('wbs');
  });

  it('stores lines without the @start/@end markers', () => {
    const blocks = linesToBlocks('@startmindmap\n* Root\n@endmindmap');
    expect(blocks[0]?.lines).toEqual(['* Root']);
  });

  it('returns "unknown" type for unrecognised @start<suffix>', () => {
    // @startfuturediagram is not in the suffix map
    const blocks = linesToBlocks(
      '@startfuturediagram\nsome content\n@endfuturediagram',
    );
    expect(blocks[0]?.type).toBe('unknown');
  });

  it('extracts @startyaml / @endyaml block with type yaml', () => {
    const blocks = linesToBlocks('@startyaml\nfruit: Apple\n@endyaml');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('yaml');
    expect(blocks[0]?.lines).toEqual(['fruit: Apple']);
  });

  it('handles empty @startyaml / @endyaml block', () => {
    const blocks = linesToBlocks('@startyaml\n@endyaml');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('yaml');
  });

});

// ---------------------------------------------------------------------------
// Type detection — content-based (@startuml blocks)
// ---------------------------------------------------------------------------

describe('extractBlocks — content-based type detection for @startuml', () => {
  it('detects sequence type when first content line contains ->', () => {
    const blocks = linesToBlocks('@startuml\nAlice -> Bob\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type when content contains -->', () => {
    const blocks = linesToBlocks('@startuml\nAlice --> Bob\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type when content contains ->>', () => {
    const blocks = linesToBlocks('@startuml\nAlice ->> Bob\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type when content contains -->>', () => {
    const blocks = linesToBlocks('@startuml\nAlice -->> Bob\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from participant keyword', () => {
    const blocks = linesToBlocks('@startuml\nparticipant Alice\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from actor keyword', () => {
    const blocks = linesToBlocks('@startuml\nactor Bob\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from boundary keyword', () => {
    const blocks = linesToBlocks('@startuml\nboundary Web\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from control keyword', () => {
    const blocks = linesToBlocks('@startuml\ncontrol Handler\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from entity keyword', () => {
    const blocks = linesToBlocks('@startuml\nentity DB\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from database keyword', () => {
    const blocks = linesToBlocks('@startuml\ndatabase Store\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from collections keyword', () => {
    const blocks = linesToBlocks('@startuml\ncollections Items\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects sequence type from queue keyword', () => {
    const blocks = linesToBlocks('@startuml\nqueue Events\n@enduml');
    expect(blocks[0]?.type).toBe('sequence');
  });

  it('detects class type when first content line starts with "class "', () => {
    const blocks = linesToBlocks('@startuml\nclass Foo\n@enduml');
    expect(blocks[0]?.type).toBe('class');
  });

  it('detects class type from "abstract class"', () => {
    const blocks = linesToBlocks('@startuml\nabstract class Foo\n@enduml');
    expect(blocks[0]?.type).toBe('class');
  });

  it('detects class type from "interface"', () => {
    const blocks = linesToBlocks('@startuml\ninterface Foo\n@enduml');
    expect(blocks[0]?.type).toBe('class');
  });

  it('detects class type from "enum"', () => {
    const blocks = linesToBlocks('@startuml\nenum Color\n@enduml');
    expect(blocks[0]?.type).toBe('class');
  });

  it('detects state type from "[*] -->"', () => {
    const blocks = linesToBlocks('@startuml\n[*] --> Idle\n@enduml');
    expect(blocks[0]?.type).toBe('state');
  });

  // SI7: the fallback is 'class', not 'unknown'. `@startuml` selects EVERY
  // legacy-UML factory (`DiagramType.findStartTypes`), and `PSystemBuilder`
  // keeps the first that does not error: Sequence is tried first but a sequence
  // diagram with no participants is `isIncomplete()`, so ClassDiagramFactory
  // takes it. The jar tags `@startuml` + `title X` `data-diagram-type="CLASS"`.
  it('falls back to "class" when no pattern matches (upstream factory order)', () => {
    const blocks = linesToBlocks(
      '@startuml\nskinparam monochrome true\n@enduml',
    );
    expect(blocks[0]?.type).toBe('class');
  });

  it('only inspects the first 20 non-empty lines for type detection', () => {
    // Build 21 non-empty lines that match no type pattern, then add an arrow
    // on line 22. The arrow must NOT be detected because it's outside the window.
    const neutralLine = 'skinparam backgroundColor white';
    const padding = Array.from({ length: 21 }, () => neutralLine).join('\n');
    const blocks = linesToBlocks(`@startuml\n${padding}\nAlice -> Bob\n@enduml`);
    // Arrow is beyond the 20 non-empty line inspection window, so no probe
    // matches and the block takes the factory-order fallback.
    expect(blocks[0]?.type).toBe('class');
  });

  it('detects state type even when [*] --> contains arrow characters', () => {
    // Verifies that state probe runs before sequence probe
    const blocks = linesToBlocks('@startuml\n[*] --> Idle\nIdle --> Active\n@enduml');
    expect(blocks[0]?.type).toBe('state');
  });
});

// ---------------------------------------------------------------------------
// DiagramRegistry
// ---------------------------------------------------------------------------

describe('DiagramRegistry', () => {
  let registry: DiagramRegistry;
  const measurer = new FixedMeasurer(8, 16);

  beforeEach(() => {
    registry = new DiagramRegistry();
  });

  it('resolves a registered plugin by accepts()', () => {
    const plugin = makePlugin('sequence', (lines) =>
      lines.some((l) => l.includes('->')),
    );
    registry.register(plugin);

    const source: UmlSource = {
      lines: ['Alice -> Bob'],
      type: 'sequence',
    };

    const resolved = registry.resolve(source);
    expect(resolved.type).toBe('sequence');
  });

  it('returns an error-sentinel plugin when no plugin accepts', () => {
    const source: UmlSource = {
      lines: ['some unknown syntax'],
      type: 'unknown',
    };

    // No plugins registered — should not throw
    const resolved = registry.resolve(source);
    expect(() => resolved.render({}, defaultTheme)).not.toThrow();
    const svg = resolved.render({}, defaultTheme);
    expect(svg).toContain('<svg');
  });

  it('calls accepts() on registered plugins to find a match', () => {
    let calledWith: readonly string[] | undefined;
    const plugin = makePlugin('class', (lines) => {
      calledWith = lines;
      return true;
    });
    registry.register(plugin);

    const source: UmlSource = {
      lines: ['class Foo'],
      type: 'class',
    };
    registry.resolve(source);
    expect(calledWith).toEqual(['class Foo']);
  });

  it('tries plugins in registration order (first match wins)', () => {
    const calls: string[] = [];
    const p1 = makePlugin('sequence', () => {
      calls.push('sequence');
      return false;
    });
    const p2 = makePlugin('class', () => {
      calls.push('class');
      return true;
    });
    const p3 = makePlugin('state', () => {
      calls.push('state');
      return true;
    });

    registry.register(p1);
    registry.register(p2);
    registry.register(p3);

    const source: UmlSource = { lines: [], type: 'unknown' };
    const resolved = registry.resolve(source);

    // Should stop after p2 matched
    expect(calls).toEqual(['sequence', 'class']);
    expect(resolved.type).toBe('class');
  });

  it('error-sentinel plugin renders an SVG containing error text', () => {
    const source: UmlSource = { lines: ['???'], type: 'unknown' };
    const sentinel = registry.resolve(source);
    const svg = sentinel.render({}, defaultTheme);
    // Must be valid SVG and communicate an error
    expect(svg).toContain('<svg');
    expect(svg.toLowerCase()).toMatch(/error|unknown/);
  });

  it('error-sentinel plugin accepts() always returns false', () => {
    // Verify the sentinel's accepts() method is callable and returns false
    const source: UmlSource = { lines: ['Alice -> Bob'], type: 'sequence' };
    const sentinel = registry.resolve(source); // no plugins registered → sentinel
    expect(sentinel.accepts(['Alice -> Bob'])).toBe(false);
  });

  it('parse() on sentinel plugin returns empty object without throwing', () => {
    const source: UmlSource = { lines: [], type: 'unknown' };
    const sentinel = registry.resolve(source);
    expect(() => sentinel.parse(source)).not.toThrow();
  });

  it('error-sentinel plugin is a SyncPlugin (has layoutSync, no async layout)', () => {
    // The sentinel uses layoutSync; it does not expose an async layout method.
    const source: UmlSource = { lines: [], type: 'unknown' };
    const sentinel = registry.resolve(source);
    expect('layoutSync' in sentinel).toBe(true);
    expect('layout' in sentinel).toBe(false);
  });

  it('layoutSync() on sentinel plugin returns without throwing', () => {
    const source: UmlSource = { lines: [], type: 'unknown' };
    const sentinel = registry.resolve(source);
    if ('layoutSync' in sentinel) {
      expect(() =>
        sentinel.layoutSync({}, defaultTheme, measurer),
      ).not.toThrow();
    } else {
      throw new Error('Expected sentinel to be a SyncPlugin');
    }
  });
});
