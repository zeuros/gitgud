import {computed, inject, Injectable, signal} from '@angular/core';
import {MenuItem} from 'primeng/api';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from '../../services/git-repository.service';
import {PopupService} from '../../services/popup.service';
import {switchMap} from 'rxjs';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';

@Injectable({
  providedIn: 'root',
})
export class LogContextMenuService {

  private readonly gitApiService = inject(GitApiService);
  private readonly gitRepositoryService = inject(GitRepositoryService);
  private readonly popupService = inject(PopupService);
  private readonly gitRepositoryStore = inject(GitRepositoryStore);

  readonly selectedCommit = signal<DisplayRef | undefined>(undefined);
  private readonly sha = computed(() => this.selectedCommit()!.sha);

  readonly contextMenu: MenuItem[] = [
    {
      label: 'Checkout this commit',
      icon: 'fa fa-code-branch',
      command: () => this.checkoutCommit(),
    },
    {separator: true},
    {
      label: 'Create branch here',
      icon: 'fa fa-plus',
      command: () => this.createBranch(),
    },
    {
      label: 'Cherry pick commit',
      icon: 'fa fa-crosshairs',
      command: () => this.cherryPick(),
    },
    {
      label: 'Reset main to this commit',
      icon: 'fa fa-undo',
      items: [{
        label: 'Soft — Undo commits, keep changes stage',
        command: () => this.reset('soft'),
        tooltipOptions: {
          tooltipLabel: 'All commits between this commit and HEAD are uncommitted, their changes are put staged in working directory',
          tooltipPosition: 'right',
        },
      },
        {
          label: 'Mixed — Undo commits, keep changes in files',
          command: () => this.reset('mixed'),
          tooltipOptions: {
            tooltipLabel: 'All commits between this commit and HEAD are uncommitted, their changes are put unstaged in working directory',
            tooltipPosition: 'right',
          },
        },
        {
          label: 'Hard — discard commits changes',
          command: () => this.reset('hard'),
          tooltipOptions: {
            tooltipLabel: 'All commits between this commit and HEAD are discarded',
            tooltipPosition: 'right',
          },
        },
      ],
    },
    {
      label: 'Revert commit',
      icon: 'fa fa-rotate-left',
      command: () => this.revertCommit(),
    },
    {separator: true},
    {
      label: 'Interactive Rebase',
      icon: 'fa fa-list-ol',
      command: () => this.interactiveRebase(),
    },
    {
      label: 'Drop commit',
      icon: 'fa fa-trash',
      command: () => this.dropCommit(),
    },
    {
      label: 'Move commit up',
      icon: 'fa fa-arrow-up',
      command: () => this.moveCommit('up'),
    },
    {
      label: 'Move commit down',
      icon: 'fa fa-arrow-down',
      command: () => this.moveCommit('down'),
    },
    {separator: true},
    {
      label: 'Copy commit sha',
      icon: 'fa fa-copy',
      command: () => this.copyCommitSha(),
    },
    {separator: true},
    {
      label: 'Create tag here',
      icon: 'fa fa-tag',
      command: () => this.createTag(),
    },
  ];

  private run = (args: (string | undefined)[], successMsg?: string) =>
    this.gitApiService.git(args)
      .pipe(switchMap(() => this.gitRepositoryService.updateLogsAndBranches()))
      .subscribe(() => successMsg && this.popupService.success(successMsg));

  protected checkoutCommit = () =>
    this.run(['checkout', this.sha()], `Checked out ${this.sha().slice(0, 7)}`);

  protected createBranch = () => {
    const name = prompt('Branch name:');
    if (!name) return;
    this.run(['checkout', '-b', name, this.sha()], `Branch ${name} created`);
  };

  protected cherryPick = () =>
    this.run(['cherry-pick', this.sha()], `Cherry picked ${this.sha().slice(0, 7)}`);

  protected reset = (mode: 'soft' | 'mixed' | 'hard') =>
    this.run(['reset', `--${mode}`, this.sha()], `Reset ${mode} to ${this.sha().slice(0, 7)}`);

  protected revertCommit = () => {
    this.run(['revert', '--no-edit', this.sha()], `Reverted ${this.sha().slice(0, 7)}`);
  };

  protected interactiveRebase = () => {
    const sha = this.selectedCommit()?.sha;
    if (!sha) return;
    // window.electron.openTerminal(this.gitApiService.cwd()!, `git rebase -i ${sha}~1`);
  };

  protected dropCommit = () =>
    this.run(['rebase', '--onto', `${this.sha()}^`, this.sha(), 'HEAD'], `Dropped ${this.sha().slice(0, 7)}`);

  protected moveCommit = (direction: 'up' | 'down') => {
    const logs = this.gitRepositoryStore.logs();
    const index = logs.findIndex(c => c.sha === this.sha());
    const targetSha = direction === 'up' ? logs[index - 1]?.sha : logs[index + 1]?.sha;
    if (!targetSha) return;

    // Reorder via rebase --onto
    this.gitApiService.git(['rebase', '--onto', `${targetSha}`, this.sha(), 'HEAD'])
      .pipe(switchMap(() => this.gitRepositoryService.updateLogsAndBranches()))
      .subscribe(() => this.popupService.success(`Moved commit ${direction}`));
  };

  protected copyCommitSha = () => {
    navigator.clipboard.writeText(this.sha());
    this.popupService.success('SHA copied to clipboard');
  };

  protected createTag = () => {
    const name = prompt('Tag name:');
    if (!name) return;
    const message = prompt('Tag message:');
    if (!message?.trim()?.length) return this.run(['tag', name, this.sha()], `Tag ${name} created`);
    return this.run(['tag', '-a', name, '-m', message, this.sha()], `Annotated tag ${name} created`);
  };

}
