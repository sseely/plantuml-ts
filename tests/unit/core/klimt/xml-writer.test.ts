import { describe, expect, it } from 'vitest';
import { XmlDocument, XmlWriter } from '../../../../src/core/klimt/drawing/svg/xml-writer.js';
import { UGroupType } from '../../../../src/core/klimt/shape/UGroup.js';

describe('XmlWriter', () => {
  it('emits a self-closing tag for an element with no children (AC1 skeleton)', () => {
    const w = new XmlWriter(0);
    w.startElement('defs');
    w.endElement();
    expect(w.getXml()).toBe('<defs/>');
  });

  it('emits attributes in call order, double-quoted', () => {
    const w = new XmlWriter(0);
    w.startElement('rect');
    w.attribute('x', '0');
    w.attribute('y', '10');
    w.endElement();
    expect(w.getXml()).toBe('<rect x="0" y="10"/>');
  });

  it('emits nested elements with inline text content', () => {
    const w = new XmlWriter(0);
    w.startElement('text');
    w.text('hello');
    w.endElement();
    expect(w.getXml()).toBe('<text>hello</text>');
  });

  it('throws when adding an attribute outside an open start tag', () => {
    const w = new XmlWriter(0);
    w.startElement('a');
    w.text('x');
    expect(() => w.attribute('id', 'y')).toThrow('Cannot add an attribute outside of an open start tag.');
  });

  it('throws getXml() when an element is left open', () => {
    const w = new XmlWriter(0);
    w.startElement('a');
    expect(() => w.getXml()).toThrow('Some elements were left open: a');
  });

  it('throws endElement() when there is no element to close', () => {
    const w = new XmlWriter(0);
    expect(() => w.endElement()).toThrow('No element to close.');
  });

  it('getRawXml() returns markup so far without requiring closure', () => {
    const w = new XmlWriter(0);
    w.startElement('a');
    expect(w.getRawXml()).toBe('<a');
  });

  it('escapes & and < in text content, leaves > untouched', () => {
    const w = new XmlWriter(0);
    w.startElement('text');
    w.text('a < b & c > d');
    w.endElement();
    expect(w.getXml()).toBe('<text>a &lt; b &amp; c > d</text>');
  });

  it('escapes &, < and " in attribute values', () => {
    const w = new XmlWriter(0);
    w.startElement('a');
    w.attribute('title', 'a < b & "c"');
    w.endElement();
    expect(w.getXml()).toBe('<a title="a &lt; b &amp; &quot;c&quot;"/>');
  });

  it('defangs -- inside comments and pads a trailing dash', () => {
    const w = new XmlWriter(0);
    w.comment('a--b-');
    expect(w.getXml()).toBe('<!--a- -b- -->');
  });

  it('emits a comment with no decorative spacing for plain text', () => {
    const w = new XmlWriter(0);
    w.comment('entity X');
    expect(w.getXml()).toBe('<!--entity X-->');
  });

  it('emits a processing instruction with data, and omits the space when data is empty', () => {
    const w = new XmlWriter(0);
    w.processingInstruction('plantuml', '$version$');
    w.processingInstruction('empty', '');
    expect(w.getXml()).toBe('<?plantuml $version$?><?empty?>');
  });

  it('splits an embedded ]]> sequence across two CDATA sections', () => {
    const w = new XmlWriter(0);
    w.cdata('a]]>b');
    expect(w.getXml()).toBe('<![CDATA[a]]]]><![CDATA[>b]]>');
  });

  it('passes raw markup through unescaped and unindented', () => {
    const w = new XmlWriter(0);
    w.startElement('g');
    w.raw('<rect x="<0>"/>');
    w.endElement();
    expect(w.getXml()).toBe('<g><rect x="<0>"/></g>');
  });

  it('indents and newlines when indentSpaces > 0', () => {
    const w = new XmlWriter(2);
    w.startElement('a');
    w.startElement('b');
    w.endElement();
    w.endElement();
    expect(w.getXml()).toBe('<a>\n  <b/>\n</a>\n');
  });
});

