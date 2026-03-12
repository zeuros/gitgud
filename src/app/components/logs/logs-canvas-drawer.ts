import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../../models/edge';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {RefType} from '../../enums/ref-type.enum';
import {commitColor, hasName, initials, isCommit, isIndex, isMergeCommit} from '../../utils/commit-utils';
import {Coordinates} from '../../models/coordinates';
import {COMMITS_SHOWN_ON_CANVAS, NODE_DIAMETER, NODE_RADIUS, ROW_HEIGHT} from './log-canvas-drawer-settings';


/**
 * Draw each commit / stash and their connections
 */
export const drawLog = (
  canvas: CanvasRenderingContext2D,
  displayLog: DisplayRef[],
  edges: IntervalTree<Edge>,
  startCommit: number,
  stashImg: HTMLImageElement,
) => {
  canvas.clearRect(0, 0, canvas.canvas.width, canvas.canvas.height);

  // Draw edges (connections between commits)
  edges.search(startCommit, startCommit + COMMITS_SHOWN_ON_CANVAS)
    .forEach(edge => drawEdge(canvas, edge, startCommit));

  // Draw commit nodes
  displayLog.slice(startCommit, startCommit + COMMITS_SHOWN_ON_CANVAS)
    .forEach((ref, indexForThisSlice) =>
      drawNode(canvas, new Coordinates(indexForThisSlice, ref.indent!), ref, stashImg),
    );
};

const drawEdge = (canvas: CanvasRenderingContext2D, edge: Edge, startCommit: number) => {
  const topScroll = startCommit * ROW_HEIGHT;
  const [xParent, yParent] = [xPosition(edge.parentCol), yPosition(edge.parentRow) - topScroll];
  const [xChild, yChild] = [xPosition(edge.childCol), yPosition(edge.childRow) - topScroll];

  const isMergeCommit = edge.type == RefType.MERGE_COMMIT;
  prepareStyleForDrawingCommit(canvas, isMergeCommit ? edge.parentCol : edge.childCol);

  const isChildrenRight = xParent < xChild;

  if (isMergeCommit) {
    canvas.moveTo(xParent, yParent - NODE_RADIUS);
    if (xParent == xChild) {
      canvas.lineTo(xParent, yChild + NODE_RADIUS);
    } else {
      canvas.lineTo(xParent, yChild + NODE_RADIUS);
      if (isChildrenRight) {
        canvas.quadraticCurveTo(xParent, yChild, xParent + NODE_RADIUS, yChild);
        canvas.lineTo(xChild - NODE_RADIUS, yChild);
      } else { // Children left
        canvas.quadraticCurveTo(xParent, yChild, xParent - NODE_RADIUS, yChild);
        canvas.lineTo(xChild + NODE_RADIUS, yChild);
      }
    }
  } else {
    if (xParent == xChild) {
      canvas.moveTo(xParent, yParent - NODE_RADIUS);
      canvas.lineTo(xParent, yChild + NODE_RADIUS);
    } else {
      if (isChildrenRight) {
        canvas.moveTo(xParent + NODE_RADIUS, yParent);
        canvas.lineTo(xChild - NODE_RADIUS, yParent);
        canvas.quadraticCurveTo(xChild, yParent, xChild, yParent - NODE_RADIUS);
        canvas.lineTo(xChild, yChild + NODE_RADIUS);
      } else {
        canvas.moveTo(xParent - NODE_RADIUS, yParent);
        canvas.lineTo(xChild + NODE_RADIUS, yParent);
        canvas.quadraticCurveTo(xChild, yParent, xChild, yParent - NODE_RADIUS);
        canvas.lineTo(xChild, yChild + NODE_RADIUS);
      }
    }
  }

  canvas.setLineDash(edge.type == RefType.INDEX ? [3] : []);
  canvas.stroke();
};

const drawNode = (
  canvas: CanvasRenderingContext2D,
  commitCoordinates: Coordinates,
  ref: DisplayRef,
  stashImg: HTMLImageElement,
) => {
  const [x, y] = [xPosition(commitCoordinates.col), yPosition(commitCoordinates.row)];

  prepareStyleForDrawingCommit(canvas, ref.indent!);

  if (isMergeCommit(ref)) {
    canvas.arc(x, y, NODE_RADIUS / 2.3, 0, 2 * Math.PI, true);
    canvas.fill();

    canvas.beginPath();
    canvas.arc(x, y, NODE_RADIUS / 1.4, 0, 2 * Math.PI, true);
    canvas.stroke();
  } else if (isCommit(ref)) {
    canvas.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI, true);
    canvas.fill();

    prepareForCommitTextDraw(canvas);
    canvas.fillText(initials(hasName(ref.author) ? ref.author : ref.committer), x, y + 1);
    canvas.fill();
  } else if (isIndex(ref)) {
    canvas.arc(x, y, NODE_RADIUS - 1, 0, 2 * Math.PI, true);
    canvas.fillStyle = '#1c1e23';
    canvas.fill();
    canvas.setLineDash([3]);
    canvas.stroke();
  } else { // Stash
    // We made sure to load stashImg before drawing the log
    canvas.drawImage(stashImg, x - NODE_RADIUS, y - NODE_RADIUS, NODE_DIAMETER, NODE_DIAMETER);
  }
};

const prepareForCommitTextDraw = (canvas: CanvasRenderingContext2D) => {
  canvas.beginPath();
  canvas.fillStyle = 'white';
  canvas.font = 'normal 900 13.5px Roboto, sans-serif'; // Nunito not working here :/
  canvas.textAlign = 'center';
  canvas.textBaseline = 'middle';
  canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
  canvas.shadowBlur = 3;
};

const prepareStyleForDrawingCommit = (canvas: CanvasRenderingContext2D, indent: number) => {
  canvas.beginPath();
  canvas.lineWidth = 2;
  canvas.setLineDash([]);
  canvas.fillStyle = canvas.strokeStyle = 'rgba(206, 147, 216, 0.9)';
  canvas.filter = commitColor(indent);
  canvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
  canvas.shadowBlur = 10;
};

export const xPosition = (col?: number): number => {
  return NODE_RADIUS + (col ?? 0) * NODE_DIAMETER;
};

export const yPosition = (row?: number): number => {
  return NODE_RADIUS + (row ?? 0) * ROW_HEIGHT;
};
