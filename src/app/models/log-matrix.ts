import {DisplayRef} from "./display-ref";


// Connection between two commits (put into matrix)
export interface Connection {
  symbol: LogMatrixSymbol,
  branch: string,
}

export enum LogMatrixSymbol {
  HORIZONTAL = '-',
  VERTICAL_BOTTTOM = '.', // Connects a commit to a commit below it
  VERTICAL_TOP = 'ˈ', // Connects a commit to a commit on top of it
  VERTICAL = '|',
  BOTTOM_RIGHT = '|▔',
  BOTTOM_LEFT = '▔|',
  TOP_LEFT = '_|',
  TOP_RIGHT = '|_',
}

export type CellContent = LogMatrixSymbol | DisplayRef;
export type CellContents = (LogMatrixSymbol | DisplayRef)[];
export type Row = CellContents[];
export type LogMatrix = Row[];
// logMatrix = [
//   [[], [], [Commit, LogMatrixSymbol.VERTICAL,...], [], ...], // row of cells
//   [], ...
// ]
