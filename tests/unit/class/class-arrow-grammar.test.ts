/**
 * Composed arrow-grammar tests (iteration 4, class-dot-sync).
 *
 * Pins the re-mirrored composed grammar in class-relationship-parser.ts:
 * decor1-set · body(dash/dot, optional direction word, optional [style]
 * segments) · decor2-set, mirroring CommandLinkClass.java's independent
 * ARROW_HEAD1 / ARROW_BODY1 / ARROW_STYLE1 / ARROW_DIRECTION / ARROW_STYLE2 /
 * ARROW_BODY2 / ARROW_HEAD2 groups (see LinkDecor.java for the decor glyph
 * sets). Each new-construct case documents the from/to/type/length expected
 * per the real oracle DOT (test-results/dot-cache/class/<slug>/svek-1.dot)
 * for the fixture that motivated it.
 */
import { describe, it, expect } from 'vitest';
import { parseRelationshipLine } from '../../../src/diagrams/class/class-relationship-parser.js';

describe('composed arrow grammar — new constructs (D6 iteration 4)', () => {
  // bisome-32-bevo992: `c1 -[thickness=5]-> c4` — oracle minlen=1 (length 2).
  it('parses an inline style bracket before the arrowhead: -[style]->', () => {
    const r = parseRelationshipLine('A -[thickness=5]-> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association', length: 2 });
  });

  // tenomi-61-ceta987: `jenkins <-[#green]-> redmine` — oracle minlen=1,
  // edge jenkins->redmine (declaration order; no swap for a symmetric
  // bidirectional arrow — see resolveArrow's swapDirection rule).
  it('parses a bidirectional arrow with an inline style bracket: <-[style]->', () => {
    const r = parseRelationshipLine('A <-[#green]-> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association', length: 2 });
  });

  // ruzibe-92-doti700: `a <|-[#FF0000,bold]- b` — oracle minlen=1, edge a->b
  // (extension swaps for HIERARCHICAL ranking: from=Bar(child),to=Foo(parent)).
  it('parses a style bracket on an extension arrow: <|-[style]-', () => {
    const r = parseRelationshipLine('Foo <|-[#FF0000,bold]- Bar');
    expect(r).toMatchObject({ from: 'Bar', to: 'Foo', type: 'extension', length: 2 });
  });

  // rekazo-16-jola519: `bob x--> alice` — oracle minlen=1, edge bob->alice.
  it('parses the NOT_NAVIGABLE head decor: x-->', () => {
    const r = parseRelationshipLine('A x--> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association', length: 2 });
  });

  // jobubo-97-resa133: `Alice --_> Bob` — oracle minlen=1, edge Alice->Bob.
  it('parses the ARROW underscore variant: --_>', () => {
    const r = parseRelationshipLine('A --_> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association', length: 2 });
  });

  // coxose-20-nifu136 (`HashMap [d4] +-l-> [h] V4`): oracle minlen=0 — the
  // 'l' (left) direction word forces length 1 regardless of body dash count.
  // CommandLinkClass.executeArg also calls `link = link.getInv()` whenever
  // ARROW_DIRECTION is LEFT/UP (CommandLinkClass.java:363-364), independent
  // of and composing with any decor-driven swap (vegubu-29-bomu147 mission
  // diagnosis) — here decorSwap is false (PLUS never participates), so the
  // 'l' word alone flips from/to.
  it('parses the PLUS head decor combined with a direction word: +-l->', () => {
    const r = parseRelationshipLine('A +-l-> B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'association', length: 1 });
  });

  // coxose-20-nifu136 (`HashMap [a1] <|-u-> [e] V1`): oracle minlen=1 — 'u'
  // (up) is not horizontal, so length is the real body-dash count (2).
  // Both ends carry a direction-glyph (extends left, arrow right); per the
  // symmetric-arrow precedent (tenomi) neither side wins on decor alone
  // (decorSwap stays false) — but the 'u' direction word triggers
  // CommandLinkClass's getInv() swap independently (see the PLUS case above),
  // so from/to still flip (type still resolves to 'extension': the triangle
  // decor outranks the plain arrowhead).
  it('parses a combined extension + directed arrowhead: <|-u->', () => {
    const r = parseRelationshipLine('A <|-u-> B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'extension', length: 2 });
  });

  // coxose-20-nifu136 (`HashMap [b2] *.r.> [f] V2`): oracle minlen=0 — 'r'
  // (right) forces length 1. Composition decor outranks the plain arrowhead
  // for type; the arrowhead alone (composition is not a direction-kind)
  // determines swapDirection (right-only arrow -> no swap).
  it('parses a composition arrow with a direction word and dotted body: *.r.>', () => {
    const r = parseRelationshipLine('A *.r.> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'composition', length: 1 });
  });

  // coxose-20-nifu136 (`HashMap [c3] o.d.> [g] V3`): oracle minlen=1 — 'd'
  // (down) is not horizontal, so length is the real dot count (2).
  it('parses an aggregation arrow with a direction word and dotted body: o.d.>', () => {
    const r = parseRelationshipLine('A o.d.> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'aggregation', length: 2 });
  });
});

describe('composed arrow grammar — regression (today\'s common arrows)', () => {
  it('plain association arrow: -->', () => {
    const r = parseRelationshipLine('A --> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association', length: 2 });
  });

  it('extension arrow: <|--', () => {
    const r = parseRelationshipLine('A <|-- B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'extension', length: 2 });
  });

  it('composition arrow: *--', () => {
    const r = parseRelationshipLine('A *-- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'composition', length: 2 });
  });

  it('aggregation arrow: o--', () => {
    const r = parseRelationshipLine('A o-- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'aggregation', length: 2 });
  });

  it('dependency arrow: ..>', () => {
    const r = parseRelationshipLine('A ..> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'dependency', length: 2 });
  });

  it('plain association connector: --', () => {
    const r = parseRelationshipLine('A -- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association', length: 2 });
  });

  it('left-pointing association arrow: <--', () => {
    const r = parseRelationshipLine('A <-- B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'association', length: 2 });
  });

  it('implementation arrow: <|..', () => {
    const r = parseRelationshipLine('A <|.. B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'implementation', length: 2 });
  });

  it('decoration + directional arrowhead: o-->', () => {
    const r = parseRelationshipLine('A o--> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'aggregation', length: 2 });
  });

  it('decoration + directional arrowhead pointing left: <--o', () => {
    const r = parseRelationshipLine('A <--o B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'aggregation', length: 2 });
  });

  it('bare longer body length still increments arrow length: ---->', () => {
    const r = parseRelationshipLine('A ----> B');
    expect(r).toMatchObject({ from: 'A', to: 'B', type: 'association', length: 4 });
  });

  // 'left' also triggers CommandLinkClass's ARROW_DIRECTION getInv() swap
  // (vegubu-29-bomu147 mission diagnosis), independent of the plain arrowhead
  // decor (decorSwap is false here), so from/to flip alongside length.
  it('horizontal direction word forces length 1: -left->', () => {
    const r = parseRelationshipLine('A -left-> B');
    expect(r).toMatchObject({ from: 'B', to: 'A', type: 'association', length: 1 });
  });
});

// G2 N28: PLUS/SQUARE/CROWFOOT/PARENTHESIS extremity marker shapes -- the
// D6-deferred glyph decorations `headToDecor` (class-arrow-grammar.ts)
// previously collapsed to 'none'. `resolveType`/`swapDirection` are
// UNCHANGED by this iteration (headToDecor is independent of
// HEAD1_KIND/HEAD2_KIND, see that file's own doc comment) -- these tests
// pin the NEW non-'none' `sourceDecor`/`targetDecor` values only.
describe('G2 N28: PLUS/SQUARE/CROWFOOT/PARENTHESIS decor resolution', () => {
  // zerofa-77-caro506: `foo2 #-- foo1` -- SQUARE at the head1 (source) end.
  it('resolves the SQUARE head decor: #--', () => {
    const r = parseRelationshipLine('A #-- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'square', targetDecor: 'none' });
  });

  // jojime-80-savu279: `A +-- C` -- PLUS at the head1 (source) end.
  it('resolves the PLUS head decor: +--', () => {
    const r = parseRelationshipLine('A +-- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'plus', targetDecor: 'none' });
  });

  // niduni-65-bujo175: `C2 --( A2` -- PARENTHESIS at the head2 (target) end
  // (a single, non-doubled paren -- distinct from `class-lollipop.ts`'s
  // `()`/`((`/`))` doubled forms, see headToDecor's own doc comment).
  it('resolves the PARENTHESIS head decor: --(', () => {
    const r = parseRelationshipLine('A --( B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'none', targetDecor: 'parenthesis' });
  });

  // The paren-bearing side is always semantically "to"
  // (`isDirectionKind`'s own doc comment, PARENTHESIS is a lollipop-family
  // direction-kind in `resolveArrow`'s classification -- unrelated to
  // `headToDecor`, unaffected by this iteration) -- `)` at head1 (textually
  // near A) swaps from/to so B becomes "to", carrying the decor.
  it('resolves the PARENTHESIS head decor with the direction-kind swap: )--', () => {
    const r = parseRelationshipLine('A )-- B');
    expect(r).toMatchObject({ from: 'B', to: 'A', sourceDecor: 'none', targetDecor: 'parenthesis' });
  });

  // medosa-71-ligu412: `foo1 --{ foo2` -- plain CROWFOOT at the head2 end.
  it('resolves the plain CROWFOOT head decor: --{', () => {
    const r = parseRelationshipLine('A --{ B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'none', targetDecor: 'crowfoot' });
  });

  it('resolves the plain CROWFOOT head decor on the source end: }--', () => {
    const r = parseRelationshipLine('A }-- B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'crowfoot', targetDecor: 'none' });
  });

  // xosiza-60-sobu480: `A |o--o| B` / `C ||--|| D` / `E }o--o{ F` /
  // `G }|--|{ H` -- the full crow's-foot IE-notation family, both ends.
  it('resolves the CIRCLE_LINE crow-foot pair: |o--o|', () => {
    const r = parseRelationshipLine('A |o--o| B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'circleLine', targetDecor: 'circleLine' });
  });

  it('resolves the DOUBLE_LINE crow-foot pair: ||--||', () => {
    const r = parseRelationshipLine('A ||--|| B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'doubleLine', targetDecor: 'doubleLine' });
  });

  it('resolves the CIRCLE_CROWFOOT pair: }o--o{', () => {
    const r = parseRelationshipLine('A }o--o{ B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'circleCrowfoot', targetDecor: 'circleCrowfoot' });
  });

  it('resolves the LINE_CROWFOOT pair: }|--|{', () => {
    const r = parseRelationshipLine('A }|--|{ B');
    expect(r).toMatchObject({ from: 'A', to: 'B', sourceDecor: 'lineCrowfoot', targetDecor: 'lineCrowfoot' });
  });

  // G2 N47: NOT_NAVIGABLE ('x') now resolves to its own marker --
  // `rekazo-16-jola519` (`bob x--> alice`) disproved the "zero corpus
  // reach" survey this test's OLD name cited (see
  // class-arrow-grammar.ts#headToDecor's doc comment). A doubled paren
  // pair is still the DISTINCT CommandLinkLollipop command, never
  // reaching headToDecor at all -- that part of the original framing
  // stands unchanged.
  it('resolves NOT_NAVIGABLE (x) to its own marker (G2 N47)', () => {
    const r = parseRelationshipLine('A x--> B');
    expect(r).toMatchObject({ sourceDecor: 'notNavigable', targetDecor: 'open' });
  });
});
