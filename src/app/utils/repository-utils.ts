import {GitRepository} from '../models/git-repository';
import {lastFolderName} from './utils';
import {Commit} from '../lib/github-desktop/model/commit';

// TODO: gather all repo infos to create the GitRepository object
export const createRepository = (directory: string) =>
  new GitRepository(directory, lastFolderName(directory));


/**
 * Stashes Have two parents: [sha1, sha2]:
 * sha1: The commit the stash was created on
 * sha2: A "stash commit" which has sha1 as parent
 * We want to build the commit log keeping the "stash commit" commits
 */
export const filterOutStashes = (stashes: Commit[]) => {

  const stashesSHAs = new Set(stashes.map(s => s.sha));

  // Filter out stashes from the log, their parent is used instead
  return (commit: Commit, i: number) => !stashesSHAs.has(commit.sha);
};