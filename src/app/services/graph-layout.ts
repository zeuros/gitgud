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

import {type DisplayRef} from '../lib/github-desktop/model/display-ref';
import {Edge} from '../models/edge';
import {edgeType} from '../utils/commit-utils';

export interface GraphLayout {
  edges: Edge[];
  columnCount: number;
}

/**
 * Assigns a lane (column) to every commit of a log sorted children first (git log --date-order), and the lane every
 * parent → child edge is drawn in.
 */
export const layoutGraph = (log: DisplayRef[], mainTip?: DisplayRef): GraphLayout => {
  const rows = new Map(log.map((commit, row) => [commit.sha, row]));
  const inLog = (sha: string) => rows.has(sha);

  // Lanes, top to bottom: each lane waits for one commit (the parent of the commit drawn above in it)
  const lanes: (string | undefined)[] = [];
  const freedOnRow: number[] = [];

  // Lane 0 is kept, from the top, for the first-parent chain of mainTip (HEAD / work in progress), which is always
  // drawn straight on the left even when other branches have newer commits
  if (mainTip && inLog(mainTip.sha)) lanes[0] = mainTip.sha;
  let mainLaneUntouched = lanes[0] != undefined;

  const firstParentChainLeadsTo = (commit: DisplayRef, sha: string) => {
    let current: DisplayRef | undefined = commit;
    while (current && current.sha != sha) current = log[rows.get(current.parentSHAs[0])!];
    return !!current;
  };

  const freeLane = (lane: number, row: number) => {
    lanes[lane] = undefined;
    freedOnRow[lane] = row;
  };

  // A lane freed on a row isn't reused on that same row, so two edges never look connected through it
  const takeFreeLane = (row: number, sha: string) => {
    let lane = lanes.findIndex((awaited, i) => awaited == undefined && freedOnRow[i] < row);
    if (lane == -1) lane = lanes.length;
    lanes[lane] = sha;
    return lane;
  };

  // Lane of every parent → child edge, keyed `${childSha} ${parentSha}`
  const edgeLanes = new Map<string, number>();

  log.forEach((commit, row) => {
    const lanesWaitingForCommit = lanes.flatMap((awaited, lane) => awaited == commit.sha ? [lane] : []);
    // The topmost branch built on mainTip (its first-parent chain leads to it) extends the main line upwards instead of being pushed to another lane
    const extendsMain = !lanesWaitingForCommit.length && mainLaneUntouched && firstParentChainLeadsTo(commit, mainTip!.sha);
    // A commit takes the leftmost lane waiting for it, so the branch already on the left keeps going straight.
    // A commit nobody waits for (branch tip) takes the leftmost free lane
    const lane = extendsMain ? 0 : lanesWaitingForCommit[0] ?? takeFreeLane(row, commit.sha);
    if (lane == 0) mainLaneUntouched = false;
    // The other lanes waiting for it end here (branching point)
    lanesWaitingForCommit.slice(1).forEach(lane => freeLane(lane, row));
    commit.lane = lane;

    // The lane then waits for the commit's first parent, so a first-parent chain stays in one lane
    const [firstParent, ...otherParents] = commit.parentSHAs.filter(inLog);
    if (firstParent && firstParent == commit.parentSHAs[0]) {
      lanes[lane] = firstParent;
      edgeLanes.set(`${commit.sha} ${firstParent}`, lane);
    } else {
      freeLane(lane, row);
      if (firstParent) otherParents.unshift(firstParent); // First parent is out of the log: every parent is a merged one
    }

    // Other parents (merges) wait in the lane already waiting for them, or in a new one
    otherParents.forEach(parent => {
      const waitingLane = lanes.indexOf(parent);
      edgeLanes.set(`${commit.sha} ${parent}`, waitingLane != -1 ? waitingLane : takeFreeLane(row, parent));
    });
  });

  const edges = log.flatMap(child => child.parentSHAs.filter(inLog).map(parentSha => {
    const parent = log[rows.get(parentSha)!];
    return new Edge(child.row!, child.lane!, parent.row!, parent.lane!, edgeType(child), edgeLanes.get(`${child.sha} ${parentSha}`)!);
  }));

  return {edges, columnCount: Math.max(lanes.length, ...log.map(c => c.lane! + 1), 1)};
};
