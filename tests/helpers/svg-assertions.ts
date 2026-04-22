import { expect } from 'vitest';

expect.extend({
  toContainElement(svg: string, tag: string) {
    const pass = svg.includes(`<${tag}`);
    return {
      pass,
      message: () => `expected SVG to contain <${tag}> element`,
    };
  },
  toContainText(svg: string, text: string) {
    const pass = svg.includes(text);
    return {
      pass,
      message: () => `expected SVG to contain text "${text}"`,
    };
  },
  toBeValidSvg(svg: string) {
    const pass = svg.startsWith('<svg') && svg.endsWith('</svg>');
    return {
      pass,
      message: () => 'expected string to be a valid SVG',
    };
  },
});

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toContainElement(tag: string): T;
    toContainText(text: string): T;
    toBeValidSvg(): T;
  }
}
