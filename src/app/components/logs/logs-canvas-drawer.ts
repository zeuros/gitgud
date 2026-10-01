/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {groupBy} from 'lodash-es';
import {IntervalTree} from 'node-interval-tree';
import {Edge} from '../../models/edge';
import {type DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {RefType} from '../../enums/ref-type.enum';
import {hasName, initials, isCommit, isIndex, isMergeCommit} from '../../utils/commit-utils';
import {Coordinates} from '../../models/coordinates';
import {DRAWING_PAD_LEFT, NODE_DIAMETER, NODE_RADIUS, ROW_HEIGHT} from './log-canvas-drawer-settings';
import {type CanvasColors} from '../../models/theme.model';

/**
 * Draw each commit / stash and their connections.
 * Uses scrollOffset to position canvas continuously without jumps.
 * Edges are batched by color to minimize canvas state changes.
 * canvas.filter is never used — colors come from CanvasColors.graphColors (WebKit-compatible).
 */
export const drawLog = (
  canvas: CanvasRenderingContext2D,
  displayLog: DisplayRef[],
  edges: IntervalTree<Edge>,
  startCommit: number,
  endCommit: number,
  scrollOffset: number,
  stashImg: HTMLImageElement,
  avatarImages: Map<string, HTMLImageElement>,
  colors: CanvasColors,
  headerHeight: number,
  devicePixelRatio: number) => {

  canvas.resetTransform();
  canvas.clearRect(0, 0, canvas.canvas.width, canvas.canvas.height);
  // Scale by devicePixelRatio so all logical coordinates (xPosition/yPosition) render at native resolution
  canvas.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, DRAWING_PAD_LEFT, (ROW_HEIGHT - scrollOffset) * devicePixelRatio);

  drawEdges(canvas, edges.search(startCommit, endCommit), colors, startCommit);

  // Draw commit nodes
  displayLog
    .slice(startCommit, endCommit)
    .forEach((ref, indexForThisSlice) => drawNode(canvas, new Coordinates(indexForThisSlice, ref.lane!), ref, stashImg, avatarImages, colors));

  // Erase the area behind the sticky table header so graph lines don't show through it
  canvas.resetTransform();
  canvas.clearRect(0, 0, canvas.canvas.width, headerHeight * devicePixelRatio);
};

// Batch edges by color key — reduces stroke() calls from O(edges) to O(distinct colors)
function drawEdges(canvas: CanvasRenderingContext2D, edgesToDisplay: Edge[], colors: CanvasColors, startCommit: number) {
  canvas.lineWidth = 2;
  canvas.shadowBlur = 0; // No shadow on edges

  // Colored by lane: a vertical line keeps the color of its column
  const solidEdgesByColor = groupBy(edgesToDisplay.filter(e => e.type !== RefType.INDEX), e => e.laneCol);
  const dashedEdgesByColor = groupBy(edgesToDisplay.filter(e => e.type === RefType.INDEX), e => e.laneCol);

  Object.entries(solidEdgesByColor).forEach(([key, group]) => strokeEdges(canvas, group, +key, colors, startCommit, false));
  Object.entries(dashedEdgesByColor).forEach(([key, group]) => strokeEdges(canvas, group, +key, colors, startCommit, true));
}

const strokeEdges = (canvas: CanvasRenderingContext2D, group: Edge[], colorKey: number, colors: CanvasColors, startCommit: number, dashed: boolean) => {
  canvas.beginPath();
  canvas.strokeStyle = colors.graphColors[colorKey % colors.graphColors.length];
  canvas.setLineDash(dashed ? [3] : []);
  group.forEach(edge => addEdgePath(canvas, edge, startCommit));
  canvas.stroke();
};

/**
 * Add path commands for one edge to the current canvas path (no style, no stroke).
 * Child → parent: sideways from the child to the edge's lane (merged parent), down the lane, then sideways into the parent
 * (lane ending on a branching point). Corners are rounded.
 */
