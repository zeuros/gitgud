import {Component, Input} from '@angular/core';
import {GitRepository} from '../../models/git-repository';
import {TableModule} from 'primeng/table';
import {DatePipe, NgIf} from '@angular/common';
import {Commit} from '../../models/commit';
import {RefType} from '../../enums/ref-type.enum';
import {byLogObjectDate, removeDuplicates, removeUndefined, throwEx} from '../../utils/utils';
import {Stash} from '../../models/stash';
import {Branch, BranchType} from "../../models/branch";
import {byName} from "../../utils/log-utils";
import {DisplayRef} from "../../models/display-ref";

@Component({
  selector: 'gitgud-logs',
  standalone: true,
  imports: [
    TableModule,
    NgIf,
    DatePipe,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {

  protected displayLog: DisplayRef[] = []; // Commits ready for display
  protected refs: string[] = [];
  protected branches: ReadonlyArray<Branch> = [];
  protected readonly removeDuplicates = removeDuplicates;

  @Input() set gitRepository(gitRepository: GitRepository) {

    // TODO: order branches before doing all the rest
    this.branches = gitRepository.branches
    // .sort(branch => branch == gitRepository.currentBranch ? -1 : 0);

    this.refs = [...new Set(gitRepository.logs.map(c => c.ref))];

    if (!gitRepository.logs.length || !gitRepository.stashes?.length)
      return;

    const displayCommits = gitRepository.logs.map(this.toDisplayRef);

    const displayStashes = gitRepository.stashes.map(s => this.stashToDisplayRef(s, displayCommits)) // Append stashes to log, removes ref since stashes never belongs to branches.

    this.displayLog = [...displayCommits, ...displayStashes].sort(byLogObjectDate);
    // this.commits = uniqBy(gitRepository.refs, 'sha').map(this.toDisplayCommit);

  }

  /**
   * Read commits bottom to top and style them (indentation & connections)
   */
  protected toDisplayRef = (commit: Commit, i: number, logs: readonly Commit[]): DisplayRef => {
    const nextRef = (i == logs.length - 1) ? undefined : logs[i + 1];
    const refIndex = this.getRefIndex(commit.ref);

    // Branches pointing to this commit (if any)
    const commitBranches = this.findCommitBranches(commit.branches)

    return {
      ...commit,
      pointedByHead: true,
      refType: RefType.COMMIT,
      // Fix stash commit date not being at the real stash date.
      // committer: refType == RefType.STASH ? this.findStash(commit.sha)!.committer : commit.committer,
      branchDetails: commitBranches.length ? {
        // This commit is pointed by origin branch (starts with origin/). Shows the [github] icon
        remote: !!commitBranches.find(b => b.name.includes('origin/')), // TODO: do it in view if short enough
        // This commit is pointed by a local branch. Shows the 💻 icon
        local: !!commitBranches.find(b => !b.name.includes('origin/')),
        // This commit is pointed by HEAD, preselect the commit line, and add the 💻 icon
        isPointedByLocalHead: !!commitBranches.find(b => !b.name.includes('origin/') && b.isHeadPointed),
        branches: commitBranches,
      } : undefined,
      bars: {
        color: refIndex, // TODO: make better palette
        bottom: i != 0,
        indent: refIndex, // e.g branch 0 => 0 indent, etc ...
        top: !!nextRef
      },
    };
  }


// private updateCommitsTree(currentCommit: ReadCommitResult, commitIndex: number) {
  //   // Init columns
  //   if (commitIndex == 0) {
  //     this.commmitTree = [[currentCommit]];
  //     return 0; // Column 0
  //   }
  //
  //   for (let column = 0; column < this.commmitTree.length; column++) {
  //     // If our current commit is the children of one of the tree columns, we add it to this column and return column index
  //     if (currentCommit.commit.parent.includes(this.commmitTree[column].at(-1)!.oid)) {
  //       this.commmitTree[column].push(currentCommit);
  //       console.logs(column, currentCommit.commit.message, currentCommit.oid, currentCommit.commit.parent);
  //       return column;
  //     }
  //   }
  //
  //   // Start new column
  //   this.commmitTree.push([currentCommit]);
  //   console.logs(this.commmitTree.length - 1, currentCommit.commit.message);
  //   return this.commmitTree.length - 1;
  // }

  protected readonly $displayCommit = (c: DisplayRef) => c

  protected notZero = (i: number) => i == 0 ? 1 : i;

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected isPointedByHead = (d: DisplayRef) => d.branchDetails?.isPointedByLocalHead;

  // FIXME
  private getRefIndex = (objectRef: string) =>
    this.refs.indexOf(objectRef.replace('origin/', '').replace('origin/HEAD', 'main'));

  private stashToDisplayRef = (s: Stash, displayCommits: DisplayRef[]): DisplayRef => {

    const parentCommit = displayCommits.find(c => s.parentSHAs.includes(c.sha)) ?? throwEx(`Couldn't find stash (${s.parentSHAs}) parent(s)`)

    return {
      ...s,
      refType: RefType.STASH,
      pointedByHead: false,
      ref: '', // TODO: remove this line and keep stash ref (do not display it)
      branchDetails: {
        branches: [],
        isPointedByLocalHead: false,
        local: false,
        remote: false
      },
      bars: {
        top: false,
        bottom: false,
        indent: parentCommit.bars.indent,// same as his parent commit
        color: parentCommit.bars.color,
      }
    }
  }

  private findCommitBranches = (branches: string): Branch[] =>
    branches
      .split(',')
      .map(s => s.trim())
      .map(branch => {
        if (branch.includes('origin/HEAD')) // Commit is pointed by remote head (usually origin/main)
          return this.branches.find(b => b.type == BranchType.Remote && b.isHeadPointed);
        else if (branch.includes('HEAD -> ')) // This commit is pointed by local HEAD, git tells which branch is pointed at. e.g: (HEAD -> branchPointedAt)
          return this.branches.find(byName(branch.replace('HEAD -> ', '')))

        return this.branches.find(byName(branch));
      })
      .filter(removeUndefined)
      .filter(removeDuplicates)
}
