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
import {Branch} from '../lib/github-desktop/model/branch';
import {groupBy, isEqual, mapValues, values} from 'lodash-es';
import {keyComparison, logsComparison, shallowArrayEqual} from '../utils/utils';
import {normalizedBranchName} from '../utils/branch-utils';
import {GitTag} from '../models/git-tag';

/**
 * Exposes reactive state for the currently selected repository.
 * Delegates mutations to GitRepositoryStore.
 */
@Injectable({providedIn: 'root'})
export class CurrentRepoStore {

  private readonly reposStore = inject(GitRepositoryStore);

  readonly logs = computed(() => this.reposStore.selectedRepository()?.logs ?? [], {equal: logsComparison});
  readonly stashes = computed(() => this.reposStore.selectedRepository()?.stashes ?? [], {equal: logsComparison});
  readonly tags = computed(() => this.reposStore.selectedRepository()?.tags ?? [], {equal: isEqual});
  readonly tagsByCommitSha = computed<Record<string, GitTag[] | undefined>>(() => groupBy(this.tags(), t => t.sha), {equal: keyComparison});
  readonly branches = computed(() => this.reposStore.selectedRepository()?.branches ?? [], {equal: isEqual});
  readonly branchesByTip = computed(() => groupBy(this.branches(), b => b.tip.sha), {equal: keyComparison});
  // Group branches by commit SHA, then merge local/remote branches by normalized name
  readonly mergedBranchesByTip = computed<Record<string, Branch[][] | undefined>>(() =>
    mapValues(this.branchesByTip(), branchesAtSha => values(groupBy(branchesAtSha, normalizedBranchName))));


  readonly startCommit = computed(() => this.reposStore.selectedRepository()?.startCommit ?? 0);
  readonly workDirStatus = computed(() => this.reposStore.selectedRepository()?.workDirStatus, {equal: isEqual});
  readonly panelSizes = computed(() => this.reposStore.selectedRepository()?.panelSizes);
  readonly editorConfig = computed(() => this.reposStore.selectedRepository()?.editorConfig);
  readonly detachedHeadSha = computed(() => this.reposStore.selectedRepository()?.detachedHeadSha);
  readonly name = computed(() => this.reposStore.selectedRepository()?.name);

  readonly selectedCommitsShas = computed(() => this.reposStore.selectedRepository()?.selectedCommitsShas, {equal: shallowArrayEqual});
  readonly selectedCommits = computed(() => {const scs = this.selectedCommitsShas();return this.logs().filter(l => scs?.includes(l.sha));});
  readonly selectedCommitSha = computed(() => {
    const sc = this.reposStore.selectedRepository()?.selectedCommitsShas;
    return sc?.length === 1 ? sc[0] : undefined;
  });
  readonly selectedCommit = computed(() => {
    const sha = this.selectedCommitSha();
    return this.logs().find(c => c.sha === sha);
  });
  readonly selectedCommitIndex = computed(() => {
    const sha = this.selectedCommitSha();
    return this.logs().findIndex(c => c.sha === sha);
  });
  readonly selectedStash = computed(() => {
    const sha = this.selectedCommitSha();
    return this.stashes().find(s => s.parentSHAs?.[1] && s.parentSHAs?.[1] === sha);
  });
  readonly selectedTag = computed(() => {
    const sha = this.selectedCommitSha();
    return this.tags().find(s => s.sha == sha);
  });
  readonly headBranch = computed(() => this.branches().find(b => b.isHeadPointed));

  readonly headSha = () => this.headBranch()?.tip?.sha ?? this.detachedHeadSha()

  readonly update = (updates: Partial<GitRepository>) => this.reposStore.updateSelectedRepository(updates);
}