const addEdgePath = (canvas: CanvasRenderingContext2D, edge: Edge, startCommit: number) => {
  const topScroll = startCommit * ROW_HEIGHT;
  const [xParent, yParent] = [xPosition(edge.parentCol), yPosition(edge.parentRow) - topScroll];
  const [xChild, yChild] = [xPosition(edge.childCol), yPosition(edge.childRow) - topScroll];
  const xLane = xPosition(edge.laneCol);

  if (xLane == xChild) {
    canvas.moveTo(xLane, yChild + NODE_RADIUS);
  } else {
    const towardsLane = Math.sign(xLane - xChild);
    canvas.moveTo(xChild + towardsLane * NODE_RADIUS, yChild);
    canvas.lineTo(xLane - towardsLane * NODE_RADIUS, yChild);
    canvas.quadraticCurveTo(xLane, yChild, xLane, yChild + NODE_RADIUS);
  }

  canvas.lineTo(xLane, yParent - NODE_RADIUS);

  if (xLane != xParent) {
    const towardsParent = Math.sign(xParent - xLane);
    canvas.quadraticCurveTo(xLane, yParent, xLane + towardsParent * NODE_RADIUS, yParent);
    canvas.lineTo(xParent - towardsParent * NODE_RADIUS, yParent);
  }
};

const drawNode = (
  canvas: CanvasRenderingContext2D,
  commitCoordinates: Coordinates,
  ref: DisplayRef,
  stashImg: HTMLImageElement,
  avatarImages: Map<string, HTMLImageElement>,
  colors: CanvasColors,
) => {
  const [x, y] = [xPosition(commitCoordinates.col), yPosition(commitCoordinates.row)];

  prepareNodeStyle(canvas, ref.lane!, colors);

  if (isMergeCommit(ref)) {
    canvas.arc(x, y, NODE_RADIUS / 2.3, 0, 2 * Math.PI, true);
    canvas.fill();

    canvas.beginPath();
    canvas.arc(x, y, NODE_RADIUS / 1.4, 0, 2 * Math.PI, true);
    canvas.stroke();
  } else if (isCommit(ref)) {
    const identity = hasName(ref.author) ? ref.author : ref.committer;
    const avatarImg = avatarImages.get(identity.email);

    if (avatarImg) {
      canvas.fillStyle = colors.avatarRing;
      canvas.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.fill();

      canvas.save();
      canvas.shadowBlur = 0;
      canvas.beginPath();
      canvas.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.clip();
      canvas.drawImage(avatarImg, x - NODE_RADIUS * 0.91, y - NODE_RADIUS * 0.91, NODE_DIAMETER * 0.91, NODE_DIAMETER * 0.91);
      canvas.restore();

      canvas.beginPath();
      canvas.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.stroke();
    } else {
      canvas.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI, true);
      canvas.fill();
      prepareForCommitTextDraw(canvas, colors);
      canvas.fillText(initials(identity), x, y + 1);
      canvas.fill();
    }
  } else if (isIndex(ref)) {
    canvas.arc(x, y, NODE_RADIUS - 1, 0, 2 * Math.PI, true);
    canvas.fillStyle = colors.background;
    canvas.fill();
    canvas.setLineDash([3]);
    canvas.stroke();
  } else { // Stash
    canvas.save();
    canvas.drawImage(stashImg, x - NODE_RADIUS, y - NODE_RADIUS, NODE_DIAMETER, NODE_DIAMETER);
    canvas.globalCompositeOperation = 'source-atop';
    canvas.shadowBlur = 0;
    canvas.fillStyle = colors.graphColors[ref.lane! % colors.graphColors.length];
    canvas.fillRect(x - NODE_RADIUS, y - NODE_RADIUS, NODE_DIAMETER, NODE_DIAMETER);
    canvas.restore();
  }
};

const prepareForCommitTextDraw = (canvas: CanvasRenderingContext2D, colors: CanvasColors) => {
  canvas.beginPath();
  canvas.fillStyle = 'white';
  canvas.font = `normal 900 13.5px 'Nunito Variable', Roboto, Cantarell, sans-serif`; // Nunito not working here :/
  canvas.textAlign = 'center';
  canvas.textBaseline = 'middle';
  canvas.shadowColor = colors.nodeShadowColor;
  canvas.shadowBlur = 3;
};

const prepareNodeStyle = (canvas: CanvasRenderingContext2D, lane: number, colors: CanvasColors) => {
  canvas.beginPath();
  canvas.lineWidth = 2;
  canvas.setLineDash([]);
  canvas.fillStyle = canvas.strokeStyle = colors.graphColors[lane % colors.graphColors.length];
  canvas.shadowColor = colors.nodeShadowColor;
  canvas.shadowBlur = colors.nodeShadowBlur;
};

export const xPosition = (col?: number): number => {
  return NODE_RADIUS + (col ?? 0) * NODE_DIAMETER;
};

export const yPosition = (row?: number): number => {
  return NODE_RADIUS + (row ?? 0) * ROW_HEIGHT;
};
