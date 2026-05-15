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

import {Commit} from '../lib/github-desktop/model/commit';
import {Branch} from '../lib/github-desktop/model/branch';
import {type WorkDirStatus} from '../lib/github-desktop/model/workdir';
import {type GitTag} from './git-tag';

export type ViewType = 'hunk' | 'inline' | 'split';

export class GitRepository {
  constructor(
    public id: string, // = repository directory
    public name: string,
    public panelSizes = {mainPanels: [20, 50, 30], leftPanel: [25, 25, 25, 25], makeCommitPanel: [40, 40, 20]}, // panels sizes
    public selected = true, // This repository is selected
    public logs: Commit[] = [],
    public stashes: Commit[] = [],
    public tags: GitTag[] = [],
    public remoteTags: GitTag[] = [],
    public branches: Branch[] = [],
    public detachedHeadSha?: string,
    public selectedCommitsShas: string[] = ['index'],
    public startCommit = 0,
    public remotes: { remote: string; url: string }[] = [],
    // Editor config
    public editorConfig: { viewType: ViewType } = {viewType: 'split'},
    public workDirStatus: WorkDirStatus = {unstaged: [], staged: [], conflicted: []},
  ) {
  }
}