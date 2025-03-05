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
  UP_RIGHT = '|▔',
  UP_LEFT = '▔|',
  RIGHT_UP = '_|',
  LEFT_UP = '|_',
}

export class CellContent {
  constructor(public value: LogMatrixSymbol | DisplayRef, public color: number) {
  }
}
export type CellContents = CellContent[];
export type Row = CellContents[];
export type LogMatrix = Row[];
// logMatrix = [
//   [[], [], [Commit, LogMatrixSymbol.VERTICAL,...], [], ...], // row of cells
//   [], ...
// ]
