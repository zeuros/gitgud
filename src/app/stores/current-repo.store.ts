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

import {computed, inject, Injectable} from '@angular/core';
import {GitRepositoryStore} from './git-repos.store';
import {GitRepository} from '../models/git-repository';
import {groupBy, isEqual, mapValues} from 'lodash-es';
import {logsComparison, shallowArrayEqual} from '../utils/utils';
import {type LocalAndDistant, toLocalAndDistantPairs} from '../utils/branch-utils';
import {type LocalAndDistantTag, toLocalAndDistantTagPairs, toLocalAndDistantTagWithName} from '../utils/tag-utils';

/**
 * Exposes reactive state for the currently selected repository.
 * Delegates mutations to GitRepositoryStore.
 */
@Injectable({providedIn: 'root'})
export class CurrentRepoStore {

  private reposStore = inject(GitRepositoryStore);

  cwd = computed(() => this.reposStore.selectedRepository()?.id);
  logs = computed(() => this.reposStore.selectedRepository()?.logs ?? [], {equal: logsComparison});
  stashes = computed(() => this.reposStore.selectedRepository()?.stashes ?? [], {equal: logsComparison});
  tags = computed(() => this.reposStore.selectedRepository()?.tags ?? [], {equal: isEqual});
  remoteTags = computed(() => this.reposStore.selectedRepository()?.remoteTags ?? [], {equal: isEqual});
  allTags = computed(() => toLocalAndDistantTagPairs(this.tags(), this.remoteTags()), {equal: isEqual});
  allTagsWithName = computed(() => this.allTags().map(toLocalAndDistantTagWithName), {equal: isEqual});
  allTagsBySha = computed<Record<string, LocalAndDistantTag[] | undefined>>(() => groupBy(this.allTags(), ([local, distant]) => (local ?? distant)!.sha), {equal: isEqual});
  branches = computed(() => this.reposStore.selectedRepository()?.branches ?? [], {equal: isEqual});
  branchesByTip = computed(() => groupBy(this.branches(), b => b.tip.sha));
  // Group branches by commit SHA, then pair local/remote branches by normalized name into [local, distant] tuples
  mergedBranchesByTip = computed<Record<string, LocalAndDistant[] | undefined>>(() => mapValues(this.branchesByTip(), toLocalAndDistantPairs));

  startCommit = computed(() => this.reposStore.selectedRepository()?.startCommit ?? 0);
  workDirStatus = computed(() => this.reposStore.selectedRepository()?.workDirStatus, {equal: isEqual});
  panelSizes = computed(() => this.reposStore.selectedRepository()?.panelSizes);
  editorConfig = computed(() => this.reposStore.selectedRepository()?.editorConfig);
  detachedHeadSha = computed(() => this.reposStore.selectedRepository()?.detachedHeadSha);
  name = computed(() => this.reposStore.selectedRepository()?.name);

  selectedCommitsShas = computed(() => this.reposStore.selectedRepository()?.selectedCommitsShas, {equal: shallowArrayEqual});
  selectedCommits = computed(() => {const scs = this.selectedCommitsShas();return this.logs().filter(l => scs?.includes(l.sha));});
  selectedCommitSha = computed(() => {
    const sc = this.reposStore.selectedRepository()?.selectedCommitsShas;
    return sc?.length === 1 ? sc[0] : undefined;
  });
  selectedCommit = computed(() => {
    const sha = this.selectedCommitSha();
    return this.logs().find(c => c.sha === sha);
  });
  selectedCommitIndex = computed(() => {
    const sha = this.selectedCommitSha();
    return this.logs().findIndex(c => c.sha === sha);
  });
  selectedStash = computed(() => {
    const sha = this.selectedCommitSha();
    return this.stashes().find(s => s.parentSHAs?.[1] && s.parentSHAs?.[1] === sha);
  });
  selectedTag = computed(() => {
    const sha = this.selectedCommitSha();
    return this.tags().find(s => s.sha == sha);
  });
  headBranch = computed(() => this.branches().find(b => b.isHeadPointed));

  headSha = () => this.headBranch()?.tip?.sha ?? this.detachedHeadSha()

  update = (updates: Partial<GitRepository>) => this.reposStore.updateSelectedRepository(updates);
}
