import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '../../src/core/svg-sanitize.js';

// ---------------------------------------------------------------------------
// Passthrough — safe SVG is unchanged
// ---------------------------------------------------------------------------

describe('sanitizeSvg — safe SVG passthrough', () => {
  it('returns SVG with no dangerous content unchanged', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="100"/></svg>';
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it('preserves internal #fragment href references', () => {
    const svg = '<svg><use href="#arrow-head"/><marker id="arrow-head"/></svg>';
    expect(sanitizeSvg(svg)).toContain('href="#arrow-head"');
  });

  it('preserves xlink:href with a #fragment reference', () => {
    const svg = '<svg><use xlink:href="#marker"/></svg>';
    expect(sanitizeSvg(svg)).toContain('xlink:href="#marker"');
  });

  it('preserves relative href paths', () => {
    const svg = '<svg><image href="images/logo.png"/></svg>';
    expect(sanitizeSvg(svg)).toContain('href="images/logo.png"');
  });

  it('preserves root-relative href paths', () => {
    const svg = '<svg><image href="/assets/sprite.svg"/></svg>';
    expect(sanitizeSvg(svg)).toContain('href="/assets/sprite.svg"');
  });
});

// ---------------------------------------------------------------------------
// <script> element stripping
// ---------------------------------------------------------------------------

describe('sanitizeSvg — <script> element stripping', () => {
  it('removes a <script> block and its content', () => {
    const svg = '<svg><script>alert("xss")</script><rect/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
  });

  it('removes a script block that spans multiple lines', () => {
    const svg = '<svg><script>\nconst x = 1;\nalert(x);\n</script></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('alert');
    expect(result).not.toContain('<script');
  });

  it('removes a self-closing <script/> element', () => {
    const svg = '<svg><script src="evil.js"/><rect/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('<script');
  });

  it('removes a <script> with a type attribute', () => {
    const svg = '<svg><script type="text/javascript">bad()</script></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('bad()');
  });

  it('preserves non-script SVG content after stripping', () => {
    const svg = '<svg><script>bad()</script><circle cx="50" cy="50" r="40"/></svg>';
    expect(sanitizeSvg(svg)).toContain('<circle');
  });
});

// ---------------------------------------------------------------------------
// <foreignObject> element stripping
// ---------------------------------------------------------------------------

describe('sanitizeSvg — <foreignObject> element stripping', () => {
  it('removes a <foreignObject> block and its content', () => {
    const svg = '<svg><foreignObject><div style="display:none">hidden</div></foreignObject></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('<foreignObject');
    expect(result).not.toContain('hidden');
  });

  it('removes a self-closing <foreignObject/>', () => {
    const svg = '<svg><foreignObject width="100" height="100"/><rect/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('<foreignObject');
  });

  it('preserves other SVG content after stripping foreignObject', () => {
    const svg = '<svg><foreignObject><span>bad</span></foreignObject><text>good</text></svg>';
    expect(sanitizeSvg(svg)).toContain('<text>good</text>');
  });
});

// ---------------------------------------------------------------------------
// on* event handler attribute stripping
// ---------------------------------------------------------------------------

describe('sanitizeSvg — on* event handler stripping', () => {
  it('removes onclick attribute with double-quoted value', () => {
    const svg = '<svg><rect onclick="evil()" width="100"/></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('evil()');
  });

  it('removes onerror attribute with single-quoted value', () => {
    const svg = "<svg><image onerror='fetch(\"/bad\")'/></svg>";
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('onerror');
  });

  it('removes onmouseover attribute', () => {
    const svg = '<svg><circle onmouseover="doSomething()" r="5"/></svg>';
    expect(sanitizeSvg(svg)).not.toContain('onmouseover');
  });

  it('removes onload attribute', () => {
    const svg = '<svg onload="init()"><rect/></svg>';
    expect(sanitizeSvg(svg)).not.toContain('onload');
  });

  it('preserves the element itself after stripping the event handler', () => {
    const svg = '<svg><rect onclick="bad()" width="100" height="50"/></svg>';
    expect(sanitizeSvg(svg)).toContain('<rect');
    expect(sanitizeSvg(svg)).toContain('width="100"');
  });
});

// ---------------------------------------------------------------------------
// javascript: URI stripping
// ---------------------------------------------------------------------------

describe('sanitizeSvg — javascript: URI stripping', () => {
  it('removes href with javascript: scheme (double-quoted)', () => {
    const svg = '<svg><a href="javascript:alert(1)"><rect/></a></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain('javascript:');
  });

  it('removes href with javascript: scheme (single-quoted)', () => {
    const svg = "<svg><a href='javascript:void(0)'><rect/></a></svg>";
    expect(sanitizeSvg(svg)).not.toContain('javascript:');
  });

  it('removes xlink:href with javascript: scheme', () => {
    const svg = '<svg><a xlink:href="javascript:bad()"><use/></a></svg>';
    expect(sanitizeSvg(svg)).not.toContain('javascript:');
  });

  it('removes data: URI from src attribute', () => {
    const svg = '<svg><image src="data:text/html,<script>bad()</script>"/></svg>';
    expect(sanitizeSvg(svg)).not.toContain('data:');
  });

  it('removes vbscript: URI from href', () => {
    const svg = '<svg><a href="vbscript:MsgBox(1)"><rect/></a></svg>';
    expect(sanitizeSvg(svg)).not.toContain('vbscript:');
  });
});

// ---------------------------------------------------------------------------
// External href stripping
// ---------------------------------------------------------------------------

describe('sanitizeSvg — external href stripping', () => {
  it('removes http:// href from anchor elements', () => {
    const svg = '<svg><a href="http://evil.example.com/payload"><rect/></a></svg>';
    expect(sanitizeSvg(svg)).not.toContain('http://evil.example.com');
  });

  it('removes https:// href', () => {
    const svg = '<svg><a href="https://tracker.example.com/pixel"><rect/></a></svg>';
    expect(sanitizeSvg(svg)).not.toContain('https://tracker.example.com');
  });

  it('removes protocol-relative // href', () => {
    const svg = '<svg><a href="//cdn.example.com/resource"><rect/></a></svg>';
    expect(sanitizeSvg(svg)).not.toContain('//cdn.example.com');
  });

  it('removes external xlink:href', () => {
    const svg = '<svg><use xlink:href="https://external.example.com/sprite.svg#icon"/></svg>';
    expect(sanitizeSvg(svg)).not.toContain('https://external.example.com');
  });
});

// ---------------------------------------------------------------------------
// Multiple dangerous patterns in one SVG
// ---------------------------------------------------------------------------

describe('sanitizeSvg — multiple patterns stripped in one pass', () => {
  it('strips all dangerous patterns from a single SVG string', () => {
    const svg = [
      '<svg>',
      '  <script>alert("xss")</script>',
      '  <foreignObject><div>leak</div></foreignObject>',
      '  <rect onclick="bad()" onerror="worse()"/>',
      '  <a href="javascript:evil()">click</a>',
      '  <a href="https://tracker.example.com/pixel">track</a>',
      '</svg>',
    ].join('\n');

    const result = sanitizeSvg(svg);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('<foreignObject');
    expect(result).not.toContain('leak');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('https://tracker.example.com');
    expect(result).toContain('<rect');
    expect(result).toContain('click');
  });
});

// ---------------------------------------------------------------------------
// trustSource bypass
// ---------------------------------------------------------------------------

describe('sanitizeSvg — trustSource bypass', () => {
  it('returns the original SVG unchanged when trustSource is true', () => {
    const svg = '<svg><script>alert("trusted")</script></svg>';
    expect(sanitizeSvg(svg, { trustSource: true })).toBe(svg);
  });

  it('sanitizes when trustSource is false', () => {
    const svg = '<svg><script>alert("x")</script></svg>';
    expect(sanitizeSvg(svg, { trustSource: false })).not.toContain('<script');
  });

  it('sanitizes when trustSource is omitted', () => {
    const svg = '<svg><script>alert("x")</script></svg>';
    expect(sanitizeSvg(svg)).not.toContain('<script');
  });
});
