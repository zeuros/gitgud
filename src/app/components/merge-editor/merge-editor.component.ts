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

import '@mismerge/core/web';

import {ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, type ElementRef, HostListener, inject, signal, viewChild, type WritableSignal} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {ButtonDirective} from 'primeng/button';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {GitApiService} from '../../services/git/git-api.service';
import {GitRefreshService} from '../../services/git-refresh.service';
import {catchError, combineLatest, finalize, firstValueFrom, of, switchMap} from 'rxjs';
import {fileName} from '../../utils/utils';
import {detectLang} from '../../utils/language-detection';
import {createHighlighter, type Highlighter} from 'shiki';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {ThemeService} from '../../services/theme.service';
import {short} from '../../utils/commit-utils';
import {isBinaryContent} from '../monaco-editor-view/monaco-utils';
import {gitPath} from '../../utils/git-path.utils';

const GitGudDarkColors = {
  added:            'rgba(155, 185, 85,  0.20)',
  removed:          'rgba(255,  0,   0,  0.20)',
  removedBothSides: 'rgba(200,  30,  30, 0.12)',
  conflict:         'rgba(160,  65,  0,  0.28)',
  modified:         'rgba(30,  130, 255, 0.15)',
  resolvedConflict: 'rgba(100, 160,  75, 0.25)',
  modifiedOverlay:  'rgba(20,  100, 200, 0.10)',
};

const GitGudLightColors = {
  added:            'rgba(100, 160, 50,  0.18)',
  removed:          'rgba(200,  40,  40, 0.16)',
  removedBothSides: 'rgba(180,  30,  30, 0.10)',
  conflict:         'rgba(180,  80,  0,  0.18)',
  modified:         'rgba(20,  100, 220, 0.12)',
  resolvedConflict: 'rgba(80,  140,  60, 0.20)',
  modifiedOverlay:  'rgba(15,   80, 180, 0.08)',
};

type HighlightFn = (text: string) => string | Promise<string>;

// One column of the editor: where its version comes from
type ConflictSide = {
  name: string;
  role: string;
  ref?: string; // Commit the version comes from, shown as sha + summary
};

// left is git's stage 2 (HEAD, `--ours`), right is stage 3 (`--theirs`), whatever the operation
type ConflictCtx = {
  operation: 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'stash' | 'unknown';
  left: ConflictSide;
  right: ConflictSide;
};

const UNKNOWN_CTX: ConflictCtx = {operation: 'unknown', left: {name: 'Ours', role: 'HEAD'}, right: {name: 'Theirs', role: 'incoming'}};

@Component({
  selector: 'gitgud-merge-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ButtonDirective, NgTemplateOutlet],
  templateUrl: './merge-editor.component.html',
  styleUrl: './merge-editor.component.scss',
})
export class MergeEditorComponent {

  protected mergeEl = viewChild<ElementRef<HTMLElement & { ctr: string }>>('mergeEl');

  protected fileDiffPanel = inject(FileDiffPanelService);
  protected fileName = fileName;

  private gitApi = inject(GitApiService);
  private currentRepo = inject(CurrentRepoStore);
  private gitRefresh = inject(GitRefreshService);
  private theme = inject(ThemeService);

  protected gitgudColors = computed(() => this.theme.isDark() ? GitGudDarkColors : GitGudLightColors);
  protected lhs = signal('');
  protected ctr = signal('');
  protected rhs = signal('');
  protected saving = signal(false);
  protected columns = ['left', 'right'] as const;
  // Binary files can't be merged line by line, one side is kept whole
  protected binary = signal(false);
  protected highlightFn = signal<HighlightFn | undefined>(undefined);
  protected conflictCtx = signal<ConflictCtx>(UNKNOWN_CTX);
  // "sha summary" of the commit each column comes from
  protected leftCommit = signal('');
  protected rightCommit = signal('');

  protected file = computed(() => this.fileDiffPanel.conflictedFile());

