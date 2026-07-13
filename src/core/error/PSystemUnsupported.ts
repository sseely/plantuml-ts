/**
 * The "Diagram not supported by this release" screen: an `@start<something>`
 * this build does not know. Not a `PSystemError` upstream either — it is a
 * plain black-on-white `GraphicStrings` block, like the Welcome screen.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemUnsupported.java
 */

/**
 * Upstream appends `Running on <version>` and `(License <license>)` here,
 * guarded by `!TeaVM.isTeaVM()`. This port has no license layer, so it prints
 * the version line only.
 */
import { fullDescription } from '../version.js';

export class PSystemUnsupported {
  private readonly strings: string[] = [];

  /** @param directive the raw `@start…` line the document opened with. */
  constructor(directive: string) {
    this.strings.push('<b>Diagram not supported by this release of PlantUML');
    this.strings.push(' ');
    this.strings.push(
      `Sorry, but the following directive ""${directive}"" is not recognized.`,
    );
    this.strings.push(' ');
    this.strings.push('Possible causes:');
    this.strings.push('- Typo in the directive or incorrect syntax.');
    this.strings.push('- The directive was added in a newer PlantUML release.');
    this.strings.push(' ');
    this.strings.push('Suggested actions:');
    this.strings.push('- Check the directive spelling and syntax.');
    this.strings.push('- Upgrade PlantUML to the latest version.');
    this.strings.push('- Consult the documentation: https://plantuml.com');
    this.strings.push(' ');
    this.strings.push(`Running on ${fullDescription()}`);
  }

  /** The lines a black-on-white `GraphicStrings` block draws. */
  getStrings(): readonly string[] {
    return this.strings;
  }

  /** @see ~/git/plantuml/.../error/PSystemUnsupported.java#getDescription */
  getDescription(): string {
    return '(Unsupported)';
  }
}
