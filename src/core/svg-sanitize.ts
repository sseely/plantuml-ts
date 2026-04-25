/**
 * SVG sanitizer — strips executable content and external resource references.
 *
 * Design principles:
 *   - Sanitization is orthogonal to fetch authorization. A URL being CSP-allowed
 *     or originating from a "trusted" resolver does not grant trust to its SVG
 *     content. These are independent security layers.
 *   - Pure TypeScript, no DOM dependency (runs in Node and browser alike).
 *   - The { trustSource: true } escape hatch bypasses sanitization for content
 *     that is verified safe at build time (e.g. committed fixtures).
 *
 * What is stripped:
 *   - <script> elements and their content
 *   - <foreignObject> elements and their content
 *   - on* event handler attributes (onclick, onerror, onmouseover, etc.)
 *   - javascript:, vbscript:, and data: URIs in href/src/action attributes
 *   - External http/https URLs in href and xlink:href attributes
 *     (internal #fragment references are preserved)
 */

export interface SanitizeSvgOptions {
  /**
   * When true, bypass all sanitization.
   * Use only for build-time-verified, committed SVG content.
   * Cannot be set silently by other configuration — callers must opt in explicitly.
   */
  trustSource?: boolean;
}

// <script> open+content+close, case-insensitive, handles newlines in content
const SCRIPT_ELEMENT_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
// <script .../> self-closing (unusual but valid XML)
const SCRIPT_SELF_CLOSE_RE = /<script\b[^/]*\/>/gi;

// <foreignObject> open+content+close
const FOREIGN_OBJECT_RE = /<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi;
const FOREIGN_OBJECT_SELF_CLOSE_RE = /<foreignObject\b[^/]*\/>/gi;

// on* event handler attributes: onerror="...", onclick='...', onfoo=bare
const EVENT_HANDLER_RE = /\s+on[a-zA-Z]\w*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// Dangerous protocol URIs in href / xlink:href / src / action
const DANGEROUS_URI_RE =
  /(?:href|xlink:href|src|action)\s*=\s*(?:"(?:javascript|vbscript|data):[^"]*"|'(?:javascript|vbscript|data):[^']*')/gi;

// External absolute URLs in href and xlink:href (http/https or protocol-relative)
// Preserves #fragment, relative, and root-relative paths.
const EXTERNAL_HREF_RE =
  /(?:href|xlink:href)\s*=\s*(?:"(?:https?:)?\/\/[^"]*"|'(?:https?:)?\/\/[^']*')/gi;

/**
 * Sanitize an SVG string, removing content that could execute code or
 * load external resources when the SVG is inlined into a document.
 *
 * @param svg     SVG source string from an external resolver.
 * @param options Options object. Pass `{ trustSource: true }` to skip sanitization.
 */
export function sanitizeSvg(svg: string, options: SanitizeSvgOptions = {}): string {
  if (options.trustSource === true) return svg;

  let result = svg;
  result = result.replace(SCRIPT_ELEMENT_RE, '');
  result = result.replace(SCRIPT_SELF_CLOSE_RE, '');
  result = result.replace(FOREIGN_OBJECT_RE, '');
  result = result.replace(FOREIGN_OBJECT_SELF_CLOSE_RE, '');
  result = result.replace(EVENT_HANDLER_RE, '');
  result = result.replace(DANGEROUS_URI_RE, '');
  result = result.replace(EXTERNAL_HREF_RE, '');
  return result;
}
