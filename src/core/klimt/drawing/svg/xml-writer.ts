/**
 * xml-writer.ts — the dependency-free XML/SVG node stack `SvgGraphics`
 * builds its document out of: a streaming text writer (`XmlWriter`) plus
 * a small eager DOM (`XmlDocument`/`XmlNode`/`XmlLeaf`/`XmlContent`).
 *
 * Upstream: klimt/drawing/svg/{XmlWriter,XmlDocument,XmlNode,XmlLeaf,
 * XmlContent}.java (285 + 75 + 138 + 102 + 48 = 648 ln with license
 * headers). Upstream's own doc comments note this is already a
 * "TeaVM-friendly" rewrite with no `org.w3c.dom`/`javax.xml` dependency —
 * i.e. upstream itself already did the dependency-free simplification a
 * TS port would otherwise have to invent, so this is a near-mechanical
 * port with two further simplifications on top (both documented at their
 * definition site below):
 *
 * - `IElement.java` (a marker interface separating a portable-DOM
 *   abstraction from `XmlNode`, its only implementer) is dropped —
 *   `XmlNode` methods are typed directly, since there is no second
 *   implementer to abstract over.
 * - `PortableSvgDocument.java` (an abstract base class existing solely so
 *   `XmlDocument` could be swapped for a real-DOM implementation, which
 *   this port never needs) is folded into `XmlDocument` directly; its one
 *   concrete method, `applyGroupAttribute`, becomes an `XmlDocument`
 *   method.
 */

import { UGroupType } from '../../shape/UGroup.js';

/** A piece of content that can sit inside an `XmlNode`: a nested element
 * (`XmlNode`) or a leaf (`XmlLeaf`). Upstream: `XmlContent.java`. */
export interface XmlContent {
  writeTo(w: XmlWriter): void;
}

/**
 * XmlWriter — a minimal, dependency-free streaming XML/SVG writer.
 *
 * Upstream: `XmlWriter.java`. Keeps a stack of open element names so it
 * can auto-close them and produce self-closing tags (`<g/>`) when an
 * element has no children. Element text and attribute values are
 * XML-escaped with the minimal escaping required for each context (text
 * content only needs `&` and `<`; attribute values additionally need
 * `"`). Comments, processing instructions, CDATA sections and raw
 * (already-serialized) markup are also supported. `indentSpaces <= 0`
 * (the value `SvgGraphics` always passes, `0`) suppresses all newlines
 * and indentation, producing the single-line output real PlantUML SVG
 * uses.
 */
export class XmlWriter {
  private out = '';
  private readonly indentSpaces: number;

  // Stack of open tag names, mirroring upstream's array-based stack
  // (chosen there to avoid autoboxing/allocation under TeaVM; kept here
  // for line-for-line fidelity rather than a plain TS array's push/pop,
  // which would behave identically).
  private openTags: string[] = [];

  // True once startElement() has written "<name" but not yet the closing
  // ">" of the start tag, so the next call can decide between
  // attributes, a child, inline text, or a self-closing "/>".
  private isPendingClose = false;

  // True when the current element's content is inline text (no child
  // element), so endElement() does not indent the closing tag onto its
  // own line.
  private hasInlineContent = false;

  constructor(indentSpaces: number) {
    this.indentSpaces = indentSpaces;
  }

  startElement(name: string): XmlWriter {
    this.closePendingStartTag(true);
    this.indent(this.openTags.length);
    this.out += '<' + name;
    this.openTags.push(name);
    this.isPendingClose = true;
    this.hasInlineContent = false;
    return this;
  }

  attribute(name: string, value: string): XmlWriter {
    if (!this.isPendingClose) {
      throw new Error('Cannot add an attribute outside of an open start tag.');
    }
    this.out += ' ' + name + '="' + this.escapeAttribute(value) + '"';
    return this;
  }

  text(value: string): XmlWriter {
    this.closePendingStartTag(false);
    this.hasInlineContent = true;
    this.out += this.escapeText(value);
    return this;
  }

