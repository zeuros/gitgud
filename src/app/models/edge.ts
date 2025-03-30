import {RefType} from "../enums/ref-type.enum";

export class Edge {

  low: number;
  high: number;

  constructor(
    public childRow: number,
    public childCol: number,
    public parentRow: number,
    public parentCol: number,
    public summary: string,
    public type: RefType,
  ) {
    this.low = childRow;
    this.high = parentRow;
  }

}