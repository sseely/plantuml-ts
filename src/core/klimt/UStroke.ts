import type { UChange } from './UChange.js';

/**
 * UStroke — line thickness plus an optional dash pattern (`dashVisible`
 * on, `dashSpace` off, repeating). It is itself a `UChange`: applying one
 * to a `UGraphic` replaces the graphic's current stroke wholesale (see
 * `AbstractCommonUGraphic#apply`).
 *
 * Upstream: klimt/UStroke.java. Ported members: the constructor,
 * `withThickness`/`simple` factories, `onlyThickness`,
 * `getDashVisible`/`getDashSpace`/`getThickness`, `getDasharraySvg`,
 * `getDashTikz`, `equals`. `hashCode` is dropped — nothing in this port
 * keys a hash-based collection off `UStroke` value equality, so a TS
 * translation would be dead code (see project code-principles: no
 * speculative members).
 */
export class UStroke implements UChange {
  private readonly dashVisible: number;
  private readonly dashSpace: number;
  private readonly thickness: number;

  constructor(dashVisible: number, dashSpace: number, thickness: number) {
    this.dashVisible = dashVisible;
    this.dashSpace = dashSpace;
    this.thickness = thickness;
  }

  static withThickness(thickness: number): UStroke {
    return new UStroke(0, 0, thickness);
  }

  static simple(): UStroke {
    return new UStroke(0, 0, 1.0);
  }

  onlyThickness(): UStroke {
    return new UStroke(0, 0, this.thickness);
  }

  getDashVisible(): number {
    return this.dashVisible;
  }

  getDashSpace(): number {
    return this.dashSpace;
  }

  getThickness(): number {
    return this.thickness;
  }

  getDasharraySvg(): readonly [number, number] | undefined {
    if (this.dashVisible === 0) return undefined;
    return [this.dashVisible, this.dashSpace];
  }

  getDashTikz(): string | undefined {
    if (this.dashVisible === 0) return undefined;
    return `on ${this.dashVisible}pt off ${this.dashSpace}pt`;
  }

  equals(other: UStroke): boolean {
    return (
      this.dashVisible === other.dashVisible &&
      this.dashSpace === other.dashSpace &&
      this.thickness === other.thickness
    );
  }

  toString(): string {
    return `${this.dashVisible}-${this.dashSpace}-${this.thickness}`;
  }
}