  /**
   * Emits an XML comment `<!--...-->` with no decorative spacing,
   * matching the legacy serializer. The sequence `--` (illegal inside a
   * comment) is defanged to `- -`; a trailing `-` would otherwise merge
   * with the closing `-->`, so a single space is inserted in that case
   * only.
   */
  comment(value: string | null): XmlWriter {
    this.closePendingStartTag(true);
    this.indent(this.openTags.length);
    this.out += '<!--';
    if (value !== null) {
      let safe = value.split('--').join('- -');
      if (safe.endsWith('-')) safe = safe + ' ';
      this.out += safe;
    }
    this.out += '-->';
    this.newline();
    this.hasInlineContent = false;
    return this;
  }

  /** Emits a processing instruction `<?target data?>`, e.g. `<?plantuml version?>`. */
  processingInstruction(target: string, data: string | null): XmlWriter {
    this.closePendingStartTag(true);
    this.indent(this.openTags.length);
    this.out += '<?' + target;
    if (data !== null && data.length > 0) this.out += ' ' + data;
    this.out += '?>';
    this.newline();
    this.hasInlineContent = false;
    return this;
  }

  /**
   * Emits a CDATA section `<![CDATA[ ... ]]>`, used for embedded CSS and
   * scripts. The content is not escaped; the only illegal sequence
   * `]]>` is split across two sections to keep the output well-formed.
   */
  cdata(value: string | null): XmlWriter {
    this.closePendingStartTag(true);
    this.indent(this.openTags.length);
    this.out += '<![CDATA[';
    if (value !== null) this.out += value.split(']]>').join(']]]]><![CDATA[>');
    this.out += ']]>';
    this.newline();
    this.hasInlineContent = false;
    return this;
  }

  /**
   * Emits already-serialized markup verbatim, with no escaping and no
   * indentation. Intended for splicing in pre-built SVG fragments. The
   * caller is responsible for the well-formedness of `markup`.
   */
  raw(markup: string | null): XmlWriter {
    this.closePendingStartTag(true);
    if (markup !== null) this.out += markup;
    this.hasInlineContent = false;
    return this;
  }

  endElement(): XmlWriter {
    if (this.openTags.length === 0) throw new Error('No element to close.');

    const name = this.openTags.pop();
    if (this.isPendingClose) {
      // Empty element: collapse to a self-closing tag, e.g. <g/>.
      this.out += '/>';
      this.newline();
      this.isPendingClose = false;
    } else {
      if (!this.hasInlineContent) this.indent(this.openTags.length);
      this.out += '</' + String(name) + '>';
      this.newline();
    }
    this.hasInlineContent = false;
    return this;
  }

  getXml(): string {
    if (this.openTags.length !== 0) {
      throw new Error(`Some elements were left open: ${this.openTags.join(', ')}`);
    }
    return this.out;
  }

  /**
   * Returns the markup produced so far, without requiring that every
   * element be closed. Use this to retrieve a fragment that will be
   * spliced into another writer via `raw()`; use `getXml()` for a
   * complete document, where leaving an element open is a programming
   * error.
   */
  getRawXml(): string {
    return this.out;
  }

  // Closes a dangling start tag. When the next thing is a child element
  // or the end of an empty element, openingChild is true and we may need
  // a newline; for inline text we just emit ">" with no extra
  // whitespace.
  private closePendingStartTag(openingChild: boolean): void {
    if (!this.isPendingClose) return;
    this.out += '>';
    if (openingChild) this.newline();
    this.isPendingClose = false;
  }

  private newline(): void {
    if (this.indentSpaces > 0) this.out += '\n';
  }

  private indent(level: number): void {
    if (this.indentSpaces <= 0) return;
    this.out += ' '.repeat(level * this.indentSpaces);
  }

  // Text content: only '&' and '<' are mandatory. '>' is escaped only as
  // part of the "]]>" sequence in real XML, which cannot occur here, so
  // we leave it.
  private escapeText(input: string): string {
    let result = '';
    for (const c of input) {
      if (c === '&') result += '&amp;';
      else if (c === '<') result += '&lt;';
      else result += c;
    }
    return result;
  }

