import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines)).root;
}

describe('YAML parser — special keys', () => {
  it('coxima-79: key with dots and slash (Kubernetes label)', () => {
    expect(parse(['app.kubernetes.io/component: grafana'])).toEqual({
      'app.kubernetes.io/component': 'grafana',
    });
  });

  it('medosa-24: key with leading dot', () => {
    expect(parse(['compile:', '  extends: .sbt-compile-cross'])).toEqual({
      compile: { extends: '.sbt-compile-cross' },
    });
  });

  it('zebapi-77: key with internal space', () => {
    expect(parse(['test mario-domain:', '  extends: .sbt-test-cross'])).toEqual({
      'test mario-domain': { extends: '.sbt-test-cross' },
    });
  });

  it('key with hyphen', () => {
    expect(parse(['french-hens: 3'])).toEqual({ 'french-hens': '3' });
  });

  it('key with underscore', () => {
    expect(parse(['pod_name: nginx'])).toEqual({ pod_name: 'nginx' });
  });

  it('value with URL colon (first colon is separator)', () => {
    expect(parse(['url: http://example.com'])).toEqual({ url: 'http://example.com' });
  });

  it('xubife-72 style: Kubernetes nested labels', () => {
    expect(parse([
      'labels:',
      '  app: blazor',
      '  pod-template-hash: "7966669766"',
    ])).toEqual({
      labels: { app: 'blazor', 'pod-template-hash': '7966669766' },
    });
  });

  it('key starting with digit (unusual but valid)', () => {
    expect(parse(['123abc: value'])).toEqual({ '123abc': 'value' });
  });

  it('does not throw on unusual input — returns null root for NO_KEY_ONLY_TEXT at root', () => {
    // parseYaml catches YamlSyntaxError internally; root becomes null
    expect(parse(['just plain text without colon'])).toBeNull();
  });
});
