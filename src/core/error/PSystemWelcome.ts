/**
 * The "Welcome to PlantUML!" block. Upstream renders it as its own diagram for
 * an empty document, AND stacks it on top of the error diagram whenever the
 * failing source is shorter than 5 lines
 * (`PSystemError#getTextBlock` → `getSource().getTotalLineCountLessThan5()`) —
 * live-oracle verified: a 4-line source with an orphan `!endif` shows it, a
 * 7-line one does not.
 *
 * The strings carry upstream's creole: `<b>` (bold), `""…""` (monospace), and
 * `<u>…</u>` (underline). `error-renderer.ts` draws all three.
 *
 * Upstream also draws the PlantUML logo (`PSystemVersion.getPlantumlImage()`)
 * in the block's top-right corner. This port vendors no raster assets, so the
 * logo is omitted — the text is identical.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/eggs/PSystemWelcome.java
 */

export class PSystemWelcome {
  private readonly strings: string[] = [];

  constructor() {
    this.strings.push('<b>Welcome to PlantUML!');
    this.strings.push(' ');
    this.strings.push('You can start with a simple UML Diagram like:');
    this.strings.push(' ');
    this.strings.push('""Bob->Alice: Hello""');
    this.strings.push(' ');
    this.strings.push('Or');
    this.strings.push(' ');
    this.strings.push('""class Example""');
    this.strings.push(' ');
    this.strings.push(
      'You will find more information about PlantUML syntax on <u>https://plantuml.com</u>',
    );
    this.strings.push(' ');
    this.strings.push('(Details by typing ""license"" keyword)');
    this.strings.push(' ');
  }

  /** The lines a black-on-white `GraphicStrings` block draws. */
  getStrings(): readonly string[] {
    return this.strings;
  }

  /** @see ~/git/plantuml/.../eggs/PSystemWelcome.java#getDescription */
  getDescription(): string {
    return '(Empty)';
  }
}
