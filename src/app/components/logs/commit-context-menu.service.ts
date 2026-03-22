import {computed, inject, Injectable, signal} from '@angular/core';
import {MenuItem} from 'primeng/api';
import {PopupService} from '../../services/popup.service';
import {filter, first, map, switchMap} from 'rxjs';
import {GitRepositoryStore} from '../../stores/git-repos.store';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {short} from '../../utils/commit-utils';
import {PromptService} from '../../services/prompt.service';
import {notUndefined} from '../../utils/utils';
import {GitWorkflowService} from '../../services/git-workflow.service';

@Injectable({
  providedIn: 'root',
})
export class CommitContextMenuService {

  private popup = inject(PopupService);
  private gitRepositoryStore = inject(GitRepositoryStore);
  protected prompt = inject(PromptService);
  protected gitWorkflow = inject(GitWorkflowService);

  selectedCommit = signal<DisplayRef | undefined>(undefined);
  private sha = computed(() => this.selectedCommit()!.sha);
  private parentSha = computed(() => this.selectedCommit()!.parentSHAs[0]);
  private childSha = computed(() => {
    const selectedSha = this.sha();
    return this.gitRepositoryStore.logs().find(c => c.parentSHAs[0] === selectedSha)?.sha;
  });

  commitContextMenu = computed<MenuItem[]>(() => [
    {label: 'Checkout this commit', icon: 'fa fa-code-branch', command: this.checkoutCommit},
    {separator: true},
    {label: 'Create branch here', icon: 'fa fa-plus', command: this.createBranch},
    {label: 'Cherry pick commit', icon: 'fa fa-hand-grab-o', command: this.cherryPick},
    {
      label: `Reset ${this.gitRepositoryStore.headBranch()?.name} to this commit`,
      icon: 'fa fa-history',
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
    {label: 'Revert commit', icon: 'fa fa-undo', command: this.revertCommit},
    {separator: true},
    // {label: 'Interactive Rebase', icon: 'fa fa-list-ol', command: this.interactiveRebase},
    {label: 'Drop commit', icon: 'fa fa-trash', command: this.dropCommit},
    {label: 'Move commit up', icon: 'fa fa-arrow-up', command: () => this.moveCommit('up')},
    {label: 'Move commit down', icon: 'fa fa-arrow-down', command: () => this.moveCommit('down')},
    {separator: true},
    {label: 'Copy commit sha', icon: 'fa fa-copy', command: this.copyCommitSha},
    {separator: true},
    {label: 'Create tag here', icon: 'fa fa-tag', command: this.createTag},
  ]);

  protected checkoutCommit = () =>
    this.gitWorkflow.doRunAndRefresh(['checkout', this.sha()], `Checked out ${short(this.sha())}`, true, false);

  protected createBranch = () =>
    this.prompt.open('Branch name:')
      .pipe(first(notUndefined))
      .subscribe(name => this.gitWorkflow.doRunAndRefresh(['checkout', '-b', name, this.sha()], `Branch ${name} created`));

  protected cherryPick = () =>
    this.gitWorkflow.doRunAndRefresh(['cherry-pick', this.sha()], `Cherry picked ${short(this.sha())}`, true, true);

  protected reset = (mode: 'soft' | 'mixed' | 'hard') =>
    this.gitWorkflow.doRunAndRefresh(['reset', `--${mode}`, this.sha()], `Reset ${mode} to ${short(this.sha())}`, mode == 'hard', false);
    // this.gitWorkflow.doRunAndRefresh(['status'], `Reset ${mode} to ${short(this.sha())}`, mode == 'hard', false);

  protected revertCommit = () => {
    this.gitWorkflow.doRunAndRefresh(['revert', '--no-edit', this.sha()], `Reverted ${short(this.sha())}`, true);
  };

  // TODO: make interface for this (late game)
  // protected interactiveRebase = () => {
  //   this.rebaseService.stashAndRun(this.rebaseService.startInteractiveRebase(this.selectedCommit()!.sha)).subscribe(console.warn);
  // };

  protected dropCommit = () => {
    const isTip = this.gitRepositoryStore.headBranch()?.tip.sha === this.sha();
    const successMsg = `Dropped ${short(this.sha())}`;

    return isTip
      // We reset the last commit => we just do a reset to previous commit — no rebase needed
      ? this.gitWorkflow.doRunAndRefresh(['reset', '--hard', `${this.sha()}~1`], successMsg, true)
      : this.gitWorkflow.rebaseAndRun(this.parentSha(), actions => actions.filter(a => !a.includes(short(this.sha()))))
        .subscribe(() => this.popup.success(successMsg));
  };

  protected moveCommit = (direction: 'up' | 'down') => {
    const toExchange = direction === 'up' ? this.childSha() : this.parentSha();
    if (!toExchange) throw new Error('Cannot move commit - boundary reached');
    const startRebaseFrom = `${direction == 'up' ? this.sha() : this.parentSha()}^`;

    const swapCommits = (actions: string[]) => this.swapActions(actions, this.sha(), toExchange);

    this.gitWorkflow.rebaseAndRun(startRebaseFrom, swapCommits).subscribe(() => this.popup.success(`Moved commit ${direction}`));
  };

  private swapActions(actions: string[], shaActionA: string, shaActionB: string) {
    let lineA = actions.findIndex(a => a.includes(short(shaActionA)));
    let lineB = actions.findIndex(a => a.includes(short(shaActionB)));

    // Swap two commits in actions list (they're in reverse chronological order)
    [actions[lineA], actions[lineB]] = [actions[lineB], actions[lineA]];

    return actions;
  }

  protected copyCommitSha = () => navigator.clipboard.writeText(this.sha()).then(() => this.popup.success('SHA copied to clipboard'));

  protected createTag = () =>
    this.prompt.open('Tag name:').pipe(
      first(notUndefined),
      switchMap(tagName => this.prompt.open('Tag message for annotated tags (leave empty for lightweight tag):', false).pipe(map(message => ({tagName, message: message ?? null})))),
    ).subscribe(({tagName, message}) => message?.trim()?.length
      ? this.gitWorkflow.doRunAndRefresh(['tag', '-a', tagName, '-m', message, this.sha()], `Annotated tag ${tagName} created`)
      : this.gitWorkflow.doRunAndRefresh(['tag', tagName, this.sha()], `Tag ${tagName} created`));

  // TODO: make a quick action close to staged changes
  fixupCommit = () =>
    this.gitWorkflow.rebaseAndRun(
      `${this.sha()}~1`,
      actions => actions.map(a => a.includes(short(this.sha())) ? a.replace(/^pick/, 'fixup') : a),
      true,
    ).subscribe(() => this.popup.success(`Fixup applied to ${short(this.sha())}`));
}
