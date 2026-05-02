export type ScaleDirection = 'ltr' | 'rtl';

export interface PacketItem {
  bitStart: number;
  bitEnd: number;
  width: number;
  height: number;
  label: string;
}

export interface PacketBlock {
  width: number;
  height: number;
  label: string;
  leftOpen: boolean;
  rightOpen: boolean;
}

export interface PacketIndicator {
  bitNumber: number;
  full: boolean;
  numbered: boolean;
}

export interface PacketDiagramAST {
  colWidth: number;
  bitHeight: number;
  scaleDirection: ScaleDirection;
  scaleInterval: number | null;
  sameHeight: boolean;
  items: PacketItem[];
}

export interface PacketGeometry {
  grid: PacketBlock[][];
  indicators: PacketIndicator[];
  colWidth: number;
  bitWidth: number;
  bitHeight: number;
  indicatorHeight: number;
  totalWidth: number;
  totalHeight: number;
}