describe('XmlDocument', () => {
  it('throws toXml() when no root has been set', () => {
    const doc = new XmlDocument();
    expect(() => doc.toXml(0)).toThrow('No root element set.');
  });

  it('serializes a document from its root element', () => {
    const doc = new XmlDocument();
    const root = doc.createElement('svg');
    doc.setRoot(root);
    const child = doc.createElement('defs');
    root.appendChild(child);
    expect(doc.toXml(0)).toBe('<svg><defs/></svg>');
  });

  it('getRoot() returns null before setRoot() and the root after', () => {
    const doc = new XmlDocument();
    expect(doc.getRoot()).toBeNull();
    const root = doc.createElement('svg');
    doc.setRoot(root);
    expect(doc.getRoot()).toBe(root);
  });

  describe('applyGroupAttribute (upstream: PortableSvgDocument#applyGroupAttribute)', () => {
    it('TITLE appends a <title> child with the value as text content', () => {
      const doc = new XmlDocument();
      const g = doc.createElement('g');
      doc.applyGroupAttribute(g, UGroupType.TITLE, 'My Title');
      expect(g.toXml(0)).toBe('<g><title>My Title</title></g>');
    });

    it('ID is ignored (no attribute set)', () => {
      const doc = new XmlDocument();
      const g = doc.createElement('g');
      doc.applyGroupAttribute(g, UGroupType.ID, 'should-not-appear');
      expect(g.toXml(0)).toBe('<g/>');
    });

    it('DATA_UID is renamed to the "id" attribute', () => {
      const doc = new XmlDocument();
      const g = doc.createElement('g');
      doc.applyGroupAttribute(g, UGroupType.DATA_UID, 'ent0002');
      expect(g.toXml(0)).toBe('<g id="ent0002"/>');
    });

    it('DATA_PARTICIPANT_1 and DATA_ENTITY_1_UID both map to data-entity-1', () => {
      const doc = new XmlDocument();
      const g1 = doc.createElement('g');
      doc.applyGroupAttribute(g1, UGroupType.DATA_PARTICIPANT_1, 'a');
      expect(g1.toXml(0)).toBe('<g data-entity-1="a"/>');

      const g2 = doc.createElement('g');
      doc.applyGroupAttribute(g2, UGroupType.DATA_ENTITY_1_UID, 'b');
      expect(g2.toXml(0)).toBe('<g data-entity-1="b"/>');
    });

    it('DATA_PARTICIPANT_2 and DATA_ENTITY_2_UID both map to data-entity-2', () => {
      const doc = new XmlDocument();
      const g1 = doc.createElement('g');
      doc.applyGroupAttribute(g1, UGroupType.DATA_PARTICIPANT_2, 'a');
      expect(g1.toXml(0)).toBe('<g data-entity-2="a"/>');

      const g2 = doc.createElement('g');
      doc.applyGroupAttribute(g2, UGroupType.DATA_ENTITY_2_UID, 'b');
      expect(g2.toXml(0)).toBe('<g data-entity-2="b"/>');
    });

    it('CLASS/DATA_SOURCE_LINE/DATA_QUALIFIED_NAME/DATA_ENTITY_UID/DATA_VISIBILITY_MODIFIER/DATA_LINK_TYPE lowercase-hyphenate to their own attribute name', () => {
      const doc = new XmlDocument();
      const g = doc.createElement('g');
      doc.applyGroupAttribute(g, UGroupType.CLASS, 'entity');
      doc.applyGroupAttribute(g, UGroupType.DATA_QUALIFIED_NAME, 'Pack1.Comp1');
      doc.applyGroupAttribute(g, UGroupType.DATA_UID, 'ent0002');
      doc.applyGroupAttribute(g, UGroupType.DATA_SOURCE_LINE, '4');
      expect(g.toXml(0)).toBe(
        '<g class="entity" data-qualified-name="Pack1.Comp1" id="ent0002" data-source-line="4"/>',
      );
    });

    it('DATA_ENTITY_UID/DATA_VISIBILITY_MODIFIER/DATA_LINK_TYPE (remaining cases)', () => {
      const doc = new XmlDocument();
      const g = doc.createElement('g');
      doc.applyGroupAttribute(g, UGroupType.DATA_ENTITY_UID, 'u1');
      doc.applyGroupAttribute(g, UGroupType.DATA_VISIBILITY_MODIFIER, 'public');
      doc.applyGroupAttribute(g, UGroupType.DATA_LINK_TYPE, 'association');
      expect(g.toXml(0)).toBe(
        '<g data-entity-uid="u1" data-visibility-modifier="public" data-link-type="association"/>',
      );
    });

    it('un-numbered DATA_ENTITY and DATA_PARTICIPANT keys are ignored (no matching case, matches upstream default)', () => {
      const doc = new XmlDocument();
      const g = doc.createElement('g');
      doc.applyGroupAttribute(g, UGroupType.DATA_ENTITY, 'x');
      doc.applyGroupAttribute(g, UGroupType.DATA_PARTICIPANT, 'y');
      expect(g.toXml(0)).toBe('<g/>');
    });
  });
});