  private highlighter: Highlighter | null = null;

  constructor() {
    effect((onCleanup) => {
      const file = this.file();
      if (!file) return;

      const path = file.path;
      const base$ = this.gitApi.git(['show', `:1:${path}`]).pipe(catchError(() => of('')));
      const ours$ = this.gitApi.git(['show', `:2:${path}`]).pipe(catchError(() => of('')));
      const theirs$ = this.gitApi.git(['show', `:3:${path}`]).pipe(catchError(() => of('')));

      this.detectConflictContext().then(ctx => {
        this.conflictCtx.set(ctx);
        this.describeCommit(ctx.left.ref, this.leftCommit);
        this.describeCommit(ctx.right.ref, this.rightCommit);
      });

      this.binary.set(false);
      const sub = combineLatest([ours$, base$, theirs$]).subscribe(([ours, base, theirs]) => {
        if ([ours, base, theirs].some(isBinaryContent)) {
          this.binary.set(true);
          return;
        }
        this.lhs.set(ours);
        this.ctr.set(base);
        this.rhs.set(theirs);
        this.highlightFn.set(undefined);
        this.initHighlight(path);
      });
      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      // Re-build highlightFn when theme changes so syntax colors update live.
      const isDark = this.theme.isDark();
      const lang = this.file() ? detectLang(this.file()!.path) : null;
      if (!lang || !this.highlighter) return;
      const h = this.highlighter;
      const theme = isDark ? 'dark-plus' : 'github-light';
      this.highlightFn.set((text: string) => h.codeToHtml(text, {lang, theme}));
    });
  }

  @HostListener('document:keydown.escape')
  protected close() {
    this.fileDiffPanel.closeConflictView();
  }

  protected saveAndMarkResolved() {
    const file = this.file();
    if (!file) return;
    this.saving.set(true);

    const merged = this.mergeEl()?.nativeElement?.ctr ?? this.ctr();
    const absPath = window.tauri.path.resolve(this.currentRepo.cwd()!, file.path);

    window.tauri.fs.writeFile(absPath, merged).then(() =>
      this.gitApi.gitAction(['add', '--', file.path])
        .pipe(finalize(() => {
          this.saving.set(false);
          this.fileDiffPanel.closeViews();
          this.gitRefresh.doUpdateWorkingDirChanges();
        }))
        .subscribe(),
    );
  }

  // Keeps one column's version whole: left is git's --ours (stage 2), right its --theirs (stage 3)
  protected keepSide(column: 'left' | 'right') {
    const file = this.file();
    if (!file) return;
    this.saving.set(true);

    this.gitApi.gitAction(['checkout', column === 'left' ? '--ours' : '--theirs', '--', file.path])
      .pipe(
        switchMap(() => this.gitApi.gitAction(['add', '--', file.path])),
        finalize(() => {
          this.saving.set(false);
          this.fileDiffPanel.closeViews();
          this.gitRefresh.doUpdateWorkingDirChanges();
        }),
      )
      .subscribe();
  }

  protected async acceptAll(column: 'left' | 'right'): Promise<void> {
    const mismerge = this.mergeEl()?.nativeElement;
    if (!mismerge) return;
    // mismerge puts the lhs merge buttons in its "right" side panel and the rhs ones in its "left" one
    const panel = column === 'left' ? 'right' : 'left';

    const buttons = Array.from(mismerge.querySelectorAll<HTMLElement>(`.msm__side-panel.msm__${panel} button`));
    for (let i = buttons.length - 1; i >= 0; i--) {
      buttons[i].click();
      await new Promise<void>(r => setTimeout(r)); // Waits for mismerge macrotask to update
    }
  }

