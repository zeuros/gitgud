import {AfterViewInit, Component, computed, effect, ElementRef, inject, input, OnDestroy, signal, untracked, ViewChild} from '@angular/core';
import {CommittedFileChange, FileChange, isCommittedFileChange, isWorkingDirectoryFileChange} from '../../lib/github-desktop/model/status';
import {editor, Uri} from 'monaco-editor';
import {FileDiffService} from '../../services/file-diff.service';
import {Button} from 'primeng/button';
import {ButtonGroup} from 'primeng/buttongroup';
import {Tooltip} from 'primeng/tooltip';
import {Toolbar} from 'primeng/toolbar';
import {FormsModule} from '@angular/forms';
import {CurrentRepoStore} from '../../stores/current-repo.store';
import {WorkingDirectoryFileChange} from '../../lib/github-desktop/model/workdir';
import {combineLatest, of} from 'rxjs';
import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';
import {MonacoDiffRightClickActionsService} from './monaco-diff-right-click-actions.service';
import {ViewType} from '../../models/git-repository';
import IEditorOptions = editor.IEditorOptions;
import ITextModel = editor.ITextModel;
import IStandaloneDiffEditor = editor.IStandaloneDiffEditor;

interface DiffModel {
  code: string;
  fileName: string;
}

// AAA
interface DiffModels {
  before: DiffModel,
  after: DiffModel
}

@Component({
  standalone: true,
  selector: 'gitgud-monaco-editor-view',
  imports: [Button, ButtonGroup, Tooltip, Toolbar, FormsModule],
  templateUrl: './monaco-editor-view.component.html',
  styleUrl: './monaco-editor-view.component.scss',
})
export class MonacoEditorViewComponent implements AfterViewInit, OnDestroy {
  fileToDiff = input<FileChange>();
  @ViewChild('diffEditor', {static: false}) diffEditorContainer?: ElementRef<HTMLDivElement>;
  diffModels = signal<DiffModels | undefined>(undefined);

  protected currentRepo = inject(CurrentRepoStore);
  protected viewType = computed(() => this.currentRepo.editorConfig()!.viewType);

  private fileDiffService = inject(FileDiffService);
  private gitApi = inject(GitApiService);
  private hunkActionsService = inject(MonacoDiffRightClickActionsService);
  private diffEditor = signal<{ editor: IStandaloneDiffEditor, contextMenuUpdater: (f: WorkingDirectoryFileChange) => void} | undefined>(undefined);
  private ownedModels = new Set<ITextModel>(); // Models are cached for the component's lifetime — switching between already-viewed files hits the URI cache
  private currentFile = signal<WorkingDirectoryFileChange | undefined>(undefined);
  private editorOptions: IEditorOptions & { theme: string } = {
    theme: 'vs-dark',
    readOnly: true,
    // standalone: true,
    automaticLayout: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    definitionLinkOpensInPeek: false,
    // experimental: {useTrueInlineView: true},
    // experimentalInlineEdit: {showToolbar: 'always'},
    inlineSuggest: {enabled: false},
    smoothScrolling: true,
    snippetSuggestions: 'none',
    inlayHints: {enabled: 'off'},
    parameterHints: {enabled: false},
    hover: {enabled: false},
    renderLineHighlight: 'all',
  };

  constructor() {
    effect(() => {
      const file = this.fileToDiff();
      if (!file) return;

      const before$ = isCommittedFileChange(file)
        ? this.fileDiffService.getFileAtRevision(file.path, `${file.commitish}^`)
        : ((file as WorkingDirectoryFileChange).staged
            ? this.fileDiffService.getFileAtRevision(file.path)        // staged: HEAD vs index
            : this.fileDiffService.getFileAtRevision(file.path, ''));  // unstaged: index vs workdir

      const after$ = isWorkingDirectoryFileChange(file)
        ? (file.staged
            ? this.fileDiffService.getFileAtRevision(file.path, '')   // git show :path  (index)
            : of(window.electron.fs.readFileSync(window.electron.path.resolve(this.gitApi.cwd()!, file.path))))
        : this.fileDiffService.getFileAtRevision(file.path, (file as CommittedFileChange).commitish);

      combineLatest([before$, after$]).subscribe(([before, after]) => {
        this.currentFile.set(isWorkingDirectoryFileChange(file) ? file : undefined);

        this.diffModels.set({
          before: {code: before, fileName: file.path},
          after: {code: after, fileName: file.path},
        });
      });
    });

    effect(() => {
      const file = this.currentFile();
      const diffEditor = this.diffEditor();
      if (diffEditor && file) diffEditor.contextMenuUpdater(file);
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
      this.diffEditor.set({editor: diffEditorEditor, contextMenuUpdater: this.hunkActionsService.registerEditorRightClick(diffEditorEditor)});
    }
  }


  ngOnDestroy(): void {
    this.diffEditor()?.editor.dispose();
    this.ownedModels.forEach(m => m.dispose());
    this.ownedModels.clear();
  }

  protected setViewType = (viewType: ViewType) => this.currentRepo.update({editorConfig: {viewType}});

  private updateDiffEditor({before, after}: DiffModels) {
    const beforeUri = Uri.parse(`before-${before.fileName}`);
    const afterUri = Uri.parse(`after-${after.fileName}`);

    let original = editor.getModel(beforeUri);
    let modified = editor.getModel(afterUri);

    if (original) {
      original.setValue(before.code);
    } else {
      original = editor.createModel(before.code, undefined, beforeUri);
      this.ownedModels.add(original);
    }

    if (modified) {
      modified.setValue(after.code);
    } else {
      modified = editor.createModel(after.code, undefined, afterUri);
      this.ownedModels.add(modified);
    }

    this.diffEditor()!.editor.setModel({original, modified});
  }

}
