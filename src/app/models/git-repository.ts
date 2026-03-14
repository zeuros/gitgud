import {Commit} from '../lib/github-desktop/model/commit';
import {Branch} from '../lib/github-desktop/model/branch';
import {WorkDirStatus} from '../lib/github-desktop/commit-files-changes';
import {ViewType} from '../components/monaco-editor-view/monaco-editor-view.component';

export class GitRepository {
  constructor(
    public id: string, // = repository directory
    public name: string,
    public panelSizes = {mainPanels: [20, 50, 30], leftPanel: [30, 30, 40]}, // panels sizes
    public selected = true, // This repository is selected
    public logs: Commit[] = [],
    public stashes: Commit[] = [],
    public branches: Branch[] = [],
    public selectedCommitsShas: string[] = [],
    public startCommit = 0,
    public remotes: { remote: string; url: string }[] = [],
    // Editor config
    public editorConfig: { viewType: ViewType } = {viewType: 'split'},
    public workDirStatus: WorkDirStatus = {unstaged: [], staged: []},
  ) {
  }
}