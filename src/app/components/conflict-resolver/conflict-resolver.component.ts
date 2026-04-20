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

import {AfterViewInit, Component, computed, effect, ElementRef, inject, input, OnDestroy, output, signal, viewChild} from '@angular/core';
import {Button} from 'primeng/button';
import {ButtonGroup} from 'primeng/buttongroup';
import {Tooltip} from 'primeng/tooltip';
import {ConflictHunk, ConflictParserService} from '../../services/conflict-parser.service';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {PopupService} from '../../services/popup.service';
import {editor} from 'monaco-editor';
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;

@Component({
  selector: 'gitgud-conflict-resolver',
  standalone: true,
  imports: [Button, ButtonGroup, Tooltip],
  templateUrl: './conflict-resolver.component.html',
  styleUrl: './conflict-resolver.component.scss',
})
export class ConflictResolverComponent implements AfterViewInit, OnDestroy {

  filePath = input.required<string>();
  fileContent = input.required<string>();
  resolved = output<void>();

  private readonly conflictParser = inject(ConflictParserService);
  private readonly gitApi = inject(GitApiService);
  private readonly popup = inject(PopupService);

  private oursContainerEl = viewChild<ElementRef<HTMLDivElement>>('oursContainer');
  private resultContainerEl = viewChild<ElementRef<HTMLDivElement>>('resultContainer');
  private theirsContainerEl = viewChild<ElementRef<HTMLDivElement>>('theirsContainer');

  protected parsedFile = computed(() => this.conflictParser.parse(this.fileContent()));
  protected hunks = computed(() => this.parsedFile().hunks);
  protected currentHunkIndex = signal(0);
  protected currentHunk = computed(() => this.hunks()[this.currentHunkIndex()]);
  protected unresolvedCount = computed(() => this.hunks().filter(h => h.resolution === undefined).length);
  protected canSave = computed(() => this.unresolvedCount() === 0);

  private oursEditor?: IStandaloneCodeEditor;
  private resultEditor?: IStandaloneCodeEditor;
  private theirsEditor?: IStandaloneCodeEditor;

  private readonly editorOptions = {
    theme: 'vs-dark',
    readOnly: true,
    automaticLayout: true,
    minimap: {enabled: false},
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    fontSize: 12,
  };

  constructor() {
    effect(() => {
      const hunk = this.currentHunk();
      if (hunk && this.oursEditor && this.theirsEditor && this.resultEditor) {
        this.updateEditors(hunk);
      }
    });
  }

  ngAfterViewInit() {
    const oursEl = this.oursContainerEl()?.nativeElement;
    const resultEl = this.resultContainerEl()?.nativeElement;
    const theirsEl = this.theirsContainerEl()?.nativeElement;
    if (!oursEl || !resultEl || !theirsEl) return;

    this.oursEditor = editor.create(oursEl, this.editorOptions);
    this.resultEditor = editor.create(resultEl, {...this.editorOptions, readOnly: false});
    this.theirsEditor = editor.create(theirsEl, this.editorOptions);

    const hunk = this.currentHunk();
    if (hunk) this.updateEditors(hunk);
  }

  ngOnDestroy() {
    this.oursEditor?.dispose();
    this.resultEditor?.dispose();
    this.theirsEditor?.dispose();
  }

  private updateEditors(hunk: ConflictHunk) {
    this.oursEditor?.setValue(hunk.oursLines.join('\n'));
    this.theirsEditor?.setValue(hunk.theirsLines.join('\n'));
    this.resultEditor?.setValue((hunk.resolution ?? []).join('\n'));
  }

  protected acceptOurs() {
    const hunk = this.currentHunk();
    if (!hunk) return;
    hunk.resolution = [...hunk.oursLines];
    this.resultEditor?.setValue(hunk.resolution.join('\n'));
    this.advanceToNextUnresolved();
  }

  protected acceptTheirs() {
    const hunk = this.currentHunk();
    if (!hunk) return;
    hunk.resolution = [...hunk.theirsLines];
    this.resultEditor?.setValue(hunk.resolution.join('\n'));
    this.advanceToNextUnresolved();
  }

  protected acceptBoth() {
    const hunk = this.currentHunk();
    if (!hunk) return;
    hunk.resolution = [...hunk.oursLines, ...hunk.theirsLines];
    this.resultEditor?.setValue(hunk.resolution.join('\n'));
    this.advanceToNextUnresolved();
  }

  protected acceptNone() {
    const hunk = this.currentHunk();
    if (!hunk) return;
    hunk.resolution = [];
    this.resultEditor?.setValue('');
    this.advanceToNextUnresolved();
  }

  protected acceptAllOurs() {
    this.hunks().forEach(h => h.resolution = [...h.oursLines]);
    const hunk = this.currentHunk();
    if (hunk) this.resultEditor?.setValue(hunk.resolution!.join('\n'));
  }

  protected acceptAllTheirs() {
    this.hunks().forEach(h => h.resolution = [...h.theirsLines]);
    const hunk = this.currentHunk();
    if (hunk) this.resultEditor?.setValue(hunk.resolution!.join('\n'));
  }

  protected applyCurrentResult() {
    const hunk = this.currentHunk();
    if (!hunk) return;
    hunk.resolution = this.resultEditor!.getValue().split('\n');
    this.advanceToNextUnresolved();
  }

  protected saveResolved() {
    const parsed = this.parsedFile();
    const result = this.conflictParser.rebuild(parsed);
    const absPath = window.electron.path.resolve(this.gitApi.cwd()!, this.filePath());
    window.electron.fs.writeFileSync(absPath, result);

    this.gitApi.git(['add', this.filePath()]).subscribe({
      next: () => {
        this.popup.success('Conflicts resolved and file staged');
        this.resolved.emit();
      },
      error: (e) => this.popup.err(e),
    });
  }

  protected navigateTo(index: number) {
    this.currentHunkIndex.set(index);
  }

  private advanceToNextUnresolved() {
    const hunks = this.hunks();
    const current = this.currentHunkIndex();
    for (let i = current + 1; i < hunks.length; i++) {
      if (hunks[i].resolution === undefined) { this.currentHunkIndex.set(i); return; }
    }
    for (let i = 0; i < current; i++) {
      if (hunks[i].resolution === undefined) { this.currentHunkIndex.set(i); return; }
    }
  }
}
