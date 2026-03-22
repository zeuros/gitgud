import {computed, inject, Injectable, signal} from '@angular/core';
import {MenuItem} from 'primeng/api';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {GitRepositoryService} from '../../services/git-repository.service';
import {PopupService} from '../../services/popup.service';
import {switchMap} from 'rxjs';
import {DisplayRef} from '../../lib/github-desktop/model/display-ref';

@Injectable({providedIn: 'root'})
export class StashContextMenuService {

  private readonly gitApi = inject(GitApiService);
  private readonly gitRepository = inject(GitRepositoryService);
  private readonly popup = inject(PopupService);

  readonly selectedCommit = signal<DisplayRef | undefined>(undefined);
  private readonly sha = computed(() => this.selectedCommit()!.sha);

  // Stash index derived from the stash ref name e.g. "stash@{2}"
  private readonly stashRef = computed(() => {
    const ref = this.selectedCommit()?.branchesDetails?.find(b => b.name?.startsWith('stash@'));
    if(ref)debugger
    return ref?.name ?? 'stash@{0}';
  });

  readonly stashContextMenu = computed<MenuItem[]>(() => [
    {label: 'Apply stash', icon: 'fa fa-download', command: this.applyStash},
    {label: 'Pop stash', icon: 'fa fa-level-down', command: this.popStash},
    {separator: true},
    {label: 'Drop stash', icon: 'fa fa-trash', command: this.dropStash},
    {separator: true},
    {label: 'Copy stash sha', icon: 'fa fa-copy', command: this.copyCommitSha},
  ]);

  private run = (args: (string | undefined)[], successMsg?: string) =>
    this.gitApi.git(args)
      .pipe(switchMap(() => this.gitRepository.updateLogsAndBranches()))
      .subscribe(() => successMsg && this.popup.success(successMsg));

  private applyStash = () =>
    this.run(['stash', 'apply', this.stashRef()], `Applied ${this.stashRef()}`);

  private popStash = () =>
    this.run(['stash', 'pop', this.stashRef()], `Popped ${this.stashRef()}`);

  private dropStash = () =>
    this.run(['stash', 'drop', this.stashRef()], `Dropped ${this.stashRef()}`);

  private copyCommitSha = () => {
    navigator.clipboard.writeText(this.sha());
    this.popup.success('SHA copied to clipboard');
  };
}