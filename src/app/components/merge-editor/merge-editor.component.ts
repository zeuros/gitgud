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

import {ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, HostListener, inject, signal, viewChild} from '@angular/core';
import {Button} from 'primeng/button';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {GitRefreshService} from '../../services/git-refresh.service';
import {catchError, combineLatest, finalize, of} from 'rxjs';
import {fileName} from '../../utils/utils';
import {detectLang} from '../../utils/language-detection';
import {createHighlighter, type Highlighter} from 'shiki';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {ThemeService} from '../../services/theme.service';
import {short} from '../../utils/commit-utils';

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

type ConflictCtx = {
  operation: 'merge' | 'rebase' | 'cherry-pick' | 'stash' | 'unknown';
  oursLabel: string;
  theirsLabel: string;
};

@Component({
  selector: 'gitgud-merge-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [Button],
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
  protected highlightFn = signal<HighlightFn | undefined>(undefined);
  protected conflictCtx = signal<ConflictCtx>({operation: 'unknown', oursLabel: 'Ours', theirsLabel: 'Theirs'});

  protected file = computed(() => this.fileDiffPanel.conflictedFile());

  private highlighter: Highlighter | null = null;

  constructor() {
    effect(() => {
      const file = this.file();
      if (!file) return;

      const path = file.path;
      const base$ = this.gitApi.git(['show', `:1:${path}`]).pipe(catchError(() => of('')));
      const ours$ = this.gitApi.git(['show', `:2:${path}`]).pipe(catchError(() => of('')));
      const theirs$ = this.gitApi.git(['show', `:3:${path}`]).pipe(catchError(() => of('')));

      this.conflictCtx.set(this.detectConflictContext());
      this.refineMergeLabel();

      combineLatest([ours$, base$, theirs$]).subscribe(([ours, base, theirs]) => {
        this.lhs.set(ours);
        this.ctr.set(base);
        this.rhs.set(theirs);
        this.highlightFn.set(undefined);
        this.initHighlight(path);
      });
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
    const absPath = window.electron.path.resolve(this.currentRepo.cwd()!, file.path);
    window.electron.fs.writeFileSync(absPath, merged);

    this.gitApi.gitAction(['add', '--', file.path])
      .pipe(finalize(() => {
        this.saving.set(false);
        this.fileDiffPanel.closeViews();
        this.gitRefresh.doUpdateWorkingDirChanges();
      }))
      .subscribe();
  }

  protected async acceptAll(side: 'ours' | 'theirs'): Promise<void> {
    const mismerge = this.mergeEl()?.nativeElement;
    if (!mismerge) return;
    // During rebase: lhs (:2:) = upstream (theirs), rhs (:3:) = our patch (ours)
    const isRebase = this.conflictCtx().operation === 'rebase';
    const physicalSide = side === 'ours'
      ? (isRebase ? 'left' : 'right')
      : (isRebase ? 'right' : 'left');

    const buttons = Array.from(mismerge.querySelectorAll<HTMLElement>(`.msm__side-panel.msm__${physicalSide} button`));
    for (let i = buttons.length - 1; i >= 0; i--) {
      buttons[i].click();
      await new Promise<void>(r => setTimeout(r)); // Waits for mismerge macrotask to update
    }
  }

  private detectConflictContext(): ConflictCtx {
    const cwd = this.currentRepo.cwd();
    if (!cwd) return {operation: 'unknown', oursLabel: 'Ours', theirsLabel: 'Theirs'};

    const git = `${cwd}/.git`;
    const read = (p: string) => { try { return window.electron.fs.readFileSync(p).trim(); } catch { return ''; } };
    const exists = (p: string) => window.electron.fs.existsSync(p);

    if (this.currentRepo.isRebasing()) {
      const branch = read(`${git}/rebase-merge/head-name`).replace('refs/heads/', '') || 'our branch';
      const onto = read(`${git}/rebase-merge/onto`).slice(0, 7) || 'upstream';
      return {operation: 'rebase', oursLabel: `${branch} (ours)`, theirsLabel: `onto ${onto}`};
    }

    if (exists(`${git}/CHERRY_PICK_HEAD`)) {
      const sha = read(`${git}/CHERRY_PICK_HEAD`).slice(0, 7);
      return {operation: 'cherry-pick', oursLabel: 'HEAD (ours)', theirsLabel: `cherry-pick ${sha}`};
    }

    if (exists(`${git}/MERGE_HEAD`)) {
      const mergeHead = read(`${git}/MERGE_HEAD`);
      const stashRef = read(`${git}/refs/stash`);
      if (stashRef && mergeHead === stashRef) {
        return {operation: 'stash', oursLabel: 'HEAD (ours)', theirsLabel: 'stash'};
      }
      return {operation: 'merge', oursLabel: 'HEAD (ours)', theirsLabel: `merging ${short(mergeHead)}`};
    }

    return {operation: 'unknown', oursLabel: 'Ours', theirsLabel: 'Theirs'};
  }

  private refineMergeLabel(): void {
    const cwd = this.currentRepo.cwd();
    if (!cwd) return;
    const git = `${cwd}/.git`;
    const read = (p: string) => { try { return window.electron.fs.readFileSync(p).trim(); } catch { return ''; } };
    const exists = (p: string) => window.electron.fs.existsSync(p);

    if (!exists(`${git}/MERGE_HEAD`) || this.currentRepo.isRebasing() || exists(`${git}/CHERRY_PICK_HEAD`)) return;
    const mergeHead = read(`${git}/MERGE_HEAD`);
    const stashRef = read(`${git}/refs/stash`);
    if (stashRef && mergeHead === stashRef) return;

    this.gitApi.git(['name-rev', '--name-only', mergeHead]).subscribe(name => {
      const clean = name?.trim().replace(/[~^]\d*$/g, '');
      if (clean && !clean.includes('undefined')) {
        this.conflictCtx.update(ctx => ({...ctx, theirsLabel: `merging ${clean}`}));
      }
    });
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
