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
