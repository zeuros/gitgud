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

import {GitRepository} from '../models/git-repository';
import {lastFolderName} from './utils';
import {Commit} from '../lib/github-desktop/model/commit';

// TODO: gather all repo infos to create the GitRepository object
export const createRepository = (directory: string) =>
  new GitRepository(directory, lastFolderName(directory));

// A few fields of the repository are synced with localStorage to keep the interface identical between gitgud restarts / refreshes
export type StoredRepository = Pick<GitRepository, 'id' | 'name' | 'selected' | 'selectedCommitsShas' | 'startCommit' | 'editorConfig'>;

export const toStoredRepository = ({id, name, selected, selectedCommitsShas, startCommit, editorConfig}: GitRepository): StoredRepository =>
  ({id, name, selected, selectedCommitsShas, startCommit, editorConfig});

// Also drops the git data that older versions stored
export const fromStoredRepository = (stored: StoredRepository): GitRepository =>
  ({...new GitRepository(stored.id, stored.name), ...toStoredRepository(stored as GitRepository)});


/**
 * Stashes Have two parents: [sha1, sha2]:
 * sha1: The commit the stash was created on
 * sha2: A "stash commit" which has sha1 as parent
 * We want to build the commit log keeping the "stash commit" commits
 */
export const filterOutStashes = (stashes: Commit[]) => {

  const stashesSHAs = new Set(stashes.map(s => s.sha));

  // Filter out stashes from the log, their parent is used instead
  return (commit: Commit) => !stashesSHAs.has(commit.sha);
};