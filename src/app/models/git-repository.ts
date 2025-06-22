import {Commit} from '../lib/github-desktop/model/commit';
import {Branch} from '../lib/github-desktop/model/branch';
import {DisplayRef} from '../lib/github-desktop/model/display-ref';
import {ViewType} from '../components/monaco-editor-view/monaco-editor-view.component';

export class GitRepository {
  constructor(
    public directory: string, // Identify the directory (like an id)
    public name: string,
    public sizes = [20, 50, 30], // panels sizes
    public selected = true, // This repository is selected
    public logs: ReadonlyArray<Commit> = [],
    public stashes: ReadonlyArray<Commit> = [],
    public branches: ReadonlyArray<Branch> = [],
    public selectedCommits: ReadonlyArray<DisplayRef> = [],
    public highlightedCommitSha?: string,
    public checkedOutBranch?: Branch,
    public startCommit = 0,
    public remotes: { remote: string; url: string }[] = [],
    // Editor config
    public editorConfig: { viewType: ViewType } = {viewType: 'split'},
  ) {
  }
}