  // Attribute value (always double-quoted): escape '&', '<' and '"'.
  private escapeAttribute(input: string): string {
    let result = '';
    for (const c of input) {
      if (c === '&') result += '&amp;';
      else if (c === '<') result += '&lt;';
      else if (c === '"') result += '&quot;';
      else result += c;
    }
    return result;
  }
}

/**
 * XmlLeaf — a leaf node inside an `XmlNode`: text, a comment, a
 * processing instruction, a CDATA section or raw markup. The kind is
 * fixed at construction and selects how the content is written out by
 * `XmlWriter`.
 *
 * Upstream: `XmlLeaf.java` — package-private there; exported here since
 * TS has no package-private visibility and `XmlNode.getFirstChild()`'s
 * return type must name it.
 */
export class XmlLeaf implements XmlContent {
  private constructor(
    private readonly kind: 'TEXT' | 'COMMENT' | 'PROCESSING_INSTRUCTION' | 'CDATA' | 'RAW',
    // For PROCESSING_INSTRUCTION, "first" is the target and "second" the
    // data. For every other kind, only "first" is used.
    private readonly first: string | null,
    private readonly second: string | null = null,
  ) {}

  static text(value: string | null): XmlLeaf {
    return new XmlLeaf('TEXT', value);
  }

  static comment(value: string | null): XmlLeaf {
    return new XmlLeaf('COMMENT', value);
  }

  static processingInstruction(target: string, data: string | null): XmlLeaf {
    return new XmlLeaf('PROCESSING_INSTRUCTION', target, data);
  }

  static cdata(value: string | null): XmlLeaf {
    return new XmlLeaf('CDATA', value);
  }

  static raw(markup: string | null): XmlLeaf {
    return new XmlLeaf('RAW', markup);
  }

  writeTo(w: XmlWriter): void {
    switch (this.kind) {
      case 'TEXT':
        w.text(this.first ?? '');
        break;
      case 'COMMENT':
        w.comment(this.first);
        break;
      case 'PROCESSING_INSTRUCTION':
        w.processingInstruction(this.first ?? '', this.second);
        break;
      case 'CDATA':
        w.cdata(this.first);
        break;
      case 'RAW':
        w.raw(this.first);
        break;
    }
  }
}

/**
 * XmlNode — a minimal, dependency-free DOM element, replicating just the
 * subset of `org.w3c.dom.Element` the SVG generation code relies on. The
 * tree is built eagerly (like a DOM) so that attributes set late — once
 * the final canvas size is known — are honored, then serialized to text
 * in one pass via `XmlWriter`. Attribute order is preserved (insertion
 * order, via `Map`) to keep the output deterministic.
 *
 * Upstream: `XmlNode.java`. Ported in full, minus the `IElement`
 * interface (see the module doc comment above).
 */
export class XmlNode implements XmlContent {
  private readonly attributes = new Map<string, string>();
  private readonly children: XmlContent[] = [];

  constructor(private readonly tagName: string) {}