  private async detectConflictContext(): Promise<ConflictCtx> {
    const cwd = this.currentRepo.cwd();
    if (!cwd) return UNKNOWN_CTX;

    const dirs = await this.gitApi.gitDirs(cwd).catch(() => undefined);
    if (!dirs) return UNKNOWN_CTX;
    const read = async (name: string) => { try { return (await window.tauri.fs.readFile(gitPath(dirs, name))).trim(); } catch { return ''; } };
    const exists = (name: string) => window.tauri.fs.exists(gitPath(dirs, name));
    const head = this.currentRepo.headBranch()?.name ?? 'HEAD';

    // Rebase replays our commits on top of the upstream: HEAD (left) is the upstream, the commit being replayed is on the right
    if (this.currentRepo.isRebasing()) {
      const branch = (await read('rebase-merge/head-name')).replace('refs/heads/', '') || 'your branch';
      const onto = short(await read('rebase-merge/onto')) || 'upstream';
      return {
        operation: 'rebase',
        left: {name: `Upstream (onto ${onto})`, role: 'rebased onto, with the commits already replayed', ref: 'HEAD'},
        right: {name: `${branch}`, role: 'your commit being replayed', ref: 'REBASE_HEAD'},
      };
    }

    if (await exists('CHERRY_PICK_HEAD')) {
      const sha = short(await read('CHERRY_PICK_HEAD'));
      return {
        operation: 'cherry-pick',
        left: {name: head, role: 'current branch', ref: 'HEAD'},
        right: {name: `Cherry-picked ${sha}`, role: 'commit being picked', ref: 'CHERRY_PICK_HEAD'},
      };
    }

    // A revert applies the reverted commit's changes backwards: the right column is its parent's version
    if (await exists('REVERT_HEAD')) {
      const sha = short(await read('REVERT_HEAD'));
      return {
        operation: 'revert',
        left: {name: head, role: 'current branch', ref: 'HEAD'},
        right: {name: `Revert of ${sha}`, role: 'commit being reverted, undone', ref: 'REVERT_HEAD'},
      };
    }

    if (await exists('MERGE_HEAD')) {
      const mergeHead = await read('MERGE_HEAD');
      const stashRef = await read('refs/stash');
      if (stashRef && mergeHead === stashRef) {
        return {operation: 'stash', left: {name: head, role: 'current branch', ref: 'HEAD'}, right: {name: 'Stash', role: 'stashed changes', ref: 'MERGE_HEAD'}};
      }
      return {
        operation: 'merge',
        left: {name: head, role: 'current branch', ref: 'HEAD'},
        right: {name: await this.mergedName(mergeHead), role: 'branch being merged in', ref: 'MERGE_HEAD'},
      };
    }

    return UNKNOWN_CTX;
  }

  // Branch name of the merged commit when it has one, its sha otherwise
  private mergedName = (mergeHead: string) =>
    firstValueFrom(this.gitApi.git(['name-rev', '--name-only', mergeHead]).pipe(catchError(() => of(''))))
      .then(name => name.trim().replace(/[~^]\d*$/g, ''))
      .then(name => name && !name.includes('undefined') ? name : short(mergeHead));

  private describeCommit(ref: string | undefined, target: WritableSignal<string>) {
    target.set('');
    if (!ref) return;
    this.gitApi.git(['log', '-1', '--format=%h %s', ref]).pipe(catchError(() => of(''))).subscribe(line => target.set(line.trim()));
  }

  private async initHighlight(path: string) {
    const lang = detectLang(path);
    if (!lang) return;

    if (!this.highlighter) {
      this.highlighter = await createHighlighter({themes: ['dark-plus', 'github-light'], langs: [lang as never]});
    } else {
      const loaded = this.highlighter.getLoadedLanguages();
      if (!loaded.includes(lang)) {
        await this.highlighter.loadLanguage(lang as never);
      }
    }

    const h = this.highlighter;
    const theme = this.theme.isDark() ? 'dark-plus' : 'github-light';
    this.highlightFn.set((text: string) => h.codeToHtml(text, {lang, theme}));
  }
}
