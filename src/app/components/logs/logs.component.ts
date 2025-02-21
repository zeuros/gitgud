import {Component, Input} from '@angular/core';
import {GitRepository} from '../../models/git-repository';
import {TableModule} from 'primeng/table';
import {DatePipe, NgIf} from '@angular/common';
import {Commit} from '../../models/commit';
import {RefType} from '../../enums/ref-type.enum';
import {removeDuplicates, removeUndefined, throwEx} from '../../utils/utils';
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
  protected branches: ReadonlyArray<Branch> = []; // Local and distant branches
  protected readonly removeDuplicates = removeDuplicates;

  @Input() set gitRepository(gitRepository: GitRepository) {

    if (!gitRepository.logs.length) return;

    // Sort branches by last commit date put on it => first branch is the one pointing to the last commit in date
    // fixme: sorting takes 30ms for small repo
    this.branches = [...gitRepository.branches].sort((b1, b2) => gitRepository.logs.findIndex(c => c.sha == b1.tip.sha) > gitRepository.logs.findIndex(c => c.sha == b2.tip.sha) ? 1 : -1)

    this.displayLog = this.prepareDisplayLog(gitRepository.logs, gitRepository.stashes);

  }

  protected readonly $displayCommit = (c: DisplayRef) => c

  protected notZero = (i: number) => i == 0 ? 1 : i;

  protected branchName = (b: Branch) => b.name.replace('origin/', '');

  protected isPointedByHead = (d: DisplayRef) => d.branchDetails?.isPointedByLocalHead;

  /**
   * Read commits top to bottom and style them (indentation & connections)
   * TODO: Create a matrix with the drawn commits, links between them, etc...
   */
  private commitToDisplayRef = (commit: Commit): DisplayRef => {
    // Find branches pointing to this commit
    const commitBranches = this.findCommitBranches(commit.branches)

    // get raw ref related to our commit (the branch it has been committed with) and match corresponding local branch
    const computedRef = this.findLocalRef(commit.ref);

    const refIndex = this.refs.indexOf(computedRef) >= 0 ? this.refs.indexOf(computedRef) : (this.refs.push(computedRef) - 1);

    // If the commit has no parentSha => It is a tree root commit ! => It means that the next commits belong to another tree.
    // In order to indent commits for this new tree, we clear the saved commits refs and restart commits indentation
    if (commit.parentSHAs.length == 0) this.refs = [];

    return {
      ...commit,
      pointedByHead: true,
      refType: RefType.COMMIT,
      // Fix stash commit date not being at the real stash date.
      // committer: refType == RefType.STASH ? this.findStash(commit.sha)!.committer : commit.committer,
      branchDetails: commitBranches.length ? {
        // This commit is pointed by origin branch (starts with origin/). Shows the [gitHub] icon
        remote: !!commitBranches.find(b => b.name.includes('origin/')), // TODO: do it in view if short enough
        // This commit is pointed by a local branch. Shows the 💻 icon
        local: !!commitBranches.find(b => !b.name.includes('origin/')),
        // This commit is pointed by HEAD, preselect the commit line, and add the 💻 icon
        isPointedByLocalHead: !!commitBranches.find(b => !b.name.includes('origin/') && b.isHeadPointed),
        branches: commitBranches,
      } : undefined,
      style: {
        indent: refIndex, // e.g branch 0 => 0 indent, etc ...
      },
    };
  }

  private prepareDisplayLog = (logs: ReadonlyArray<Commit>, stashes: ReadonlyArray<Commit>) => {

    const displayCommits = logs.map(this.commitToDisplayRef);

    const displayStashes = stashes.map(s => this.stashToDisplayRef(s, displayCommits)) // Append stashes to log, removes ref since stashes never belongs to branches.

    return this.insertStashesIntoLog(displayCommits, displayStashes);

  }

  private stashToDisplayRef = (s: Stash, displayCommits: DisplayRef[]): DisplayRef => {

    const parentCommit = displayCommits.find(c => s.parentSHAs.includes(c.sha)) ?? throwEx(`Couldn't find stash (${s.summary}) parent(s) (${s.parentSHAs})`)

    return {
      ...s,
      refType: RefType.STASH,
      pointedByHead: false,
      ref: '',
      branchDetails: {
        branches: [],
        isPointedByLocalHead: false,
        local: false,
        remote: false
      },
      style: {
        indent: parentCommit.style.indent,// same as his parent commit
      }
    }
  }

  /**
   * @param commitBranches Branch objects pointing to this commit
   */
  private findCommitBranches = (commitBranches: string): Branch[] =>
    commitBranches
      .split(', ')
      .map(this.findBranchByRef)
      .filter(removeUndefined)
      .filter(removeDuplicates)

  private insertStashesIntoLog = (displayCommits: DisplayRef[], stashes: DisplayRef[]) => {
    const stashByParentSha: { [sha: string]: DisplayRef } = {}; // { [sha]: stash0, [sha1]: stash0, [sha3]: stash1 ...}

    stashes.forEach((stash) =>
      stash.parentSHAs.forEach(stashSha =>
        stashByParentSha[stashSha] = stash
      )
    );

    let i = displayCommits.length;
    while (i--) {
      if (stashByParentSha[displayCommits[i].sha]) // Found stash parent
        displayCommits.splice(i, 0, stashByParentSha[displayCommits[i].sha]);
    }

    return displayCommits;
  }

  private findBranchByRef = (branchRef: string) => {
    if (branchRef.includes('origin/HEAD')) // Commit is pointed by remote head (usually origin/main)
      return this.branches.find(b => b.type == BranchType.Remote && b.isHeadPointed);
    else if (branchRef.includes('HEAD -> ')) // This commit is pointed by local HEAD, git tells which branch is pointed at. e.g: (HEAD -> branchPointedAt)
      return this.branches.find(byName(branchRef.replace('HEAD -> ', '')))

    return this.branches.find(byName(branchRef));
  }

  // For a given ref (thing, origin/thing, HEAD), finds the corresponding local branch if available
  private findLocalRef = (ref: string) => {
    ref = this.followHeadPointer(ref);

    // We merge the ref to remote branch, returns the local equivalent if available
    if (ref.includes('origin/'))
      return this.branches.find(byName(ref.replace('origin/', '')))?.name ?? ref.replace('origin/', '');

    // Else it's a local ref, or a ref of a disappeared branch
    return ref;
  }

  private followHeadPointer = (ref: string) => {
    if (ref.includes('origin/HEAD')) // Follow HEAD pointer to the actual remote branch
      return this.branches.find(b => b.type == BranchType.Remote && b.isHeadPointed)?.name ?? ref;
    else if (ref.includes('HEAD -> ')) // This commit is pointed by local HEAD, git tells which branch is pointed at. e.g: (HEAD -> branchPointedAt)
      return this.branches.find(byName(ref.replace('HEAD -> ', '')))?.name ?? ref
    else if (ref == 'HEAD')
      return this.branches.find(b => b.type == BranchType.Local && b.isHeadPointed)?.name ?? ref;

    return ref;
  }
}