  getTagName(): string {
    return this.tagName;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  appendChild(child: XmlNode): void {
    this.children.push(child);
  }

  /** Replaces all current content with a single text node, mirroring
   * `org.w3c.dom.Node.setTextContent(String)`. */
  setTextContent(value: string): void {
    this.children.length = 0;
    this.appendText(value);
  }

  appendText(value: string): void {
    this.children.push(XmlLeaf.text(value));
  }

  appendComment(value: string): void {
    this.children.push(XmlLeaf.comment(value));
  }

  appendProcessingInstruction(target: string, data: string | null): void {
    this.children.push(XmlLeaf.processingInstruction(target, data));
  }

  appendCData(value: string): void {
    this.children.push(XmlLeaf.cdata(value));
  }

  /** Appends already-serialized markup, spliced verbatim (no escaping).
   * Used for inlined SVG images. */
  appendRaw(markup: string): void {
    this.children.push(XmlLeaf.raw(markup));
  }

  /** Returns the first child if this element has any content, else
   * `null`. Mirrors `org.w3c.dom.Node.getFirstChild()`, used only to
   * test whether an element is empty (so empty groups/links can be
   * dropped). */
  getFirstChild(): XmlContent | null {
    return this.children.length === 0 ? null : this.children[0]!;
  }

  /** Serializes this element and its subtree into the given writer. */
  writeTo(w: XmlWriter): void {
    w.startElement(this.tagName);
    for (const [name, value] of this.attributes) w.attribute(name, value);
    for (const child of this.children) child.writeTo(w);
    w.endElement();
  }

  /** Serializes this element as a standalone document fragment. */
  toXml(indentSpaces: number): string {
    const w = new XmlWriter(indentSpaces);
    this.writeTo(w);
    return w.getXml();
  }
}

// applyGroupAttribute's plain-rename cases, factored into module-level
// lookup sets so the method below reads as a short if-chain rather than a
// 14-case switch (kept the complexity checker's CCN budget for the
// method; behavior is unchanged from a straight switch port).
const ENTITY_1_KEYS: ReadonlySet<UGroupType> = new Set([
  UGroupType.DATA_PARTICIPANT_1,
  UGroupType.DATA_ENTITY_1_UID,
]);
const ENTITY_2_KEYS: ReadonlySet<UGroupType> = new Set([
  UGroupType.DATA_PARTICIPANT_2,
  UGroupType.DATA_ENTITY_2_UID,
]);
const SVG_KEY_ATTR_KEYS: ReadonlySet<UGroupType> = new Set([
  UGroupType.CLASS,
  UGroupType.DATA_SOURCE_LINE,
  UGroupType.DATA_QUALIFIED_NAME,
  UGroupType.DATA_ENTITY_UID,
  UGroupType.DATA_VISIBILITY_MODIFIER,
  UGroupType.DATA_LINK_TYPE,
]);

/**
 * XmlDocument — a minimal, dependency-free document: a factory for
 * `XmlNode` elements plus a single root.
 *
 * Upstream: `XmlDocument.java` (factory + root + `toXml`) merged with
 * `PortableSvgDocument.java` (`applyGroupAttribute`) — see the module
 * doc comment above for why the two collapse into one class here.
 */
export class XmlDocument {
  private root: XmlNode | null = null;

  createElement(name: string): XmlNode {
    return new XmlNode(name);
  }

  /** Sets the root element; subsequent serialization starts from it. */
  setRoot(root: XmlNode): void {
    this.root = root;
  }

  getRoot(): XmlNode | null {
    return this.root;
  }

  /** Serializes the whole document, starting at the root element. */
  toXml(indentSpaces: number): string {
    if (this.root === null) throw new Error('No root element set.');
    const w = new XmlWriter(indentSpaces);
    this.root.writeTo(w);
    return w.getXml();
  }

  /**
   * applyGroupAttribute — upstream: `PortableSvgDocument.java`. Maps a
   * `UGroupType` key/value pair from `SvgGraphics#startGroup` onto the
   * `<g>` element's attributes (or, for `TITLE`, a child `<title>`
   * element). Keys handled by none of the branches below (`ID`, and the
   * un-numbered `DATA_ENTITY`/`DATA_PARTICIPANT`) are intentionally
   * ignored, matching upstream's `default:` fallthrough.
   */
  applyGroupAttribute(element: XmlNode, key: UGroupType, value: string): void {
    if (key === UGroupType.TITLE) {
      this.applyTitleAttribute(element, value);
      return;
    }
    if (key === UGroupType.ID) return; // ignored

    if (key === UGroupType.DATA_UID) {
      // DATA_UID *will* be renamed to ID, but right now, we do some hack
      element.setAttribute('id', value);
      return;
    }
    if (ENTITY_1_KEYS.has(key)) {
      element.setAttribute('data-entity-1', value);
      return;
    }
    if (ENTITY_2_KEYS.has(key)) {
      element.setAttribute('data-entity-2', value);
      return;
    }
    if (SVG_KEY_ATTR_KEYS.has(key)) {
      element.setAttribute(key.toLowerCase().replace(/_/g, '-'), value);
    }
  }

  private applyTitleAttribute(element: XmlNode, value: string): void {
    const title = this.createElement('title');
    title.setTextContent(value);
    element.appendChild(title);
  }
}
