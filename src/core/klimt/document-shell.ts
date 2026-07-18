/**
 * document-shell.ts — shared klimt-document-shell assembly/disassembly
 * helpers. Extracted from `diagrams/description/renderer.ts` (G1 I1's
 * `assembleKlimtShell`/`unwrapKlimtSvg`) during mission G2 N1 so a second
 * engine (class) can reuse the SAME literal-constant root-attribute
 * assembly instead of duplicating it — see `plans/g2-class-svg/ledger.md`
 * N1 ("the class path may be able to share the same shell machinery
 * rather than duplicating it").
 *
 * `description/renderer.ts` keeps `unwrapKlimtSvg`/`assembleKlimtShell` as
 * its own thin, description-scoped wrappers around the functions here
 * (`DIAGRAM_TYPE_DESCRIPTION` baked in) — this module carries no
 * per-engine defaults, only the diagram-type-parameterized mechanics.
 *
 * @see ~/git/plantuml/.../klimt/drawing/svg/SvgGraphicsCore.java (getRootNode, getG, createXml)
 * @see plans/g1-description-svg/decision-journal.md (I1)
 * @see plans/g2-class-svg/ledger.md (N1)
 */

/**
 * A literal double-quote, via unicode escape so this file contains zero raw
 * double-quote glyphs — mirrors `description/renderer.ts`'s DQUOTE
 * convention (project complexity-hook rule).
 */
export const DQUOTE = '\x22';

/** D4′ preamble conformance — every cached jar fixture carries this
 *  literal placeholder token, not a real version string (see
 *  `svg-graphics-core.ts`'s own doc comment). */
export const VERSION_PLACEHOLDER = '$version$';

/** `data-diagram-type` — the root attribute name every klimt-shaped
 *  document shell carries (verified against `DiagramType.java:45` and
 *  every cached jar fixture's root `<svg>`). */
export const DIAGRAM_TYPE_ATTR = 'data-diagram-type';

/**
 * Everything `assembleDocumentShell` needs from a `RenderFragment`-shaped
 * object: pre-composed body content, final document dimensions, and the
 * optional background/extraDefs `svgRoot` would otherwise consume. `body`
 * MUST already be wrapped exactly the way the caller wants it to appear
 * inside the root `<g>` slot — this function performs no wrapping of its
 * own (see `class/renderer-shell.ts`'s doc comment for why the wrap
 * decision lives at the call site, not here).
 */
export interface ShellFragment {
  readonly body: string;
  readonly width: number;
  readonly height: number;
  readonly background?: string;
  readonly extraDefs?: string;
}

/**
 * Reassembles a `ShellFragment` using klimt's OWN root-attribute/prolog/
 * defs conventions (`SvgGraphicsCore#getRootNode`/`#finalizeRootAttributes`,
 * `svg-graphics-core.ts:311-336,456-479`) instead of the generic `svgRoot`
 * (`core/svg.ts`) every non-klimt-shaped engine uses.
 *
 * `xmlns:xlink`/`version="1.1"`/`zoomAndPan="magnify"`/
 * `preserveAspectRatio="none"`/`contentStyleType="text/css"` are ALL
 * diagram-type-wide constants, never per-fixture data — reproduced
 * directly rather than parsed back out of a klimt string. No
 * `ALL_ARROW_TYPES` marker-def injection (every klimt-shaped engine draws
 * its own arrowheads as inline polygons/paths, never an SVG `<marker>`)
 * and no separate background `<rect>` (background is folded into the
 * root `style` attribute, matching `finalizeRootAttributes`).
 *
 * @param fragment    - pre-composed body + dimensions (see {@link ShellFragment}).
 * @param diagramType - the `data-diagram-type` root attribute value (e.g.
 *   `'DESCRIPTION'`, `'CLASS'`).
 */
export function assembleDocumentShell(fragment: ShellFragment, diagramType: string): string {
  const width = Math.trunc(fragment.width);
  const height = Math.trunc(fragment.height);
  const background = fragment.background ?? '#FFFFFF';
  const extraDefs = fragment.extraDefs ?? '';
  // G2 N4: also excludes the CANONICAL transparent hex `#00000000` --
  // `svg-graphics-core.ts#finalizeRootAttributes`'s own exact rule
  // (`this.backcolorString !== '#00000000'`). Class's `renderClass` now
  // passes an already-`resolveColorToSvgHex`-canonicalized value (G2 N4,
  // "canonicalBackground"), so a literal `'transparent'`/`'none'` string
  // never reaches here for class -- only the additive `#00000000` check
  // catches it; the original two literal-string checks are kept for any
  // caller that still passes a raw, un-resolved value.
  const isSolid = background !== 'transparent' && background !== 'none' && background !== '#00000000';
  const style =
    `width:${String(width)}px;height:${String(height)}px;` +
    (isSolid ? `background:${background};` : '');
  return (
    '<svg xmlns=' + DQUOTE + 'http://www.w3.org/2000/svg' + DQUOTE +
    ' xmlns:xlink=' + DQUOTE + 'http://www.w3.org/1999/xlink' + DQUOTE +
    ' version=' + DQUOTE + '1.1' + DQUOTE +
    ' ' + DIAGRAM_TYPE_ATTR + '=' + DQUOTE + diagramType + DQUOTE +
    ' style=' + DQUOTE + style + DQUOTE +
    ' width=' + DQUOTE + String(width) + 'px' + DQUOTE +
    ' height=' + DQUOTE + String(height) + 'px' + DQUOTE +
    ' viewBox=' + DQUOTE + `0 0 ${String(width)} ${String(height)}` + DQUOTE +
    ' zoomAndPan=' + DQUOTE + 'magnify' + DQUOTE +
    ' preserveAspectRatio=' + DQUOTE + 'none' + DQUOTE +
    ' contentStyleType=' + DQUOTE + 'text/css' + DQUOTE +
    '>' +
    '<?plantuml ' + VERSION_PLACEHOLDER + '?>' +
    `<defs>${extraDefs}</defs>` +
    fragment.body +
    '</svg>'
  );
}

