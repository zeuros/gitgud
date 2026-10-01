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

import {type AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, type OnDestroy, signal, untracked, ViewChild} from '@angular/core';
import {AppFileStatusKind, CommittedFileChange, FileChange, isCommittedFileChange, isWorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import {editor, Uri} from 'monaco-editor';
import {diffSides, FileDiffService} from '../../services/file-diff.service';
import {FormsModule} from '@angular/forms';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';
import {catchError, combineLatest, EMPTY, switchMap, tap} from 'rxjs';
import {MonacoDiffRightClickActionsService} from './monaco-diff-right-click-actions.service';
import {FileDiffPanelService} from '../../services/file-diff-panel.service';
import {type ViewType} from '../../models/git-repository';
import {disableMonacoLanguageServices, imageMimeType, isBinaryContent, maxDisplaySize, registerMonacoEditorThemes, renderWindowsShitEol} from './monaco-utils';
import {ThemeService} from '../../services/theme.service';
import {SelectButton} from 'primeng/selectbutton';
import IStandaloneDiffEditor = editor.IStandaloneDiffEditor;
import IEditorOptions = editor.IEditorOptions;
import IDiffEditorOptions = editor.IDiffEditorOptions;
import {fileName} from '../../utils/utils';
import {Button} from 'primeng/button';
import {DatePipe} from '@angular/common';
import {FileHistoryReaderService} from '../../services/electron-cmd-parser-layer/file-history-reader.service';
import {type Blame, type BlameCommit, type FileHistoryEntry, startsBlameBlock} from '../../utils/file-history.utils';
import {ToastService} from '../../services/toast.service';
import {short} from '../../utils/commit-utils';
import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;

interface DiffModel {
  code: string;
  fileName: string;
}

interface DiffModels {
  before: DiffModel,
  after: DiffModel
}

/** One side of an image diff; undefined url when the file doesn't exist on that side */
interface ImageSide {
  url?: string;
  size: number;
}

type ImageSideName = 'before' | 'after';

type DiffContent =
  | {kind: 'text'}
  | {kind: 'binary'}
  | {kind: 'too-large', size: number}
  | {kind: 'image', before: ImageSide, after: ImageSide};

// Path of the file before the change: renames and copies come from another path
// (committed files carry an undefined oldPath when they weren't renamed)
const oldPath = (file: FileChange) => ('oldPath' in file.status ? file.status.oldPath : undefined) ?? file.path;

const BLAME_AUTHOR_WIDTH = 14;
// "abc1234 2026-01-31 Author name   " in front of the line number
const BLAME_LABEL_WIDTH = 7 + 1 + 10 + 1 + BLAME_AUTHOR_WIDTH + 1;

const blameLabel = ({sha, date, author, committed}: BlameCommit) =>
  (committed
    ? `${sha.slice(0, 7)} ${date.toISOString().slice(0, 10)} ${author.slice(0, BLAME_AUTHOR_WIDTH)}`
    : 'Not committed yet'
  ).padEnd(BLAME_LABEL_WIDTH);

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B`
    : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

@Component({
  standalone: true,
  selector: 'gitgud-monaco-editor-view',
  imports: [FormsModule, SelectButton, Button, DatePipe],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonacoEditorViewComponent implements AfterViewInit, OnDestroy {

  protected currentRepo = inject(CurrentRepoStore);
  protected fileDiffPanel = inject(FileDiffPanelService);
  private fileDiff = inject(FileDiffService);
  private hunkActions = inject(MonacoDiffRightClickActionsService);
  private theme = inject(ThemeService);
  private fileHistoryReader = inject(FileHistoryReaderService);
  private toast = inject(ToastService);
  protected viewOptions = Object.entries({
    hunk:   {label: 'Hunk',   icon: 'fa fa-list'},
    inline: {label: 'Inline', icon: 'fa fa-align-left'},
    split:  {label: 'Split',  icon: 'fa fa-columns'},
  } satisfies Record<ViewType, {label: string; icon: string}>).map(([value, {label, icon}]) => ({value, label, icon}));

  fileToDiff = input<FileChange | null>();
  @ViewChild('diffEditor', {static: false}) diffEditorContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('blameEditor', {static: false}) blameEditorContainer?: ElementRef<HTMLDivElement>;
  diffModels = signal<DiffModels | undefined>(undefined);
  protected history = signal<FileHistoryEntry[] | undefined>(undefined);
  protected blame = signal<Blame | undefined>(undefined);
  // Commit of the blamed line under the mouse
  protected blameHovered = signal<BlameCommit | undefined>(undefined);
  private blameEditor?: IStandaloneCodeEditor;
  private blameDecorations?: editor.IEditorDecorationsCollection;
  protected short = short;
  protected content = signal<DiffContent>({kind: 'text'});
  protected images = computed(() => {
    const content = this.content();
    return content.kind === 'image' ? content : undefined;
  });
  protected readonly imageSides = ['before', 'after'] as const;
  private imageDimensions = signal<Record<ImageSideName, string | undefined>>({before: undefined, after: undefined});

  protected viewType = computed(() => this.currentRepo.editorConfig()!.viewType);

  private diffEditor = signal<{ editor: IStandaloneDiffEditor, contextMenuUpdater: (f: WorkingDirectoryFileChange) => void } | undefined>(undefined);
  private currentFile = signal<WorkingDirectoryFileChange | undefined>(undefined);
  private editorOptions: IDiffEditorOptions = {
    readOnly: true,
    automaticLayout: true,        // polls container size every ~100 ms; acceptable for a single editor
    ignoreTrimWhitespace: false,
    renderWhitespace: 'none',
    renderControlCharacters: false,
    unusualLineTerminators: 'off',
    diffAlgorithm: 'legacy',
    useInlineViewWhenSpaceIsLimited: true,
    cursorBlinking: 'phase',      // 'smooth' drives continuous CSS animation; 'phase' is simpler
    cursorSmoothCaretAnimation: 'off',
    definitionLinkOpensInPeek: false,
    inlineSuggest: {enabled: false},
    smoothScrolling: false,       // eliminates multi-frame scroll deceleration paint
    snippetSuggestions: 'none',
    inlayHints: {enabled: 'off'},
    parameterHints: {enabled: false},
    hover: {enabled: 'off'},
    renderLineHighlight: 'gutter', // 'all' repaints the full-width highlight line on cursor move
    folding: false,               // fold-range computation scans visible lines on every model change
    links: false,                 // URL tokenization runs over every visible line continuously
    fontLigatures: false,         // ligature shaping adds per-character GPU cost
    colorDecorators: false,       // color swatches: a color request and a decoration per CSS color
    minimap: {enabled: false},    // whole-file canvas; the diff overview ruler already locates changes
    stickyScroll: {enabled: false},                      // recomputes the scope outline on load and scroll
    bracketPairColorization: {enabled: false},           // parses the whole model on load
    guides: {bracketPairs: false, indentation: false},   // painted on every visible line
    matchBrackets: 'never',
    occurrencesHighlight: 'off',  // word scans on every cursor move
    selectionHighlight: false,
    unicodeHighlight: {ambiguousCharacters: false},      // editor-worker round trip per model; invisible chars stay highlighted
    renderGutterMenu: false,      // diff gutter revert menu: read-only, staging goes through our context menu
    renderMarginRevertIcon: false,
    experimentalWhitespaceRendering: 'font', // cheaper than SVG glyphs with renderWhitespace: 'all'
  };
  private lastRevealedPath: string | undefined;

  constructor() {
    registerMonacoEditorThemes();
    disableMonacoLanguageServices();
    effect(() => editor.setTheme(this.theme.tokens().monacoTheme));

    effect((onCleanup) => {
      const file = this.fileToDiff();
      if (!file) return;

      // Check sizes first so a huge file is never loaded
      const sub = this.fileDiff.getDiffSize(file).pipe(
        switchMap(size =>
          size > maxDisplaySize(file.path) ? this.showTooLarge(size)
            : imageMimeType(file.path) ? this.showImageDiff(file)
              : this.showTextDiff(file)),
      ).subscribe();
      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      const file = this.currentFile();
      const diffEditor = this.diffEditor();
      if (diffEditor && file) diffEditor.contextMenuUpdater(file);
    });

    // History of the file shown when the panel is opened: browsing its revisions keeps the list
    effect((onCleanup) => {
      if (!this.fileDiffPanel.historyOpen()) return this.history.set(undefined);
      const file = untracked(this.fileToDiff);
      if (!file) return;

      const sub = this.fileHistoryReader.history(file.path, isCommittedFileChange(file) ? file.commitish : 'HEAD')
        .subscribe(history => this.history.set(history));
      onCleanup(() => sub.unsubscribe());
    });

    effect((onCleanup) => {
      const file = this.fileToDiff();
      if (!this.fileDiffPanel.blameOpen() || !file) return this.blame.set(undefined);

      const sub = this.fileHistoryReader.blame(...this.blameTarget(file)).pipe(
        catchError(() => {
          this.toast.warn(`${fileName(file.path)} can't be blamed: git doesn't track it there`);
          this.fileDiffPanel.blameOpen.set(false);
          return EMPTY;
        }),
      ).subscribe(blame => this.showBlame(file, blame));
      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      const viewType = this.viewType();
      const diffEditor = this.diffEditor();

      if (diffEditor) {
        diffEditor.editor.updateOptions({
          renderSideBySide: viewType === 'split',
          hideUnchangedRegions: viewType === 'hunk'
            ? {enabled: true, revealLineCount: 15, minimumLineCount: 5, contextLineCount: 3}
            : {enabled: false},
        } as IEditorOptions);
      }
    });

    // Update editor models when data changes
    effect(() => {
      const models = this.diffModels();
      if (models && this.diffEditor())
        this.updateDiffEditor(models!);
    });
  }

  ngAfterViewInit(): void {
    if (this.diffEditorContainer) {
      const diffEditorEditor = editor.createDiffEditor(this.diffEditorContainer.nativeElement, this.editorOptions);
      this.diffEditor.set({editor: diffEditorEditor, contextMenuUpdater: this.hunkActions.registerEditorRightClick(diffEditorEditor)});
      diffEditorEditor.onDidUpdateDiff(this.clearEditorWhenNoChangesToDisplay(diffEditorEditor));
      // Expose for e2e tests (window.monaco is not available in the main thread)
      (window as any).__e2eDiffEditor = diffEditorEditor;
    }
  }


  ngOnDestroy(): void {
    this.blameEditor?.getModel()?.dispose();
    this.blameEditor?.dispose();
    this.setContent({kind: 'text'});
    const model = this.diffEditor()?.editor.getModel();
    model?.original.dispose();
    model?.modified.dispose();
    this.diffEditor()?.editor.dispose();
  }

  @HostListener('document:keydown.escape')
  protected onEscape = () => this.fileDiffPanel.closeDiffView();

  protected setViewType = (viewType: ViewType) => this.currentRepo.update({editorConfig: {viewType}});

  // Monaco only handles text: blobs that aren't valid UTF-8 (images, videos…) must be fetched as raw bytes
  private showTextDiff(file: FileChange) {
    const {before, after} = diffSides(file);
    return combineLatest([this.fileDiff.getFileText(oldPath(file), before), this.fileDiff.getFileText(file.path, after)]).pipe(tap(([before, after]) => {
      if (isBinaryContent(before) || isBinaryContent(after)) {
        this.currentFile.set(undefined);
        this.setContent({kind: 'binary'});
        return;
      }

      this.currentFile.set(isWorkingDirectoryFileChange(file) ? file : undefined);
      this.setContent({kind: 'text'});
      this.diffModels.set({
        before: {code: renderWindowsShitEol(before), fileName: file.path},
        after: {code: renderWindowsShitEol(after), fileName: file.path},
      });
    }));
  }

  private showTooLarge(size: number) {
    this.currentFile.set(undefined);
    this.setContent({kind: 'too-large', size});
    return EMPTY;
  }

  private showImageDiff(file: FileChange) {
    const {before, after} = diffSides(file);
    const mime = imageMimeType(file.path);
    const toSide = (bytes: ArrayBuffer): ImageSide => ({
      url: bytes.byteLength ? URL.createObjectURL(new Blob([bytes], {type: mime})) : undefined,
      size: bytes.byteLength,
    });

    return combineLatest([this.fileDiff.getFileBytes(file.path, before), this.fileDiff.getFileBytes(file.path, after)]).pipe(tap(([before, after]) => {
      this.currentFile.set(undefined);
      this.setContent({kind: 'image', before: toSide(before), after: toSide(after)});
    }));
  }

  protected isShown = (entry: FileHistoryEntry) => {
    const file = this.fileToDiff();
    return !!file && isCommittedFileChange(file) && file.commitish == entry.sha && !file.baseCommitish;
  };

  protected showHistoryEntry = ({path, status, sha}: FileHistoryEntry) =>
    this.fileDiffPanel.showRevision(new CommittedFileChange(path, status, sha));

  protected selectInLog = (sha: string, event?: Event) => {
    event?.stopPropagation();
    if (this.currentRepo.logs().some(c => c.sha == sha)) this.currentRepo.update({selectedCommitsShas: [sha]});
    else this.toast.info(`${short(sha)} isn't in the log shown`);
  };

  // What to blame: [path, revision]. A deleted file is blamed as it was before; working directory files as they are on disk
  private blameTarget = (file: FileChange): [string, string | undefined] => {
    if (!isCommittedFileChange(file)) return [file.path, undefined];
    return [file.path, file.status.kind == AppFileStatusKind.Deleted ? `${file.commitish}^` : file.commitish];
  };

  private showBlame(file: FileChange, blame: Blame) {
    const blameEditor = this.blameEditor ??= this.createBlameEditor();
    const digits = `${blame.lines.length}`.length;

    const previousModel = blameEditor.getModel();
    blameEditor.setModel(this.upsertModel(Uri.parse(`blame-${file.path}`), blame.lines.map(l => l.text).join('\n')));
    if (previousModel && previousModel !== blameEditor.getModel()) previousModel.dispose();

    blameEditor.updateOptions({
      lineNumbersMinChars: BLAME_LABEL_WIDTH + digits + 1,
      lineNumbers: lineNumber => {
        const line = blame.lines[lineNumber - 1];
        const number = `${lineNumber}`.padStart(digits);
        return line && startsBlameBlock(blame, lineNumber - 1) ? blameLabel(blame.commits.get(line.sha)!) + number : number;
      },
    });

    // Tells the blocks apart: every other one is shaded
    let shaded = true;
    const blocks = blame.lines.flatMap((_, index) => {
      if (!startsBlameBlock(blame, index)) return [];
      shaded = !shaded;
      const end = blame.lines.findIndex((_, i) => i > index && startsBlameBlock(blame, i));
      return shaded ? [{range: {startLineNumber: index + 1, startColumn: 1, endLineNumber: end < 0 ? blame.lines.length : end, endColumn: 1}, options: {isWholeLine: true, className: 'blame-shaded', marginClassName: 'blame-shaded'}}] : [];
    });
    this.blameDecorations?.clear();
    this.blameDecorations = blameEditor.createDecorationsCollection(blocks);

    this.blameHovered.set(undefined);
    this.blame.set(blame);
  }

  private createBlameEditor() {
    const blameEditor = editor.create(this.blameEditorContainer!.nativeElement, {...this.editorOptions, glyphMargin: false, renderLineHighlight: 'all'});
    const commitAt = (lineNumber?: number) => {
      const blame = this.blame();
      return blame?.commits.get(blame.lines[(lineNumber ?? 0) - 1]?.sha);
    };

    blameEditor.onMouseMove(({target}) => this.blameHovered.set(commitAt(target.position?.lineNumber)));
    blameEditor.onMouseLeave(() => this.blameHovered.set(undefined));
    // Clicking a line's annotation opens what its commit changed in the file
    blameEditor.onMouseDown(({target}) => {
      const commit = commitAt(target.position?.lineNumber);
      if (target.type != editor.MouseTargetType.GUTTER_LINE_NUMBERS || !commit?.committed) return;
      this.fileDiffPanel.blameOpen.set(false);
      this.fileDiffPanel.showRevision(new CommittedFileChange(commit.path, {kind: AppFileStatusKind.Modified}, commit.sha));
    });
    return blameEditor;
  }

  // Releases the previous image blobs
  private setContent(content: DiffContent) {
    const previous = this.content();
    if (previous.kind === 'image')
      [previous.before.url, previous.after.url].forEach(url => url && URL.revokeObjectURL(url));
    this.imageDimensions.set({before: undefined, after: undefined});
    this.content.set(content);
  }

  protected onImageLoad = (side: ImageSideName, event: Event) => {
    const img = event.target as HTMLImageElement;
    this.imageDimensions.update(d => ({...d, [side]: `${img.naturalWidth} × ${img.naturalHeight}`}));
  };

  // "1920 × 1080 · 245.3 KB"
  protected readonly formatSize = formatSize;

  protected imageMeta = (side: ImageSideName, bytes: number) =>
    [this.imageDimensions()[side], formatSize(bytes)].filter(Boolean).join(' · ');

  private clearEditorWhenNoChangesToDisplay = (diffEditorEditor: IStandaloneDiffEditor) => () => {
    const changes = diffEditorEditor.getLineChanges();
    if (this.currentFile() && changes !== null && changes.length === 0) {
      const oldModel = diffEditorEditor.getModel();
      diffEditorEditor.setModel(null);
      oldModel?.original.dispose();
      oldModel?.modified.dispose();
      this.fileDiffPanel.closeDiffView();
    }
  };

  private updateDiffEditor({before, after}: DiffModels) {
    const diffEditor = this.diffEditor()!.editor;
    const oldModel = diffEditor.getModel();

    // Attach the new models before disposing the old ones: Monaco kills its diff worker as soon
    // as no model exists, and respawning it on every file made showing a diff slow
    const original = this.upsertModel(Uri.parse(`before-${before.fileName}`), before.code);
    const modified = this.upsertModel(Uri.parse(`after-${after.fileName}`), after.code);
    diffEditor.setModel({original, modified});

    for (const model of [oldModel?.original, oldModel?.modified])
      if (model && model !== original && model !== modified) model.dispose();

    // Scroll editor to first edited lines on first show
    if (after.fileName !== this.lastRevealedPath) {
      this.lastRevealedPath = after.fileName;
      const disposable = diffEditor.onDidUpdateDiff(() => {
        disposable.dispose();
        const firstChange = diffEditor.getLineChanges()?.[0];
        if (firstChange) diffEditor.getModifiedEditor().revealLineInCenter(firstChange.modifiedStartLineNumber);
      });
    }
  }

  // Re-showing the same file reuses its URI, and createModel throws while that model is alive
  private upsertModel(uri: Uri, code: string) {
    const existing = editor.getModel(uri);
    if (!existing) return editor.createModel(code, undefined, uri);
    existing.setValue(code);
    return existing;
  }

  protected readonly fileName = fileName;
}
