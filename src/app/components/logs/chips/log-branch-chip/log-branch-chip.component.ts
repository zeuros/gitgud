import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import type {Branch} from '../../../../lib/github-desktop/model/branch';
import {normalizedBranchName} from '../../../../utils/branch-utils';
import {CurrentRepoStore} from '../../../../stores/current-repo.store';
import {otherWorktreeTooltip} from '../../../../utils/worktree-utils';

@Component({
  selector: 'gitgud-log-branch-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './log-branch-chip.component.html',
  styleUrl: './log-branch-chip.component.scss',
  standalone: true,
})
export class LogBranchChip {

  localBranch = input<Branch>();
  remoteBranch = input<Branch>();

  private currentRepo = inject(CurrentRepoStore);
  protected otherWorktreeTooltip = computed(() => {
    const path = this.currentRepo.otherWorktreeOf(this.localBranch()?.name);
    return path && otherWorktreeTooltip(path);
  });

  protected normalizedBranchName = normalizedBranchName;
}
