/**
 * YamlBuilder — builds a Monomorph tree from a sequence of YAML parse events.
 *
 * Ported from:
 *   net.sourceforge.plantuml.yaml.parser.YamlBuilder
 *
 * Two-stack invariant:
 *   nodes.length === indents.length + 1
 *   nodes[0] is the root (created in constructor).
 *   indents[i] is the YAML indentation level when nodes[i+1] was pushed.
 */

import { Monomorph } from './monomorph.js';

export class YamlBuilder {
  private readonly _indents: number[] = [];
  private readonly _nodes: Monomorph[] = [new Monomorph()];

  /**
   * Called by the parser before processing a line.
   * Adjusts the stack depth to match the current indentation level.
   */
  adjustIndentation(indent: number): void {
    if (this._indents.length === 0) {
      this._indents.push(indent);
      return;
    }
    if (indent > this._indents[this._indents.length - 1]!) {
      this._indents.push(indent);
    } else {
      while (
        this._indents.length > 0 &&
        indent < this._indents[this._indents.length - 1]!
      ) {
        this._indents.pop();
        this._nodes.pop();
        if (this.getLast().type === 'LIST') {
          this._nodes.pop();
        }
      }
    }
  }

  getResult(): Monomorph {
    return this._nodes[0]!;
  }

  private getLast(): Monomorph {
    return this._nodes[this._nodes.length - 1]!;
  }

  private isArrayAlreadyThere(): boolean {
    if (this._nodes.length < 2) return false;
    const parent = this._nodes[this._nodes.length - 2]!;
    if (parent.type !== 'LIST') return false;
    const lastIndex = parent.size() - 1;
    return parent.getElementAt(lastIndex) === this._nodes[this._nodes.length - 1];
  }

  onListItemPlainDash(): void {
    if (this.isArrayAlreadyThere()) this._nodes.pop();
    const newElement = new Monomorph();
    this.getLast().addInList(newElement);
    this._nodes.push(newElement);
  }

  onOnlyKey(key: string): void {
    const newElement = new Monomorph();
    this.getLast().putInMap(key, newElement);
    this._nodes.push(newElement);
  }

  onListItemOnlyKey(key: string): void {
    if (this.isArrayAlreadyThere()) this._nodes.pop();
    const newElement = new Monomorph();
    this.getLast().addInList(newElement);
    this._nodes.push(newElement);
    const newElement2 = new Monomorph();
    this.getLast().putInMap(key, newElement2);
    this._nodes.push(newElement2);
  }

  onListItemOnlyValue(value: string): void {
    if (this.isArrayAlreadyThere()) this._nodes.pop();
    this.getLast().addInList(Monomorph.scalar(value));
    // do NOT push to nodes
  }

  onListItemKeyAndValue(key: string, value: string): void {
    if (this.isArrayAlreadyThere()) this._nodes.pop();
    const newElement = new Monomorph();
    this.getLast().addInList(newElement);
    this._nodes.push(newElement);
    this.getLast().putInMap(key, Monomorph.scalar(value));
  }

  onListItemKeyAndFlowSequence(key: string, values: string[]): void {
    if (this.isArrayAlreadyThere()) this._nodes.pop();
    const newElement = new Monomorph();
    this.getLast().addInList(newElement);
    this._nodes.push(newElement);
    this.getLast().putInMap(key, Monomorph.list(values));
  }

  onKeyAndValue(key: string, value: string): void {
    this.getLast().putInMap(key, Monomorph.scalar(value));
  }

  onKeyAndFlowSequence(key: string, list: string[]): void {
    this.getLast().putInMap(key, Monomorph.list(list));
  }
}
