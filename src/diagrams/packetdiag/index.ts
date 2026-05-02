import type { SyncPlugin } from '../../core/dispatcher.js';
import type { PacketDiagramAST, PacketGeometry } from './ast.js';
import { parsePacket } from './parser.js';
import { layoutPacket } from './layout.js';
import { renderPacket } from './renderer.js';

export const packetdiagPlugin: SyncPlugin<PacketDiagramAST, PacketGeometry> = {
  type: 'packetdiag',

  accepts(_lines: readonly string[]): boolean {
    return false;
  },

  parse(source) {
    return parsePacket(source);
  },

  layoutSync(ast, _theme, _measurer) {
    return layoutPacket(ast);
  },

  render(geo, theme) {
    return renderPacket(geo, theme);
  },
};