/**
 * Every root/child attribute value `SvgGraphicsCore#finalizeRootAttributes`/
 * `#format` are known to emit contains no literal `>` character, so the
 * first `>` in a (defs-stripped) klimt document string is reliably the
 * root open tag's own close — see `description/renderer.ts`'s original
 * `unwrapKlimtSvg` doc comment (this module's extraction) for the full
 * rationale. NOT a general SVG parser; scoped exactly to this producer
 * shape (klimt's own `getSvgString()`/`createXml()` output).
 *
 * @see u-graphic-svg.ts#getSvgString @see svg-graphics-core.ts#createXml
 */
export function extractViewBoxDims(svg: string): { width: number; height: number } {
  const marker = 'viewBox=' + DQUOTE + '0 0 ';
  const start = svg.indexOf(marker);
  if (start === -1) {
    throw new Error('extractViewBoxDims: klimt SVG output has no viewBox attribute');
  }
  const afterMarker = start + marker.length;
  const end = svg.indexOf(DQUOTE, afterMarker);
  if (end === -1) {
    throw new Error('extractViewBoxDims: malformed viewBox attribute');
  }
  const [widthStr, heightStr] = svg.slice(afterMarker, end).split(' ');
  const width = Number(widthStr);
  const height = Number(heightStr);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('extractViewBoxDims: malformed viewBox dimensions');
  }
  return { width, height };
}

/** Strips the single `<defs>...</defs>` (or self-closing `<defs/>`)
 *  `SvgGraphicsCore`'s constructor always appends, hoisting its inner
 *  markup so the caller can splice it into `svgRoot`'s OWN defs block
 *  (`RenderFragment.extraDefs`) instead of nesting a second `<defs>`. */
export function extractDefs(svg: string): { withoutDefs: string; extraDefs: string } {
  const openTag = '<defs>';
  const closeTag = '</defs>';
  const selfClose = '<defs/>';

  const openIdx = svg.indexOf(openTag);
  if (openIdx !== -1) {
    const closeIdx = svg.indexOf(closeTag, openIdx);
    if (closeIdx === -1) throw new Error('extractDefs: unterminated <defs> element');
    const extraDefs = svg.slice(openIdx + openTag.length, closeIdx);
    const withoutDefs = svg.slice(0, openIdx) + svg.slice(closeIdx + closeTag.length);
    return { withoutDefs, extraDefs };
  }

  const selfIdx = svg.indexOf(selfClose);
  if (selfIdx !== -1) {
    const withoutDefs = svg.slice(0, selfIdx) + svg.slice(selfIdx + selfClose.length);
    return { withoutDefs, extraDefs: '' };
  }

  return { withoutDefs: svg, extraDefs: '' };
}

/** Everything between the root `<svg ...>` open tag's own `>` and the final
 *  `</svg>` — see {@link extractViewBoxDims}'s doc comment for why the FIRST
 *  `>` in a defs-stripped klimt document is always that boundary. Includes
 *  the leading `<?plantuml ...?>` PI and klimt's own content `<g>...</g>`
 *  wrapper — {@link unwrapContentG} strips both. */
export function extractBody(svgWithoutDefs: string): string {
  const openTagEnd = svgWithoutDefs.indexOf('>');
  const closeTagStart = svgWithoutDefs.lastIndexOf('</svg>');
  if (openTagEnd === -1 || closeTagStart === -1 || closeTagStart < openTagEnd) {
    throw new Error('extractBody: malformed klimt SVG output (missing <svg>/</svg> boundary)');
  }
  return svgWithoutDefs.slice(openTagEnd + 1, closeTagStart);
}

/**
 * Strips klimt's own leading `<?plantuml ...?>` processing instruction
 * (`SvgGraphicsCore#getRootNode`, always the first child of `<svg>`) and
 * its single content `<g>...</g>` wrapper (`SvgGraphicsCore#getG`'s
 * `gRoot`, always the bare three-character open tag `<g>`), leaving JUST
 * the flat markup {@link extractBody} bracketed with them.
 *
 * @see svg-graphics-core.ts#getRootNode @see svg-graphics-core.ts#getG
 */
export function unwrapContentG(bodyWithPiAndG: string): string {
  const withoutPi = bodyWithPiAndG.replace(/^<\?plantuml[^>]*\?>/, '');
  if (!withoutPi.startsWith('<g>') || !withoutPi.endsWith('</g>')) {
    throw new Error('unwrapContentG: malformed klimt SVG output (missing bare content <g> wrapper)');
  }
  return withoutPi.slice(3, -4);
}

/**
 * Convenience composition of {@link extractDefs} + {@link extractBody} +
 * {@link unwrapContentG}: turns a complete klimt document string (as
 * produced by `UGraphicSvg#getSvgString`) into its flat, unwrapped content
 * markup plus any non-empty `<defs>` payload (gradients, etc.) — the shape
 * every `RenderFragment.body`/`.extraDefs` pair expects.
 */
export function extractFlatContent(svg: string): { body: string; extraDefs: string } {
  const { withoutDefs, extraDefs } = extractDefs(svg);
  const body = unwrapContentG(extractBody(withoutDefs));
  return { body, extraDefs };
}
