import { describe, it, expect } from 'vitest';
import { yamlPlugin } from '../../../src/diagrams/yaml/index.js';

describe('yamlPlugin', () => {
  it('has type yaml', () => {
    expect(yamlPlugin.type).toBe('yaml');
  });

  it('accepts yaml key-value content', () => {
    expect(yamlPlugin.accepts(['fruit: Apple', 'size: Large'])).toBe(true);
  });

  it('accepts yaml list content', () => {
    expect(yamlPlugin.accepts(['- item one', '- item two'])).toBe(true);
  });

  it('accepts #highlight lines', () => {
    expect(yamlPlugin.accepts(['#highlight fruit', 'fruit: Apple'])).toBe(true);
  });

  it('rejects JSON object content', () => {
    expect(yamlPlugin.accepts(['{"key": "value"}'])).toBe(false);
  });

  it('rejects JSON array content', () => {
    expect(yamlPlugin.accepts(['[1, 2, 3]'])).toBe(false);
  });

  it('rejects empty line list', () => {
    expect(yamlPlugin.accepts([])).toBe(false);
  });

  it('skips title directive and checks remaining content', () => {
    expect(yamlPlugin.accepts(['title My Diagram', 'fruit: Apple'])).toBe(true);
  });

  it('skips style block and checks remaining content', () => {
    expect(
      yamlPlugin.accepts(['<style>', 'node { color: red }', '</style>', 'fruit: Apple'])
    ).toBe(true);
  });
});
