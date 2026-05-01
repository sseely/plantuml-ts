export interface BoardNode {
  name: string;
  stage: number;
  children: BoardNode[];
}

export interface BoardActivity {
  name: string;
  root: BoardNode;
}

export interface BoardDiagramAST {
  activities: BoardActivity[];
}

export interface CardGeometry {
  label: string;
  dx: number;
  dy: number;
}

export interface ActivityGeometry {
  xOffset: number;
  fullWidth: number;
  cards: CardGeometry[];
}

export interface BoardGeometry {
  activities: ActivityGeometry[];
  totalWidth: number;
  maxStage: number;
}
